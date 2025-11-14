"""
Resume Parsing and Standardizing Batch Test Pipeline
"""

import sys
import os
import time
from pathlib import Path
from datetime import datetime
from typing import Any
import json

# Add paths for imports
sys.path.append('src/services/document_processing')
sys.path.append('src/services/embeddings')
sys.path.append('src/database')

# Import Azure resume parser components
from azure_resume_parser import azure_resume_parser
from resume_standardizing import standardize_resume

# Load environment variables
from dotenv import load_dotenv
load_dotenv()
subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
if not subscription_key:
    raise ValueError("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY environment variable not set")

def store_json_result_to_dir(result_json: dict[str, Any], dir_path: str, file_prefix: str) -> None:
    """Stores the JSON result to a directory.

    Args:
        result (dict): The result to store.
        dir_path (str): The path to the directory where the result will be stored.
    """
    os.makedirs(dir_path, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    json_filepath = os.path.join(dir_path, f'{file_prefix}_{timestamp}.json')

    with open(json_filepath, 'w', encoding='utf-8') as f:
        json.dump(result_json, f, indent=2, ensure_ascii=False)

    print(f"JSON saved to: {json_filepath}")

def main():
    """
    Main function to run the batch test pipeline for resume parsing and standardizing.
    1. Parse resumes from a specific directory or command line using Azure Content Understanding.
    2. Standardize the parsed resume data.
    3. Store the results in JSON files.
    4. Print the time taken for each resume processing.
    5. Handle exceptions and print error messages if any step fails.
    """
            
    # manually entered file path and run manually in sequence
    # script_dir = Path(__file__).parent
    # pdf_path = script_dir / "src" / "testing_files" / "Bart L.pdf"

    # Add an option for testing specific files later
    # For example: python batch_test_resumes.py "file1.pdf,file2.pdf,file3.pdf"
    pdf_paths = []
    # if (len(sys.argv) > 1):
    #     pdf_paths = sys.argv[1].split(',')

    # # Use default test files
    script_dir = Path(__file__).parent
    test_dir = str(script_dir / "src" / "testing_files")
    for name in os.listdir(test_dir):
        if name.endswith('.pdf'):
            pdf_paths.append(os.path.join(test_dir, name))

    for pdf_path in pdf_paths:

        print(f"""--------Starting pipeline with PDF: {Path(pdf_path).name}--------""")

        try:            
            # # Validate PDF file exists - only for manually entered file path
            # pdf_file = Path(pdf_path)
            # if not pdf_file.exists():
            #     raise FileNotFoundError(f"PDF file not found: {pdf_path}")
            
            # Extract candidate name from filename
            candidate_name = Path(pdf_path).stem
            print(f"Processing resume for: {candidate_name}")
            time_taken = -time.perf_counter()
            # Step 1: Azure resume parser
            print("Step 1: Parsing resume with Azure Content Understanding")
            azure_result = azure_resume_parser(pdf_path)
            
            # Step 2: Standardize resume data
            print("Step 2: Standardizing resume data")
            standardized_data = standardize_resume(azure_result, candidate_name)
            standardized_data_path = script_dir / "src" / "standardized_output_files" / candidate_name.replace(" ", "_")
            store_json_result_to_dir(standardized_data, standardized_data_path, "resume_standardized")
            print(f"Pipeline completed successfully for {candidate_name}.\n")
            time_taken += time.perf_counter()
            print(f"Total time taken: {time_taken:.2f} seconds")
        except Exception as e:
            print(f"Pipeline failed: {str(e)}")
            sys.exit(1)

if __name__ == "__main__":
    main()

