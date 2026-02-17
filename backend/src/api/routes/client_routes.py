# API routes for client management (list, get details, update)
from fastapi import APIRouter, HTTPException, Query, Depends
import logging
from typing import Optional
from datetime import datetime, timezone

from src.database.connection import mongo_connection
from src.api.models import ClientListResponse, ClientDetailsResponse, ClientUpdateRequest
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
            query_filter["status"] = {"$regex": f"^{status}$", "$options": "i"}

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


@router.put("/clients/{client_id}/update")
async def update_client(client_id: str, client_data: ClientUpdateRequest):
    """Update editable fields of a client (MLG recruiter only)"""
    validate_object_id(client_id)

    try:
        # Whitelist allowed fields, mapping API names to MongoDB field names
        field_mapping = {
            "company_name": "companyName",
            "status": "status",
            "contact_email": "contactEmail",
            "contact_number": "contactNumber",
            "contact_recruiter": "contactRecruiter",
            "summary": "summary",
            "locations": "locations",
        }

        # Only include fields that were explicitly provided (not None)
        provided_fields = client_data.model_dump(exclude_none=True)
        update_fields = {}
        for api_field, mongo_field in field_mapping.items():
            if api_field in provided_fields:
                update_fields[mongo_field] = provided_fields[api_field]

        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        update_fields["profile_updated_at"] = datetime.now(timezone.utc)

        result = mongo_connection.clients_collection.update_one(
            {"_id": ObjectId(client_id)},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Client not found")

        logger.info(f"Client {client_id} updated successfully")
        return {"success": True, "message": "Client updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update client {client_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
