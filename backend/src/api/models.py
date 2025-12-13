# Pydantic models for API responses related to candidates, jobs, and matching results.
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Candidate Models
class CandidateInfo(BaseModel):
    name: str
    email: Optional[str] = None
    location: Optional[str] = None
    skills: List[str] = []
    has_embeddings: bool = False

class CandidateResponse(BaseModel):
    success: bool
    message: str
    candidate: CandidateInfo

class CandidateListResponse(BaseModel):
    success: bool
    count: int
    candidates: List[CandidateInfo]

# Job Models
class JobInfo(BaseModel):
    company: str
    title: str
    location: Optional[str] = None
    skills: List[str] = []
    has_embeddings: bool = False
    job_id: str

class JobResponse(BaseModel):
    success: bool
    message: str
    job: JobInfo

class JobListResponse(BaseModel):
    success: bool
    count: int
    jobs: List[JobInfo]

# Matching Models
class MatchRequest(BaseModel):
    company_name: str
    job_title: str
    top_k: Optional[int] = 10

class MatchScores(BaseModel):
    combined: float
    profile: float
    culture: float

class MatchExplanation(BaseModel):
    keyword_overlap: List[str]
    relevant_roles: List[str]
    candidate_companies: List[str]
    summary: str

class MatchResult(BaseModel):
    rank: int
    candidate_name: str
    email: Optional[str] = None
    location: Optional[str] = None
    distance_km: Optional[float] = None
    scores: MatchScores
    explanation: MatchExplanation
    clifton_strengths: List[str] = []
    skills: List[str] = []

class MatchResponse(BaseModel):
    success: bool
    job_id: str
    company_name: str
    job_title: str
    total_matches: int
    matches: List[MatchResult]