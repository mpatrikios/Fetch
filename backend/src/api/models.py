# Pydantic models for API responses related to candidates, jobs, and matching results.
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime

# Candidate Models

class CandidateInfo(BaseModel):
    """ Recruiter's view of candidate profile """
    id: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    location: Optional[str] = None
    Summary: Optional[str] = None
    skills: List[str] = []
    clifton_strengths: List[str] = []
    notes: Optional[str] = None
    status: Optional[str] = "pending"
    has_embeddings: bool = False
    has_resume: bool = False
    has_clifton_doc: bool = False

class CandidateResponse(BaseModel):
    success: bool
    message: str
    candidate: CandidateInfo


class ResumeUploadResponse(BaseModel):
    success: bool
    message: str
    filename: str

class CandidateListResponse(BaseModel):
    success: bool
    count: int
    total_count: Optional[int] = None
    candidates: List[CandidateInfo]


# Candidate Self-Service Profile Models
class CandidateProfileResponse(BaseModel):
    """Candidate's view of their own profile - excludes
    recruiter-only data and detailed resume info"""
    id: str
    full_name: str
    email: str
    location: Optional[str] = None
    has_resume: bool = False
    has_clifton_doc: bool = False
    clifton_strengths: List[str] = []
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    resume_filename: Optional[str] = None
    clifton_filename: Optional[str] = None


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
class PostedJob(BaseModel):
    JobTitle: str
    job_id: str
class JobInfo(BaseModel):
    company: str
    title: str
    locations: Optional[List[str]] = None
    skills: List[str] = []
    has_embeddings: bool = False
    job_id: str
    mongo_id: str
    last_match_generated_at: Optional[str] = None

class JobResponse(BaseModel):
    success: bool
    message: str
    job: JobInfo

class JobListResponse(BaseModel):
    success: bool
    count: int
    jobs: List[JobInfo]


class SuggestedStrength(BaseModel):
    strength: str
    rationale: str


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
    has_description: bool = False
    mongo_id: Optional[str] = None
    last_match_generated_at: Optional[str] = None
    suggested_clifton_strengths: List[SuggestedStrength] = []
    culture_strengths_status: Optional[str] = None
    culture_doc_filename: Optional[str] = None


class JobDetailsResponse(BaseModel):
    success: bool
    job: JobDetails


class JobPartialParseResponse(BaseModel):
    success: bool
    needs_review: bool = True
    message: str
    company_name: str
    parsed_fields: Dict[str, Any]
    blob_path: Optional[str] = None
    blob_filename: Optional[str] = None


class JobFinalizeRequest(BaseModel):
    company_name: str
    title: str
    job_id: str
    summary: Optional[str] = None
    locations: List[str] = []
    skills: List[str] = []
    responsibilities: List[str] = []
    qualifications: List[str] = []
    min_years: Optional[str] = None
    culture_index: Optional[str] = None
    blob_path: Optional[str] = None
    blob_filename: Optional[str] = None


class CultureDocumentUploadResponse(BaseModel):
    success: bool
    message: str
    job_id: str
    suggested_clifton_strengths: List[SuggestedStrength]
    culture_strengths_status: str


class CliftonStrengthsUpdateRequest(BaseModel):
    clifton_strengths: List[str]


class CliftonStrengthsUpdateResponse(BaseModel):
    success: bool
    message: str
    clifton_strengths: List[str]
    embeddings_generated: bool

# Matching Models
class MatchRequest(BaseModel):
    company_name: str
    job_title: str
    job_id: str
    top_k: Optional[int] = 10
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
    skill_overlap: List[str] = []
    relevant_roles: List[str]
    relevant_experience: List[RelevantExperience] = []
    candidate_companies: List[str]
    summary: str

class MatchResult(BaseModel):
    candidate_id: Optional[str] = None
    rank: Optional[int] = None
    full_name: str
    email: Optional[str] = None
    location: Optional[str] = None
    distance_km: Optional[float] = None
    summary: Optional[str] = None
    scores: Optional[MatchScores] = None
    explanation: MatchExplanation
    clifton_strengths: List[str] = []
    skills: List[str] = []
    review_status: Optional[str] = None
    reviewed_at: Optional[str] = None
    reviewed_by: Optional[str] = None

class MatchResponse(BaseModel):
    success: bool
    job_id: str
    company_name: str
    job_title: str
    total_matches: int
    matches: List[MatchResult]
    is_cohort: bool = True
    mongo_match_id: Optional[str] = None
    created_at: Optional[str] = None


class ReviewUpdateRequest(BaseModel):
    review_status: Literal["Approved", "Rejected", "Pending"]


class ReviewUpdateResponse(BaseModel):
    success: bool
    message: str
    match_id: str
    candidate_id: str
    review_status: Literal["Approved", "Rejected", "Pending"]
    reviewed_by: str
    reviewed_at: str


class MatchHistoryEntry(BaseModel):
    match_id: str
    created_at: Optional[str] = None
    total_matches: int


class MatchHistoryResponse(BaseModel):
    success: bool
    company_name: str
    job_title: str
    history: List[MatchHistoryEntry]


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


# Client Models
class ClientInfo(BaseModel):
    """Basic client information for list view"""
    id: str
    company_name: str
    status: Optional[str] = None
    contact_email: Optional[str] = None
    locations: List[str] = []
    posted_jobs_count: int = 0


class ClientDetails(BaseModel):
    """Full client details for detail view"""
    id: str
    company_name: str
    status: Optional[str] = None
    contact_email: Optional[str] = None
    contact_number: Optional[str] = None
    contact_recruiter: Optional[str] = None
    summary: Optional[str] = None
    locations: List[str] = []
    posted_jobs: List[PostedJob] = []
    intake_call_notes: Optional[str] = None
    activated_at: Optional[str] = None


class ClientUpdateRequest(BaseModel):
    """Request to update client details"""
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    status: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[str] = Field(None, max_length=200)
    contact_number: Optional[str] = Field(None, max_length=50)
    contact_recruiter: Optional[str] = Field(None, max_length=200)
    summary: Optional[str] = None
    locations: Optional[List[str]] = None
    intake_call_notes: Optional[str] = None
    posted_jobs: Optional[List[PostedJob]] = None


class ClientListResponse(BaseModel):
    """Response for listing clients"""
    success: bool
    count: int
    clients: List[ClientInfo]


class ClientDetailsResponse(BaseModel):
    """Response for single client details"""
    success: bool
    client: ClientDetails