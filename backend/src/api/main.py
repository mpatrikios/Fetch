# Main application file for the Fetch FastAPI 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from src.api.routes import resume_routes, job_routes, matching_routes
from src.database.connection import mongo_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifespan event to manage startup and shutdown tasks
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up FastAPI application...")
    try:
        mongo_connection.client.server_info()
        logger.info("MongoDB connection verified")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
    yield
    logger.info("Shutting down FastAPI application...")

# Initialize FastAPI app with metadata
app = FastAPI(
    title="Fetch Recruitment API",
    description="API for resume and job description processing with AI-powered matching",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Fetch Recruitment API",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "api_docs": "/docs",
            "resume_upload": "/api/resume/upload",
            "job_upload": "/api/job/upload",
            "find_matches": "/api/matches/find"
        }
    }

# health check endpoint
@app.get("/health")
async def health_check():
    try:
        mongo_connection.client.server_info()
        db_status = "connected"
    except:
        db_status = "disconnected"
    
    return {
        "status": "healthy",
        "database": db_status
    }

# Include API routers
app.include_router(resume_routes.router, prefix="/api", tags=["resumes"])
app.include_router(job_routes.router, prefix="/api", tags=["jobs"])
app.include_router(matching_routes.router, prefix="/api", tags=["matching"])