"""
Shared fixtures for all backend tests.
"""
import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# Patch Azure env vars at session scope so the import of cosine_similarity.py
# (which raises ValueError at module level if keys are missing) never fails
# during test collection or fixture setup — no real keys or .env required.
@pytest.fixture(autouse=True, scope="session")
def patch_azure_env():
    env = {
        "AZURE_OPENAI_API_KEY": "test-key",
        "AZURE_OPENAI_EXPLANATION_BASE_URL": "https://test.example.com",
    }
    with patch.dict(os.environ, env):
        # Clear any previously cached import of cosine_similarity so it
        # re-imports cleanly under the patched environment.
        for mod in list(sys.modules.keys()):
            if "cosine_similarity" in mod:
                del sys.modules[mod]
        yield


@pytest.fixture(scope="session")
def client():
    """
    FastAPI TestClient with MongoDB patched out so tests run without a real DB.
    """
    mock_mongo = MagicMock()
    mock_mongo.client.server_info.return_value = {"version": "6.0"}

    with patch("src.database.connection.mongo_connection", mock_mongo):
        from src.api.main import app
        with TestClient(app) as c:
            yield c
