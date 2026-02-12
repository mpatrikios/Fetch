# API routes for client management (list, get details)
from fastapi import APIRouter, HTTPException, Query, Depends
import logging
from typing import Optional

from src.database.connection import mongo_connection
from src.api.models import ClientListResponse, ClientDetailsResponse
from src.api.auth_utils import get_current_mlg_recruiter
from bson import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])


def validate_object_id(client_id: str) -> None:
    """Validate that client_id is a valid ObjectId format."""
    try:
        ObjectId(client_id)
    except InvalidId:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid client ID format: {client_id}"
        )


@router.get("/clients", response_model=ClientListResponse)
async def list_clients(
    status: Optional[str] = Query(None, description="Filter by client status: onboarding, active, etc.")
):
    """List all clients with optional status filter"""
    try:
        # Build query filter
        query_filter = {}
        if status:
            query_filter["status"] = status

        clients = list(mongo_connection.clients_collection.find(
            query_filter,
            {
                "_id": 1,
                "companyName": 1,
                "status": 1,
                "contactEmail": 1,
                "locations": 1,
                "postedJobs": 1
            }
        ).sort("companyName", 1).limit(100))

        formatted_clients = []
        for client in clients:
            posted_jobs = client.get("postedJobs", [])
            formatted_clients.append({
                "id": str(client.get("_id")),
                "company_name": client.get("companyName", "Unknown"),
                "status": client.get("status"),
                "contact_email": client.get("contactEmail"),
                "locations": client.get("locations", []),
                "posted_jobs_count": len(posted_jobs) if isinstance(posted_jobs, list) else 0
            })

        return ClientListResponse(
            success=True,
            count=len(formatted_clients),
            clients=formatted_clients
        )

    except Exception as e:
        logger.error(f"Failed to fetch clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clients/{client_id}", response_model=ClientDetailsResponse)
async def get_client_details(client_id: str):
    """Get full details for a specific client"""
    validate_object_id(client_id)

    try:
        client = mongo_connection.clients_collection.find_one(
            {"_id": ObjectId(client_id)}
        )

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        return ClientDetailsResponse(
            success=True,
            client={
                "id": str(client.get("_id")),
                "company_name": client.get("companyName", ""),
                "status": client.get("status"),
                "contact_email": client.get("contactEmail"),
                "contact_number": client.get("contactNumber"),
                "contact_recruiter": client.get("contactRecruiter"),
                "summary": client.get("summary"),
                "locations": client.get("locations", []),
                "posted_jobs": client.get("postedJobs", [])
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch client details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
