#!/usr/bin/env python3
"""
Script to create an MLG recruiter test user in MongoDB
"""

import sys
import os
import hashlib
from datetime import datetime
from dotenv import load_dotenv

# Add the src directory to Python path to import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from database.connection import mongo_connection

# Load environment variables
load_dotenv()

PASSWORD_SALT = os.getenv("PASSWORD_SALT", "fetch-recruitment-salt")

def hash_password_sha256(password: str) -> str:
    """Hash password using SHA256 with salt - same as auth_routes.py"""
    salted_password = f"{password}{PASSWORD_SALT}"
    return hashlib.sha256(salted_password.encode()).hexdigest()

def create_mlg_recruiter():
    """Create MLG recruiter test user in MongoDB"""
    try:
        # Get database connection
        db = mongo_connection.database
        collection = db.CandidatesTesting
        
        # Check if recruiter already exists
        existing_user = collection.find_one({"email": "recruiter@mlg-test.com"})
        if existing_user:
            print("MLG recruiter test user already exists!")
            print(f"User ID: {existing_user['_id']}")
            print(f"Name: {existing_user['name']}")
            print(f"Email: {existing_user['email']}")
            print(f"Role: {existing_user.get('role', 'user')}")
            return existing_user
        
        # Create new MLG recruiter user
        recruiter_password = "MLGRecruiter2024"
        hashed_password = hash_password_sha256(recruiter_password)
        
        recruiter_data = {
            "name": "MLG Test Recruiter",
            "email": "recruiter@mlg-test.com",
            "password": hashed_password,
            "created_at": datetime.utcnow(),
            "role": "mlg-recruiter",
            "status": "active"
        }
        
        # Insert the recruiter
        result = collection.insert_one(recruiter_data)
        recruiter_data["_id"] = result.inserted_id
        
        print("✅ MLG recruiter test user created successfully!")
        print(f"User ID: {result.inserted_id}")
        print(f"Name: {recruiter_data['name']}")
        print(f"Email: {recruiter_data['email']}")
        print(f"Password: {recruiter_password}")
        print(f"Role: {recruiter_data['role']}")
        print(f"Status: {recruiter_data['status']}")
        
        return recruiter_data
        
    except Exception as e:
        print(f"❌ Error creating MLG recruiter: {str(e)}")
        return None

if __name__ == "__main__":
    print("Creating MLG recruiter test user...")
    create_mlg_recruiter()