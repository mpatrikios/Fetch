# API routes for uploading resume documents to Azure Blob Storage.
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict
from datetime import datetime, timezone
import logging

from bson import ObjectId

from src.database.connection import mongo_connection
from src.api.models import ResumeUploadResponse
from src.api.utils import validate_document_file
from src.api.routes.auth_routes import get_current_user
from src.services.storage.blob_storage import get_blob_storage, get_content_type

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/resume/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload a resume document for the authenticated user.
    Stores the file in Azure Blob Storage (no parsing at this stage).
    Parsing happens when a recruiter accepts the candidate.
    """

    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    is_valid, _ = await validate_document_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Accepted formats: PDF, DOC, DOCX"
        )

    try:
        user_id = current_user["_id"]
        file_bytes = await file.read()

        # Upload to Azure Blob Storage
        blob_storage = get_blob_storage()
        blob_path = f"resumes/{user_id}/{file.filename}"
        content_type = get_content_type(file.filename)
        blob_url = blob_storage.upload_blob(blob_path, file_bytes, content_type)

        # Update candidate record with blob reference and status
        mongo_connection.candidates_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "resume_blob_path": blob_path,
                    "resume_blob_url": blob_url,
                    "resume_filename": file.filename,
                    "resume_uploaded_at": datetime.now(timezone.utc),
                    "status": "onboarding"
                }
            }
        )

        return ResumeUploadResponse(
            success=True,
            message="Resume uploaded successfully",
            filename=file.filename,
        )

    except Exception as e:
        logger.error(f"Resume upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
