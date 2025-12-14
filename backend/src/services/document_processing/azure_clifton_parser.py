"""
This file is responsible for interfacing with Azure Content Understanding
to parse CliftonStrengths assessment documents. It takes a pdf file and outputs JSON data. 
"""
import json
import logging
import sys
import time
from datetime import datetime
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast
from dataclasses import dataclass

import requests

import os
from dotenv import load_dotenv

# Import the existing Azure client and settings from resume parser
from src.services.document_processing.azure_resume_parser import AzureContentUnderstandingClient, Settings

load_dotenv()
subscription_key = os.getenv("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY")
if not subscription_key:
    raise ValueError("AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY environment variable not set")

def azure_clifton_parser(pdf_path: str) -> dict:
    """
    Function to parse CliftonStrengths assessment using Azure Content Understanding
    """
    try:
        settings = Settings(
                    endpoint="https://fetch-contentunderstanding.services.ai.azure.com/",
                    api_version="2025-05-01-preview",
                    subscription_key=subscription_key,
                    aad_token=None,
                    analyzer_id="clifton_strengths_parser",  # Your Azure CliftonStrengths model name
                    file_location=str(pdf_path)
                )
                
        client = AzureContentUnderstandingClient(
            settings.endpoint,
            settings.api_version,
            subscription_key=settings.subscription_key,
            token_provider=settings.token_provider,
        )
        
        response = client.begin_analyze(settings.analyzer_id, settings.file_location)
        result = client.poll_result(
            response,
            timeout_seconds=60 * 60,
            polling_interval_seconds=1,
        )
        
        if result:
            logging.info(f"CliftonStrengths parsing completed for: {pdf_path}")
            return result
        else:
            logging.error(f"Failed to parse CliftonStrengths document: {pdf_path}")
            return {}
            
    except Exception as e:
        logging.error(f"Error in azure_clifton_parser: {str(e)}")
        return {}

def parse_clifton_strengths_result(azure_result: dict) -> dict:
    """
    Parse the Azure CliftonStrengths result into structured data
    """
    try:
        # Extract relevant fields from Azure response
        # Adjust these field names based on your actual Azure model output
        parsed_data = {
            "strengths_themes": azure_result.get("StrengthsThemes", []),
            "theme_descriptions": azure_result.get("ThemeDescriptions", {}),
            "assessment_date": azure_result.get("AssessmentDate", ""),
            "participant_name": azure_result.get("ParticipantName", ""),
            "raw_azure_result": azure_result
        }
        
        return parsed_data
        
    except Exception as e:
        logging.error(f"Error parsing CliftonStrengths result: {str(e)}")
        return {"raw_azure_result": azure_result}