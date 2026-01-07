# API routes for uploading and processing CliftonStrengths assessment documents
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict
import logging
from datetime import datetime

from src.services.document_processing.document_service import DocumentService
from src.services.document_processing.azure_clifton_parser import azure_clifton_parser, parse_clifton_strengths_result
from src.api.routes.auth_routes import get_current_user

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
            "azure_processed_at": datetime.utcnow(),
        }
        
        # Store file metadata using shared service
        result = await DocumentService.store_file_metadata(
            user_email=current_user["email"],
            file=file,
            document_type="clifton_strengths",
            additional_data=additional_data
        )
        
        # Clean up temporary file
        DocumentService.cleanup_temp_file_safe(tmp_file_path)
        
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