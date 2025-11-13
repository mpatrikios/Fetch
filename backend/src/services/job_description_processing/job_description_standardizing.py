"""
This file is responsible for standardizing the JSON output from Azure Content Understanding
"""
import json
from datetime import datetime
import os
import sys
import mimetypes

# Fields match the Azure Content Understanding job description parser's schema
DESIRED_FIELD_KEYS = {"Summary", "Locations", "JobTitle", "Skills", "Responsibilities", "MinYears", "CultureIndex", "Qualifications"}
LIST_FIELD_KEYS = {"Locations", "Skills", "Responsibilities", "Qualifications"}
FLAT_FIELD_KEYS = {"Summary", "JobTitle", "MinYears", "CultureIndex"}

# --- Basic field extraction function ---
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

# --- Complex field flattening function ---
def flatten_object_array(object_array: list[dict]) -> list:
    """Flatten a list of objects as dictionaries into a list of strings/numbers.

    Args:
        object_array:   List of Azure AI field objects of type 'object'. 
                        Each object is expected to only have a 'subfield' property.
    """
    
    values = []
    if not object_array:
        return values

    for obj in object_array:
        obj_fields = obj.get("valueObject", {})
        field_val = extract_field_value(obj_fields.get("subfield"))
        if field_val:
            values.append(field_val)
    return values

# -- Standardizing all extracted fields --

def extract_data(fields: dict) -> dict:
    """Extract relevant fields from the input dictionary"""
    extracted_data = {}

    # Complex fields - Locations, Skills, Responsibilities, Qualifications
    # Updated to remove '\\-' from responsibilities during extraction
    for list_field_key in LIST_FIELD_KEYS:
        field_value = extract_field_value(fields.get(list_field_key))
        extracted_data[list_field_key] = [
            item.replace("\\-", "").strip() if isinstance(item, str) else item
            for item in flatten_object_array(field_value)
        ]

    for flat_field_key in FLAT_FIELD_KEYS:
        field_value = extract_field_value(fields.get(flat_field_key))
        if field_value is not None:
            extracted_data[flat_field_key] = field_value

    extracted_data["extracted_at"] = datetime.now().isoformat()

    return extracted_data

def validate_file_type(filepath: str) -> bool:
    """Validate if the file is a json based on its MIME type."""
    mime_type, _ = mimetypes.guess_type(filepath)
    valid_mime_types = "application/json"
    if mime_type == valid_mime_types:
        print(f"\n✓ Valid file type\n")
    return mime_type == valid_mime_types

# --- Main standardization function ---
def standardize_job_description(result_json: dict, company_name: str = "Unknown Company") -> dict:
    """Standardize job description JSON data from Azure into MongoDB-ready format.
    
    Args:
        result_json: The JSON result from Azure Content Understanding
        company_name: Name of the company associated with the job description
    
    Returns:
        MongoDB-ready document dictionary
    """
    all_fields = result_json["result"]["contents"][0]["fields"]
    # Filter only the desired field keys
    filtered_fields = {k: v for k, v in all_fields.items() if k in DESIRED_FIELD_KEYS}
    print(f"Filtered fields: {list(filtered_fields.keys())}")

    extracted_data = extract_data(filtered_fields)

    #  Build mongo-ready document (no normalization – use extracted values as-is)
    mongo_doc = {
        "companyName": company_name,
        "JobTitle": extracted_data.get("JobTitle"),
        "Summary": extracted_data.get("Summary"),
        "Locations": extracted_data.get("Locations", []),
        "Skills": extracted_data.get("Skills", []),
        "Responsibilities": extracted_data.get("Responsibilities", []),
        "MinYears": extracted_data.get("MinYears"),
        "CultureIndex": extracted_data.get("CultureIndex"),
        "Qualifications": extracted_data.get("Qualifications", []),
        "extracted_at": extracted_data.get("extracted_at")
    }
    
    return mongo_doc

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <filepath>")
        sys.exit(1)

    if (not validate_file_type(sys.argv[1])):
        sys.exit(1)

    filepath = sys.argv[1]
    with open(filepath, 'r', encoding='utf-8') as file:
        result_json = json.load(file)
    
    # Extract candidate name from file path
    # For path like: /Users/.../company/jobTitle/jd_result_20251107_132444.json
    # Extract the parent directory name as job title
    path_parts = filepath.split(os.sep)
    company_name = ""
    job_title = ""
    if len(path_parts) >= 3:
        company_name = path_parts[-3].replace('_', ' ')
        job_title = path_parts[-2].replace('_', ' ')
    
    # Use the standardize_job_description function
    mongo_doc = standardize_job_description(result_json, company_name)
    
    # Save one Mongo-ready document per file as newline-delimited JSON (JSONL)
    output_dir = os.path.join('..', '..', 'standardized_output_files', company_name.replace(" ", "_"), job_title.replace(" ", "_"))
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    # Adjusted the file path structure to include company name and job title as directories
    json_filepath = os.path.join(output_dir, f'jd_mongo_{timestamp}.json')

    with open(json_filepath, 'w', encoding='utf-8') as file:
        file.write(json.dumps(mongo_doc, ensure_ascii=False))

    print(f"\n✓ Mongo-ready JSON saved to: {json_filepath}")

if __name__ == "__main__":
    main()