# API routes for downloading documents from Azure Blob Storage
from fastapi import APIRouter, Depends
from typing import Dict

from src.services.storage.blob_storage import get_blob_storage
from src.api.auth_utils import get_current_mlg_recruiter, get_candidate_or_recruiter
from src.api.utils import validate_object_id
from src.api.routes.helpers import get_candidate_or_404, get_job_or_404

router = APIRouter()


@router.get("/documents/resume/{candidate_id}/download")
async def download_resume(
    candidate_id: str,
    current_user: Dict = Depends(get_candidate_or_recruiter),
):
    """Generate a SAS download URL for a candidate's resume."""
    validate_object_id(candidate_id)
    candidate = get_candidate_or_404(candidate_id, required_field="resume_blob_path", missing_msg="No resume uploaded")

    blob_storage = get_blob_storage()
    sas_url = blob_storage.generate_sas_url(candidate["resume_blob_path"])
    return {"download_url": sas_url, "filename": candidate.get("resume_filename", "resume")}


@router.get("/documents/job/{job_id}/download")
async def download_job_description(
    job_id: str,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """Generate a SAS download URL for a job description document."""
    validate_object_id(job_id)
    job = get_job_or_404(job_id, required_field="description_blob_path", missing_msg="No description document uploaded")

    blob_storage = get_blob_storage()
    sas_url = blob_storage.generate_sas_url(job["description_blob_path"])
    return {"download_url": sas_url, "filename": job.get("description_filename", "job_description")}


@router.get("/documents/clifton/{candidate_id}/download")
async def download_clifton_strengths(
    candidate_id: str,
    current_user: Dict = Depends(get_candidate_or_recruiter),
):
    """Generate a SAS download URL for a candidate's Clifton Strengths document."""
    validate_object_id(candidate_id)
    candidate = get_candidate_or_404(candidate_id, required_field="clifton_blob_path", missing_msg="No Clifton Strengths document uploaded")

    blob_storage = get_blob_storage()
    sas_url = blob_storage.generate_sas_url(candidate["clifton_blob_path"])
    return {"download_url": sas_url, "filename": candidate.get("clifton_filename", "clifton_strengths")}


@router.get("/documents/culture-job/{job_id}/download")
async def download_culture_document(
    job_id: str,
    current_user: Dict = Depends(get_current_mlg_recruiter),
):
    """Generate a SAS download URL for a job's culture document."""
    validate_object_id(job_id)
    job = get_job_or_404(job_id, required_field="culture_doc_blob_path", missing_msg="No culture document uploaded")

    blob_storage = get_blob_storage()
    sas_url = blob_storage.generate_sas_url(job["culture_doc_blob_path"])
    return {"download_url": sas_url, "filename": job.get("culture_doc_filename", "culture_document")}
