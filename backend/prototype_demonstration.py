"""
Prototype Demonstration Pipeline
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add paths for imports
sys.path.append('src/services/document_processing')
sys.path.append('src/services/job_description_processing')
sys.path.append('src/services/embeddings')
sys.path.append('src/database')

# Import Azure resume parser components
from azure_resume_parser import (
    AzureContentUnderstandingClient,
    Settings
)
from resume_standardizing import standardize_resume
from insert_to_mongo import upsert_candidate, get_candidate, insert_job_description, get_job_description
from generate_embeddings import (
    embed_candidate_profile, 
    embed_candidate_location,
    embed_job_description_profile,
    embed_job_description_location
)

# Import job description parser components
from azure_job_description_parser import (
    AzureContentUnderstandingClient as JDClient,
    Settings as JDSettings
)
from job_description_standardizing import standardize_job_description

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def process_job_description(pdf_path: str):
    """
    Process a job description PDF and insert it into MongoDB
    """
    print(f"Starting job description pipeline with PDF: {pdf_path}")
    
    try:
        # Validate PDF file exists
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        # Extract company name and job title from path
        # Expected path structure: .../company_name/job_title/filename.pdf
        path_parts = str(pdf_file.parent).split(os.sep)
        if len(path_parts) >= 2:
            job_title = path_parts[-1].replace('_', ' ')
            company_name = path_parts[-2].replace('_', ' ')
        else:
            # Fallback to extracting from filename
            company_name = "Unknown Company"
            job_title = pdf_file.stem.replace('_', ' ')
        
        print(f"Processing job description for: {company_name} - {job_title}")
        
        # Step 1: Azure job description parser
        
        subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
        if not subscription_key:
            raise ValueError("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY environment variable not set")
        
        settings = JDSettings(
            endpoint="https://fetch-contentunderstanding.services.ai.azure.com/",
            api_version="2025-05-01-preview",
            subscription_key=subscription_key,
            aad_token=None,
            analyzer_id="job_description_parser_v1",
            file_location=str(pdf_path)
        )
        
        client = JDClient(
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
        
        # Step 2: Standardize job description data
        standardized_data = standardize_job_description(azure_result, company_name)
        
        # Step 3: Insert to MongoDB
        print("Step 3: Inserting job description into MongoDB")
        mongo_result = insert_job_description(standardized_data)
        
        if mongo_result.get("success"):
            pass
        else:
            raise Exception(f"MongoDB operation failed: {mongo_result.get('error')}")
        
        # Step 4: Retrieve job description document from MongoDB
        job_doc = get_job_description(company_name, standardized_data.get("JobTitle"))
        
        if not job_doc:
            raise Exception("Failed to retrieve job description")
        
        # Step 5: Generate and store embeddings
        
        # Check for Azure OpenAI API key
        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("AZURE_OPENAI_API_KEY environment variable not set")
        
        embed_job_description_profile(job_doc)
        embed_job_description_location(job_doc)
        
        # Step 6: Verify embeddings were stored
        updated_job = get_job_description(company_name, standardized_data.get("JobTitle"))
        
        if updated_job:
            profile_check = "profile_embedding" in updated_job
            location_check = "location_embedding" in updated_job
            
            if profile_check and location_check:
                print(f"Embedding verification successful")
            else:
                missing = []
                if not profile_check:
                    missing.append("profile_embedding")
                if not location_check:
                    missing.append("location_embedding")
                print(f"Warning: Missing embeddings: {', '.join(missing)}")
        else:
            print("Warning: Could not retrieve job description for verification")
        
    except Exception as e:
        print(f"Job description pipeline failed: {str(e)}")
        raise

def process_resume(pdf_path: str):
    """
    Process a resume PDF and insert it into MongoDB
    """
    print(f"Starting resume pipeline with PDF: {pdf_path}")
    
    try:
        # Validate PDF file exists
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        # Extract candidate name from filename
        candidate_name = pdf_file.stem
        
        # Step 1: Azure resume parser
        
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
        standardized_data = standardize_resume(azure_result, candidate_name)
        
        # Step 3: Insert to MongoDB
        mongo_result = upsert_candidate(standardized_data)
        
        if mongo_result.get("success"):
            operation = mongo_result.get("operation", "unknown")
        else:
            raise Exception(f"MongoDB operation failed: {mongo_result.get('error')}")
        
        # Step 4: Retrieve candidate document from MongoDB
        candidate_doc = get_candidate(candidate_name)
        
        if not candidate_doc:
            raise Exception(f"Failed to retrieve candidate document: {candidate_name}")
        
        # Step 5: Generate and store embeddings
        
        # Check for Azure OpenAI API key
        openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("AZURE_OPENAI_API_KEY environment variable not set")
        
        embed_candidate_profile(candidate_doc)
        
        embed_candidate_location(candidate_doc)
        
        # Step 6: Verify embeddings were stored
        updated_candidate = get_candidate(candidate_name)
        
        if updated_candidate:
            profile_check = "profile_embedding" in updated_candidate
            location_check = "location_embedding" in updated_candidate
            
            if profile_check and location_check:
                print(f"Embedding verification successful")
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
        print(f"Resume pipeline failed: {str(e)}")
        raise

def main():
    """
    Main function that routes to appropriate pipeline based on command
    
    Usage:
        python prototype_demonstration.py --resume <pdf_path>
        python prototype_demonstration.py --job-description <pdf_path>
        python prototype_demonstration.py --both <resume_pdf> <job_description_pdf>
    """
    if len(sys.argv) < 3:
        print("Usage:")
        print("  python prototype_demonstration.py --resume <pdf_path>")
        print("  python prototype_demonstration.py --job-description <pdf_path>")
        print("  python prototype_demonstration.py --both <resume_pdf> <job_description_pdf>")
        print("\nExamples:")
        print("  python prototype_demonstration.py --resume 'src/testing_files/Brian P.pdf'")
        print("  python prototype_demonstration.py --job-description 'src/testing_files/MLG/Head_of_Technology/jd.pdf'")
        print("  python prototype_demonstration.py --both 'src/testing_files/Brian P.pdf' 'src/testing_files/MLG Head of Technology.pdf'")
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == "--resume":
            if len(sys.argv) < 3:
                print("Error: --resume requires a PDF path")
                sys.exit(1)
            pdf_path = sys.argv[2]
            process_resume(pdf_path)
            
        elif command == "--job-description":
            if len(sys.argv) < 3:
                print("Error: --job-description requires a PDF path")
                sys.exit(1)
            pdf_path = sys.argv[2]
            process_job_description(pdf_path)
            
        elif command == "--both":
            if len(sys.argv) < 4:
                print("Error: --both requires both resume and job description PDF paths")
                print("Usage: python prototype_demonstration.py --both <resume_pdf> <job_description_pdf>")
                sys.exit(1)
            resume_pdf = sys.argv[2]
            job_pdf = sys.argv[3]
            
            # Process resume first
            process_resume(resume_pdf)
            
            # Process job description next
            process_job_description(job_pdf)
            
        else:
            print(f"Invalid command: {command}")
            print("Valid commands: --resume, --job-description, --both")
            sys.exit(1)
    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

