import json
from datetime import datetime
import os
import sys
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

def validate_file_type(filepath: str) -> bool:
    """Validate if the file is a json based on its MIME type and malware free."""
    mime_type, _ = mimetypes.guess_type(filepath)
    valid_mime_types = "application/json"
    if mime_type == valid_mime_types:
        print(f"\n✓ Valid file type\n")
    return mime_type == valid_mime_types

DESIRED_FIELD_KEYS = {"Location", "Summary", "WorkExperience", "Skills"}

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

    # Add metadata
    extracted_data["extracted_at"] = datetime.now().isoformat()

    return extracted_data

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <filepath>")
        sys.exit(1)

    if (not validate_file_type(sys.argv[1])):
        sys.exit(1)

    filepath = sys.argv[1]
    # Extract main fields
    with open(filepath, 'r', encoding='utf-8') as file:
        result_json = json.load(file)
    
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
        "extracted_at": extracted_data.get("extracted_at")
    }

    # Save one Mongo-ready document per file as newline-delimited JSON (JSONL)
    output_dir = os.path.join('..', '..', 'standardized_output_files')
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    jsonl_filepath = os.path.join(output_dir, f'Brian_P_{timestamp}.jsonl')

    with open(jsonl_filepath, 'w', encoding='utf-8') as file:
        file.write(json.dumps(mongo_doc, ensure_ascii=False) + '\n')

    print(f"\n✓ Mongo-ready JSONL saved to: {jsonl_filepath}")

if __name__ == "__main__":
    main()