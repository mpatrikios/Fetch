from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends, Query
from fastapi.concurrency import run_in_threadpool
from typing import List
from datetime import datetime, timezone
import os
import uuid
import logging

from bson import ObjectId
from bson.errors import InvalidId
from src.api.utils import validate_object_id

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
    embed_job_description_culture,
)
from src.services.document_processing.culture_document_parser import (
    extract_text_from_culture_doc,
    suggest_clifton_strengths,
    VALID_CLIFTON_STRENGTHS,
)
from src.api.models import (
    JobResponse, JobListResponse, JobDetailsResponse, JobInfo, JobDetails,
    CultureDocumentUploadResponse, CliftonStrengthsUpdateRequest, CliftonStrengthsUpdateResponse,
    JobPartialParseResponse, JobFinalizeRequest,
)
from src.api.utils import save_upload_file_tmp, cleanup_temp_file, validate_document_file, validate_object_id
from src.api.auth_utils import get_current_mlg_recruiter
from src.services.storage.blob_storage import get_blob_storage, get_content_type
from src.api.routes.helpers import ensure_updated, delete_document_blobs, get_job_or_404

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_mlg_recruiter)])

@router.post("/job/upload")
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

        # Job title should be parsed from the document; if missing, ask the user to fill it in
        job_title = standardized_data.get("JobTitle")
        if not job_title:
            blob_path = None
            blob_filename = None
            try:
                with open(tmp_file_path, "rb") as f:
                    file_bytes = f.read()
                blob_storage = get_blob_storage()
                blob_path = f"job-descriptions/pending/{uuid.uuid4()}/{file.filename}"
                blob_url = blob_storage.upload_blob(blob_path, file_bytes, get_content_type(file.filename))
                blob_filename = file.filename
            except Exception as be:
                logger.error(f"Blob upload for partial parse failed: {be}")
            return JobPartialParseResponse(
                success=True,
                needs_review=True,
                message="Some fields could not be extracted — please fill in the missing details",
                company_name=company_name,
                parsed_fields={
                    "JobTitle": standardized_data.get("JobTitle") or "",
                    "Summary": standardized_data.get("Summary") or "",
                    "Locations": standardized_data.get("Locations") or [],
                    "Skills": standardized_data.get("Skills") or [],
                    "Responsibilities": standardized_data.get("Responsibilities") or [],
                    "Qualifications": standardized_data.get("Qualifications") or [],
                    "MinYears": standardized_data.get("MinYears") or "",
                    "CultureIndex": standardized_data.get("CultureIndex") or "",
                },
                blob_path=blob_path,
                blob_filename=blob_filename,
            )

        # Insert into MongoDB
        mongo_result = insert_job_description(standardized_data)
        if not mongo_result.get("success"):
            raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")
        mongo_id = mongo_result.get("document_id")
        if not mongo_id:
            raise HTTPException(status_code=500, detail="Failed to retrieve job ID after insertion")
        
        postedJob = {
            "JobTitle": job_title,
            "job_id": mongo_id
        }
        try:
            mongo_connection.clients_collection.update_one(
                {"companyName": company_name},
                {
                    "$setOnInsert": {
                        "status": "active",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$addToSet": {"postedJobs": postedJob}
                },
                upsert=True
            )
        except Exception as e:
            logger.error(f"Failed to update client postedJobs for {company_name}: {e}")

        # Retrieve the inserted job description
        job_doc = get_job_description(mongo_id)
        # Upload original document to Azure Blob Storage
        blob_stored = False
        try:
            with open(tmp_file_path, "rb") as f:
                file_bytes = f.read()
            blob_storage = get_blob_storage()
            blob_path = f"job-descriptions/{mongo_id}/{file.filename}"
            blob_content_type = get_content_type(file.filename)
            blob_url = blob_storage.upload_blob(blob_path, file_bytes, blob_content_type)

            mongo_connection.job_descriptions_collection.update_one(
                {"_id": ObjectId(mongo_id)},
                {"$set": {
                    "description_blob_path": blob_path,
                    "description_blob_url": blob_url,
                    "description_filename": file.filename,
                }}
            )
            blob_stored = True
        except Exception as e:
            logger.error(f"Blob storage upload failed for job {company_name}/{job_title}/{mongo_id}: {e}")

        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            logger.warning("OpenAI API key not set - skipping embeddings")
        else:
            try:
                await run_in_threadpool(embed_job_description_profile, job_doc)
                await run_in_threadpool(embed_job_description_location, job_doc)
                job_doc = get_job_description(mongo_id)
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
                has_embeddings="profile_embedding" in job_doc and "culture_embedding" in job_doc,
                job_id=f"{job_doc.get('companyName')}_{job_doc.get('JobTitle')}",
                mongo_id=mongo_id,
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Job description processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_file_path:
            cleanup_temp_file(tmp_file_path)

@router.post("/job/finalize", response_model=JobResponse)
async def finalize_job(body: JobFinalizeRequest):
    """Insert a job whose title (and optionally other fields) were filled in manually after partial parse."""
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Job title is required")

    mongo_doc = {
        "companyName": body.company_name,
        "JobTitle": body.title.strip(),
        "Summary": body.summary or None,
        "Locations": body.locations,
        "Skills": body.skills,
        "Responsibilities": body.responsibilities,
        "Qualifications": body.qualifications,
        "MinYears": body.min_years or None,
        "CultureIndex": body.culture_index or None,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
    }

    mongo_result = insert_job_description(mongo_doc)
    if not mongo_result.get("success"):
        raise HTTPException(status_code=500, detail=f"Database error: {mongo_result.get('error')}")
    mongo_id = mongo_result.get("document_id")
    if not mongo_id:
        raise HTTPException(status_code=500, detail="Failed to retrieve job ID after insertion")

    postedJob = {
        "JobTitle": body.title.strip(),
        "job_id": mongo_id
    }
    try:
        mongo_connection.clients_collection.update_one(
            {"companyName": body.company_name},
            {"$addToSet": {"postedJobs": postedJob}},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to update client postedJobs for {body.company_name}: {e}")

    job_doc = get_job_description(mongo_id)
    if not job_doc:
        raise HTTPException(status_code=500, detail="Failed to retrieve job after insertion")

    if body.blob_path and body.blob_filename:
        try:
            mongo_connection.job_descriptions_collection.update_one(
                {"_id": job_doc["_id"]},
                {"$set": {
                    "description_blob_path": body.blob_path,
                    "description_filename": body.blob_filename,
                }}
            )
        except Exception as e:
            logger.error(f"Blob path update failed: {e}")

    if os.getenv("AZURE_OPENAI_API_KEY"):
        try:
            await run_in_threadpool(embed_job_description_profile, job_doc)
            await run_in_threadpool(embed_job_description_location, job_doc)
            refreshed = get_job_description(mongo_id)
            if refreshed:
                job_doc = refreshed
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")

    return JobResponse(
        success=True,
        message="Job created successfully",
        job=JobInfo(
            company=job_doc.get("companyName", body.company_name),
            title=job_doc.get("JobTitle", ""),
            locations=job_doc.get("Locations", []),
            skills=job_doc.get("Skills", [])[:10],
            has_embeddings="profile_embedding" in job_doc and "culture_embedding" in job_doc,
            job_id=f"{job_doc.get('companyName')}_{job_doc.get('JobTitle')}",
            mongo_id=mongo_id
        )
    )


# Endpoint to list job descriptions
@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    limit: int = Query(500, ge=1, le=10000),
    offset: int = Query(0, ge=0)
):
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
        ).skip(offset).limit(limit))

        formatted_jobs = []
        for job in jobs:
            formatted_jobs.append({
                "company": job.get("companyName", "Unknown"),
                "title": job.get("JobTitle"),
                "locations": job.get("Locations", []),
                "skills": job.get("Skills", []),
                "has_embeddings": "profile_embedding" in job and "culture_embedding" in job,
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

@router.get("/jobs/{company_name}/{job_title}", response_model=List[JobDetailsResponse])
async def get_job_details_by_company_and_title(company_name: str, job_title: str):
    """Get all jobs with shared company name and job title"""
    try:
        jobs = mongo_connection.job_descriptions_collection.find({
            "companyName": company_name,
            "JobTitle": job_title
        })
    except Exception as e:
        logger.error(f"Failed to fetch job by company and title: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if not jobs:
        raise HTTPException(status_code=404, detail=f"Job {company_name}_{job_title} not found")
    
    job_details_list = []
    for job in jobs:
        job_details_list.append(
            JobDetailsResponse(
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
                    has_embeddings="profile_embedding" in job and "culture_embedding" in job,
                    has_description=bool(job.get("description_blob_path")),
                    last_match_generated_at=job.get("last_match_generated_at"),
                    suggested_clifton_strengths=job.get("suggested_clifton_strengths", []),
                    culture_strengths_status=job.get("culture_strengths_status"),
                    culture_doc_filename=job.get("culture_doc_filename"),
                )
            )
        )
    return job_details_list


# Endpoint to get full job details
@router.get("/jobs/{job_id}", response_model=JobDetailsResponse)
async def get_job_details_by_id(job_id: str):
    """Get one job's details including all fields"""
    validate_object_id(job_id)
    try:
        job = mongo_connection.job_descriptions_collection.find_one({
            "_id": ObjectId(job_id)
        })

        if not job:
            raise HTTPException(status_code=404, detail=f"Job ID: {job_id} not found")

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
                suggested_clifton_strengths=job.get("suggested_clifton_strengths", []),
                culture_strengths_status=job.get("culture_strengths_status"),
                culture_doc_filename=job.get("culture_doc_filename"),
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch job details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/{job_id}/culture-document", response_model=CultureDocumentUploadResponse)
async def upload_culture_document(
    job_id: str,
    file: UploadFile = File(...),
):
    """Upload a culture assessment document. LLM extracts suggested CliftonStrengths themes."""
    validate_object_id(job_id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    is_valid, _ = validate_document_file(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid file type. Accepted formats: PDF, DOC, DOCX")

    get_job_or_404(job_id)

    tmp_file_path = None
    try:
        tmp_file_path = await save_upload_file_tmp(file)

        try:
            culture_text = await run_in_threadpool(extract_text_from_culture_doc, tmp_file_path)
        except RuntimeError as e:
            raise HTTPException(status_code=422, detail=str(e))

        try:
            suggestions = await run_in_threadpool(suggest_clifton_strengths, culture_text)
        except Exception as e:
            logger.error(f"Clifton suggestions failed for job {job_id}: {e}")
            suggestions = []

        blob_stored = False
        blob_path = None
        blob_url = None
        try:
            with open(tmp_file_path, "rb") as f:
                file_bytes = f.read()
            blob_storage = get_blob_storage()
            blob_path = f"culture-documents/{job_id}/{file.filename}"
            blob_content_type = get_content_type(file.filename)
            blob_url = blob_storage.upload_blob(blob_path, file_bytes, blob_content_type)
            blob_stored = True
        except Exception as e:
            logger.error(f"Blob storage upload failed for culture doc {job_id}: {e}")

        update_fields = {
            "culture_doc_filename": file.filename,
            "suggested_clifton_strengths": suggestions,
            "culture_strengths_status": "pending_review",
        }
        if blob_stored:
            update_fields["culture_doc_blob_path"] = blob_path
            update_fields["culture_doc_blob_url"] = blob_url

        mongo_connection.job_descriptions_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update_fields}
        )

        return CultureDocumentUploadResponse(
            success=True,
            message="Culture document processed successfully",
            job_id=job_id,
            suggested_clifton_strengths=suggestions,
            culture_strengths_status="pending_review",
        )
    finally:
        if tmp_file_path:
            cleanup_temp_file(tmp_file_path)


@router.put("/jobs/{job_id}/clifton-strengths", response_model=CliftonStrengthsUpdateResponse)
async def update_clifton_strengths(job_id: str, body: CliftonStrengthsUpdateRequest):
    """Confirm/update Clifton Strengths for a job and generate the culture embedding."""
    validate_object_id(job_id)

    invalid = [s for s in body.clifton_strengths if s not in VALID_CLIFTON_STRENGTHS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid Clifton Strength names: {invalid}")

    strengths_for_storage = [{"name": s} for s in body.clifton_strengths]

    result = mongo_connection.job_descriptions_collection.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"clifton_strengths": strengths_for_storage, "culture_strengths_status": "confirmed"}}
    )
    ensure_updated(result, "Job")

    job_doc = mongo_connection.job_descriptions_collection.find_one({"_id": ObjectId(job_id)})

    embeddings_generated = False
    if os.getenv("AZURE_OPENAI_API_KEY") and job_doc:
        try:
            await run_in_threadpool(embed_job_description_culture, job_doc)
            embeddings_generated = True
        except Exception as e:
            logger.error(f"Culture embedding failed for job {job_id}: {e}")

    return CliftonStrengthsUpdateResponse(
        success=True,
        message="Clifton Strengths updated successfully",
        clifton_strengths=body.clifton_strengths,
        embeddings_generated=embeddings_generated,
    )


# Endpoint to update editable fields of a job description
@router.put("/jobs/{job_id}/update")
async def update_job(job_id: str, job_data: dict):
    """Update editable fields of a job description (MLG recruiter only)"""
    try:
        validate_object_id(job_id)

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
async def delete_job(job_id: str, company_name: str):
    """
    Delete a job description and its associated blobs from Azure Storage.
    Also deletes all match documents for this job.
    """
    validate_object_id(job_id)
    oid = ObjectId(job_id)

    job = mongo_connection.job_descriptions_collection.find_one(
        {"_id": oid}, {"description_blob_path": 1, "culture_doc_blob_path": 1, "companyName": 1, "JobTitle": 1}
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    delete_document_blobs(job, ["description_blob_path", "culture_doc_blob_path"], job_id)

    mongo_connection.job_descriptions_collection.delete_one({"_id": oid})

    mongo_connection.matches_collection.delete_many(
        {
            "$or": [
                {"JobId": job_id},
                {
                    "companyName": job.get("companyName"),
                    "JobTitle": job.get("JobTitle"),
                },
            ]
        }
    )

    logger.info(f"Job {job_id} deleted")

    client = mongo_connection.clients_collection.find_one(
        {"companyName": company_name}, {"postedJobs": 1}
    )
    if client and client.get("postedJobs"):
        mongo_connection.clients_collection.update_one(
            {"_id": client["_id"]},
            {"$pull": {"postedJobs": {"job_id": job_id}}}
        )
        logger.info(f"Job {job_id} removed from client {company_name}'s profile")
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