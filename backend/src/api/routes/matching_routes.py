# API routes for matching candidates to job descriptions.
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import sys
import os
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database.connection import mongo_connection
from src.database.insert_to_mongo import (
    get_job_description,
    insert_match,
    get_match,
    set_job_match_generated,
    get_all_matches,
)
from src.services.matching.cosine_similarity import (
    profile_matching_candidate,
    build_match_doc,
)
from src.api.models import MatchRequest, MatchResponse, MatchResult, MatchHistoryResponse
from src.api.auth_utils import get_current_mlg_recruiter

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])

# API endpoint to find matching candidates for a job description
@router.post("/matches/find", response_model=MatchResponse)
async def find_matches(request: MatchRequest):
    """
    Find matching candidates for a specific job.
    Requires company name and job title.
    """
    try:
        # Retrieve job description
        job_doc = get_job_description(request.company_name, request.job_title)
        if not job_doc:
            raise HTTPException(
                status_code=404, 
                detail=f"Job not found: {request.company_name} - {request.job_title}"
            )
        
        # Check if job has embeddings
        if "profile_embedding" not in job_doc:
            raise HTTPException(
                status_code=400,
                detail="Job description does not have embeddings. Please reprocess the job."
            )
        
        # Find matching candidates
        matches = profile_matching_candidate(
            mongo_connection.database,
            job_doc,
            top_k=request.top_k or 10,
            percentile_threshold=request.percentile_threshold or 0.75,
            use_cohort=request.use_cohort or False
        )

        # Format results
        formatted_matches = []
        for rank, match in enumerate(matches, 1):
            candidate = match["candidate"]
            
            # Extract Clifton Strengths
            clifton_strengths = []
            if candidate.get("clifton_strengths"):
                for strength in candidate.get("clifton_strengths", [])[:5]:
                    if isinstance(strength, dict) and "name" in strength:
                        clifton_strengths.append(strength["name"])
                    elif isinstance(strength, str):
                        clifton_strengths.append(strength)
            
            # Build formatted match entry
            formatted_match = {
                "candidate_id": str(candidate.get("_id")) if candidate.get("_id") else None,
                "rank": rank if not request.use_cohort else None,
                "full_name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("email", candidate.get("Email", "")),
                "location": candidate.get("location", candidate.get("Location", "")),
                "distance_km": match.get("distance_km"),
                "scores": {
                    "combined": round(match["combined_similarity_score"], 3),
                    "profile": round(match["profile_similarity_score"], 3),
                    "culture": round(match["culture_similarity_score"], 3)
                },
                "explanation": {
                    "keyword_overlap": match.get("explanation", {}).get("keyword_overlap", [])[:10],
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

        match = build_match_doc(job_doc, formatted_matches)
        mongo_result = insert_match(match)
        if not mongo_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")

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
            created_at=match.get("created_at"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# endpoint to get matches via GET request using URL. Might be useful for testing or caching.
@router.get("/matches/job/{company_name}/{job_title}")
async def get_job_matches(company_name: str, job_title: str, top_k: int = 10, percentile_threshold: float = 0.75, use_cohort: bool = False):
    """
    Alternative GET endpoint for finding matches.
    Useful for direct URL access or caching.
    """
    request = MatchRequest(
        company_name=company_name,
        job_title=job_title,
        top_k=top_k,
        percentile_threshold=percentile_threshold,
        use_cohort=use_cohort
    )
    return await find_matches(request)


@router.get("/matches/stored/{company_name}/{job_title}", response_model=MatchResponse)
async def get_stored_matches(company_name: str, job_title: str):
    """
    Retrieve the most recently saved match list for a job from the database.
    Returns 404 if no matches have been generated yet for this job.
    """
    try:
        match_doc = get_match(company_name, job_title)
        if not match_doc:
            raise HTTPException(
                status_code=404,
                detail=f"No stored matches found for: {company_name} - {job_title}"
            )

        candidates = match_doc.get("candidates", [])
        matches = []
        for c in candidates:
            explanation_data = c.get("explanation", {})
            relevant_experience = [
                {"role": e.get("role", ""), "company": e.get("company")}
                for e in explanation_data.get("relevant_experience", [])
            ]
            matches.append(MatchResult(
                candidate_id=c.get("candidate_id"),
                rank=c.get("rank"),
                full_name=c.get("full_name", "Unknown"),
                email=c.get("email"),
                location=c.get("location"),
                distance_km=c.get("distance_km"),
                scores=c.get("scores"),
                explanation={
                    "keyword_overlap": explanation_data.get("keyword_overlap", []),
                    "relevant_roles": explanation_data.get("relevant_roles", []),
                    "relevant_experience": relevant_experience,
                    "candidate_companies": explanation_data.get("candidate_companies", []),
                    "summary": explanation_data.get("summary", "No summary available"),
                },
                clifton_strengths=c.get("clifton_strengths", []),
                skills=c.get("skills", []),
            ))

        return MatchResponse(
            success=True,
            job_id=f"{company_name}_{job_title}",
            company_name=company_name,
            job_title=job_title,
            total_matches=len(matches),
            matches=matches,
            is_cohort=True,
            created_at=match_doc.get("created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve stored matches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/history/{company_name}/{job_title}", response_model=MatchHistoryResponse)
async def get_match_history(company_name: str, job_title: str):
    """List all historical match runs for a job (summary only — no candidate data)."""
    try:
        history = get_all_matches(company_name, job_title)
        return MatchHistoryResponse(
            success=True,
            company_name=company_name,
            job_title=job_title,
            history=history,
        )
    except Exception as e:
        logger.error(f"Failed to retrieve match history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matches/{match_id}", response_model=MatchResponse)
async def get_match_by_id(match_id: str):
    """Retrieve a specific historical match document by its MongoDB _id."""
    try:
        from bson import ObjectId
        from bson.errors import InvalidId

        try:
            oid = ObjectId(match_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail=f"Invalid match ID: {match_id}")

        match_doc = mongo_connection.matches_collection.find_one({"_id": oid})
        if not match_doc:
            raise HTTPException(status_code=404, detail=f"Match not found: {match_id}")

        candidates = match_doc.get("candidates", [])
        matches = []
        for c in candidates:
            explanation_data = c.get("explanation", {})
            relevant_experience = [
                {"role": e.get("role", ""), "company": e.get("company")}
                for e in explanation_data.get("relevant_experience", [])
            ]
            matches.append(MatchResult(
                candidate_id=c.get("candidate_id"),
                rank=c.get("rank"),
                full_name=c.get("full_name", "Unknown"),
                email=c.get("email"),
                location=c.get("location"),
                distance_km=c.get("distance_km"),
                scores=c.get("scores"),
                explanation={
                    "keyword_overlap": explanation_data.get("keyword_overlap", []),
                    "relevant_roles": explanation_data.get("relevant_roles", []),
                    "relevant_experience": relevant_experience,
                    "candidate_companies": explanation_data.get("candidate_companies", []),
                    "summary": explanation_data.get("summary", "No summary available"),
                },
                clifton_strengths=c.get("clifton_strengths", []),
                skills=c.get("skills", []),
            ))

        return MatchResponse(
            success=True,
            job_id=f"{match_doc.get('companyName')}_{match_doc.get('JobTitle')}",
            company_name=match_doc.get("companyName", ""),
            job_title=match_doc.get("JobTitle", ""),
            total_matches=len(matches),
            matches=matches,
            is_cohort=match_doc.get("use_cohort", True),
            created_at=match_doc.get("created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve match by ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))