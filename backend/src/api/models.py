# Pydantic models for API responses related to candidates, jobs, and matching results.
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Candidate Models

class CandidateInfo(BaseModel):
    """ Recruiter's view of candidate profile """
    id: Optional[str] = None
    name: str
    email: Optional[str] = None
    location: Optional[str] = None
    Summary: Optional[str] = None
    skills: List[str] = []
    clifton_strengths: List[str] = []
    notes: Optional[str] = None
    status: Optional[str] = "pending"
    has_embeddings: bool = False

class CandidateResponse(BaseModel):
    success: bool
    message: str
    candidate: CandidateInfo

class CandidateListResponse(BaseModel):
    success: bool
    count: int
    candidates: List[CandidateInfo]


# Candidate Self-Service Profile Models
class CandidateProfileResponse(BaseModel):
    """Candidate's view of their own profile - excludes
    recruiter-only data and detailed resume info"""
    id: str
    full_name: str
    email: str
    location: Optional[str] = None
    clifton_strengths: List[str] = []
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class ProfileUpdateRequest(BaseModel):
    """Request to update candidate's own profile"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=200)


class ProfileUpdateResponse(BaseModel):
    """Response after profile update"""
    success: bool
    message: str
    profile: CandidateProfileResponse
    embeddings_regenerated: bool = False


# Account Settings Models
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class PasswordChangeResponse(BaseModel):
    success: bool
    message: str


class AccountDeleteRequest(BaseModel):
    password: str
    confirm_deletion: bool = False


class AccountDeleteResponse(BaseModel):
    success: bool
    message: str
    deletion_type: str


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


class JobDetails(BaseModel):
    job_id: str
    company: str
    title: str
    summary: Optional[str] = None
    locations: List[str] = []
    skills: List[str] = []
    responsibilities: List[str] = []
    min_years: Optional[str] = None
    culture_index: Optional[str] = None
    qualifications: List[str] = []
    clifton_strengths: List[str] = []
    has_embeddings: bool = False


class JobDetailsResponse(BaseModel):
    success: bool
    job: JobDetails

# Matching Models
class MatchRequest(BaseModel):
    company_name: str
    job_title: str
    top_k: Optional[int] = 10
    top_k_percent: Optional[float] = 0.75
    use_cohort: Optional[bool] = True

class MatchScores(BaseModel):
    combined: float
    profile: float
    culture: float

class RelevantExperience(BaseModel):
    role: str
    company: Optional[str] = None

class MatchExplanation(BaseModel):
    keyword_overlap: List[str]
    relevant_roles: List[str]
    relevant_experience: List[RelevantExperience] = []
    candidate_companies: List[str]
    summary: str

class MatchResult(BaseModel):
    candidate_id: Optional[str] = None
    rank: Optional[int] = None
    candidate_name: str
    email: Optional[str] = None
    location: Optional[str] = None
    distance_km: Optional[float] = None
    scores: Optional[MatchScores] = None
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
    is_cohort: bool = True


# Dashboard Stats Models
class CandidateStats(BaseModel):
    total: int
    pending: int
    accepted: int
    rejected: int
    onboarding: int


class JobStats(BaseModel):
    total: int
    with_matches: int


class ClientStats(BaseModel):
    total: int
    onboarding: int


class DashboardStatsResponse(BaseModel):
    success: bool
    candidates: CandidateStats
    jobs: JobStats
    clients: ClientStats