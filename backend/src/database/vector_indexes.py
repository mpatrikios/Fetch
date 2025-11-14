"""
Vector index management for Azure Cosmos DB for MongoDB vCore
"""

"""
DiskANN vector index creation is way too expensive. $160/month. Commented out for now.
"""
# import os
# import pymongo
# from pymongo import MongoClient
# from dotenv import load_dotenv
# from typing import Dict, Any
# load_dotenv()
# connection_string = os.getenv("MONGODB_URL")

# client = MongoClient(connection_string)

# db = client.get_database("FetchTestingDB")

# def ensure_candidate_profile_vector_index(db) -> Dict[str, Any]:
#     """
#     Create DiskANN vector index on CandidatesTesting.profile_embedding field.
    
#     Uses DiskANN for high-performance vector similarity search with cosine similarity.
#     Optimized for OpenAI text-embedding-ada-002 (1536 dimensions).
    
#     Args:
#         db: MongoDB database instance
        
#     Returns:
#         Dictionary with operation result
#     """
#     collection_name = "CandidatesTesting"
#     index_name = "profile_embedding_diskann_index"
    
#     try:
#         # Check if index already exists
#         existing_indexes = list(db[collection_name].list_indexes())
#         for index in existing_indexes:
#             if index.get('name') == index_name:
#                 print(f"Vector index '{index_name}' already exists on {collection_name}")
#                 return {
#                     "success": True,
#                     "operation": "exists",
#                     "index_name": index_name,
#                     "collection": collection_name
#                 }
        
#         # Create DiskANN vector index
#         create_index_command = {
#             "createIndexes": collection_name,
#             "indexes": [
#                 {
#                     "name": index_name,
#                     "key": {
#                         "profile_embedding": "cosmosSearch"
#                     },
#                     "cosmosSearchOptions": {
#                         "kind": "vector-diskann",
#                         "dimensions": 1536,  # OpenAI text-embedding-ada-002 dimensions
#                         "similarity": "COS",  # Cosine similarity
#                         "maxDegree": 32,      # Default optimized value
#                         "lBuild": 50          # Default optimized value
#                     }
#                 }
#             ]
#         }
        
#         result = db.command(create_index_command)
        
#         print(f"Successfully created vector index '{index_name}' on {collection_name}")
#         return {
#             "success": True,
#             "operation": "created",
#             "index_name": index_name,
#             "collection": collection_name,
#             "result": result
#         }
        
#     except Exception as e:
#         print(f"Failed to create vector index '{index_name}' on {collection_name}: {str(e)}")
#         return {
#             "success": False,
#             "error": str(e),
#             "index_name": index_name,
#             "collection": collection_name
#         }

# def ensure_job_profile_vector_index(db) -> Dict[str, Any]:
#     """
#     Create DiskANN vector index on JobDescriptionsTesting.profile_embedding field.
    
#     Args:
#         db: MongoDB database instance
        
#     Returns:
#         Dictionary with operation result
#     """
#     collection_name = "JobDescriptionsTesting"
#     index_name = "profile_embedding_diskann_index"
    
#     try:
#         # Check if index already exists
#         existing_indexes = list(db[collection_name].list_indexes())
#         for index in existing_indexes:
#             if index.get('name') == index_name:
#                 print(f"Vector index '{index_name}' already exists on {collection_name}")
#                 return {
#                     "success": True,
#                     "operation": "exists",
#                     "index_name": index_name,
#                     "collection": collection_name
#                 }
        
#         # Create DiskANN vector index  
#         create_index_command = {
#             "createIndexes": collection_name,
#             "indexes": [
#                 {
#                     "name": index_name,
#                     "key": {
#                         "profile_embedding": "cosmosSearch"
#                     },
#                     "cosmosSearchOptions": {
#                         "kind": "vector-diskann",
#                         "dimensions": 1536,  # OpenAI text-embedding-ada-002 dimensions
#                         "similarity": "COS",  # Cosine similarity
#                         "maxDegree": 32,      # Default optimized value
#                         "lBuild": 50          # Default optimized value
#                     }
#                 }
#             ]
#         }
        
#         result = db.command(create_index_command)
        
#         print(f"Successfully created vector index '{index_name}' on {collection_name}")
#         return {
#             "success": True,
#             "operation": "created",
#             "index_name": index_name,
#             "collection": collection_name,
#             "result": result
#         }
        
#     except Exception as e:
#         print(f"Failed to create vector index '{index_name}' on {collection_name}: {str(e)}")
#         return {
#             "success": False,
#             "error": str(e),
#             "index_name": index_name,
#             "collection": collection_name
#         }

# def setup_all_vector_indexes() -> Dict[str, Any]:
#     """
#     Setup all required vector indexes for the application.
    
#     Args:
#         db: MongoDB database instance
        
#     Returns:
#         Dictionary with overall operation result
#     """
#     results = {
#         "candidates": ensure_candidate_profile_vector_index(db),
#         "jobs": ensure_job_profile_vector_index(db)
#     }
    
#     all_successful = all(result.get("success", False) for result in results.values())
    
#     return {
#         "success": all_successful,
#         "results": results
#     }