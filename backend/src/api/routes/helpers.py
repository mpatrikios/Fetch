# Shared helper functions for route handlers
from typing import Optional
from fastapi import HTTPException
from bson import ObjectId

from src.database.connection import mongo_connection


def get_candidate_or_404(
    candidate_id: str,
    required_field: Optional[str] = None,
    missing_msg: Optional[str] = None,
) -> dict:
    """
    Look up a candidate by ID. Raises 404 if not found.
    Optionally checks for a required field and raises 404 if missing.
    """
    candidate = mongo_connection.candidates_collection.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if required_field and not candidate.get(required_field):
        raise HTTPException(status_code=404, detail=missing_msg or f"{required_field} not found")
    return candidate


def get_job_or_404(
    job_id: str,
    required_field: Optional[str] = None,
    missing_msg: Optional[str] = None,
) -> dict:
    """
    Look up a job description by ID. Raises 404 if not found.
    Optionally checks for a required field and raises 404 if missing.
    """
    job = mongo_connection.job_descriptions_collection.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if required_field and not job.get(required_field):
        raise HTTPException(status_code=404, detail=missing_msg or f"{required_field} not found")
    return job
