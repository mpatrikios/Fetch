"""
This file is responsible for generating embeddings using OpenAI API
"""

from openai import OpenAI
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from insert_to_mongo import insert_embedding

load_dotenv()
connection_string = os.getenv("MONGODB_URL")
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
mongo_client = MongoClient(connection_string)
db = mongo_client["FetchTestingDB"]

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
           " ".join([exp.get('role', '') for exp in candidate_doc.get('Experience', []) if exp]) + " " + \
           " ".join([comp.get('companyName', '') for comp in candidate_doc.get('Companies', []) if comp])
    embedding = generate_embedding(text)
    insert_embedding(candidate_doc["_id"], "CandidatesTesting", "profile_embedding", embedding)

# generate and store candidate location embeddings
def embed_candidate_location(candidate_doc):
    location_text = candidate_doc.get("Location", "")
    embedding = generate_embedding(location_text)
    insert_embedding(candidate_doc["_id"], "CandidatesTesting", "location_embedding", embedding)

# function for generating and storing candidate embeddings of cultural index

# function for generating and storing job description embeddings 

# function for generating and storing job cultural index embeddings