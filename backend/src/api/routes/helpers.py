# Shared helper functions for route handlers
from typing import List, Optional
import logging
from fastapi import HTTPException
from bson import ObjectId

from src.database.connection import mongo_connection
from src.api.models import MatchResult
from src.services.storage.blob_storage import get_blob_storage

logger = logging.getLogger(__name__)


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


def extract_clifton_names(strengths: list) -> list:
    """Extract strength name strings from a mixed list of dicts or strings."""
    names = []
    for s in strengths:
        if isinstance(s, dict) and "name" in s:
            names.append(s["name"])
        elif isinstance(s, str):
            names.append(s)
    return names


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


def ensure_updated(result, entity_name: str = "Document") -> None:
    """Raise 404 if a MongoDB update matched no documents."""
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"{entity_name} not found")


def delete_document_blobs(doc: dict, blob_fields: List[str], entity_id: str) -> None:
    """Delete Azure blobs referenced by the given fields on a MongoDB document. Logs warnings on failure."""
    blob_storage = get_blob_storage()
    for field in blob_fields:
        blob_path = doc.get(field)
        if blob_path:
            try:
                blob_storage.delete_blob(blob_path)
            except Exception as e:
                logger.warning(f"Blob delete failed for {entity_id} ({field}): {e}")


def pending_candidates_filter() -> dict:
    """Excludes rejected and accepted candidates (pending workflow state)."""
    return {"$or": [
        {"status": {"$nin": ["rejected", "accepted"]}},
        {"status": {"$exists": False}},
        {"status": None}
    ]}


def non_rejected_candidates_filter() -> dict:
    """Excludes only explicitly rejected candidates (includes accepted)."""
    return {"$or": [
        {"status": {"$ne": "rejected"}},
        {"status": {"$exists": False}},
        {"status": None}
    ]}


def anonymize_candidate_in_matches(candidate_id: str) -> None:
    """Anonymize PII for a deleted candidate across all historical match documents."""
    mongo_connection.matches_collection.update_many(
        {"candidates.candidate_id": candidate_id},
        {"$set": {
            "candidates.$[elem].full_name": "[DELETED]",
            "candidates.$[elem].email": None,
            "candidates.$[elem].location": None,
            "candidates.$[elem].summary": None,
            "candidates.$[elem].skills": [],
            "candidates.$[elem].clifton_strengths": [],
            "candidates.$[elem].explanation.relevant_experience": [],
            "candidates.$[elem].explanation.candidate_companies": [],
            "candidates.$[elem].explanation.relevant_roles": [],
        }},
        array_filters=[{"elem.candidate_id": candidate_id}]
    )


def build_match_result_from_candidate(c: dict, live_candidate: Optional[dict] = None) -> MatchResult:
    """Build a MatchResult Pydantic model from a stored match candidate dict.

    Args:
        c: Stored candidate entry from the Matches collection.
        live_candidate: Optional live document from Candidates — used to freshen
            profile fields (skills, location) that may have been empty at match time.
    """
    explanation_data = c.get("explanation") or {}
    relevant_experience = [
        {"role": e.get("role", ""), "company": e.get("company")}
        for e in (explanation_data.get("relevant_experience") or [])
        if e is not None
    ]
    # Prefer live candidate data for profile fields that could have changed since
    # the match was generated (e.g. after a resume backfill).
    live = live_candidate or {}
    skills = live.get("Skills") or c.get("skills") or []
    location = live.get("Location") or c.get("location")
    summary = live.get("Summary") or c.get("summary")

    return MatchResult(
        candidate_id=c.get("candidate_id"),
        rank=c.get("rank"),
        full_name=c.get("full_name", "Unknown"),
        email=c.get("email"),
        location=location,
        distance_km=c.get("distance_km"),
        summary=summary,
        scores=c.get("scores"),
        explanation={
            "keyword_overlap": explanation_data.get("keyword_overlap") or [],
            "skill_overlap": explanation_data.get("skill_overlap") or [],
            "relevant_roles": explanation_data.get("relevant_roles") or [],
            "relevant_experience": relevant_experience,
            "candidate_companies": explanation_data.get("candidate_companies") or [],
            "summary": explanation_data.get("summary") or "No summary available",
        },
        clifton_strengths=c.get("clifton_strengths") or [],
        skills=skills[:10],
        review_status=c.get("review_status"),
        reviewed_at=c.get("reviewed_at"),
        reviewed_by=c.get("reviewed_by"),
    )
