import os
import logging
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException

from src.api.auth_utils import get_current_mlg_recruiter

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])

CALENDLY_BASE = "https://api.calendly.com"


def _get_token() -> str:
    token = os.getenv("CALENDLY_ACCESS_TOKEN")
    if not token:
        raise ValueError("CALENDLY_ACCESS_TOKEN environment variable not set")
    return token


@router.get("/calendly/upcoming")
async def get_upcoming_meetings():
    """Return upcoming scheduled Calendly events for the next 30 days."""
    token = _get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(headers=headers, timeout=15) as client:
        # Step 1: get the current user's URI
        me_resp = await client.get(f"{CALENDLY_BASE}/users/me")
        if me_resp.status_code != 200:
            logger.error("Calendly /users/me failed: %s", me_resp.text)
            raise HTTPException(status_code=502, detail="Failed to fetch Calendly user")

        user_uri = me_resp.json()["resource"]["uri"]

        # Step 2: fetch active scheduled events for the next 30 days
        now = datetime.now(timezone.utc)
        max_time = now + timedelta(days=30)

        events_resp = await client.get(
            f"{CALENDLY_BASE}/scheduled_events",
            params={
                "user": user_uri,
                "status": "active",
                "min_start_time": now.isoformat(),
                "max_start_time": max_time.isoformat(),
                "sort": "start_time:asc",
                "count": 50,
            },
        )
        if events_resp.status_code != 200:
            logger.error("Calendly /scheduled_events failed: %s", events_resp.text)
            raise HTTPException(status_code=502, detail="Failed to fetch Calendly events")

        events = events_resp.json().get("collection", [])

        # Step 3: fetch invitees in parallel to get participant names
        async def fetch_invitees(event_uri: str) -> str:
            uuid = event_uri.split("/")[-1]
            try:
                resp = await client.get(f"{CALENDLY_BASE}/scheduled_events/{uuid}/invitees")
                if resp.status_code == 200:
                    invitees = resp.json().get("collection", [])
                    if invitees:
                        return invitees[0].get("name", "Unknown")
            except Exception:
                pass
            return "Unknown"

        import asyncio
        participants = await asyncio.gather(*(fetch_invitees(e["uri"]) for e in events))

        # Step 4: build response
        result = []
        for event, participant in zip(events, participants):
            uuid = event["uri"].split("/")[-1]
            result.append({
                "id": uuid,
                "title": event.get("name", "Meeting"),
                "start_time": event.get("start_time"),
                "participant": participant,
                "event_url": f"https://calendly.com/app/scheduled_events/{uuid}",
            })

        return result
