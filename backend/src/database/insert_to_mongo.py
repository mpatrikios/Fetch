"""
This file is responsible for interfacing with MongoDB to insert and update documents
"""
from typing import Dict, Any, List
import logging

from src.api.utils import validate_object_id
from .connection import mongo_connection
from bson import ObjectId
# Get database and collections from centralized connection
database = mongo_connection.database
candidates_collection = mongo_connection.candidates_collection
job_descriptions_collection = mongo_connection.job_descriptions_collection
matches_collection = mongo_connection.matches_collection
logging.basicConfig(level=logging.INFO)

def upsert_candidate(candidate_data: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
    """
    Insert or update candidate document in MongoDB.
    If user_id is provided, update based on _id; otherwise use full_name for backward compatibility.
    
    Args:
        candidate_data: Dictionary containing candidate information
        user_id: Optional user ObjectID string for updating existing user
        
    Returns:
        Dictionary with operation result
    """
    try:
        
        if user_id:
            validate_object_id(user_id)
            # Use user_id for authenticated users
            filter_query = {"_id": ObjectId(user_id)}
        else:
            # Fallback to full_name for backward compatibility
            full_name = candidate_data.get("full_name")
            if not full_name:
                raise ValueError("full_name is required for candidate insertion")
            filter_query = {"full_name": full_name}
        
        update_operation = {
            "$set": candidate_data
        }
        
        result = candidates_collection.update_one(
            filter_query,
            update_operation,
            upsert=True
        )
        
        identifier = user_id if user_id else candidate_data.get("full_name", "Unknown")
        
        if result.upserted_id:
            logging.info(f"New candidate created: {identifier}")
            return {
                "success": True,
                "operation": "inserted",
                "candidate_name": candidate_data.get("full_name", "Unknown"),
                "document_id": str(result.upserted_id)
            }
        else:
            logging.info(f"Candidate updated: {identifier}")
            return {
                "success": True,
                "operation": "updated",
                "candidate_name": candidate_data.get("full_name", "Unknown"),
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

def get_candidate(full_name: str = None, user_id: str = None) -> Dict[str, Any] | None:
    """
    Retrieve candidate document from MongoDB by full_name or user_id.
    
    Args:
        full_name: The full name of the candidate (for backward compatibility)
        user_id: The ObjectID string of the user (preferred for authenticated users)
        
    Returns:
        Dictionary containing the candidate document or None if not found
    """

    identifier = "Unknown"
    try:
        if user_id:
            validate_object_id(user_id)
            # Use user_id for authenticated users
            query = {"_id": ObjectId(user_id)}
            identifier = user_id
        elif full_name:
            # Fallback to full_name for backward compatibility
            query = {"full_name": full_name}
            identifier = full_name
        else:
            raise ValueError("Either full_name or user_id must be provided")
        
        candidate = candidates_collection.find_one(query)
        if candidate:
            logging.info(f"Retrieved candidate: {identifier}")
            return candidate
        else:
            logging.warning(f"Candidate not found: {identifier}")
            return None
    except Exception as e:
        logging.error(f"Error retrieving candidate {identifier}: {str(e)}")
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

def get_job_description(job_id: str) -> Dict[str, Any] | None:
    """
    Retrieve job description document(s) from MongoDB by companyName and optionally JobTitle.
    
    Args:
        job_id: The MongoDB ObjectId string of the job description document
        
    Returns:
        Dictionary containing the job description document, list of documents, or None if not found
    """
    try:
        validate_object_id(job_id)
        query = {"_id": ObjectId(job_id)}
        job_description = job_descriptions_collection.find_one(query)
        if job_description:
            logging.info(f"Retrieved job description: {job_description.get('companyName', 'Unknown company name')} - {job_description.get('JobTitle', 'Unknown job title')} - {job_id}")
            return job_description
    except Exception as e:
        logging.error(f"Error retrieving job description for {job_id}: {str(e)}")
        return None
    

def update_match_review(match_id: str, candidate_id: str, review_status: str, reviewed_by: str) -> Dict[str, Any]:
    """
    Update the review fields for a specific candidate within a match document.

    Args:
        match_id: The MongoDB ObjectId string of the match document
        candidate_id: The candidate_id string to target within the candidates array
        review_status: One of "Approved", "Rejected", "Pending"
        reviewed_by: The user _id string of the recruiter performing the review

    Returns:
        Dictionary with operation result
    """
    try:
        validate_object_id(match_id)
        from datetime import datetime, timezone

        reviewed_at = datetime.now(timezone.utc).isoformat()

        result = matches_collection.update_one(
            {"_id": ObjectId(match_id)},
            {"$set": {
                "candidates.$[elem].review_status": review_status,
                "candidates.$[elem].reviewed_by": reviewed_by,
                "candidates.$[elem].reviewed_at": reviewed_at,
            }},
            array_filters=[{"elem.candidate_id": candidate_id}]
        )

        if result.matched_count == 0:
            return {"success": False, "error": "Match document not found"}
        if result.modified_count == 0:
            return {"success": False, "error": "Candidate not found in match or review status unchanged"}

        logging.info(f"Review updated for candidate {candidate_id} in match {match_id}")
        return {"success": True, "reviewed_at": reviewed_at}

    except Exception as e:
        logging.error(f"Error updating review for candidate {candidate_id} in match {match_id}: {str(e)}")
        return {"success": False, "error": str(e)}


def get_match(company_name: str, job_title: str, job_id: str) -> Dict[str, Any] | None:
    """
    Retrieve the most recent match document for a given company and job title.
    Returns None if no matches have been saved yet.
    """
    try:
        validate_object_id(job_id)
        match = matches_collection.find_one(
            { "JobId": job_id,"companyName": company_name, "JobTitle": job_title},
            sort=[("created_at", -1)]
        )
        if match:
            logging.info(f"Retrieved stored match: {company_name} - {job_title}")
            return match
        else:
            logging.info(f"No stored match found: {company_name} - {job_title}")
            return None
    except Exception as e:
        logging.error(f"Error retrieving match for {company_name} - {job_title}: {str(e)}")
        return None


def set_job_match_generated(company_name: str, job_title: str) -> None:
    from datetime import datetime, timezone
    job_descriptions_collection.update_one(
        {"companyName": company_name, "JobTitle": job_title},
        {"$set": {"last_match_generated_at": datetime.now(timezone.utc).isoformat()}}
    )


def get_all_matches(company_name: str, job_title: str, job_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all historical matches for a given company and job title.
    Computes total_matches server-side to avoid projecting the full candidates array.
    """
    pipeline = [
        {"$match": {"companyName": company_name, "JobTitle": job_title, "JobId": job_id}},
        {"$sort": {"created_at": -1}},
        {
            "$project": {
                "created_at": 1,
                "total_matches": {
                    "$size": {"$ifNull": ["$candidates", []]}
                }
            }
        },
    ]
    cursor = matches_collection.aggregate(pipeline)
    return [
        {
            "match_id": str(doc["_id"]),
            "created_at": doc.get("created_at"),
            "total_matches": doc.get("total_matches", 0),
        }
        for doc in cursor
    ]


def insert_match(match_data: Dict[str, Any]):
    """
    Insert a new match document in Mongo every time (creates history/duplicates).
    Always creates a new document regardless of whether similar matches exist.
    
    Args:
        match_data: Dictionary that contains a job and the matched candidates information
    Returns:
        Dictionary with operation result
    """
    try:
        job_id = match_data.get("JobId", "")
        company_name = match_data.get("companyName", "")
        job_title = match_data.get("JobTitle", "")
        if (company_name == "" and job_title == "") and job_id == "":
            raise ValueError("Either JobId or (companyName and JobTitle) must be provided for insertion")
        
        result = matches_collection.insert_one(match_data)
        
        if job_id != "":
            identifier = job_id
        else:
            identifier = f"{company_name} - {job_title}"
            
        logging.info(f"New match created for this job: {identifier}")
        
        return {
            "success": True,
            "operation": "inserted",
            "company_name": company_name,
            "job_title": job_title,
            "document_id": str(result.inserted_id)
        }
            
    except Exception as e:
        logging.error(f"Error inserting match {match_data.get('companyName', 'Unknown')} - {match_data.get('JobTitle', 'Unknown')}: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "company_name": match_data.get('companyName', 'Unknown'),
            "job_title": match_data.get('JobTitle', 'Unknown')
        }

