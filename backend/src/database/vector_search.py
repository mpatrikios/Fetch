"""
Vector similarity search operations for Azure Cosmos DB for MongoDB vCore
"""

from typing import List, Dict, Any

def search_candidates_by_profile_embedding(db, query_vector: List[float], top_k: int = 10) -> List[Dict[str, Any]]:
    """
    Search for candidates using cosine similarity on profile embeddings.
    
    Uses Azure Cosmos DB for MongoDB vCore vector search with DiskANN index
    to find candidates most similar to the provided job profile embedding.
    
    Args:
        db: MongoDB database instance
        query_vector: Job profile embedding vector (1536 dimensions)
        top_k: Number of top results to return (default: 10)
        
    Returns:
        List of dictionaries with candidate documents and similarity scores
        Format: [{"similarityScore": float, "document": candidate_doc}, ...]
        
    Raises:
        ValueError: If query_vector is invalid
        Exception: If search operation fails
    """
    if not query_vector:
        raise ValueError("query_vector cannot be empty")
    
    if len(query_vector) != 1536:
        raise ValueError(f"query_vector must have 1536 dimensions, got {len(query_vector)}")
    
    if top_k <= 0:
        raise ValueError("top_k must be positive")
    
    collection = db["CandidatesTesting"]
    
    try:
        # Build aggregation pipeline for vector search
        pipeline = [
            {
                "$search": {
                    "cosmosSearch": {
                        "path": "profile_embedding",
                        "vector": query_vector,
                        "k": top_k
                    }
                }
            },
            {
                "$project": {
                    "similarityScore": {"$meta": "searchScore"},
                    "document": "$$ROOT"
                }
            }
        ]
        
        # Execute search
        results = list(collection.aggregate(pipeline))
        
        print(f"Vector search found {len(results)} candidates")
        
        return results
        
    except Exception as e:
        print(f"Vector search failed: {str(e)}")
        raise Exception(f"Vector search operation failed: {str(e)}")