"""
Backfill script: re-parse resumes for accepted candidates that have empty Skills or Experience,
using the text-based fallback parser. Downloads each .docx from Azure Blob Storage,
runs fallback_parse, upserts the result, then re-generates the profile embedding.

Run from backend/:
    python backfill_resume_parsing.py

Optional flags:
    --dry-run   Print what would be changed without writing to MongoDB
    --limit N   Process at most N candidates (default: all)
"""

import os
import sys
import tempfile
import argparse
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from azure.storage.blob import BlobServiceClient

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

from src.services.document_processing.fallback_resume_parser import fallback_parse
from src.services.embeddings.generate_embeddings import embed_candidate_profile


def has_real_skills(cand: dict) -> bool:
    return any(s for s in (cand.get("Skills") or []))


def has_real_experience(cand: dict) -> bool:
    return any(e.get("role") for e in (cand.get("Experience") or []))


def needs_backfill(cand: dict) -> bool:
    """Return True if this candidate is missing meaningful Skills or Experience."""
    return not has_real_skills(cand) or not has_real_experience(cand)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    parser.add_argument("--limit", type=int, default=0, help="Max candidates to process (0 = all)")
    args = parser.parse_args()

    # -- MongoDB ----------------------------------------------------------------
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        raise RuntimeError("MONGODB_URL environment variable not set")
    db = MongoClient(mongo_url)["FetchTestingDB"]
    candidates_col = db["Candidates"]

    # -- Azure Blob -------------------------------------------------------------
    az_conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not az_conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING environment variable not set")
    container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "fetch-documents")
    blob_service = BlobServiceClient.from_connection_string(az_conn_str)
    container_client = blob_service.get_container_client(container_name)

    # -- Find candidates --------------------------------------------------------
    query = {
        "status": "accepted",
        "resume_blob_path": {"$exists": True, "$ne": None},
        "$or": [
            {"Skills": {"$exists": False}},
            {"Skills": []},
            {"Skills": None},
            {"Experience": {"$exists": False}},
            {"Experience": []},
            {"Experience": None},
        ],
    }
    cursor = candidates_col.find(query)
    candidates = list(cursor)
    if args.limit:
        candidates = candidates[: args.limit]

    print(f"Found {len(candidates)} candidates to backfill\n")

    ok, skipped, failed = 0, 0, 0

    for cand in candidates:
        cid = str(cand["_id"])
        name = cand.get("full_name", cid)
        blob_path = cand.get("resume_blob_path")

        if not blob_path:
            print(f"  SKIP  {name} — no resume_blob_path")
            skipped += 1
            continue

        # Determine file extension from blob path
        ext = Path(blob_path).suffix.lower()
        if ext not in (".docx", ".pdf", ".doc"):
            print(f"  SKIP  {name} — unsupported extension '{ext}'")
            skipped += 1
            continue

        try:
            # Download blob to a temp file
            blob_client = container_client.get_blob_client(blob_path)
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp_path = tmp.name
                download_stream = blob_client.download_blob()
                tmp.write(download_stream.readall())

            # Run fallback parser
            fallback_data = fallback_parse(tmp_path)
            os.unlink(tmp_path)

            if not fallback_data:
                print(f"  SKIP  {name} — fallback parser returned nothing")
                skipped += 1
                continue

            # Build the update — only fill fields that lack real content
            update_fields = {}
            field_has_content = {
                "Skills":     has_real_skills(cand),
                "Experience": has_real_experience(cand),
                "Companies":  any(c.get("companyName") for c in (cand.get("Companies") or [])),
                "Location":   bool(cand.get("Location")),
                "Summary":    bool(cand.get("Summary")),
            }
            for field in ("Skills", "Experience", "Companies", "Location", "Summary"):
                if not field_has_content[field] and fallback_data.get(field):
                    update_fields[field] = fallback_data[field]

            if not update_fields:
                print(f"  SKIP  {name} — nothing new extracted")
                skipped += 1
                continue

            filled = list(update_fields.keys())
            if args.dry_run:
                print(f"  DRY   {name} — would fill: {filled}")
                ok += 1
                continue

            # Write to MongoDB
            candidates_col.update_one(
                {"_id": cand["_id"]},
                {"$set": {**update_fields, "resume_backfilled_at": datetime.now(timezone.utc).isoformat()}},
            )

            # Re-fetch and re-embed profile
            updated_doc = candidates_col.find_one({"_id": cand["_id"]})
            if updated_doc:
                embed_candidate_profile(updated_doc)

            print(f"  OK    {name} — filled: {filled}")
            ok += 1

        except Exception as exc:
            print(f"  FAIL  {name} — {exc}")
            failed += 1

    print(f"\nDone. {ok} updated, {skipped} skipped, {failed} failed out of {len(candidates)} candidates.")


if __name__ == "__main__":
    main()
