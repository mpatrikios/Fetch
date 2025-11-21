"""
This file is responsible for standardizing the JSON output from Azure Content Understanding
"""
from datetime import datetime
import mimetypes


def extract_field_value(field_obj):
    """Extract the actual value from Azure AI field object"""
    if field_obj is None:
        return None
    
    field_type = field_obj.get("type")
    
    if field_type == "string":
        return field_obj.get("valueString")
    elif field_type == "number":
        return field_obj.get("valueNumber")
    elif field_type == "array":
        return field_obj.get("valueArray", [])
    elif field_type == "object":
        return field_obj.get("valueObject", {})
    else:
        return None

def flatten_work_experience(work_exp_array):
    """Flatten work experience array into list of dicts"""
    experiences = []
    
    for exp in work_exp_array:
        if exp.get("type") == "object":
            value_obj = exp.get("valueObject", {})
            exp_dict = {}
            
            for key, val in value_obj.items():
                exp_dict[key] = extract_field_value(val)
            
            experiences.append(exp_dict)
    
    return experiences

def flatten_skills(skills_array):
    """Flatten skills array into list of strings"""
    skills = []
    
    for skill in skills_array:
        if skill.get("type") == "object":
            # Skills are objects with a 'subfield' property
            value_obj = skill.get("valueObject", {})
            if "subfield" in value_obj:
                skill_name = extract_field_value(value_obj["subfield"])
                if skill_name:
                    skills.append(skill_name)
        elif skill.get("type") == "string":
            # Fallback for direct string skills
            skill_name = skill.get("valueString")
            if skill_name:
                skills.append(skill_name)
    
    return skills

def flatten_companies(companies_array):
    """Flatten companies array into list of dicts"""
    companies = []
    
    for company in companies_array:
        if company.get("type") == "object":
            value_obj = company.get("valueObject", {})
            company_dict = {}
            
            for key, val in value_obj.items():
                company_dict[key] = extract_field_value(val)
            
            companies.append(company_dict)
    
    return companies

def validate_file_type(filepath: str) -> bool:
    """Validate if the file is a json based on its MIME type."""
    mime_type, _ = mimetypes.guess_type(filepath)
    valid_mime_types = "application/json"
    if mime_type == valid_mime_types:
        print(f"\n✓ Valid file type\n")
    return mime_type == valid_mime_types

DESIRED_FIELD_KEYS = {"Location", "Summary", "WorkExperience", "Skills", "Companies"}

def standardize_resume(result_json: dict) -> dict:
    """Standardize resume JSON data from Azure into MongoDB-ready format.
    
    Args:
        result_json: The JSON result from Azure Content Understanding
    
    Returns:
        MongoDB-ready document dictionary
    """
    all_fields = result_json["result"]["contents"][0]["fields"]
    
    # Filter only the desired field keys
    filtered_fields = {k: v for k, v in all_fields.items() if k in DESIRED_FIELD_KEYS}

    extracted_data = extract_data(filtered_fields)

    #  Build mongo-ready document (no normalization – use extracted values as-is)
    mongo_doc = {
        "Location": extracted_data.get("Location"),
        "Summary": extracted_data.get("Summary"),
        "Experience": extracted_data.get("Experience", []),
        "Skills": extracted_data.get("Skills", []),
        "Companies": extracted_data.get("Companies", []),
        "extracted_at": extracted_data.get("extracted_at")
    }
    
    return mongo_doc

def extract_data(fields: dict) -> dict:
    """Extract relevant fields from the input dictionary"""
    extracted_data = {}

    # Simple string fields
    extracted_data["Location"] = extract_field_value(fields.get("Location"))
    extracted_data["Summary"] = extract_field_value(fields.get("Summary"))

    # Complex fields - Experience (array of objects)
    if "WorkExperience" in fields:
        work_exp_raw = extract_field_value(fields["WorkExperience"])
        extracted_data["Experience"] = flatten_work_experience(work_exp_raw)
    else:
        extracted_data["Experience"] = []

    # Complex fields - Skills (array of strings)
    if "Skills" in fields:
        skills_raw = extract_field_value(fields["Skills"])
        extracted_data["Skills"] = flatten_skills(skills_raw)
    else:
        extracted_data["Skills"] = []

    # Complex fields - Companies (array of objects)
    if "Companies" in fields:
        companies_raw = extract_field_value(fields["Companies"])
        extracted_data["Companies"] = flatten_companies(companies_raw)
    else:
        extracted_data["Companies"] = []

    # Add metadata
    extracted_data["extracted_at"] = datetime.now().isoformat()

    return extracted_data