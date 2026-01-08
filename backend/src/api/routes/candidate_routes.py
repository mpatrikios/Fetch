# API routes for candidate management (list, reject, accept, send assessments)
from fastapi import APIRouter, HTTPException
import logging
from datetime import datetime

from src.database.connection import mongo_connection
from src.api.models import CandidateListResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# API endpoint to list candidates with basic info
@router.get("/candidates", response_model=CandidateListResponse)
async def list_candidates():
    try:
        candidates = list(mongo_connection.candidates_collection.find(
            {"status": {"$ne": "rejected"}},  # Exclude rejected candidates
            {
                "_id": 1,
                "full_name": 1,
                "Email": 1,
                "Location": 1,
                "Summary": 1,
                "Skills": 1,
                "clifton_strengths": 1,
                "profile_embedding": 1
            }
        ).limit(100))
        
        formatted_candidates = []
        for candidate in candidates:
            formatted_candidates.append({
                "id": str(candidate.get("_id")),
                "name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("Email"),
                "location": candidate.get("Location"),
                "Summary": candidate.get("Summary"),
                "skills": candidate.get("Skills", []),
                "clifton_strengths": candidate.get("clifton_strengths", []),
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
    try:
        from bson import ObjectId
        
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": datetime.utcnow()
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
    try:
        from bson import ObjectId
        
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "status": "accepted",
                    "accepted_at": datetime.utcnow()
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
                    "assessment_sent_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Assessment sent to candidate {candidate_id}")
        return {"success": True, "message": "Assessment sent successfully"}
        
    except Exception as e:
        logger.error(f"Failed to send assessment to candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to update candidate notes
@router.put("/candidates/{candidate_id}/notes")
async def update_candidate_notes(candidate_id: str, notes_data: dict):
    try:
        from bson import ObjectId
        
        notes = notes_data.get("notes", "")
        
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "recruiter_notes": notes,
                    "notes_updated_at": datetime.utcnow()
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