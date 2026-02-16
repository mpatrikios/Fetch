# API routes for uploading and processing CliftonStrengths assessment documents
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict
import logging
from datetime import datetime, timezone

from src.services.document_processing.document_service import DocumentService
from src.services.document_processing.azure_clifton_parser import azure_clifton_parser, parse_clifton_strengths_result
from src.api.routes.auth_routes import get_current_user
from src.database.connection import mongo_connection
from src.services.storage.blob_storage import get_blob_storage, get_content_type

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/clifton-strengths/upload")
async def upload_clifton_strengths(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload a CliftonStrengths assessment document for the authenticated user.
    Accepts PDF, DOC, and DOCX files.
    """
    tmp_file_path = None
    
    try:
        # Read file bytes for blob storage before consuming the stream
        file_bytes = await file.read()
        await file.seek(0)

        # Validate and save temporary file
        tmp_file_path = await DocumentService.validate_and_save_temp_file(file)
        
        # Process with Azure CliftonStrengths Content Understanding model
        azure_result = azure_clifton_parser(tmp_file_path)
        processed_data = parse_clifton_strengths_result(azure_result)
        
        # Prepare additional data with Azure processing results
        additional_data = {
            "strengths_themes": processed_data.get("strengths_themes", []),
            "theme_descriptions": processed_data.get("theme_descriptions", {}),
            "assessment_date": processed_data.get("assessment_date", ""),
            "participant_name": processed_data.get("participant_name", ""),
            "processing_status": "completed" if azure_result else "failed",
            "azure_processed_at": datetime.now(timezone.utc),
        }
        
        # Store file metadata using shared service
        result = await DocumentService.store_file_metadata(
            user_email=current_user["email"],
            file=file,
            document_type="clifton_strengths",
            additional_data=additional_data
        )
        
        # Update candidate document with Clifton Strengths
        if processed_data.get("strengths_themes"):
            try:
                mongo_connection.candidates_collection.update_one(
                    {"Email": current_user["email"]},
                    {
                        "$set": {
                            "clifton_strengths": processed_data["strengths_themes"],
                            "clifton_strengths_updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
                logger.info(f"Updated candidate document with Clifton Strengths for {current_user['email']}")
            except Exception as e:
                logger.error(f"Failed to update candidate document with Clifton Strengths for {current_user['email']}: {e}")
                raise

        # Upload original document to Azure Blob Storage
        blob_stored = False
        try:
            blob_storage = get_blob_storage()
            user_id = str(current_user["_id"])
            blob_path = f"clifton-strengths/{user_id}/{file.filename}"
            blob_content_type = get_content_type(file.filename)
            blob_url = blob_storage.upload_blob(blob_path, file_bytes, blob_content_type)

            mongo_connection.candidates_collection.update_one(
                {"email": current_user["email"]},
                {"$set": {
                    "clifton_blob_path": blob_path,
                    "clifton_blob_url": blob_url,
                    "clifton_filename": file.filename,
                }}
            )
            blob_stored = True
        except Exception as e:
            logger.error(f"Blob storage upload failed for Clifton Strengths for {current_user['email']}: {e}")

        # Clean up temporary file
        DocumentService.cleanup_temp_file_safe(tmp_file_path)

        if not blob_stored:
            result["warning"] = "Original document could not be stored for download"
        return result
        
    except Exception as e:
        await DocumentService.handle_upload_error(
            error=e,
            user_email=current_user["email"],
            document_type="clifton_strengths",
            tmp_file_path=tmp_file_path
        )

@router.get("/clifton-strengths")
async def get_clifton_strengths(current_user: Dict = Depends(get_current_user)):
    """
    Get CliftonStrengths information for the authenticated user.
    """
    try:
        return await DocumentService.get_document_info(
            user_email=current_user["email"],
            document_type="clifton_strengths"
        )
        
    except Exception as e:
        logger.error(f"Error fetching CliftonStrengths info for {current_user['email']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch CliftonStrengths information")