"""
This file is responsible for generating embeddings using OpenAI API
"""

from openai import OpenAI
import os
from dotenv import load_dotenv
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from database.insert_to_mongo import insert_embedding
from database.connection import mongo_connection

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
    location_text = " ".join(locations) if isinstance(locations, list) else str(locations)
    embedding = generate_embedding(location_text)
    if embedding is None:
        print(f"Failed to generate location embedding for job description {job_doc.get('_id')}")
        return
    insert_embedding(job_doc["_id"], "JobDescriptionsTesting", "location_embedding", embedding)

# function for generating and storing job cultural index embeddings