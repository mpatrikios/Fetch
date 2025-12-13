from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import logging
from bson import ObjectId

from src.database.connection import mongo_connection

logger = logging.getLogger(__name__)
router = APIRouter()


class CalendlyWebhookPayload(BaseModel):
    """Pydantic model for Calendly webhook payload"""
    event: str
    time: str
    payload: Dict[str, Any]


@router.post("/webhooks/calendly")
async def calendly_webhook(request: Request):
    """
    Handle Calendly webhook events when meetings are scheduled
    """
    try:
        # Get raw request body
        body = await request.json()
        logger.info(f"Received Calendly webhook: {body}")
        
        # Extract event type and payload
        event_type = body.get("event")
        payload = body.get("payload", {})
        
        # We're interested in invitee.created events (when someone schedules)
        if event_type != "invitee.created":
            logger.info(f"Ignoring event type: {event_type}")
            return {"status": "ignored", "reason": "not_invitee_created"}
        
        # Extract invitee information
        # In the actual webhook payload, email is directly in payload
        invitee_email = payload.get("email")
        
        # Event info is in payload.scheduled_event
        scheduled_event = payload.get("scheduled_event", {})
        event_name = scheduled_event.get("name", "").lower()
        
        if not invitee_email:
            logger.error("No invitee email found in webhook payload")
            return {"status": "error", "reason": "missing_invitee_email"}
        
        # Determine which status to update based on event name
        new_status = None
        if "intake" in event_name or "30min" in event_name:
            new_status = "scheduled_intake"
        elif "follow" in event_name or "followup" in event_name:
            new_status = "completed_onboarding"
        
        if not new_status:
            logger.warning(f"Could not determine status for event: {event_name}")
            return {"status": "ignored", "reason": "unknown_event_type"}
        
        # Update user status in database
        db = mongo_connection.database
        
        # Find user by email
        user = db.CandidatesTesting.find_one({"email": invitee_email})
        if not user:
            logger.warning(f"User not found for email: {invitee_email}")
            return {"status": "error", "reason": "user_not_found"}
        
        # Update user status
        result = db.CandidatesTesting.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "status": new_status,
                    "last_updated": datetime.utcnow(),
                    "calendly_event_scheduled": {
                        "event_name": event_name,
                        "scheduled_at": datetime.utcnow(),
                        "calendly_event_uri": scheduled_event.get("uri")
                    }
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated user {invitee_email} status to {new_status}")
            return {
                "status": "success", 
                "user_email": invitee_email,
                "new_status": new_status
            }
        else:
            logger.error(f"Failed to update user {invitee_email}")
            return {"status": "error", "reason": "update_failed"}
            
    except Exception as e:
        logger.error(f"Error processing Calendly webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@router.get("/webhooks/calendly/test")
async def test_webhook():
    """Test endpoint to verify webhook route is working"""
    return {
        "status": "ok",
        "message": "Calendly webhook endpoint is ready",
        "timestamp": datetime.utcnow()
    }