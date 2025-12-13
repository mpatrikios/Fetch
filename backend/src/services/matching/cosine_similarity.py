import numpy as np
import re
from openai import OpenAI
import os
from dotenv import load_dotenv
from src.services.matching.location_matching import is_candidate_commutable, calculate_haversine_distance

load_dotenv()

openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError ("AZURE_OPENAI_API_KEY environment variable not set")
azure_base_url = os.getenv("AZURE_OPENAI_EXPLANATION_BASE_URL")
if not azure_base_url:
    raise ValueError ("AZURE_OPENAI_EXPLANATION_BASE_URL environment variable not set")
deployment_name = "Explanation-LLM"

# initialize OpenAI client
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
 
# Common English stopwords to exclude from keyword extraction       
STOPWORDS = {
    "the", "and", "with", "for", "from", "that", "this", "your", "their",
    "they", "them", "our", "into", "through", "will", "have", "has", "are",
    "was", "were", "been", "being", "over", "such", "than", "then", "about",
    "also", "using", "based", "able", "experience", "years"
}

# Extract keywords from text by tokenizing, lowercasing, and removing stopwords
def extract_keywords(text: str) -> set[str]:
    """
    Extracts keywords from the input text that are longer than 4 characters and are not common stopwords.

    Parameters:
        text (str): The input text from which to extract keywords.

    Returns:
        set[str]: A set of keywords (strings) that are longer than 4 characters and not in the STOPWORDS list.
    """
    tokens = re.findall(r"[A-Za-z]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 4}


# Calculates simple cosine similarity between two vectors
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    if a.shape != b.shape:
        raise ValueError("Vectors must have the same shape")
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(a.dot(b) / denom)


# Find top-k candidate matches for a job based on profile embeddings and location
def profile_matching_candidate(db, job_doc, top_k: int = 10):
    """
    Finds the top-k candidate matches for a given job document based on cosine similarity of profile and culture embeddings.
    Only includes candidates within reasonable commute distance (80km).
    Uses 50/50 weighting between profile and culture similarity.

    Args:
        db: The database connection object, expected to have a "CandidatesTesting" collection.
        job_doc (dict): The job document containing "profile_embedding" and "culture_embedding" keys and optionally "location_coordinates".
        top_k (int, optional): The number of top candidates to return. Defaults to 10.

    Returns:
        list of dict: A list of dictionaries, each containing:
            - "combined_similarity_score": The weighted 50/50 combination of profile and culture similarity.
            - "profile_similarity_score": The cosine similarity score for profile embeddings.
            - "culture_similarity_score": The cosine similarity score for culture embeddings.
            - "candidate": The candidate document.
            - "explanation": An explanation of the match.
            - "distance_km": Distance in kilometers (if coordinates available).
    """
    job_profile_vec = np.array(job_doc["profile_embedding"], dtype=float)
    job_culture_vec = np.array(job_doc.get("culture_embedding", []), dtype=float) if job_doc.get("culture_embedding") else None
    job_coords = job_doc.get("location_coordinates")

    # Find candidates with both profile and culture embeddings
    candidates_cursor = db["CandidatesTesting"].find(
        {
            "profile_embedding": {"$exists": True, "$ne": []},
            "culture_embedding": {"$exists": True, "$ne": []}
        }
    )

    scored = []
    for cand in candidates_cursor:
        # Check if candidate is within commutable distance
        is_commutable = is_candidate_commutable(job_doc, cand)
        
        # If we have location data and candidate is not commutable, skip them
        if is_commutable is False:
            continue  # Skip candidates beyond reasonable commute distance
        
        # Calculate profile similarity
        cand_profile_vec = np.array(cand["profile_embedding"], dtype=float)
        profile_similarity = cosine_similarity(job_profile_vec, cand_profile_vec)
        
        # Calculate culture similarity
        culture_similarity = 0.0
        if job_culture_vec is not None and cand.get("culture_embedding"):
            cand_culture_vec = np.array(cand["culture_embedding"], dtype=float)
            culture_similarity = cosine_similarity(job_culture_vec, cand_culture_vec)
        
        # Calculate combined score (60/40 weighting)
        combined_similarity = (profile_similarity * 0.7) + (culture_similarity * 0.3)
        
        # Calculate distance if coordinates available
        distance_km = None
        if job_coords and cand.get("location_coordinates"):
            distance_km = calculate_haversine_distance(job_coords, cand["location_coordinates"])
        
        explanation = build_match_explanation_llm(job_doc, cand, combined_similarity)
        
        scored.append({
            "combined_similarity_score": combined_similarity,
            "profile_similarity_score": profile_similarity,
            "culture_similarity_score": culture_similarity,
            "distance_km": distance_km,
            "candidate": cand,
            "explanation": explanation
        })

    scored.sort(key=lambda x: x["combined_similarity_score"], reverse=True)
    return scored[:top_k]

# python based explanation builder, using only keyword overlap and role analysis
def build_match_explanation(job_doc: dict, cand_doc: dict) -> dict:
    """
    Build a structured explanation for why a candidate matches a job based on:
      - keyword overlap in job responsibilities and candidate experience,
      - relevant senior/leadership roles in candidate experience,
      - companies worked at by candidate.
    Returns a dict with these fields for further processing or display.
    """

    # Full job text for keyword extraction
    job_text = (
        job_doc.get("Summary", "") + " " +
        " ".join(job_doc.get("Responsibilities", [])) + " " +
        " ".join(job_doc.get("Qualifications", []))
    )

    # Candidate experience text
    cand_roles_text = " ".join(
        exp.get("role", "") for exp in cand_doc.get("Experience", [])
    )
    cand_resp_text = " ".join(
        (exp.get("responsibilities") or "") for exp in cand_doc.get("Experience", [])
    )

    cand_text = (
        cand_doc.get("Summary", "") + " " +
        cand_roles_text + " " +
        cand_resp_text
    )

    # Extract keywords from job and candidate texts
    # Find overlapping keywords
    job_kw = extract_keywords(job_text)
    cand_kw = extract_keywords(cand_text)
    keyword_overlap = sorted(job_kw & cand_kw)
 

    # Tokens indicating leadership/senior roles
    job_title = (job_doc.get("JobTitle") or "").lower()
    leadership_tokens = {"head", "director", "cto", "chief", "lead", "leader", "architect"}
    
    # Find relevant senior/leadership roles in candidate experience
    relevant_roles = []
    for exp in cand_doc.get("Experience", []):
        role = (exp.get("role") or "").strip()
        rl = role.lower()
        if any(tok in rl for tok in leadership_tokens) or any(tok in job_title.split() for tok in rl.split()):
            relevant_roles.append(role)

    # Companies worked at by candidate
    candidate_companies = [
        c.get("companyName")
        for c in cand_doc.get("Companies", [])
        if c.get("companyName")
    ]

    # rough seniority estimate from job min years and candidate role count
    job_min_years = job_doc.get("MinYears", "")
    # For now, approximate candidate seniority by number of roles, probably need to sum up years in future?
    cand_role_count = len(cand_doc.get("Experience", []))
    

    return {
        "keyword_overlap": keyword_overlap[:15],  # cap for readability
        "relevant_roles": relevant_roles,
        "candidate_companies": candidate_companies,
        "job_min_years": job_min_years,
        "candidate_num_roles": cand_role_count,
    }

# LLM-enhanced explanation builder with OpenAI
def build_match_explanation_llm(job_doc: dict, cand_doc: dict, combined_score: float) -> dict:
    """
    Build an explanation for the match using:
      - structured keyword/role/skills analysis, and
      - a natural-language summary from Azure OpenAI.

    Returns a dict with the structured fields PLUS a 'summary' text.
    """
    features = build_match_explanation(job_doc, cand_doc)

    job_title = job_doc.get("JobTitle", "")
    job_summary = job_doc.get("Summary", "")
    job_skills = job_doc.get("Skills", [])
    job_company = job_doc.get("companyName", "")

    cand_name = cand_doc.get("full_name", "Unknown candidate")
    cand_summary = cand_doc.get("Summary", "")
    cand_skills = cand_doc.get("Skills", [])
    cand_location = cand_doc.get("Location", "")

    prompt = f"""
You are assisting a recruiter by explaining why a candidate matches a job.

JOB
- Company: {job_company}
- Title: {job_title}
- Summary: {job_summary}
- Required Skills: {job_skills}
- Minimum Experience: {features.get('job_min_years')}

CANDIDATE
- Name: {cand_name}
- Location: {cand_location}
- Summary: {cand_summary}
- Skills: {cand_skills}
- Companies: {features.get('candidate_companies')}
- Number of roles: {features.get('candidate_num_roles')}

MATCH ANALYSIS (computed by the system)
- Combined similarity score: {combined_score:.4f}
- Overlapping keywords in responsibilities/experience: {features.get('keyword_overlap')}
- Senior / leadership roles that look aligned: {features.get('relevant_roles')}

TASK
Write 3–5 short bullet points explaining:
1. Why this candidate is a strong or weak match for this job.
2. Which aspects of their background align well (architecture, cloud, leadership, modernization, etc.).
3. Any important gaps or risks that aren't obvious in the candidate profile.

Keep the tone factual and recruiter-friendly. Do NOT invent facts that are not supported above.
"""
    if client is None:
        # Fallback: OpenAI client not initialized
        summary_text = "Explanation generation failed: OpenAI client not initialized."
    else:
        try:
            response = client.chat.completions.create(
                model=os.environ.get("AZURE_OPENAI_MATCH_EXPLAIN_MODEL", deployment_name),
                messages=[
                    {"role": "system", "content": "You are an assistant that explains job–candidate matches for recruiters in clear, concise bullet points."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )
            summary_text = response.choices[0].message.content
        except Exception as e:
            # Fallback: if LLM call fails, just return structured info without summary
            summary_text = f"Explanation generation failed: {e}"

    # Attach LLM summary to structured features
    features["summary"] = summary_text
    return features
