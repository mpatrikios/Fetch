"""
This file is responsible for generating embeddings using OpenAI API
"""

import openai
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from insert_to_mongo import insert_embedding

load_dotenv()
connection_string = os.getenv("MONGODB_URL")
openai_api_key = os.getenv("OPENAI_API_KEY")

openai.api_key = openai_api_key
mongo_client = MongoClient(connection_string)
db = mongo_client["FetchTestingDB"]

def generate_embedding(text):
    try:
        response = openai.Embedding.create(
            input=text,
            model="text-embedding-ada-002"  # Ensure this is a valid model name string
        )
        return response['data'][0]['embedding']
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
    insert_embedding(candidate_doc["_id"], "candidates", "profile_embedding", embedding)

# generate and store candidate location embeddings
def embed_candidate_location(candidate_doc):
    location_text = candidate_doc.get("Location", "")
    embedding = generate_embedding(location_text)
    insert_embedding(candidate_doc["_id"], "candidates", "location_embedding", embedding)

# function for generating and storing candidate embeddings of cultural index

# function for generating and storing job description embeddings 

# function for generating and storing job cultural index embeddings