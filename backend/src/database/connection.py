"""
MongoDB Connection Manager

This module provides a centralized MongoDB client interface for the entire application.
It implements a single pattern to ensure only one connection pool is created.
"""

import os
import logging
from typing import Optional
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MongoDBConnection:
    """
    Singleton MongoDB connection manager.
    Provides a single point of access to MongoDB client, database, and collections.
    """
    
    _instance: Optional['MongoDBConnection'] = None
    _client: Optional[MongoClient] = None
    _database: Optional[Database] = None
    
    def __new__(cls) -> 'MongoDBConnection':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            self._initialize_connection()
    
    def _initialize_connection(self) -> None:
        """Initialize MongoDB connection"""
        try:
            connection_string = os.getenv("MONGODB_URL")
            if not connection_string:
                raise ValueError("MONGODB_URL environment variable not set")
            
            self._client = MongoClient(connection_string)
            self._database = self._client.get_database("FetchTestingDB")
            
            # Test the connection
            self._client.server_info()
            logger.info("Successfully connected to MongoDB")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    
    @property
    def client(self) -> MongoClient:
        """Get MongoDB client"""
        if self._client is None:
            self._initialize_connection()
        return self._client
    
    @property
    def database(self) -> Database:
        """Get default database (FetchTestingDB)"""
        if self._database is None:
            self._initialize_connection()
        return self._database
    
    @property
    def db(self) -> Database:
        """Alias for database property"""
        return self.database
    
    def get_collection(self, collection_name: str) -> Collection:
        """
        Get a collection from the default database
        
        Args:
            collection_name: Name of the collection
            
        Returns:
            MongoDB collection object
        """
        return self.database.get_collection(collection_name)
    
    @property
    def candidates_collection(self) -> Collection:
        """Get CandidatesTesting collection"""
        return self.get_collection("CandidatesTesting")
    
    @property
    def job_descriptions_collection(self) -> Collection:
        """Get JobDescriptionsTesting collection"""
        return self.get_collection("JobDescriptionsTesting")


# Create a module-level instance for easy import
mongo_connection = MongoDBConnection()

# Export commonly used attributes for convenience
client = mongo_connection.client
database = mongo_connection.database