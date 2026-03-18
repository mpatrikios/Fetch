"""
Backfill script: randomly assign 5 CliftonStrengths to every job in
JobDescriptions that doesn't already have them, then generate culture embeddings.

Run from backend/:
    python seed_job_culture.py
"""

import os
import sys
import random
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))

from src.services.embeddings.generate_embeddings import embed_job_description_culture

CLIFTON_THEMES = [
    "Achiever", "Activator", "Adaptability", "Analytical", "Arranger",
    "Belief", "Command", "Communication", "Competition", "Connectedness",
    "Consistency", "Context", "Deliberative", "Developer", "Discipline",
    "Empathy", "Focus", "Futuristic", "Harmony", "Ideation",
    "Includer", "Individualization", "Input", "Intellection", "Learner",
    "Maximizer", "Positivity", "Relator", "Responsibility", "Restorative",
    "Self-Assurance", "Significance", "Strategic", "Woo",
]


def main():
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        raise RuntimeError("MONGODB_URL environment variable not set")

    db = MongoClient(mongo_url)["FetchTestingDB"]
    jobs_col = db["JobDescriptions"]

    jobs = list(jobs_col.find({"culture_embedding": {"$exists": False}}))
    print(f"Found {len(jobs)} jobs without culture embeddings\n")

    ok, fail = 0, 0
    for job in jobs:
        try:
            strengths = [{"name": s} for s in random.sample(CLIFTON_THEMES, 5)]
            jobs_col.update_one(
                {"_id": job["_id"]},
                {"$set": {"clifton_strengths": strengths}},
            )
            job["clifton_strengths"] = strengths
            embed_job_description_culture(job)
            print(f"  OK  {job.get('companyName')} – {job.get('JobTitle')}  →  {', '.join(s['name'] for s in strengths)}")
            ok += 1
        except Exception as exc:
            print(f"  FAIL  {job.get('companyName')} – {job.get('JobTitle')}  →  {exc}")
            fail += 1

    print(f"\nDone. {ok} OK, {fail} FAIL out of {len(jobs)} jobs.")


if __name__ == "__main__":
    main()
