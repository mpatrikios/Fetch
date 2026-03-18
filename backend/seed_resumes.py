"""
Seed script: upload all .docx resumes from src/testing_resumes/, create one
candidate per file with 5 random CliftonStrengths, parse the resume via Azure,
generate all embeddings, and set status to 'accepted'.

Run from backend/:
    python seed_resumes.py
"""

import os
import re
import sys
import hashlib
import random
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from azure.storage.blob import BlobServiceClient, ContentSettings

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))

from src.services.document_processing.document_service import DocumentService
from src.services.embeddings.generate_embeddings import embed_candidate_culture

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RESUMES_DIR = Path("src/testing_resumes")
DEFAULT_PASSWORD = "Fetch2025!"
EMAIL_DOMAIN = "test.com"
PASSWORD_SALT = os.getenv("PASSWORD_SALT", "fetch-recruitment-salt")

CLIFTON_THEMES = [
    "Achiever", "Activator", "Adaptability", "Analytical", "Arranger",
    "Belief", "Command", "Communication", "Competition", "Connectedness",
    "Consistency", "Context", "Deliberative", "Developer", "Discipline",
    "Empathy", "Focus", "Futuristic", "Harmony", "Ideation",
    "Includer", "Individualization", "Input", "Intellection", "Learner",
    "Maximizer", "Positivity", "Relator", "Responsibility", "Restorative",
    "Self-Assurance", "Significance", "Strategic", "Woo",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return hashlib.sha256(f"{password}{PASSWORD_SALT}".encode()).hexdigest()


def stem_to_full_name(stem: str) -> str:
    """'01_Clifton_R_Beaumont' -> 'Clifton R Beaumont'"""
    name = re.sub(r"^\d+_", "", stem)
    return name.replace("_", " ").strip()


def stem_to_email(stem: str) -> str:
    name = stem_to_full_name(stem)
    parts = name.lower().split()
    local = ".".join(parts) if parts else stem.lower()
    return f"{local}@{EMAIL_DOMAIN}"


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
    candidates = db["Candidates"]

    # -- Azure Blob -------------------------------------------------------------
    az_conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not az_conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING environment variable not set")

    container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "fetch-documents")
    blob_service = BlobServiceClient.from_connection_string(az_conn_str)
    container_client = blob_service.get_container_client(container_name)

    # -- Files ------------------------------------------------------------------
    docx_files = sorted(RESUMES_DIR.glob("*.docx"))
    if not docx_files:
        print(f"No .docx files found in {RESUMES_DIR}")
        return

    print(f"Found {len(docx_files)} .docx files\n")

    ok_count = 0
    fail_count = 0

    for docx_path in docx_files:
        stem = docx_path.stem
        filename = docx_path.name
        full_name = stem_to_full_name(stem)
        email = stem_to_email(stem)

        try:
            # 1. Insert candidate document
            strengths = [{"name": s} for s in random.sample(CLIFTON_THEMES, 5)]
            doc = {
                "full_name": full_name,
                "email": email,
                "password": hash_password(DEFAULT_PASSWORD),
                "role": "user",
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc),
                "clifton_strengths": strengths,
                "clifton_strengths_updated_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc),
            }
            result = candidates.insert_one(doc)
            candidate_id = str(result.inserted_id)

            # 2. Upload .docx to Azure Blob Storage
            blob_path = f"resumes/{candidate_id}/{filename}"
            file_bytes = docx_path.read_bytes()

            blob_client = container_client.get_blob_client(blob_path)
            blob_client.upload_blob(
                file_bytes,
                overwrite=True,
                content_settings=ContentSettings(
                    content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ),
            )
            blob_url = blob_client.url

            # 3. Update candidate with resume fields
            candidates.update_one(
                {"_id": result.inserted_id},
                {"$set": {
                    "resume_blob_path": blob_path,
                    "resume_blob_url": blob_url,
                    "resume_filename": filename,
                    "resume_uploaded_at": datetime.now(timezone.utc),
                }},
            )

            # 4. Parse resume and generate profile + location embeddings
            DocumentService.parse_and_embed_resume(candidate_id, str(docx_path), email)

            # 5. Generate culture embedding from Clifton strengths
            full_doc = candidates.find_one({"_id": result.inserted_id})
            embed_candidate_culture(full_doc)

            print(f"  OK  {full_name} ({email})  →  {', '.join(s['name'] for s in strengths)}")
            ok_count += 1

        except Exception as exc:
            print(f"  FAIL  {full_name}  →  {exc}")
            fail_count += 1

    print(f"\nDone. {ok_count} OK, {fail_count} FAIL out of {len(docx_files)} files.")


if __name__ == "__main__":
    main()
