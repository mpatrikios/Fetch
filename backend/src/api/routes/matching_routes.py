# API routes for matching candidates to job descriptions.
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys
import os
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database.connection import mongo_connection
from src.database.insert_to_mongo import get_job_description
from src.services.matching.cosine_similarity import profile_matching_candidate
from src.api.models import MatchRequest, MatchResponse

logger = logging.getLogger(__name__)
router = APIRouter()

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
            top_k=request.top_k or 10
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
                "rank": rank,
                "candidate_name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("Email"),
                "location": candidate.get("Location"),
                "distance_km": match.get("distance_km"),
                "scores": {
                    "combined": round(match["combined_similarity_score"], 3),
                    "profile": round(match["profile_similarity_score"], 3),
                    "culture": round(match["culture_similarity_score"], 3)
                },
                "explanation": {
                    "keyword_overlap": match.get("explanation", {}).get("keyword_overlap", [])[:10],
                    "relevant_roles": match.get("explanation", {}).get("relevant_roles", [])[:3],
                    "candidate_companies": match.get("explanation", {}).get("candidate_companies", [])[:3],
                    "summary": match.get("explanation", {}).get("summary", "No summary available")
                },
                "clifton_strengths": clifton_strengths,
                "skills": candidate.get("Skills", [])[:10]
            }
            formatted_matches.append(formatted_match)
        
        # Return response with matches
        return MatchResponse(
            success=True,
            job_id=f"{request.company_name}_{request.job_title}",
            company_name=request.company_name,
            job_title=request.job_title,
            total_matches=len(formatted_matches),
            matches=formatted_matches
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# endpoint to get matches via GET request using URL. Might be useful for testing or caching.
@router.get("/matches/job/{company_name}/{job_title}")
async def get_job_matches(company_name: str, job_title: str, top_k: int = 10):
    """
    Alternative GET endpoint for finding matches.
    Useful for direct URL access or caching.
    """
    request = MatchRequest(
        company_name=company_name,
        job_title=job_title,
        top_k=top_k
    )
    return await find_matches(request)