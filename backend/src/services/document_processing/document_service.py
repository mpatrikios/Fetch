# Shared document processing service for common operations across different document types
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException, UploadFile

from src.database.connection import mongo_connection
from src.database.insert_to_mongo import upsert_candidate, get_candidate
from src.api.utils import save_upload_file_tmp, cleanup_temp_file, validate_document_file
from src.services.document_processing.azure_resume_parser import AzureContentUnderstandingClient, Settings
from src.services.document_processing.resume_standardizing import standardize_resume
from src.services.document_processing.fallback_resume_parser import fallback_parse
from src.services.embeddings.generate_embeddings import embed_candidate_profile, embed_candidate_location

logger = logging.getLogger(__name__)

# Centralized Azure Content Understanding configuration
AZURE_CU_ENDPOINT = "https://fetch-contentunderstanding.services.ai.azure.com/"
AZURE_CU_API_VERSION = "2025-05-01-preview"
RESUME_ANALYZER_ID = "resume_parser_v3"

class DocumentService:
    """Shared service for common document processing operations"""
    
    @staticmethod
    def parse_and_embed_resume(candidate_id: str, file_path: str, email: str) -> None:
        """
        Run the full resume parsing and embedding pipeline on a file.
        Downloads are handled by the caller; this takes a local file path.

        Args:
            candidate_id: MongoDB ObjectId string for the candidate
            file_path: Local path to the resume file
            email: Candidate's email for the upserted record

        Raises:
            HTTPException: If Azure API key is missing or DB upsert fails
            Exception: If Azure parsing or embedding fails
        """
        subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
        if not subscription_key:
            raise HTTPException(status_code=500, detail="Azure API key not configured")

        settings = Settings(
            endpoint=AZURE_CU_ENDPOINT,
            api_version=AZURE_CU_API_VERSION,
            subscription_key=subscription_key,
            aad_token=None,
            analyzer_id=RESUME_ANALYZER_ID,
            file_location=file_path,
        )

        client = AzureContentUnderstandingClient(
            settings.endpoint,
            settings.api_version,
            subscription_key=settings.subscription_key,
            token_provider=settings.token_provider,
        )

        response = client.begin_analyze(settings.analyzer_id, settings.file_location)
        azure_result = client.poll_result(
            response,
            timeout_seconds=60 * 60,
            polling_interval_seconds=1,
        )

        # Log only metadata about the Azure analysis to avoid leaking PII or large payloads
        logger.info(
            "Azure resume analysis completed",
            extra={
                "candidate_id": candidate_id,
                "analyzer_id": settings.analyzer_id,
                "file_name": os.path.basename(file_path),
            },
        )

        standardized_data = standardize_resume(azure_result)

        # Fill empty fields using the text-based fallback parser
        needs_fallback = (
            not standardized_data.get("Skills")
            or not standardized_data.get("Experience")
            or not standardized_data.get("Companies")
            or not standardized_data.get("Location")
        )
        if needs_fallback:
            try:
                fallback_data = fallback_parse(file_path)
                for field in ("Skills", "Experience", "Companies", "Location", "Summary"):
                    if not standardized_data.get(field) and fallback_data.get(field):
                        standardized_data[field] = fallback_data[field]
                logger.info(
                    "Fallback parser supplemented missing fields",
                    extra={
                        "candidate_id": candidate_id,
                        "file_name": os.path.basename(file_path),
                        "filled_fields": [
                            f for f in ("Skills", "Experience", "Companies", "Location", "Summary")
                            if fallback_data.get(f)
                        ],
                    },
                )
            except Exception as e:
                logger.warning(f"Fallback parser failed for {file_path}: {e}")

        if not standardized_data.get("Skills"):
            raise ValueError(
                "No skills found in this resume after parsing. "
                "Please ask the candidate to update their profile with skills before re-accepting."
            )

        # Log only metadata about the standardization step
        logger.info(
            "Resume standardization completed",
            extra={
                "candidate_id": candidate_id,
                "analyzer_id": settings.analyzer_id,
                "file_name": os.path.basename(file_path),
            },
        )
        standardized_data["email"] = email

        mongo_result = upsert_candidate(standardized_data, user_id=candidate_id)
        if not mongo_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")

        # Generate embeddings (non-critical — log and continue on failure)
        candidate_doc = get_candidate(user_id=candidate_id)
        if candidate_doc:
            openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
            if openai_api_key:
                try:
                    embed_candidate_profile(candidate_doc)
                    embed_candidate_location(candidate_doc)
                except Exception as e:
                    logger.error(f"Embedding generation failed for candidate {candidate_id}: {e}")
            else:
                logger.warning("OpenAI API key not set - skipping embeddings")

    @staticmethod
    async def validate_and_save_temp_file(file: UploadFile) -> str:
        """
        Validate file type and save to temporary location
        Returns: temporary file path
        """
        # Validate file type
        is_valid, _ = validate_document_file(file.filename)
        
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