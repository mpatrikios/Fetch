# common utility functions for file handling and validation
import os
import tempfile
import logging
from fastapi import HTTPException, UploadFile
from bson import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES= {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

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

# function for validating document file size and type
async def validate_document_file(file: UploadFile) -> tuple[bool, str, int, str]:
    """
        Orchestrates the full document ingestion pipeline: validates the uploaded file,
        saves it to a temporary location, and converts it to PDF if necessary.

        Args:
            file: FastAPI UploadFile object

        Returns:
            Tuple of (is_valid, temp_path, file_size, file_type)

        Raises:
            HTTPException: If the file is missing, exceeds size limits, or is of an unsupported type.
        """
    if not file:
        raise HTTPException(
            status_code=400,
            detail="No file provided. Please upload a PDF, DOC, or DOCX file."
        )
    file_size = await validate_file_size(file)
    file_type = await validate_file_type(file)
    
    temp_file_path = await save_upload_file_tmp(file)
    
    return True, temp_file_path, file_size, file_type

async def validate_file_size(file: UploadFile, max_size_kb: int = 500) -> int:
    """
    Validate that the uploaded file does not exceed the maximum allowed size.
    
    Args:
        file: FastAPI UploadFile object
        max_size_kb: Maximum allowed file size in kilobytes (default is 500 KB)
        
    Returns:
        Tuple of (is_valid, file_size_bytes)
    """
    max_size_bytes = max_size_kb * 1024
    file_size_bytes = file.size
    if file_size_bytes is None:
        current_pos = file.file.tell()
        file.file.seek(0, 2)
        file_size_bytes = file.file.tell()
        file.file.seek(current_pos)
    if file_size_bytes > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the maximum allowed limit of {max_size_kb} KB."
        )
    return file_size_bytes

async def validate_file_type(file: UploadFile) -> str:
    import filetype
    from docx import Document

    content = await file.read(261)
    file_type = filetype.guess(content)
    await file.seek(0)

    detected_mime = file_type.mime if file_type else None
    logger.info(f"Detected MIME type for {file.filename}: {detected_mime if detected_mime else 'Unknown'}")

    if detected_mime == 'application/zip':
        try:
            Document(file.file)
            await file.seek(0)
            detected_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        except Exception as e:
            await file.seek(0)
            raise HTTPException(
                status_code=400,
                detail=f"Error occurred while validating DOCX file {file.filename}: {e}"
            )

    if not detected_mime or detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.filename}. Only PDF, DOC, and DOCX files are supported."
        )

    return detected_mime

