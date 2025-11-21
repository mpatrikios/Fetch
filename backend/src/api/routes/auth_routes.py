from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
import hashlib
import os
from dotenv import load_dotenv

from src.database.connection import mongo_connection

load_dotenv()

router = APIRouter()
security = HTTPBearer()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
JWT_ALGORITHM = "HS256"  # For JWT token signing (HMAC with SHA-256)
ACCESS_TOKEN_EXPIRE_MINUTES = 30
PASSWORD_SALT = os.getenv("PASSWORD_SALT", "fetch-recruitment-salt")

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    token: str
    token_type: str = "bearer"
    user: dict

def hash_password_sha256(password: str) -> str:
    """Hash password using SHA256 with salt"""
    salted_password = f"{password}{PASSWORD_SALT}"
    return hashlib.sha256(salted_password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its SHA256 hash"""
    return hash_password_sha256(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    db = mongo_connection.database
    user = db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["_id"] = str(user["_id"])
    return user

@router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    db = mongo_connection.database
    
    existing_user = db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    hashed_password = hash_password_sha256(user_data.password)
    
    user_dict = {
        "name": user_data.name,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": datetime.utcnow(),
        "role": "user"
    }
    
    result = db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.email}, expires_delta=access_token_expires
    )
    
    user_response = {
        "id": user_dict["_id"],
        "name": user_dict["name"],
        "email": user_dict["email"],
        "role": user_dict["role"]
    }
    
    return {
        "token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

@router.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    db = mongo_connection.database
    
    user = db.users.find_one({"email": user_credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(user_credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    user_response = {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "user")
    }
    
    return {
        "token": access_token,
        "token_type": "bearer",
        "user": user_response
    }

@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user.get("role", "user")
    }

@router.post("/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}