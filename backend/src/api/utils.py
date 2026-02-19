# common utility functions for file handling and validation
import os
import tempfile
import logging
from typing import Tuple
from fastapi import HTTPException
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
def validate_document_file(filename: str) -> Tuple[bool, str]:
    """
    Validate that a file is an acceptable document format.
    
    Args:
        filename: Name of the file to validate
        
    Returns:
        Tuple of (is_valid, file_extension)
    """
    allowed_extensions = ('.pdf', '.doc', '.docx')
    file_extension = os.path.splitext(filename.lower())[1]
    
    is_valid = file_extension in allowed_extensions
    return is_valid, file_extension

