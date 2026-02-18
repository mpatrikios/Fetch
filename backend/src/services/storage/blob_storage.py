import os
import logging
from datetime import datetime, timedelta, timezone

from azure.storage.blob import BlobServiceClient, BlobSasPermissions, generate_blob_sas, ContentSettings

logger = logging.getLogger(__name__)

CONTENT_TYPE_MAP = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class BlobStorageService:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING environment variable is not set")

        self._client = BlobServiceClient.from_connection_string(connection_string)
        self._container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "fetch-documents")
        self._container_client = self._client.get_container_client(self._container_name)

        # Parse account name and key from connection string for SAS generation
        parts = dict(pair.split("=", 1) for pair in connection_string.split(";") if "=" in pair)
        self._account_name = parts.get("AccountName")
        self._account_key = parts.get("AccountKey")

        self._initialized = True
        logger.info(f"BlobStorageService initialized for container '{self._container_name}'")

    def upload_blob(self, blob_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload bytes to a blob. Returns the full blob URL."""
        blob_client = self._container_client.get_blob_client(blob_path)
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        logger.info(f"Uploaded blob: {blob_path}")
        return blob_client.url

    def generate_sas_url(self, blob_path: str, expiry_minutes: int = 15) -> str:
        """Generate a time-limited read-only SAS URL for a blob."""
        sas_token = generate_blob_sas(
            account_name=self._account_name,
            container_name=self._container_name,
            blob_name=blob_path,
            account_key=self._account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes),
        )
        blob_client = self._container_client.get_blob_client(blob_path)
        return f"{blob_client.url}?{sas_token}"

    def download_blob(self, blob_path: str) -> bytes:
        """Download blob content as bytes."""
        blob_client = self._container_client.get_blob_client(blob_path)
        return blob_client.download_blob().readall()

    def delete_blob(self, blob_path: str) -> None:
        """Delete a blob."""
        blob_client = self._container_client.get_blob_client(blob_path)
        blob_client.delete_blob()
        logger.info(f"Deleted blob: {blob_path}")


def get_blob_storage() -> BlobStorageService:
    """Get the singleton BlobStorageService instance."""
    return BlobStorageService()


def get_content_type(filename: str) -> str:
    """Get the content type for a file based on its extension."""
    ext = os.path.splitext(filename)[1].lower()
    return CONTENT_TYPE_MAP.get(ext, "application/octet-stream")
