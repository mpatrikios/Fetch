from pymongo import MongoClient
import os
from typing import Dict, Any
import logging

connection_string = os.getenv("MONGODB_URL")

client = MongoClient(connection_string)

database = client.get_database("FetchTestingDB")
collection = database.get_collection("CandidatesTesting")

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