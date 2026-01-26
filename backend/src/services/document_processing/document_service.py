# Shared document processing service for common operations across different document types
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException, UploadFile

from src.database.connection import mongo_connection
from src.api.utils import save_upload_file_tmp, cleanup_temp_file, validate_document_file

logger = logging.getLogger(__name__)

class DocumentService:
    """Shared service for common document processing operations"""
    
    @staticmethod
    async def validate_and_save_temp_file(file: UploadFile) -> str:
        """
        Validate file type and save to temporary location
        Returns: temporary file path
        """
        # Validate file type
        is_valid, error_msg = validate_document_file(file.filename)
        
        if not is_valid:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Accepted formats: PDF, DOC, DOCX"
            )
        
        # Save to temporary location
        tmp_file_path = await save_upload_file_tmp(file)
        return tmp_file_path
    
    @staticmethod
    async def store_file_metadata(
        user_email: str, 
        file: UploadFile, 
        document_type: str,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Store file metadata in database
        """
        db = mongo_connection.database
        
        # Create file metadata
        file_metadata = {
            "filename": file.filename,
            "uploaded_at": datetime.now(timezone.utc),
            "file_size": file.size,
            "document_type": document_type
        }
        
        # Add any additional data
        if additional_data:
            file_metadata.update(additional_data)
        
        # Update user record based on document type
        update_data = {
            f"{document_type}_file": file_metadata,
            "last_updated": datetime.now(timezone.utc)
        }
        
        # Add any additional fields to user record
        if additional_data:
            for key, value in additional_data.items():
                if key not in file_metadata:  # Don't duplicate metadata fields
                    update_data[key] = value
        
        result = db.Candidates.update_one(
            {"email": user_email},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info(f"{document_type} file uploaded for user: {user_email}")
        
        return {
            "message": f"{document_type.replace('_', ' ').title()} uploaded successfully",
            "filename": file.filename,
            "uploaded_at": file_metadata["uploaded_at"],
            "document_type": document_type
        }
    
    @staticmethod
    async def get_document_info(user_email: str, document_type: str) -> Dict[str, Any]:
        """
        Get document information for a user
        """
        db = mongo_connection.database
        user = db.Candidates.find_one({"email": user_email})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        document_data = user.get(f"{document_type}_file", {})
        
        return {
            f"has_{document_type}": bool(document_data),
            f"{document_type}_info": document_data
        }
    
    @staticmethod
    def cleanup_temp_file_safe(tmp_file_path: str):
        """
        Safely cleanup temporary file with error handling
        """
        try:
            cleanup_temp_file(tmp_file_path)
        except Exception as e:
            logger.warning(f"Failed to cleanup temp file {tmp_file_path}: {e}")
    
    @staticmethod
    async def handle_upload_error(error: Exception, user_email: str, document_type: str, tmp_file_path: str = None):
        """
        Handle upload errors with cleanup and logging
        """
        logger.error(f"Error uploading {document_type} for {user_email}: {str(error)}")
        
        if tmp_file_path:
            DocumentService.cleanup_temp_file_safe(tmp_file_path)
        
        if isinstance(error, HTTPException):
            raise error
        else:
            raise HTTPException(status_code=500, detail=f"Failed to upload {document_type}: {str(error)}")