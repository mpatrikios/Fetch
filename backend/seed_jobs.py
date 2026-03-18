"""
Seed script: pick 100 random rows from executive_job_postings.csv,
insert them into JobDescriptions with blob storage + embeddings,
and upsert one Clients document per unique company.

Run from backend/:
    python seed_jobs.py
"""

import os
import re
import sys
import time
import random
from datetime import datetime, timezone
from pathlib import Path

import json
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI
from pymongo import MongoClient
from bson import ObjectId
from azure.storage.blob import BlobServiceClient, ContentSettings

load_dotenv()

# Make src/ importable
sys.path.insert(0, str(Path(__file__).parent))

from src.database.insert_to_mongo import insert_job_description
from src.services.embeddings.generate_embeddings import (
    embed_job_description_profile,
    embed_job_description_location,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CSV_PATH = Path("testing_jobs/executive_job_postings.csv")
SAMPLE_SIZE = 100

# ---------------------------------------------------------------------------
# Azure OpenAI client for chat (uses the explanation endpoint, same as cosine_similarity.py)
# ---------------------------------------------------------------------------
_openai_client = None
_chat_api_key = os.getenv("AZURE_OPENAI_API_KEY")
_chat_base_url = os.getenv("AZURE_OPENAI_EXPLANATION_BASE_URL")
if _chat_api_key and _chat_base_url:
    _openai_client = OpenAI(api_key=_chat_api_key, base_url=_chat_base_url)

EXTRACTION_PROMPT = """\
You are a job description parser. Given the job description below, extract and return a JSON object with exactly these keys:
- "Skills": array of specific skills mentioned or implied (e.g. ["Python", "Budget management"])
- "Responsibilities": array of key responsibilities (short phrases)
- "Qualifications": array of required qualifications (short phrases)

Return only valid JSON, no markdown, no explanation.

Job description:
{description}
"""

def extract_structured_fields(description: str) -> dict:
    """Use Azure OpenAI to extract Skills, Responsibilities, Qualifications from description text."""
    if not _openai_client or not description:
        return {"Skills": [], "Responsibilities": [], "Qualifications": []}
    try:
        response = _openai_client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_MATCH_EXPLAIN_MODEL", "Explanation-LLM"),
            messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(description=description)}],
            temperature=0,
            max_tokens=800,
        )
        time.sleep(1)  # respect rate limits
        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)
        return {
            "Skills":          parsed.get("Skills", []),
            "Responsibilities": parsed.get("Responsibilities", []),
            "Qualifications":  parsed.get("Qualifications", []),
        }
    except Exception as e:
        print(f"    [warn] extraction failed: {e}")
        return {"Skills": [], "Responsibilities": [], "Qualifications": []}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_name(text: str) -> str:
    """Collapse whitespace and replace non-alphanumeric chars with underscores."""
    return re.sub(r"[^\w]+", "_", text.strip())[:80]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # -- MongoDB ----------------------------------------------------------------
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        raise RuntimeError("MONGODB_URL environment variable not set")

    client = MongoClient(mongo_url)
    db = client.get_database("FetchTestingDB")
    jobs_col = db["JobDescriptions"]
    clients_col = db["Clients"]

    # -- Azure Blob -------------------------------------------------------------
    az_conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not az_conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING environment variable not set")

    container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "fetch-documents")
    blob_service = BlobServiceClient.from_connection_string(az_conn_str)
    container_client = blob_service.get_container_client(container_name)

    # -- CSV --------------------------------------------------------------------
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=["company", "title"])
    sample = df.sample(min(SAMPLE_SIZE, len(df)), random_state=random.randint(0, 9999))
    print(f"Sampled {len(sample)} rows from {CSV_PATH}\n")

    ok_count = 0
    fail_count = 0

    for _, row in sample.iterrows():
        company = str(row["company"]).strip()
        title = str(row["title"]).strip()
        description = str(row["description"]) if pd.notna(row.get("description")) else ""
        location = str(row["location"]).strip() if pd.notna(row.get("location")) else ""

        structured = extract_structured_fields(description)
        job_doc = {
            "companyName": company,
            "JobTitle": title,
            "Summary": description,
            "Locations": [location] if location else [],
            "Skills": structured["Skills"],
            "Responsibilities": structured["Responsibilities"],
            "Qualifications": structured["Qualifications"],
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            # 1. Insert into MongoDB
            result = insert_job_description(job_doc)
            if not result.get("success"):
                print(f"  FAIL (insert) {company} – {title}: {result.get('error')}")
                fail_count += 1
                continue

            document_id = result["document_id"]

            # 2. Upload .txt to Azure Blob Storage
            filename = f"{safe_name(company)}_{safe_name(title)}.txt"
            blob_path = f"job-descriptions/{document_id}/{filename}"
            txt_content = f"{title}\n{company}\n{location}\n\n{description}"

            blob_client = container_client.get_blob_client(blob_path)
            blob_client.upload_blob(
                txt_content.encode("utf-8"),
                overwrite=True,
                content_settings=ContentSettings(content_type="text/plain"),
            )
            blob_url = blob_client.url

            jobs_col.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "description_blob_path": blob_path,
                    "description_blob_url": blob_url,
                    "description_filename": filename,
                }},
            )

            # 3. Generate embeddings (functions fetch the doc themselves)
            full_doc = jobs_col.find_one({"_id": ObjectId(document_id)})
            embed_job_description_profile(full_doc)
            embed_job_description_location(full_doc)

            print(f"  OK  {company} – {title}")
            ok_count += 1

        except Exception as exc:
            print(f"  FAIL {company} – {title}: {exc}")
            fail_count += 1

    print(f"\nJobs: {ok_count} OK, {fail_count} FAIL out of {len(sample)}")

    # -- Clients ----------------------------------------------------------------
    unique_companies = [
        str(c).strip() for c in sample["company"].dropna().unique()
    ]
    client_ok = 0
    for company in unique_companies:
        result = clients_col.update_one(
            {"companyName": company},
            {"$setOnInsert": {
                "companyName": company,
                "status": "active",
                "created_at": datetime.now(timezone.utc),
                "postedJobs": [],
            }},
            upsert=True,
        )
        if result.upserted_id:
            client_ok += 1

    print(f"Clients: {client_ok} new upserted ({len(unique_companies)} unique companies in sample)")


if __name__ == "__main__":
    main()
