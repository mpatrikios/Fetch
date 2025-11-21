# API routes for uploading and processing resume documents, and fetching candidate data.
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Dict
import os
import sys
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database.insert_to_mongo import upsert_candidate, get_candidate
from src.database.connection import mongo_connection
from src.services.document_processing.azure_resume_parser import AzureContentUnderstandingClient, Settings
from src.services.document_processing.resume_standardizing import standardize_resume
from src.services.embeddings.generate_embeddings import (
    embed_candidate_profile,
    embed_candidate_location,
    embed_candidate_culture
)
from src.api.models import CandidateResponse, CandidateListResponse
from src.api.utils import save_upload_file_tmp, cleanup_temp_file, validate_document_file
from src.api.routes.auth_routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# API endpoint to upload and process a resume document
@router.post("/resume/upload", response_model=CandidateResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload a resume document for the authenticated user.
    Accepts PDF, DOC, and DOCX files.
    """
    
    # Validate file type
    is_valid, _ = validate_document_file(file.filename)
    
    if not is_valid:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Accepted formats: PDF, DOC, DOCX"
        )
    
    # try block to process the document with Azure Content Understanding
    try:
        tmp_file_path = await save_upload_file_tmp(file)
        
        # Use the authenticated user's information
        user_id = current_user["_id"]
        user_name = current_user["name"]
        user_email = current_user["email"]
        
        subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
        if not subscription_key:
            raise HTTPException(status_code=500, detail="Azure API key not configured")
        
        settings = Settings(
            endpoint="https://fetch-contentunderstanding.services.ai.azure.com/",
            api_version="2025-05-01-preview",
            subscription_key=subscription_key,
            aad_token=None,
            analyzer_id="resume_parser_v3",
            file_location=tmp_file_path
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
        
        # standardize and upsert candidate data
        standardized_data = standardize_resume(azure_result, user_name)
        
        # Add authenticated user's information
        standardized_data["full_name"] = user_name  
        standardized_data["Email"] = user_email  
        standardized_data["status"] = "uploaded_resume"  # Update status
        
        # Use existing upsert_candidate function with user_id parameter
        mongo_result = upsert_candidate(standardized_data, user_id=user_id)
        if not mongo_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")
        
        # Use existing get_candidate function with user_id parameter
        candidate_doc = get_candidate(user_id=user_id)
        if not candidate_doc:
            raise HTTPException(status_code=500, detail="Failed to retrieve candidate after insertion")
        
        # create embeddings for candidate
        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            logger.warning("OpenAI API key not set - skipping embeddings")
        else:
            try:
                embed_candidate_profile(candidate_doc)
                embed_candidate_location(candidate_doc)
                candidate_doc = get_candidate(user_id=user_id)
            except Exception as e:
                logger.error(f"Embedding generation failed: {e}")
        
        # return successful response
        return CandidateResponse(
            success=True,
            message=f"Resume processed successfully",
            candidate={
                "name": candidate_doc.get("full_name", user_name),
                "email": candidate_doc.get("Email"),
                "location": candidate_doc.get("Location"),
                "skills": candidate_doc.get("Skills", [])[:10],
                "has_embeddings": "profile_embedding" in candidate_doc
            }
        )
        
    except Exception as e:
        logger.error(f"Resume processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'tmp_file_path' in locals():
            cleanup_temp_file(tmp_file_path)

# api endpoint to list candidates with basic info
@router.get("/candidates", response_model=CandidateListResponse)
async def list_candidates():
    try:
        candidates = list(mongo_connection.candidates_collection.find(
            {}, 
            {
                "_id": 0,
                "full_name": 1,
                "Email": 1,
                "Location": 1,
                "Skills": {"$slice": 10},
                "profile_embedding": {"$exists": True}
            }
        ).limit(100))
        
        formatted_candidates = []
        for candidate in candidates:
            formatted_candidates.append({
                "name": candidate.get("full_name", "Unknown"),
                "email": candidate.get("Email"),
                "location": candidate.get("Location"),
                "skills": candidate.get("Skills", []),
                "has_embeddings": "profile_embedding" in candidate
            })
        
        return CandidateListResponse(
            success=True,
            count=len(formatted_candidates),
            candidates=formatted_candidates
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))