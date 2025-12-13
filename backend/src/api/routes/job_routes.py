from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Optional
import os
from pathlib import Path
import sys
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database.insert_to_mongo import insert_job_description, get_job_description
from src.database.connection import mongo_connection
from src.services.document_processing.azure_job_description_parser import (
    AzureContentUnderstandingClient as JDClient,
    Settings as JDSettings
)
from src.services.document_processing.job_description_standardizing import standardize_job_description
from src.services.embeddings.generate_embeddings import (
    embed_job_description_profile,
    embed_job_description_location,
    embed_job_description_culture
)
from src.api.models import JobResponse, JobListResponse
from src.api.utils import save_upload_file_tmp, cleanup_temp_file, validate_document_file

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/job/upload", response_model=JobResponse)
async def upload_job_description(
    file: UploadFile = File(...),
    company_name: str = Form(...)
):
    """
    Upload a job description document.
    Accepts PDF, DOC, and DOCX files.
    Company name must be selected from frontend to ensure client exists in DB. 
    """
    # Validate file type
    is_valid, _ = validate_document_file(file.filename)
    
    if not is_valid:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Accepted formats: PDF, DOC, DOCX"
        )
    
    # Validate company name is picked by user
    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")
    
    # try block to process the document with Azure Content Understanding
    try:
        tmp_file_path = await save_upload_file_tmp(file)
        
        subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
        if not subscription_key:
            raise HTTPException(status_code=500, detail="Azure API key not configured")
        
        settings = JDSettings(
            endpoint="https://fetch-contentunderstanding.services.ai.azure.com/",
            api_version="2025-05-01-preview",
            subscription_key=subscription_key,
            aad_token=None,
            analyzer_id="job_description_parser_v1", # Predefined analyzer for job descriptions, change is schema changes
            file_location=tmp_file_path
        )
        
        client = JDClient(
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
        
        # Standardize with the provided company name
        standardized_data = standardize_job_description(azure_result, company_name)
        
        # Job title should be parsed from the document
        job_title = standardized_data.get("JobTitle")
        if not job_title:
            raise HTTPException(status_code=400, detail="Could not extract job title from document")
        
        # Insert into MongoDB
        mongo_result = insert_job_description(standardized_data)
        if not mongo_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")
        
        # Retrieve the inserted job description
        job_doc = get_job_description(company_name, job_title)
        if not job_doc:
            raise HTTPException(status_code=500, detail="Failed to retrieve job after insertion")
        
        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            logger.warning("OpenAI API key not set - skipping embeddings")
        else:
        # try block to create job embeddings
            try:
                embed_job_description_profile(job_doc)
                embed_job_description_location(job_doc)
                job_doc = get_job_description(company_name, job_title)
            except Exception as e:
                logger.error(f"Embedding generation failed: {e}")
        
        # successful response if all steps complete
        return JobResponse(
            success=True,
            message=f"Job description processed successfully",
            job={
                "company": job_doc.get("CompanyName", company_name),
                "title": job_doc.get("JobTitle"),
                "location": job_doc.get("Location"),
                "skills": job_doc.get("Skills", [])[:10],
                "has_embeddings": "profile_embedding" in job_doc,
                "job_id": f"{job_doc.get('CompanyName')}_{job_doc.get('JobTitle')}"
            }
        )
        
    except Exception as e:
        logger.error(f"Job description processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'tmp_file_path' in locals():
            cleanup_temp_file(tmp_file_path)

# Endpoint to list job descriptions
@router.get("/jobs", response_model=JobListResponse)
async def list_jobs():
    try:
        jobs = list(mongo_connection.job_descriptions_collection.find(
            {}, 
            {
                "_id": 0,
                "CompanyName": 1,
                "JobTitle": 1,
                "Location": 1,
                "Skills": {"$slice": 10},
                "profile_embedding": {"$exists": True}
            }
        ).limit(100))
        
        formatted_jobs = []
        for job in jobs:
            formatted_jobs.append({
                "company": job.get("CompanyName", "Unknown"),
                "title": job.get("JobTitle"),
                "location": job.get("Location"),
                "skills": job.get("Skills", []),
                "has_embeddings": "profile_embedding" in job,
                "job_id": f"{job.get('CompanyName')}_{job.get('JobTitle')}"
            })
        
        return JobListResponse(
            success=True,
            count=len(formatted_jobs),
            jobs=formatted_jobs
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# endpoint to get unique company names for dropdown lists, like filters or selecting company on upload
@router.get("/companies")
async def list_companies():
    """Get list of unique company names for dropdown selection"""
    try:
        companies = mongo_connection.job_descriptions_collection.distinct("CompanyName")
        return {
            "success": True,
            "companies": sorted(companies)
        }
    except Exception as e:
        logger.error(f"Failed to fetch companies: {e}")
        raise HTTPException(status_code=500, detail=str(e))