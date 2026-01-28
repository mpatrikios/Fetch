"""
Self-service profile and account management routes for candidates.
All endpoints require authentication and operate on the authenticated user's own data.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict
from datetime import datetime, timezone
from bson import ObjectId
import logging

from src.database.connection import mongo_connection
from src.api.routes.auth_routes import get_current_user, hash_password_sha256, verify_password
from src.api.models import (
    CandidateProfileResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    AccountDeleteRequest,
    AccountDeleteResponse,
    NotificationPreferences,
    PreferencesResponse,
)

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
            clifton_strengths=clifton_names,
            status=candidate.get("status"),
            created_at=candidate.get("created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")


@router.put("/account/password", response_model=PasswordChangeResponse)
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


@router.delete("/account", response_model=AccountDeleteResponse)
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


@router.get("/account/preferences", response_model=PreferencesResponse)
async def get_preferences(current_user: Dict = Depends(get_current_user)):
    """Get notification preferences for the authenticated user."""
    try:
        user_id = ObjectId(current_user["_id"])

        user = mongo_connection.candidates_collection.find_one(
            {"_id": user_id},
            {"notification_preferences": 1}
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        prefs = user.get("notification_preferences", {})

        return PreferencesResponse(
            success=True,
            preferences=NotificationPreferences(
                email_job_matches=prefs.get("email_job_matches", True),
                email_status_updates=prefs.get("email_status_updates", True),
                email_assessment_reminders=prefs.get("email_assessment_reminders", True),
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get preferences for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve preferences")


@router.put("/account/preferences", response_model=PreferencesResponse)
async def update_preferences(
    preferences: NotificationPreferences,
    current_user: Dict = Depends(get_current_user)
):
    """Update notification preferences for the authenticated user."""
    try:
        user_id = ObjectId(current_user["_id"])

        result = mongo_connection.candidates_collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "notification_preferences": preferences.dict(),
                    "preferences_updated_at": datetime.now(timezone.utc)
                }
            }
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        logger.info(f"Preferences updated for {current_user.get('email', 'unknown')}")

        return PreferencesResponse(
            success=True,
            preferences=preferences
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update preferences for {current_user.get('email', 'unknown')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update preferences")
