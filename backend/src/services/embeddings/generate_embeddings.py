"""
This file is responsible for generating embeddings using OpenAI API
"""

from openai import OpenAI
import os
from dotenv import load_dotenv
import sys
import time
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from database.insert_to_mongo import insert_embedding
from connection import mongo_connection
from geocoding import geocode_location
from typing import Optional, Dict

load_dotenv()
openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
azure_base_url = os.getenv("AZURE_OPENAI_BASE_URL")

# Only initialize client if we have the required environment variables
client = None
if openai_api_key and azure_base_url:
    try:
        client = OpenAI(
            api_key=openai_api_key,
            base_url=azure_base_url
        )
    except Exception as e:
        print(f"Failed to initialize OpenAI client: {e}")
        client = None

# Use centralized MongoDB connection
db = mongo_connection.database

def generate_embedding(text, model="text-embedding-ada-002"):
    if client is None:
        print("OpenAI client not initialized. Check environment variables.")
        return None
    
    try:
        response = client.embeddings.create(
            input=[text],
            model=model
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Embedding generation failed: {e}")
        return None

def create_location_embedding(coordinates: Optional[Dict[str, float]]) -> Optional[list]:
    """
    Create a simple embedding vector from coordinates.
    Using normalized coordinates to create a 2D embedding vector.
    
    Args:
        coordinates: Dict with 'lat' and 'lon' keys
        
    Returns:
        List representing the location as a normalized vector [lat/90, lon/180]
        This normalizes latitude to [-1, 1] and longitude to [-1, 1]
    """
    if not coordinates:
        return None
    
    lat = coordinates.get('lat')
    lon = coordinates.get('lon')
    
    if lat is None or lon is None:
        return None
    
    # Normalize latitude (range -90 to 90) and longitude (range -180 to 180)
    # This creates a 2D vector where both components are in [-1, 1]
    normalized_lat = lat / 90.0
    normalized_lon = lon / 180.0
    
    # Return as a list to match the format of text embeddings
    # We'll pad this to match the dimensionality of text embeddings if needed
    return [normalized_lat, normalized_lon]


# generate and store candidate profile embeddings
def embed_candidate_profile(candidate_doc):
    text = f"{candidate_doc.get('Summary', '')} " + \
           " ".join(candidate_doc.get('Skills', [])) + " " + \
           " ".join([exp.get('role', '') for exp in (candidate_doc.get('Experience') or []) if exp]) + " " + \
           " ".join([comp.get('companyName', '') for comp in (candidate_doc.get('Companies') or []) if comp])
    embedding = generate_embedding(text)
    if embedding is None:
        print(f"Failed to generate profile embedding for candidate {candidate_doc.get('_id')}")
        return
    insert_embedding(candidate_doc["_id"], "CandidatesTesting", "profile_embedding", embedding)

# generate and store candidate location embeddings
def embed_candidate_location(candidate_doc):
    location_text = candidate_doc.get("Location", "")
    
    # Geocode the location to get coordinates
    coordinates = geocode_location(location_text)
    
    if coordinates:
        # Create coordinate-based embedding
        embedding = create_location_embedding(coordinates)
        
        # Also store the coordinates in the database for reference
        insert_embedding(candidate_doc["_id"], "CandidatesTesting", "location_coordinates", coordinates)
    else:
        # Fallback to text embedding if geocoding fails
        print(f"Geocoding failed for {location_text}, using text embedding as fallback")
        embedding = generate_embedding(location_text)
    
    if embedding is None:
        print(f"Failed to generate location embedding for candidate {candidate_doc.get('_id')}")
        return
    
    insert_embedding(candidate_doc["_id"], "CandidatesTesting", "location_embedding", embedding)
# function for generating and storing candidate embeddings of cultural index

# generate and store job description profile embeddings
def embed_job_description_profile(job_doc):
    text = f"{job_doc.get('JobTitle', '')} " + \
           f"{job_doc.get('Summary', '')} " + \
           " ".join(job_doc.get('Skills') or []) + " " + \
           " ".join(job_doc.get('Responsibilities') or []) + " " + \
           " ".join(job_doc.get('Qualifications') or [])
    embedding = generate_embedding(text)
    if embedding is None:
        print(f"Failed to generate profile embedding for job description {job_doc.get('_id')}")
        return
    insert_embedding(job_doc["_id"], "JobDescriptionsTesting", "profile_embedding", embedding)

# generate and store job description location embeddings
def embed_job_description_location(job_doc):
    locations = job_doc.get("Locations", [])
    
    # Handle multiple locations - use the first one for primary embedding
    if isinstance(locations, list) and locations:
        primary_location = locations[0]
    else:
        primary_location = str(locations) if locations else ""
    
    # Geocode the primary location
    coordinates = geocode_location(primary_location)
    
    if coordinates:
        # Create coordinate-based embedding
        embedding = create_location_embedding(coordinates)
        
        # Store the coordinates in the database for reference
        insert_embedding(job_doc["_id"], "JobDescriptionsTesting", "location_coordinates", coordinates)
        
        # If there are multiple locations, store all coordinates
        if isinstance(locations, list) and len(locations) > 1:
            all_coordinates = []
            for loc in locations:
                coord = geocode_location(loc)
                if coord:
                    all_coordinates.append(coord)
                # Add 1 second delay to respect Nominatim rate limits
                time.sleep(1)
            if all_coordinates:
                insert_embedding(job_doc["_id"], "JobDescriptionsTesting", "all_location_coordinates", all_coordinates)
    else:
        # Fallback to text embedding if geocoding fails
        location_text = " ".join(locations) if isinstance(locations, list) else str(locations)
        print(f"Geocoding failed for {primary_location}, using text embedding as fallback")
        embedding = generate_embedding(location_text)
    
    if embedding is None:
        print(f"Failed to generate location embedding for job description {job_doc.get('_id')}")
        return
    
    insert_embedding(job_doc["_id"], "JobDescriptionsTesting", "location_embedding", embedding)

# function for generating and storing job cultural index embeddings