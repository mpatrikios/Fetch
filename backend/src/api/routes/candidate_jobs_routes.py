"""
Routes for managing job recommendations pushed by MLG recruiters to candidates,
and candidate self-service endpoints to express interest and view applications.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
import logging

from src.api.utils import validate_object_id

from src.database.connection import mongo_connection
from src.api.routes.auth_routes import get_current_user
from src.api.auth_utils import get_current_mlg_recruiter

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_STATUSES = {"recommended", "pending", "interview", "accepted", "rejected"}
RECRUITER_UPDATABLE_STATUSES = {"pending", "interview", "accepted", "rejected"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RecommendJobRequest(BaseModel):
    job_mongo_id: str
    company_name: str
    job_title: str
    job_location: Optional[str] = ""
    skills: List[str] = []


class UpdateStatusRequest(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_doc(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-serializable dict."""
    doc["_id"] = str(doc["_id"])
    return doc


# ---------------------------------------------------------------------------
# Recruiter endpoints
# ---------------------------------------------------------------------------

@router.post("/candidates/{candidate_id}/recommend-job")
async def recommend_job(
    candidate_id: str,
    body: RecommendJobRequest,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """
    Recruiter pushes a job recommendation to a specific candidate.
    Returns 409 if the same candidate+job pair already exists.
    """
    validate_object_id(candidate_id)
    collection = mongo_connection.candidate_jobs_collection

    # Duplicate check
    existing = collection.find_one({
        "candidate_id": candidate_id,
        "job_mongo_id": body.job_mongo_id,
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This job has already been recommended to this candidate."
        )

    doc = {
        "candidate_id": candidate_id,
        "job_mongo_id": body.job_mongo_id,
        "company_name": body.company_name,
        "job_title": body.job_title,
        "job_location": body.job_location or "",
        "skills": body.skills,
        "recommended_at": datetime.now(timezone.utc),
        "recommended_by": current_user.get("email", ""),
        "status": "recommended",
        "interest_expressed_at": None,
    }

    result = collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    logger.info(
        f"Recruiter {current_user.get('email')} recommended job {body.job_mongo_id} "
        f"to candidate {candidate_id}"
    )

    return {"success": True, "recommendation": doc}


@router.delete("/candidates/{candidate_id}/recommendations/{rec_id}")
async def remove_recommendation(
    candidate_id: str,
    rec_id: str,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """Remove a job recommendation for a candidate."""
    validate_object_id(candidate_id)
    collection = mongo_connection.candidate_jobs_collection

    try:
        object_id = ObjectId(rec_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid recommendation ID")

    result = collection.delete_one({
        "_id": object_id,
        "candidate_id": candidate_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    logger.info(f"Recruiter {current_user.get('email')} removed recommendation {rec_id}")
    return {"success": True, "message": "Recommendation removed"}


@router.get("/jobs/{company_name}/{job_title}/recommendations")
async def get_job_recommendations(
    company_name: str,
    job_title: str,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """
    Return all recommendations for a specific job (by recruiter).
    Used to populate button state on the JobRecommendations page.
    """
    job_mongo_id = f"{company_name}_{job_title}"
    collection = mongo_connection.candidate_jobs_collection
    docs = list(collection.find(
        {"job_mongo_id": job_mongo_id},
        {"_id": 1, "candidate_id": 1}
    ))
    entries = [{"rec_id": str(d["_id"]), "candidate_id": d["candidate_id"]} for d in docs]
    return {"success": True, "recommendations": entries}


@router.put("/candidates/{candidate_id}/recommendations/{rec_id}/status")
async def update_recommendation_status(
    candidate_id: str,
    rec_id: str,
    body: UpdateStatusRequest,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """Update the pipeline status of a recommendation (recruiter only)."""
    validate_object_id(candidate_id)
    if body.status not in RECRUITER_UPDATABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(RECRUITER_UPDATABLE_STATUSES))}"
        )

    collection = mongo_connection.candidate_jobs_collection

    try:
        object_id = ObjectId(rec_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid recommendation ID")

    result = collection.update_one(
        {"_id": object_id, "candidate_id": candidate_id},
        {"$set": {"status": body.status}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    logger.info(
        f"Recruiter {current_user.get('email')} updated recommendation {rec_id} "
        f"status to {body.status}"
    )
    return {"success": True, "status": body.status}


# ---------------------------------------------------------------------------
# Candidate endpoints
# ---------------------------------------------------------------------------

@router.get("/profile/recommendations")
async def get_my_recommendations(
    current_user: Dict = Depends(get_current_user),
):
    """
    Return all jobs with status='recommended' for the current candidate.
    These are jobs an MLG recruiter has pushed but the candidate hasn't acted on yet.
    """
    candidate_id = current_user["_id"]
    collection = mongo_connection.candidate_jobs_collection

    docs = list(collection.find({
        "candidate_id": candidate_id,
        "status": "recommended",
    }))

    recommendations = [_serialize_doc(d) for d in docs]
    return {"success": True, "recommendations": recommendations}


@router.post("/profile/recommendations/{rec_id}/apply")
async def express_interest(
    rec_id: str,
    current_user: Dict = Depends(get_current_user),
):
    """
    Candidate expresses interest in a recommended job.
    Moves status from 'recommended' -> 'pending'.
    """
    candidate_id = current_user["_id"]
    collection = mongo_connection.candidate_jobs_collection

    try:
        object_id = ObjectId(rec_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid recommendation ID")

    result = collection.update_one(
        {
            "_id": object_id,
            "candidate_id": candidate_id,
            "status": "recommended",
        },
        {
            "$set": {
                "status": "pending",
                "interest_expressed_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Recommendation not found or already actioned"
        )

    logger.info(f"Candidate {current_user.get('email')} expressed interest in recommendation {rec_id}")
    return {"success": True, "message": "Interest expressed successfully"}


@router.delete("/profile/recommendations/{rec_id}/withdraw")
async def withdraw_application(
    rec_id: str,
    current_user: Dict = Depends(get_current_user),
):
    """
    Candidate withdraws expressed interest in a job.
    Deletes the recommendation document entirely.
    """
    candidate_id = current_user["_id"]
    collection = mongo_connection.candidate_jobs_collection

    try:
        object_id = ObjectId(rec_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid recommendation ID")

    result = collection.delete_one({
        "_id": object_id,
        "candidate_id": candidate_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")

    logger.info(f"Candidate {current_user.get('email')} withdrew application {rec_id}")
    return {"success": True, "message": "Application withdrawn"}


@router.get("/profile/applications")
async def get_my_applications(
    current_user: Dict = Depends(get_current_user),
):
    """
    Return all jobs where the candidate has expressed interest (status != 'recommended').
    These appear in the candidate's Applied Jobs section.
    """
    candidate_id = current_user["_id"]
    collection = mongo_connection.candidate_jobs_collection

    docs = list(collection.find({
        "candidate_id": candidate_id,
        "status": {"$ne": "recommended"},
    }))

    applications = [_serialize_doc(d) for d in docs]
    return {"success": True, "applications": applications}
