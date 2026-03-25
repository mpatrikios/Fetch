# API routes for matching candidates to job descriptions.
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Optional
import logging
from bson import ObjectId
from bson.errors import InvalidId

from src.database.connection import mongo_connection
from src.database.insert_to_mongo import (
    get_job_description,
    insert_match,
    update_match_review,
    get_match,
    set_job_match_generated,
    get_all_matches,
)
from src.services.matching.cosine_similarity import (
    profile_matching_candidate,
    build_match_doc,
)
from src.api.models import MatchRequest, MatchResponse, MatchResult, MatchHistoryResponse, ReviewUpdateRequest, ReviewUpdateResponse
from src.api.auth_utils import get_current_mlg_recruiter
from src.api.utils import validate_object_id
from src.api.routes.helpers import extract_clifton_names, build_match_result_from_candidate

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])


def _fetch_live_candidates(stored_candidates: list) -> dict:
    """
    Batch-fetch current candidate documents from MongoDB for a list of stored
    match entries.  Returns a dict keyed by candidate_id string.
    """
    ids = []
    for c in stored_candidates:
        cid = c.get("candidate_id")
        if cid:
            try:
                ids.append(ObjectId(cid))
            except Exception:
                pass
    if not ids:
        return {}
    docs = mongo_connection.candidates_collection.find(
        {"_id": {"$in": ids}},
        {"Skills": 1, "Location": 1, "Summary": 1}
    )
    return {str(d["_id"]): d for d in docs}

# API endpoint to find matching candidates for a job description
@router.post("/matches/find", response_model=MatchResponse)
async def find_matches(request: MatchRequest):
    """
    Find matching candidates for a specific job.
    Requires company name and job title.
    """
    try:
        # Retrieve job description
        validate_object_id(request.job_id)
        job_doc = get_job_description(request.job_id)
        if not job_doc:
            raise HTTPException(
                status_code=404, 
                detail=f"Job not found: {request.company_name} - {request.job_title} - {request.job_id}"
            )
        
        # Check if job has embeddings
        if "profile_embedding" not in job_doc:
            raise HTTPException(
                status_code=400,
                detail="Job description does not have embeddings. Please reprocess the job."
            )
        
        # Collect rejected candidate IDs from all prior match runs for this job
        rejected_ids = set()
        prior_matches = mongo_connection.matches_collection.find(
            {"companyName": request.company_name, "JobTitle": request.job_title, "JobId": request.job_id},
            {"candidates.candidate_id": 1, "candidates.review_status": 1}
        )
        for doc in prior_matches:
            for c in doc.get("candidates", []) or []:
                if c and c.get("review_status") == "Rejected":
                    rejected_ids.add(c["candidate_id"])

        # Find matching candidates
        matches = profile_matching_candidate(
            mongo_connection.database,
            job_doc,
            top_k=request.top_k,
            use_cohort=request.use_cohort or False,
            excluded_ids=rejected_ids or None
        )

        # Format results
        formatted_matches = []
        for rank, match in enumerate(matches, 1):
            candidate = match["candidate"]
            
            # Extract Clifton Strengths
            clifton_strengths = extract_clifton_names(candidate.get("clifton_strengths", [])[:5])
            
            # Build formatted match entry
            formatted_match = {
                "candidate_id": str(candidate.get("_id")) if candidate.get("_id") else None,
                "rank": rank if not request.use_cohort else None,
                "full_name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("email", ""),
                "location": candidate.get("location", ""),
                "distance_km": match.get("distance_km"),
                "summary": candidate.get("Summary"),
                "scores": {
                    "combined": round(match["combined_similarity_score"], 3),
                    "profile": round(match["profile_similarity_score"], 3),
                    "culture": round(match["culture_similarity_score"], 3)
                },
                "explanation": {
                    "keyword_overlap": match.get("explanation", {}).get("keyword_overlap", [])[:10],
                    "skill_overlap": match.get("explanation", {}).get("skill_overlap", [])[:15],
                    "relevant_roles": match.get("explanation", {}).get("relevant_roles", [])[:3],
                    "relevant_experience": match.get("explanation", {}).get("relevant_experience", [])[:3],
                    "candidate_companies": match.get("explanation", {}).get("candidate_companies", [])[:3],
                    "summary": match.get("explanation", {}).get("summary", "No summary available")
                },
                "clifton_strengths": clifton_strengths,
                "skills": candidate.get("Skills", [])[:10],
                "review_status": None,
                "reviewed_at": None,
                "reviewed_by": None
            }
            formatted_matches.append(formatted_match)

        match = build_match_doc(job_doc, formatted_matches, use_cohort=request.use_cohort or False)
        mongo_result = insert_match(match)
        if not mongo_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")

        mongo_match_id = mongo_result.get("document_id")
        set_job_match_generated(request.company_name, request.job_title)

        # Return response with matches
        return MatchResponse(
            success=True,
            job_id=f"{request.company_name}_{request.job_title}",
            company_name=request.company_name,
            job_title=request.job_title,
            total_matches=len(formatted_matches),
            matches=formatted_matches,
            is_cohort=request.use_cohort or False,
            mongo_match_id=mongo_match_id,
            created_at=match.get("created_at"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/matches/{match_id}/candidates/{candidate_id}/review", response_model=ReviewUpdateResponse)
async def update_candidate_review(
    match_id: str,
    candidate_id: str,
    request: ReviewUpdateRequest,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """
    Update the review status for a specific candidate within a match document.
    Sets review_status, reviewed_by (current user _id), and reviewed_at (UTC timestamp).
    """
    validate_object_id(match_id)

    result = update_match_review(
        match_id=match_id,
        candidate_id=candidate_id,
        review_status=request.review_status,
        reviewed_by=current_user["_id"],
    )

    if not result.get("success"):
        error_message = result.get("error", "Unknown error")
        error_lower = error_message.lower()
        if "not found" in error_lower:
            status_code = 404
        else:
            status_code = 500
        raise HTTPException(status_code=status_code, detail=error_message)

    return ReviewUpdateResponse(
        success=True,
        message="Review status updated",
        match_id=match_id,
        candidate_id=candidate_id,
        review_status=request.review_status,
        reviewed_by=current_user["_id"],
        reviewed_at=result["reviewed_at"],
    )


@router.get("/matches/stored/{company_name}/{job_title}/{job_id}", response_model=MatchResponse)
async def get_stored_matches(company_name: str, job_title: str, job_id: str):
    """
    Retrieve the most recently saved match list for a job from the database.
    Returns 404 if no matches have been generated yet for this job.
    """
    try:
        validate_object_id(job_id)
        match_doc = get_match(company_name, job_title, job_id)
        if not match_doc:
            raise HTTPException(
                status_code=404,
                detail=f"No stored matches found for: {company_name} - {job_title} - {job_id}"
            )

        candidates_list = [c for c in match_doc.get("candidates", []) if c is not None]
        live_candidates = _fetch_live_candidates(candidates_list)
        matches = [
            build_match_result_from_candidate(c, live_candidates.get(c.get("candidate_id")))
            for c in candidates_list
        ]

        return MatchResponse(
            success=True,
            job_id=job_id,
            company_name=company_name,
            job_title=job_title,
            total_matches=len(matches),
            matches=matches,
            is_cohort=match_doc.get("use_cohort", True),
            mongo_match_id=str(match_doc["_id"]),
            created_at=match_doc.get("created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve stored matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/history/{company_name}/{job_title}/{job_id}", response_model=MatchHistoryResponse)
async def get_match_history(company_name: str, job_title: str, job_id: str):
    """List all historical match runs for a job (summary only — no candidate data)."""
    try:
        validate_object_id(job_id)
        history = get_all_matches(company_name, job_title, job_id)
        return MatchHistoryResponse(
            success=True,
            company_name=company_name,
            job_title=job_title,
            job_id=job_id,
            history=history,
        )
    except Exception as e:
        logger.error(f"Failed to retrieve match history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/{match_id}", response_model=MatchResponse)
async def get_match_by_id(match_id: str):
    """Retrieve a specific historical match document by its MongoDB _id."""
    try:
        try:
            validate_object_id(match_id)
            oid = ObjectId(match_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail=f"Invalid match ID: {match_id}")

        match_doc = mongo_connection.matches_collection.find_one({"_id": oid})
        if not match_doc:
            raise HTTPException(status_code=404, detail=f"Match not found: {match_id}")

        candidates_list = [c for c in match_doc.get("candidates", []) if c is not None]
        live_candidates = _fetch_live_candidates(candidates_list)
        matches = [
            build_match_result_from_candidate(c, live_candidates.get(c.get("candidate_id")))
            for c in candidates_list
        ]

        return MatchResponse(
            success=True,
            job_id=match_doc.get("JobId", ""),
            company_name=match_doc.get("companyName", ""),
            job_title=match_doc.get("JobTitle", ""),
            total_matches=len(matches),
            matches=matches,
            is_cohort=match_doc.get("use_cohort", True),
            mongo_match_id=str(match_doc["_id"]),
            created_at=match_doc.get("created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve match by ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))
