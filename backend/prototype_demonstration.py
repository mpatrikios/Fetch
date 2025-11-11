"""
Prototype Demonstration Pipeline
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add paths for imports
sys.path.append('src/services/document_processing')
sys.path.append('src/services/embeddings')
sys.path.append('src/database')

# Import Azure resume parser components
from azure_resume_parser import (
    AzureContentUnderstandingClient,
    Settings
)
from resume_standardizing import standardize_resume
from insert_to_mongo import upsert_candidate, get_candidate
from generate_embeddings import embed_candidate_profile, embed_candidate_location

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def main():
    """
    Main function that implements the complete pipeline
    """
    # Get PDF path from command line or use default
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        # Use default test file
        script_dir = Path(__file__).parent
        pdf_path = str(script_dir / "src" / "testing_files" / "Brian P.pdf")
    
    print(f"Starting pipeline with PDF: {pdf_path}")
    
    try:
        # Validate PDF file exists
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        # Extract candidate name from filename
        candidate_name = pdf_file.stem
        print(f"Processing resume for: {candidate_name}")
        
        # Step 1: Azure resume parser
        print("Step 1: Parsing resume with Azure Content Understanding")
        
        subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
        if not subscription_key:
            raise ValueError("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY environment variable not set")
        
        settings = Settings(
            endpoint="https://fetch-contentunderstanding.services.ai.azure.com/",
            api_version="2025-05-01-preview",
            subscription_key=subscription_key,
            aad_token=None,
            analyzer_id="resume_parser_v3",
            file_location=str(pdf_path)
        )
        
        client = AzureContentUnderstandingClient(
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
        
        # Step 2: Standardize resume data
        print("Step 2: Standardizing resume data")
        standardized_data = standardize_resume(azure_result, candidate_name)
        
        # Step 3: Insert to MongoDB
        print("Step 3: Inserting into MongoDB")
        mongo_result = upsert_candidate(standardized_data)
        
        if mongo_result.get("success"):
            operation = mongo_result.get("operation", "unknown")
            print(f"MongoDB operation completed: {operation}")
        else:
            raise Exception(f"MongoDB operation failed: {mongo_result.get('error')}")
        
        # Step 4: Retrieve candidate document from MongoDB
        print("Step 4: Retrieving candidate document from MongoDB")
        candidate_doc = get_candidate(candidate_name)
        
        if not candidate_doc:
            raise Exception(f"Failed to retrieve candidate document: {candidate_name}")
        
        # Step 5: Generate and store embeddings
        print("Step 5: Generating embeddings for candidate profile and location")
        
        # Check for Azure OpenAI API key
        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("AZURE_OPENAI_API_KEY environment variable not set")
        
        embed_candidate_profile(candidate_doc)
        print("Profile embedding generated and stored successfully")
        
        embed_candidate_location(candidate_doc)
        print("Location embedding generated and stored successfully")
        
        # Step 6: Verify embeddings were stored
        print("Step 6: Verifying embeddings in database")
        updated_candidate = get_candidate(candidate_name)
        
        if updated_candidate:
            profile_check = "profile_embedding" in updated_candidate
            location_check = "location_embedding" in updated_candidate
            
            if profile_check and location_check:
                profile_dims = len(updated_candidate['profile_embedding'])
                location_dims = len(updated_candidate['location_embedding'])
                print(f"Embedding verification successful:")
                print(f"  - Profile embedding: {profile_dims} dimensions")
                print(f"  - Location embedding: {location_dims} dimensions")
                print(f"Pipeline completed successfully for {candidate_name}")
            else:
                missing = []
                if not profile_check:
                    missing.append("profile_embedding")
                if not location_check:
                    missing.append("location_embedding")
                print(f"Warning: Missing embeddings: {', '.join(missing)}")
        else:
            print("Warning: Could not retrieve candidate for verification")
            
    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

