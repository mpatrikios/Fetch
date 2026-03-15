"""
Self-service profile management routes for candidates.
All endpoints require authentication and operate on the authenticated user's own data.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict
from datetime import datetime, timezone
from bson import ObjectId
import logging

from src.database.connection import mongo_connection
from src.services.storage.blob_storage import get_blob_storage
from src.api.routes.auth_routes import get_current_user, hash_password_sha256, verify_password
from src.api.models import (
    CandidateProfileResponse,
    ProfileUpdateRequest,
    ProfileUpdateResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    AccountDeleteRequest,
    AccountDeleteResponse,
)
from src.services.embeddings.generate_embeddings import embed_candidate_location

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/profile", response_model=CandidateProfileResponse)
async def get_own_profile(current_user: Dict = Depends(get_current_user)):
    """
    Get the authenticated user's profile.
    Returns minimal candidate info - excludes recruiter-only data and detailed resume info.
    """
    try:
        candidate = mongo_connection.candidates_collection.find_one(
            {"_id": ObjectId(current_user["_id"])}
        )

        if not candidate:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Extract clifton strengths names only
        clifton_raw = candidate.get("clifton_strengths", [])
        clifton_names = []
        for strength in clifton_raw:
            if isinstance(strength, dict):
                clifton_names.append(strength.get("name", ""))
            elif isinstance(strength, str):
                clifton_names.append(strength)
        clifton_names = [name for name in clifton_names if name]

        return CandidateProfileResponse(
            id=str(candidate["_id"]),
            full_name=candidate.get("full_name", candidate.get("name", "")),
            email=candidate.get("email", candidate.get("Email", "")),
            location=candidate.get("Location"),
            has_resume=bool(candidate.get("resume_blob_path")),
            has_clifton_doc=bool(candidate.get("clifton_blob_path")),
            clifton_strengths=clifton_names,
            status=candidate.get("status"),
            created_at=candidate.get("created_at"),
            resume_filename=candidate.get("resume_filename"),
            clifton_filename=candidate.get("clifton_filename"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")


@router.get("/profile/documents/resume/download")
async def download_my_resume(current_user: Dict = Depends(get_current_user)):
    """Generate a SAS download URL for the authenticated user's own resume."""
    try:
        candidate = mongo_connection.candidates_collection.find_one(
            {"_id": ObjectId(current_user["_id"])},
            {"resume_blob_path": 1, "resume_filename": 1}
        )
        if not candidate:
            raise HTTPException(status_code=404, detail="Profile not found")
        blob_storage = get_blob_storage()
        sas_url = blob_storage.generate_sas_url(candidate["resume_blob_path"])
        return {"download_url": sas_url, "filename": candidate.get("resume_filename", "resume")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching resume download URL for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve resume download URL")


@router.get("/profile/documents/clifton/download")
async def download_my_clifton_strengths(current_user: Dict = Depends(get_current_user)):
    """Generate a SAS download URL for the authenticated user's own clifton strengths report."""
    try:
        candidate = mongo_connection.candidates_collection.find_one(
            {"_id": ObjectId(current_user["_id"])},
            {"clifton_blob_path": 1, "clifton_filename": 1}
        )
        if not candidate:
            raise HTTPException(status_code=404, detail="Profile not found")

        clifton_blob_path = candidate.get("clifton_blob_path")
        if not clifton_blob_path:
            raise HTTPException(status_code=404, detail="No Clifton Strengths document uploaded")

        blob_storage = get_blob_storage()
        sas_url = blob_storage.generate_sas_url(clifton_blob_path)
        return {"download_url": sas_url, "filename": candidate.get("clifton_filename", "clifton_strengths")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching clifton download URL for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve clifton download URL")


@router.put("/profile", response_model=ProfileUpdateResponse)
async def update_profile(
    update_data: ProfileUpdateRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Update the authenticated user's profile (name and/or location).
    Regenerates location embeddings if location changes.
    """
    try:
        user_id = ObjectId(current_user["_id"])

        # Get current profile for comparison
        old_profile = mongo_connection.candidates_collection.find_one({"_id": user_id})
        if not old_profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Build update document
        update_doc = {}
        if update_data.full_name is not None:
            update_doc["full_name"] = update_data.full_name
            update_doc["name"] = update_data.full_name  # Keep both fields in sync
        if update_data.location is not None:
            update_doc["Location"] = update_data.location

        if not update_doc:
            raise HTTPException(status_code=400, detail="No fields provided for update")

        # Add timestamp
        update_doc["profile_updated_at"] = datetime.now(timezone.utc)

        # Perform update
        result = mongo_connection.candidates_collection.update_one(
            {"_id": user_id},
            {"$set": update_doc}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Check if location changed - regenerate embeddings if so
        embeddings_regenerated = False
        if "Location" in update_doc and update_doc["Location"] != old_profile.get("Location"):
            try:
                new_profile = mongo_connection.candidates_collection.find_one({"_id": user_id})
                embed_candidate_location(new_profile)
                embeddings_regenerated = True
                logger.info(f"Location embeddings regenerated for {current_user.get('email', 'unknown')}")
            except Exception as e:
                logger.warning(f"Embedding regeneration failed for {current_user.get('email', 'unknown')}: {e}")

        # Fetch updated profile for response
        updated_profile = await get_own_profile(current_user)

        logger.info(f"Profile updated for {current_user.get('email', 'unknown')}: {list(update_doc.keys())}")

        return ProfileUpdateResponse(
            success=True,
            message="Profile updated successfully",
            profile=updated_profile,
            embeddings_regenerated=embeddings_regenerated,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update failed for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.put("/profile/password", response_model=PasswordChangeResponse)
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Change the authenticated user's password.
    Requires current password verification.
    """
    try:
        user_id = ObjectId(current_user["_id"])

        # Fetch current password hash
        user = mongo_connection.candidates_collection.find_one(
            {"_id": user_id},
            {"password": 1, "email": 1}
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify current password
        if not verify_password(password_data.current_password, user.get("password", "")):
            logger.warning(f"Failed password change attempt for {current_user.get('email', 'unknown')}: incorrect current password")
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # Hash and update new password
        new_password_hash = hash_password_sha256(password_data.new_password)

        result = mongo_connection.candidates_collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "password": new_password_hash,
                    "password_changed_at": datetime.now(timezone.utc)
                }
            }
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update password")

        logger.info(f"Password changed successfully for {current_user.get('email', 'unknown')}")

        return PasswordChangeResponse(
            success=True,
            message="Password changed successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change failed for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")


@router.delete("/profile", response_model=AccountDeleteResponse)
async def delete_account(
    delete_request: AccountDeleteRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Delete (soft delete) the authenticated user's account.
    Requires password confirmation and explicit acknowledgment.
    Anonymizes PII but keeps record for audit purposes.
    """
    try:
        if not delete_request.confirm_deletion:
            raise HTTPException(
                status_code=400,
                detail="Must confirm deletion by setting confirm_deletion=true"
            )

        user_id = ObjectId(current_user["_id"])

        # Verify password
        user = mongo_connection.candidates_collection.find_one(
            {"_id": user_id},
            {"password": 1, "email": 1}
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(delete_request.password, user.get("password", "")):
            logger.warning(f"Failed account deletion attempt for {current_user.get('email', 'unknown')}: incorrect password")
            raise HTTPException(status_code=401, detail="Password is incorrect")

        # Perform soft delete - anonymize PII
        deleted_email = f"deleted_{user_id}@deleted.local"
        original_email = user.get("email", current_user.get("email", "unknown"))

        result = mongo_connection.candidates_collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_at": datetime.now(timezone.utc),
                    "full_name": "[DELETED]",
                    "name": "[DELETED]",
                    "Email": deleted_email,
                    "email": deleted_email,
                    "Summary": None,
                    "Location": None,
                    "Skills": [],
                    "Experience": [],
                    "Companies": [],
                    "profile_embedding": None,
                    "location_embedding": None,
                    "culture_embedding": None,
                }
            }
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete account")

        logger.warning(f"Account soft-deleted for original email: {original_email}")

        return AccountDeleteResponse(
            success=True,
            message="Account deleted successfully",
            deletion_type="soft"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Account deletion failed for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")
