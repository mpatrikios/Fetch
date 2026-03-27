# common utility functions for file handling and validation
import os
import tempfile
import logging
from typing import Tuple
from fastapi import HTTPException, UploadFile
from bson import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)


def validate_object_id(id_str: str) -> None:
    """Validate that a string is a valid MongoDB ObjectId format."""
    try:
        ObjectId(id_str)
    except InvalidId:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ID format: {id_str}"
        )

# function for saving uploaded files to a temporary location
async def save_upload_file_tmp(upload_file) -> str:
    """
    Save an uploaded file to a temporary location.
    
    Args:
        upload_file: FastAPI UploadFile object
        
    Returns:
        Path to the temporary file
    """
    try:
        suffix = os.path.splitext(upload_file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            content = await upload_file.read()
            tmp_file.write(content)
            return tmp_file.name
    except Exception as e:
        logger.error(f"Failed to save upload file: {e}")
        raise

# function for cleaning up temporary files
def cleanup_temp_file(file_path: str) -> None:
    """
    Remove a temporary file if it exists.
    
    Args:
        file_path: Path to the file to remove
    """
    try:
        if file_path and os.path.exists(file_path):
            os.unlink(file_path)
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file {file_path}: {e}")

# function for validating document file types
async def validate_document_file(file: UploadFile) -> Tuple[bool, str]:
    """
    Validate that the file's type is acceptable based on its content, not extension.
    Acceptable file types are PDF, DOC, and DOCX.
    Args:
        file: FastAPI UploadFile object
        
    Returns:
        Tuple of (is_valid, file_extension)
    """
    if not file:
        raise HTTPException(
            status_code=400,
            detail="No file provided. Please upload a PDF, DOC, or DOCX file."
        )

    import filetype
    allowed_mime_types = (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    content = await file.read(261)
    file_type = filetype.guess(content)
    await file.seek(0)
    if not file_type or file_type.mime not in allowed_mime_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.filename}. Only PDF, DOC, and DOCX files are supported."
        )

    return True, file_type.mime