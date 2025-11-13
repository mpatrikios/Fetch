"""
This file is responsible for interfacing with MongoDB to insert and update documents
"""
from pymongo import MongoClient
import os
from typing import Dict, Any, List
import logging
from dotenv import load_dotenv
import json
import sys

load_dotenv()
connection_string = os.getenv("MONGODB_URL")

client = MongoClient(connection_string)

database = client.get_database("FetchTestingDB")
collection = database.get_collection("CandidatesTesting")
job_descriptions_collection = database.get_collection("JobDescriptionsTesting")

logging.basicConfig(level=logging.INFO)

def upsert_candidate(candidate_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert or update candidate document in MongoDB based on full_name.
    If the candidate's full_name exists, update the document; otherwise, insert a new document.
    Probably need to add error instead if the candidate does not exist.
    
    Args:
        candidate_data: Dictionary containing candidate information 
        
    Returns:
        Dictionary with operation result
    """
    try:
        full_name = candidate_data.get("full_name")
        if not full_name:
            raise ValueError("full_name is required for candidate insertion")
        
        filter_query = {"full_name": full_name}
        
        update_operation = {
            "$set": candidate_data
        }
        
        result = collection.update_one(
            filter_query,
            update_operation,
            upsert=True
        )
        
        if result.upserted_id:
            logging.info(f"Candidate does not exist. New candidate created: {full_name}")
            return {
                "success": True,
                "operation": "inserted",
                "candidate_name": full_name,
                "document_id": str(result.upserted_id)
            }
        else:
            logging.info(f"Candidate updated: {full_name}")
            return {
                "success": True,
                "operation": "updated",
                "candidate_name": full_name,
                "matched_count": result.matched_count,
                "modified_count": result.modified_count
            }
            
    except Exception as e:
        logging.error(f"Error upserting candidate {candidate_data.get('full_name', 'Unknown')}: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "candidate_name": candidate_data.get('full_name', 'Unknown')
        }

def get_candidate(full_name: str) -> Dict[str, Any] | None:
    """
    Retrieve candidate document from MongoDB by full_name.
    
    Args:
        full_name: The full name of the candidate
        
    Returns:
        Dictionary containing the candidate document or None if not found
    """
    try:
        candidate = collection.find_one({"full_name": full_name})
        if candidate:
            logging.info(f"Retrieved candidate: {full_name}")
            return candidate
        else:
            logging.warning(f"Candidate not found: {full_name}")
            return None
    except Exception as e:
        logging.error(f"Error retrieving candidate {full_name}: {str(e)}")
        return None

def insert_embedding(doc_id: Any, collection_name: str, field_name: str, embedding: List[float]) -> None:
    database[collection_name].update_one(
        {"_id": doc_id},
        {"$set": {field_name: embedding}}
    )

def insert_job_description(job_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert job description document in MongoDB.
    
    Args:
        job_data: Dictionary containing job description information 
        
    Returns:
        Dictionary with operation result
    """
    try:
        company_name = job_data.get("companyName")
        job_title = job_data.get("JobTitle", "Unknown Position")
        
        if not company_name:
            raise ValueError("companyName is required for job description insertion")
        
        result = job_descriptions_collection.insert_one(job_data)
        
        logging.info(f"New job description created: {company_name} - {job_title}")
        return {
            "success": True,
            "operation": "inserted",
            "company_name": company_name,
            "job_title": job_title,
            "document_id": str(result.inserted_id)
        }
            
    except Exception as e:
        logging.error(f"Error inserting job description {job_data.get('companyName', 'Unknown')} - {job_data.get('JobTitle', 'Unknown')}: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "company_name": job_data.get('companyName', 'Unknown'),
            "job_title": job_data.get('JobTitle', 'Unknown')
        }

def get_job_description(company_name: str, job_title: str = None) -> Dict[str, Any] | List[Dict[str, Any]] | None:
    """
    Retrieve job description document(s) from MongoDB by companyName and optionally JobTitle.
    
    Args:
        company_name: The company name
        job_title: The job title (optional)
        
    Returns:
        Dictionary containing the job description document, list of documents, or None if not found
    """
    try:
        query = {"companyName": company_name}
        if job_title:
            query["JobTitle"] = job_title
            job_description = job_descriptions_collection.find_one(query)
            if job_description:
                logging.info(f"Retrieved job description: {company_name} - {job_title}")
                return job_description
            else:
                logging.warning(f"Job description not found: {company_name} - {job_title}")
                return None
        else:
            job_descriptions = list(job_descriptions_collection.find(query))
            if job_descriptions:
                logging.info(f"Retrieved {len(job_descriptions)} job descriptions for company: {company_name}")
                return job_descriptions
            else:
                logging.warning(f"No job descriptions found for company: {company_name}")
                return None
    except Exception as e:
        logging.error(f"Error retrieving job description(s) for {company_name}: {str(e)}")
        return None