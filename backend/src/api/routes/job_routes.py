from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.concurrency import run_in_threadpool
from typing import List, Optional
from datetime import datetime, timezone
import os
import logging

from bson import ObjectId
from bson.errors import InvalidId
from src.database.insert_to_mongo import insert_job_description, get_job_description
from src.database.connection import mongo_connection
from src.services.document_processing.azure_job_description_parser import (
    AzureContentUnderstandingClient as JDClient,
    Settings as JDSettings
)
from src.services.document_processing.job_description_standardizing import standardize_job_description
from src.services.embeddings.generate_embeddings import (
    embed_job_description_profile,
    embed_job_description_location
)
from src.api.models import JobResponse, JobListResponse, JobDetailsResponse, JobInfo, JobDetails
from src.api.utils import save_upload_file_tmp, cleanup_temp_file, validate_document_file
from src.api.auth_utils import get_current_mlg_recruiter
from src.services.storage.blob_storage import get_blob_storage, get_content_type
from src.api.routes.helpers import ensure_updated, delete_document_blobs

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])

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
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    
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
    tmp_file_path = None
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
        
        response = await run_in_threadpool(client.begin_analyze, settings.analyzer_id, settings.file_location)
        azure_result = await run_in_threadpool(
            client.poll_result,
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
        job_docs = get_job_description(company_name, job_title)
        if not job_docs:
            raise HTTPException(status_code=500, detail="Failed to retrieve job after insertion")
        
        job_doc = job_docs[0] if isinstance(job_docs, list) else job_docs

        # Upload original document to Azure Blob Storage
        blob_stored = False
        try:
            with open(tmp_file_path, "rb") as f:
                file_bytes = f.read()
            blob_storage = get_blob_storage()
            document_id = str(job_doc.get("_id"))
            blob_path = f"job-descriptions/{document_id}/{file.filename}"
            blob_content_type = get_content_type(file.filename)
            blob_url = blob_storage.upload_blob(blob_path, file_bytes, blob_content_type)

            mongo_connection.job_descriptions_collection.update_one(
                {"_id": job_doc["_id"]},
                {"$set": {
                    "description_blob_path": blob_path,
                    "description_blob_url": blob_url,
                    "description_filename": file.filename,
                }}
            )
            blob_stored = True
        except Exception as e:
            logger.error(f"Blob storage upload failed for job {company_name}/{job_title}: {e}")

        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            logger.warning("OpenAI API key not set - skipping embeddings")
        else:
            try:
                await run_in_threadpool(embed_job_description_profile, job_doc)
                await run_in_threadpool(embed_job_description_location, job_doc)
                job_doc = get_job_description(company_name, job_title)
            except Exception as e:
                logger.error(f"Embedding generation failed: {e}")
        
        # successful response if all steps complete
        message = "Job description processed successfully"
        if not blob_stored:
            message += " (warning: original document could not be stored for download)"
        
        if not isinstance(job_doc, dict):
            raise HTTPException(status_code=500, detail="Invalid job document format")
        
        return JobResponse(
            success=True,
            message=message,
            job=JobInfo(
                company=job_doc.get("companyName", company_name),
                title=job_doc.get("JobTitle", ""),
                locations=job_doc.get("Locations", []),
                skills=job_doc.get("Skills", [])[:10],
                has_embeddings="profile_embedding" in job_doc,
                job_id=f"{job_doc.get('companyName')}_{job_doc.get('JobTitle')}"
            )
        )
        
    except Exception as e:
        logger.error(f"Job description processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_file_path:
            cleanup_temp_file(tmp_file_path)

# Endpoint to list job descriptions
@router.get("/jobs", response_model=JobListResponse)
async def list_jobs():
    try:
        jobs = list(mongo_connection.job_descriptions_collection.find(
            {"profile_embedding": {"$exists": True}, "companyName": {"$exists": True, "$ne": None}},
            {
                "_id": 1,
                "companyName": 1,
                "JobTitle": 1,
                "Locations": 1,
                "Skills": {"$slice": 10},
                "last_match_generated_at": 1
            }
        ).limit(100))

        formatted_jobs = []
        for job in jobs:
            formatted_jobs.append({
                "company": job.get("companyName", "Unknown"),
                "title": job.get("JobTitle"),
                "locations": job.get("Locations", []),
                "skills": job.get("Skills", []),
                "has_embeddings": "profile_embedding" in job,
                "job_id": f"{job.get('companyName')}_{job.get('JobTitle')}",
                "mongo_id": str(job.get("_id")),
                "last_match_generated_at": job.get("last_match_generated_at")
            })
        
        return JobListResponse(
            success=True,
            count=len(formatted_jobs),
            jobs=formatted_jobs
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to get full job details
@router.get("/jobs/{company_name}/{job_title}", response_model=JobDetailsResponse)
async def get_job_details(company_name: str, job_title: str):
    """Get full job details including all fields"""
    try:
        job = mongo_connection.job_descriptions_collection.find_one({
            "companyName": company_name,
            "JobTitle": job_title
        })

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return JobDetailsResponse(
            success=True,
            job=JobDetails(
                job_id=f"{job.get('companyName')}_{job.get('JobTitle')}",
                mongo_id=str(job.get("_id")),
                company=job.get("companyName", ""),
                title=job.get("JobTitle", ""),
                summary=job.get("Summary"),
                locations=job.get("Locations", []),
                skills=job.get("Skills", []),
                responsibilities=job.get("Responsibilities", []),
                min_years=job.get("MinYears"),
                culture_index=job.get("CultureIndex"),
                qualifications=job.get("Qualifications", []),
                clifton_strengths=[str(s.get("name")) if isinstance(s, dict) and s.get("name") else str(s) for s in job.get("clifton_strengths", []) if s],
                has_embeddings="profile_embedding" in job,
                has_description=bool(job.get("description_blob_path")),
                last_match_generated_at=job.get("last_match_generated_at"),
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch job details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint to update editable fields of a job description
@router.put("/jobs/{job_id}/update")
async def update_job(job_id: str, job_data: dict):
    """Update editable fields of a job description (MLG recruiter only)"""
    try:
        try:
            ObjectId(job_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail=f"Invalid job ID format: {job_id}")

        # Whitelist allowed fields, mapping API names to MongoDB field names
        field_mapping = {
            "summary": "Summary",
            "locations": "Locations",
            "skills": "Skills",
            "responsibilities": "Responsibilities",
            "qualifications": "Qualifications",
            "min_years": "MinYears",
            "culture_index": "CultureIndex",
        }

        update_fields = {}
        for api_field, mongo_field in field_mapping.items():
            if api_field in job_data:
                update_fields[mongo_field] = job_data[api_field]

        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        update_fields["profile_updated_at"] = datetime.now(timezone.utc)

        result = mongo_connection.job_descriptions_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update_fields}
        )

        ensure_updated(result, "Job")

        # Regenerate embeddings if content-relevant fields changed
        embedding_fields = {"Summary", "Skills", "Responsibilities", "Qualifications"}
        location_fields = {"Locations"}
        needs_profile_embedding = bool(embedding_fields & set(update_fields.keys()))
        needs_location_embedding = bool(location_fields & set(update_fields.keys()))

        if needs_profile_embedding or needs_location_embedding:
            try:
                job_doc = mongo_connection.job_descriptions_collection.find_one(
                    {"_id": ObjectId(job_id)}
                )
                if job_doc:
                    openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
                    if openai_api_key:
                        if needs_profile_embedding:
                            embed_job_description_profile(job_doc)
                        if needs_location_embedding:
                            embed_job_description_location(job_doc)
                    else:
                        logger.warning("OpenAI API key not set - skipping embedding regeneration")
            except Exception as e:
                logger.error(f"Embedding regeneration failed after job update: {e}")

        logger.info(f"Job {job_id} updated successfully")
        return {"success": True, "message": "Job updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """
    Delete a job description and its associated blob from Azure Storage.
    Historical match documents referencing this job are left intact.
    """
    try:
        oid = ObjectId(job_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    job = mongo_connection.job_descriptions_collection.find_one(
        {"_id": oid}, {"description_blob_path": 1}
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    delete_document_blobs(job, ["description_blob_path"], job_id)

    mongo_connection.job_descriptions_collection.delete_one({"_id": oid})
    logger.info(f"Job {job_id} deleted")
    return {"success": True, "message": "Job deleted successfully"}


# endpoint to get unique company names for dropdown lists, like filters or selecting company on upload
@router.get("/companies")
async def list_companies():
    """Get list of unique company names for dropdown selection"""
    try:
        companies = mongo_connection.job_descriptions_collection.distinct("companyName")
        return {
            "success": True,
            "companies": sorted(companies)
        }
    except Exception as e:
        logger.error(f"Failed to fetch companies: {e}")
        raise HTTPException(status_code=500, detail=str(e))