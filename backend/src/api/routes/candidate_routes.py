# API routes for candidate management (list, reject, accept, send assessments)
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.concurrency import run_in_threadpool
import os
import tempfile
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from src.database.connection import mongo_connection
from src.api.models import CandidateListResponse
from src.api.auth_utils import get_current_mlg_recruiter
from src.api.utils import cleanup_temp_file, validate_object_id
from src.api.routes.helpers import extract_clifton_names, ensure_updated, delete_document_blobs, pending_candidates_filter, non_rejected_candidates_filter
from src.services.storage.blob_storage import get_blob_storage
from src.services.document_processing.document_service import DocumentService
from src.services.email_service import send_email

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])


# API endpoint to list candidates with basic info
@router.get("/candidates", response_model=CandidateListResponse)
async def list_candidates(
    status: Optional[str] = Query("all", description="Filter by candidate status: pending, all")
):
    try:
        # Build query filter based on status parameter
        pending_query = pending_candidates_filter()
        if status == "all":
            query_filter = non_rejected_candidates_filter()
        elif status == "pending":
            query_filter = pending_query
        elif status == "onboarding":
            query_filter = {
                "assessment_sent": True
            }
        elif status == "accepted":
            query_filter = {"status": "accepted"}
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
                "location": 1,
                "Summary": 1,
                "Skills": 1,
                "clifton_strengths": 1,
                "recruiter_notes": 1,
                "status": 1,
                "profile_embedding": 1,
                "resume_blob_path": 1,
                "clifton_blob_path": 1
            }
        ).sort("full_name", 1).limit(100))
        
        formatted_candidates = []
        for candidate in candidates:
            clifton_strengths_names = extract_clifton_names(candidate.get("clifton_strengths", []))
            
            formatted_candidates.append({
                "id": str(candidate.get("_id")),
                "full_name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("email", ""),
                "location": candidate.get("location", ""),
                "Summary": candidate.get("Summary"),
                "skills": candidate.get("Skills", []),
                "clifton_strengths": clifton_strengths_names,
                "notes": candidate.get("recruiter_notes", ""),
                "status": candidate.get("status", "pending"),
                "has_embeddings": "profile_embedding" in candidate,
                "has_resume": bool(candidate.get("resume_blob_path")),
                "has_clifton_doc": bool(candidate.get("clifton_blob_path"))
            })
        
        total_count = mongo_connection.candidates_collection.count_documents(query_filter)

        return CandidateListResponse(
            success=True,
            count=len(formatted_candidates),
            total_count=total_count,
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
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": datetime.now(timezone.utc)
                }
            }
        )
        
        ensure_updated(result, "Candidate")
        logger.info(f"Candidate {candidate_id} has been rejected")
        return {"success": True, "message": "Candidate rejected successfully"}
        
    except Exception as e:
        logger.error(f"Failed to reject candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoint to accept a candidate — triggers resume parsing and embedding generation
@router.put("/candidates/{candidate_id}/accept")
async def accept_candidate(candidate_id: str):
    validate_object_id(candidate_id)

    # Look up candidate and verify resume exists
    candidate = mongo_connection.candidates_collection.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    resume_blob_path = candidate.get("resume_blob_path")
    if not resume_blob_path:
        raise HTTPException(status_code=400, detail="No resume uploaded for this candidate")

    tmp_file_path = None
    try:
        # Download resume from blob storage and save to temp file
        blob_storage = get_blob_storage()
        file_bytes = blob_storage.download_blob(resume_blob_path)

        suffix = os.path.splitext(candidate.get("resume_filename", ".pdf"))[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_file_path = tmp.name

        # Parse resume, upsert data, and generate embeddings (blocking — offload to threadpool)
        email = candidate.get("email", "")
        await run_in_threadpool(DocumentService.parse_and_embed_resume, candidate_id, tmp_file_path, email)

        # Set accepted status and timestamp
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "status": "accepted",
                    "accepted_at": datetime.now(timezone.utc),
                },
                "$unset": {"parsing_error": ""},
            }
        )
        ensure_updated(result, "Candidate")

        logger.info(f"Candidate {candidate_id} accepted and resume parsed successfully")

        # Send acceptance email (non-blocking — failure does not block the accept)
        candidate_name = candidate.get("full_name", "Candidate")
        if email:
            subject = "[ACCEPTANCE SUBJECT PLACEHOLDER]"  # user to fill in
            body_html = f"""
            <p>Hi {candidate_name},</p>
            <p>[EMAIL BODY PLACEHOLDER — fill in your acceptance message here.]</p>
            <p>Best,<br>The MLG Team</p>
            """
            body_text = f"Hi {candidate_name},\n\n[EMAIL BODY PLACEHOLDER]\n\nBest,\nThe MLG Team"
            try:
                await run_in_threadpool(send_email, email, subject, body_html, body_text)
                logger.info(f"Acceptance email sent to candidate {candidate_id} at {email}")
            except Exception as email_err:
                # Log email sending failure but do not block overall acceptance flow
                logger.error(f"Failed to send acceptance email to candidate {candidate_id} at {email}: {email_err}")

        return {"success": True, "message": "Candidate accepted and resume processed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to accept candidate {candidate_id}: {e}")
        # Store parsing error so recruiter can see what went wrong and retry
        mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {"parsing_error": str(e)}}
        )
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_file_path:
            cleanup_temp_file(tmp_file_path)

# API endpoint to send assessment to candidate (placeholder)
@router.post("/candidates/{candidate_id}/send-assessment")
async def send_assessment(candidate_id: str):
    # Validate ObjectId format
    validate_object_id(candidate_id)
    
    try:
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
        result = mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "assessment_sent": True,
                    "assessment_sent_at": datetime.now(timezone.utc)
                }
            }
        )
        ensure_updated(result, "Candidate")

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

        ensure_updated(result, "Candidate")
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
        
        ensure_updated(result, "Candidate")
        logger.info(f"Notes updated for candidate {candidate_id}")
        return {"success": True, "message": "Notes updated successfully"}
        
    except Exception as e:
        logger.error(f"Failed to update notes for candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidates/search")
async def search_candidates(q: str = Query(..., min_length=1)):
    """Search candidates by name or email for manual job recommendations."""
    pattern = {"$regex": q, "$options": "i"}
    candidates = list(mongo_connection.candidates_collection.find(
        {
            "$or": [{"full_name": pattern}, {"email": pattern}],
            "status": {"$ne": "rejected"},
        },
        {"_id": 1, "full_name": 1, "email": 1, "location": 1}
    ).limit(10))
    results = [
        {
            "candidate_id": str(c["_id"]),
            "full_name": c.get("full_name", "Unknown"),
            "email": c.get("email", ""),
            "location": c.get("location", ""),
        }
        for c in candidates
    ]
    return {"success": True, "candidates": results}


@router.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str):
    """
    Permanently delete a candidate and their associated blobs from Azure Storage.
    Historical match documents referencing this candidate are left intact.
    """
    validate_object_id(candidate_id)

    cand = mongo_connection.candidates_collection.find_one(
        {"_id": ObjectId(candidate_id)},
        {"resume_blob_path": 1, "clifton_blob_path": 1}
    )
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    delete_document_blobs(cand, ["resume_blob_path", "clifton_blob_path"], candidate_id)
    mongo_connection.candidates_collection.delete_one({"_id": ObjectId(candidate_id)})
    logger.info(f"Candidate {candidate_id} deleted")
    return {"success": True, "message": "Candidate deleted successfully"}