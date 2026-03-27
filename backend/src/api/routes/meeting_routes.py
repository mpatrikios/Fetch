"""
API routes for fetching upcoming meetings from Calendly.
"""
import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

import httpx

from src.database.connection import mongo_connection
from src.api.auth_utils import get_current_mlg_recruiter

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])

CALENDLY_BASE = "https://api.calendly.com"
CALENDLY_TOKEN = os.getenv("CALENDLY_ACCESS_TOKEN")


async def _get_calendly_user_uri(client: httpx.AsyncClient, headers: dict) -> str:
    resp = await client.get(f"{CALENDLY_BASE}/users/me", headers=headers)
    resp.raise_for_status()
    return resp.json()["resource"]["uri"]


async def _get_upcoming_events(client: httpx.AsyncClient, headers: dict, user_uri: str) -> list:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    resp = await client.get(
        f"{CALENDLY_BASE}/scheduled_events",
        headers=headers,
        params={
            "user": user_uri,
            "status": "active",
            "min_start_time": now,
            "count": 20,
            "sort": "start_time:asc",
        },
    )
    resp.raise_for_status()
    return resp.json().get("collection", [])


async def _get_invitees(client: httpx.AsyncClient, headers: dict, event_uri: str) -> list:
    event_uuid = event_uri.split("/")[-1]
    resp = await client.get(
        f"{CALENDLY_BASE}/scheduled_events/{event_uuid}/invitees",
        headers=headers,
    )
    resp.raise_for_status()
    return resp.json().get("collection", [])


def _find_candidate_id(email: str) -> str | None:
    """Look up a candidate by email; return their _id as a string, or None."""
    if not email:
        return None
    doc = mongo_connection.candidates_collection.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 1},
    )
    return str(doc["_id"]) if doc else None


def _extract_join_url(event: dict) -> str | None:
    location = event.get("location") or {}
    return location.get("join_url") or location.get("location")


@router.get("/meetings/upcoming")
async def get_upcoming_meetings():
    """Fetch upcoming Calendly meetings and match invitees to candidates."""
    if not CALENDLY_TOKEN:
        raise HTTPException(status_code=503, detail="Calendly integration not configured")

    headers = {
        "Authorization": f"Bearer {CALENDLY_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            user_uri = await _get_calendly_user_uri(client, headers)
            events = await _get_upcoming_events(client, headers, user_uri)

            meetings = []
            for event in events:
                invitees = await _get_invitees(client, headers, event["uri"])
                invitee = invitees[0] if invitees else {}
                invitee_email = invitee.get("email", "")
                invitee_name = invitee.get("name", "Unknown")

                meetings.append({
                    "event_id": event["uri"].split("/")[-1],
                    "title": event.get("name", "Meeting"),
                    "start_time": event.get("start_time"),
                    "end_time": event.get("end_time"),
                    "join_url": _extract_join_url(event),
                    "invitee_name": invitee_name,
                    "invitee_email": invitee_email,
                    "candidate_id": _find_candidate_id(invitee_email),
                })

            return {"success": True, "meetings": meetings}

    except httpx.HTTPStatusError as e:
        logger.error(f"Calendly API error: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to fetch meetings from Calendly")
    except Exception as e:
        logger.error(f"Unexpected error fetching meetings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming meetings")
