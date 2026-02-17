# API routes for candidate management (list, reject, accept, send assessments)
from fastapi import APIRouter, HTTPException, Query, Depends
import logging
from datetime import datetime, timezone
from typing import Optional

from src.database.connection import mongo_connection
from src.api.models import CandidateListResponse
from src.api.auth_utils import get_current_mlg_recruiter
from bson.errors import InvalidId

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])

def validate_object_id(candidate_id: str) -> None:
    """Validate that candidate_id is a valid ObjectId format."""
    try:
        from bson import ObjectId
        ObjectId(candidate_id)
    except InvalidId:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid candidate ID format: {candidate_id}"
        )

# API endpoint to list candidates with basic info
@router.get("/candidates", response_model=CandidateListResponse)
async def list_candidates(
    status: Optional[str] = Query("all", description="Filter by candidate status: pending, all")
):
    try:
        # Define common query patterns
        pending_query = {
            "$or": [
                {"status": {"$nin": ["rejected", "accepted"]}},  # Exclude rejected and accepted
                {"status": {"$exists": False}},                  # Include documents missing status
                {"status": None}                                 # Include documents with null status
            ]
        }
        
        # Build query filter based on status parameter
        if status == "all":
            # Include candidates without a status or with non-rejected status
            query_filter = {
                "$or": [
                    {"status": {"$ne": "rejected"}},           # Exclude only explicitly rejected
                    {"status": {"$exists": False}},            # Include documents missing status
                    {"status": None}                           # Include documents with null status
                ]
            }
        elif status == "pending":
            query_filter = pending_query
        elif status == "onboarding":
            query_filter = {
                "role": {"$ne": "mlg-recruiter"},
                "assessment_sent": True
            }
        else:
            # Log invalid status and default to pending logic
            logger.warning(f"Invalid status filter '{status}' provided, defaulting to 'pending'")
            query_filter = pending_query
        
        candidates = list(mongo_connection.candidates_collection.find(
            query_filter,
            {
                "_id": 1,
                "full_name": 1,
                "email": 1,
                "Email": 1,  # Legacy field support
                "location": 1,
                "Location": 1,  # Legacy field support
                "Summary": 1,
                "Skills": 1,
                "clifton_strengths": 1,
                "recruiter_notes": 1,
                "status": 1,
                "profile_embedding": 1
            }
        ).sort("full_name", 1).limit(100))
        
        formatted_candidates = []
        for candidate in candidates:
            # Extract only strength names from clifton_strengths objects
            clifton_strengths_raw = candidate.get("clifton_strengths", [])
            clifton_strengths_names = []
            
            for strength in clifton_strengths_raw:
                if isinstance(strength, dict) and "name" in strength:
                    clifton_strengths_names.append(strength["name"])
                elif isinstance(strength, str):
                    # Handle case where it's already a string
                    clifton_strengths_names.append(strength)
            
            formatted_candidates.append({
                "id": str(candidate.get("_id")),
                "full_name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("email", candidate.get("Email", "")),
                "location": candidate.get("location", candidate.get("Location", "")),
                "Summary": candidate.get("Summary"),
                "skills": candidate.get("Skills", []),
                "clifton_strengths": clifton_strengths_names,
                "notes": candidate.get("recruiter_notes", ""),
                "status": candidate.get("status", "pending"),
                "has_embeddings": "profile_embedding" in candidate
            })
        
        return CandidateListResponse(
            success=True,
            count=len(formatted_candidates),
            candidates=formatted_candidates
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to reject a candidate
@router.put("/candidates/{candidate_id}/reject")
async def reject_candidate(candidate_id: str):
    # Validate ObjectId format
    validate_object_id(candidate_id)
    
    try:
        from bson import ObjectId
        
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        logger.info(f"Candidate {candidate_id} has been rejected")
        return {"success": True, "message": "Candidate rejected successfully"}
        
    except Exception as e:
        logger.error(f"Failed to reject candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to accept a candidate
@router.put("/candidates/{candidate_id}/accept")
async def accept_candidate(candidate_id: str):
    # Validate ObjectId format
    validate_object_id(candidate_id)
    
    try:
        from bson import ObjectId
        
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "status": "accepted",
                    "accepted_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        logger.info(f"Candidate {candidate_id} has been accepted")
        return {"success": True, "message": "Candidate accepted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to accept candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to send assessment to candidate (placeholder)
@router.post("/candidates/{candidate_id}/send-assessment")
async def send_assessment(candidate_id: str):
    # Validate ObjectId format
    validate_object_id(candidate_id)
    
    try:
        from bson import ObjectId
        
        # Get candidate info
        candidate = mongo_connection.candidates_collection.find_one(
            {"_id": ObjectId(candidate_id)}
        )
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # TODO: Implement actual assessment sending logic
        # This could involve:
        # - Sending email with Clifton Strengths assessment link
        # - Generating unique assessment code
        # - Integrating with external assessment platform
        
        # For now, just update the candidate with assessment sent flag
        mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "assessment_sent": True,
                    "assessment_sent_at": datetime.now(timezone.utc)
                }
            }
        )
        
        logger.info(f"Assessment sent to candidate {candidate_id}")
        return {"success": True, "message": "Assessment sent successfully"}
        
    except Exception as e:
        logger.error(f"Failed to send assessment to candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to update candidate profile (for MLG recruiters)
@router.put("/candidates/{candidate_id}/profile")
async def update_candidate_profile(candidate_id: str, profile_data: dict):
    # Validate ObjectId format
    validate_object_id(candidate_id)

    try:
        from bson import ObjectId

        # Extract allowed fields from the request
        update_fields = {}

        if "full_name" in profile_data:
            update_fields["full_name"] = profile_data["full_name"]
        if "location" in profile_data:
            update_fields["location"] = profile_data["location"]
        if "summary" in profile_data:
            update_fields["Summary"] = profile_data["summary"]
        if "skills" in profile_data:
            update_fields["Skills"] = profile_data["skills"]

        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        update_fields["profile_updated_at"] = datetime.now(timezone.utc)

        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Candidate not found")

        logger.info(f"Profile updated for candidate {candidate_id}")
        return {"success": True, "message": "Profile updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update profile for candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to update candidate notes
@router.put("/candidates/{candidate_id}/notes")
async def update_candidate_notes(candidate_id: str, notes_data: dict):
    # Validate ObjectId format
    validate_object_id(candidate_id)
    
    try:
        from bson import ObjectId
        
        notes = notes_data.get("notes", "")
        
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "recruiter_notes": notes,
                    "notes_updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        logger.info(f"Notes updated for candidate {candidate_id}")
        return {"success": True, "message": "Notes updated successfully"}
        
    except Exception as e:
        logger.error(f"Failed to update notes for candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))