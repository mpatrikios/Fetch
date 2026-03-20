"""
generate_mlg_sheets_google.py

Creates Google Sheets for MLG (external reviewers) to blind-evaluate candidate
recommendations. Each sheet covers one job and shows up to --total-candidates
candidates: the AI-matched candidates (from the Matches collection) plus random
fill-ins. MLG reviewers cannot see which are AI vs random. A separate internal
cross-reference sheet tracks the source for accuracy measurement.

Usage:
    python generate_mlg_sheets_google.py [--n-jobs N] [--total-candidates N]

Required env vars:
    MONGODB_URL
    GOOGLE_SERVICE_ACCOUNT_FILE   path to service account JSON

Optional env vars:
    DRIVE_FOLDER_ID               Google Drive folder to place sheets in
    SHARE_WITH_EMAIL              email address to share each sheet with
"""

import argparse
import os
import random
import sys
from datetime import datetime

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# ---------------------------------------------------------------------------
# Google Sheets / Drive imports
# ---------------------------------------------------------------------------
try:
    import gspread
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build as gdrive_build
except ImportError:
    print(
        "ERROR: Required packages not installed.\n"
        "Run: pip install gspread google-auth google-api-python-client"
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DB_NAME = "FetchTestingDB"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
REVIEW_SHEET_HEADERS = [
    "#",
    "Name",
    "Location",
    "Candidate Summary",
    "Top CliftonStrengths",
    "Recruiter Notes",
    "Recommendation",
    "MLG Notes",
]
XREF_HEADERS = [
    "Job",
    "#",
    "Candidate ID",
    "Name",
    "Location",
    "Source",
]
RECOMMENDATION_OPTIONS = ["Strong Yes", "Yes", "Maybe", "No", "Strong No"]


# ---------------------------------------------------------------------------
# MongoDB helpers
# ---------------------------------------------------------------------------

def connect_db() -> object:
    url = os.getenv("MONGODB_URL")
    if not url:
        raise ValueError("MONGODB_URL environment variable is not set")
    client = MongoClient(url)
    client.server_info()  # fail fast if unreachable
    return client[DB_NAME]


def get_jobs(db, n: int) -> list:
    """Return up to n jobs that have had matches generated, most recent first."""
    cursor = (
        db["JobDescriptions"]
        .find({"last_match_generated_at": {"$exists": True}})
        .sort("last_match_generated_at", -1)
        .limit(n)
    )
    jobs = list(cursor)
    print(f"Found {len(jobs)} job(s) with matches generated.")
    return jobs


def get_latest_match(db, company_name: str, job_title: str) -> dict | None:
    """Return the most recent Matches document for the given job."""
    return db["Matches"].find_one(
        {"companyName": company_name, "JobTitle": job_title},
        sort=[("created_at", -1)],
    )


def get_candidate_records(db, candidate_ids: list) -> dict:
    """Batch-fetch Candidates by _id. Returns {str(id): doc}."""
    oids = []
    for cid in candidate_ids:
        try:
            oids.append(ObjectId(cid))
        except Exception:
            pass
    if not oids:
        return {}
    docs = db["Candidates"].find({"_id": {"$in": oids}})
    return {str(d["_id"]): d for d in docs}


def get_random_candidates(db, exclude_ids: set, limit: int) -> list:
    """Return `limit` random Candidates not in exclude_ids."""
    if limit <= 0:
        return []
    pipeline = [
        {"$match": {"_id": {"$nin": [ObjectId(i) for i in exclude_ids if _valid_oid(i)]}}},
        {"$sample": {"size": limit}},
    ]
    return list(db["Candidates"].aggregate(pipeline))


def _valid_oid(s: str) -> bool:
    try:
        ObjectId(s)
        return True
    except Exception:
        return False


def build_jd_text(job_doc: dict) -> str:
    """Compose a readable job description string from JobDescriptions fields."""
    parts = []
    title = job_doc.get("JobTitle", "")
    company = job_doc.get("companyName", "")
    if title or company:
        parts.append(f"ROLE: {company} — {title}")

    summary = job_doc.get("Summary", "")
    if summary:
        parts.append(f"SUMMARY:\n{summary}")

    responsibilities = job_doc.get("Responsibilities", []) or []
    if responsibilities:
        resp_lines = "\n".join(f"  • {r}" for r in responsibilities[:8])
        parts.append(f"RESPONSIBILITIES:\n{resp_lines}")

    skills = job_doc.get("Skills", []) or []
    if skills:
        parts.append(f"SKILLS: {', '.join(skills[:10])}")

    qualifications = job_doc.get("Qualifications", []) or []
    if qualifications:
        qual_lines = "\n".join(f"  • {q}" for q in qualifications[:5])
        parts.append(f"QUALIFICATIONS:\n{qual_lines}")

    locations = job_doc.get("Locations", []) or []
    if locations:
        parts.append(f"LOCATIONS: {', '.join(locations)}")

    min_years = job_doc.get("MinYears", "")
    if min_years:
        parts.append(f"MINIMUM EXPERIENCE: {min_years} years")

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Candidate data helpers
# ---------------------------------------------------------------------------

def get_clifton_strengths(candidate: dict) -> str:
    strengths = candidate.get("clifton_strengths") or []
    names = [s.get("name", "") for s in strengths[:5] if isinstance(s, dict)]
    return ", ".join(n for n in names if n)


def get_recruiter_notes(candidate: dict) -> str:
    notes = candidate.get("recruiter_notes") or ""
    return str(notes)[:300]


def build_summary(candidate: dict) -> str:
    """Build a short summary: current role + blurb + top skills."""
    lines = []

    # Current / most recent role
    experience = candidate.get("Experience") or []
    if experience:
        recent = experience[0]
        role = recent.get("role", "")
        company = recent.get("company") or recent.get("companyName", "")
        if role or company:
            lines.append(f"{role} at {company}".strip(" at "))

    # Short summary blurb (first 200 chars)
    summary = (candidate.get("Summary") or "")[:200]
    if summary:
        lines.append(summary)

    # Top skills
    skills = candidate.get("Skills") or []
    if skills:
        lines.append("Skills: " + ", ".join(skills[:6]))

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Candidate assembly per job
# ---------------------------------------------------------------------------

def assemble_candidates(db, job_doc: dict, total: int) -> list:
    """
    Returns a shuffled list of up to `total` candidates dicts, each tagged
    with a `_source` key ("AI Match" or "Random").
    """
    company = job_doc.get("companyName", "")
    title = job_doc.get("JobTitle", "")

    match_doc = get_latest_match(db, company, title)
    ai_candidate_ids = []
    if match_doc:
        for c in match_doc.get("candidates", []) or []:
            if c and c.get("candidate_id"):
                ai_candidate_ids.append(c["candidate_id"])

    # Fetch full records for AI candidates
    ai_records = get_candidate_records(db, ai_candidate_ids)

    tagged = []
    seen_ids = set(ai_candidate_ids)

    for cid in ai_candidate_ids:
        rec = ai_records.get(cid)
        if rec:
            rec["_source"] = "AI Match"
            tagged.append(rec)

    # Fill remaining slots with random candidates
    n_random = max(0, total - len(tagged))
    random_candidates = get_random_candidates(db, seen_ids, n_random)
    for rec in random_candidates:
        rec["_source"] = "Random"
        tagged.append(rec)

    random.shuffle(tagged)
    return tagged[:total]


# ---------------------------------------------------------------------------
# Google Sheets helpers
# ---------------------------------------------------------------------------

def get_gc() -> gspread.Client:
    sa_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    creds = Credentials.from_service_account_file(sa_file, scopes=SCOPES)
    return gspread.authorize(creds)


def get_drive_service():
    sa_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    creds = Credentials.from_service_account_file(sa_file, scopes=SCOPES)
    return gdrive_build("drive", "v3", credentials=creds)


def move_to_folder(drive_service, file_id: str, folder_id: str) -> None:
    file_meta = drive_service.files().get(fileId=file_id, fields="parents").execute()
    previous_parents = ",".join(file_meta.get("parents", []))
    drive_service.files().update(
        fileId=file_id,
        addParents=folder_id,
        removeParents=previous_parents,
        fields="id, parents",
    ).execute()


def share_with(drive_service, file_id: str, email: str) -> None:
    drive_service.permissions().create(
        fileId=file_id,
        body={"type": "user", "role": "writer", "emailAddress": email},
        sendNotificationEmail=False,
    ).execute()


def add_dropdown_validation(spreadsheet, sheet_index: int, start_row: int, end_row: int, col: int) -> None:
    """Add a dropdown (data validation) for the Recommendation column via batchUpdate."""
    values = [{"userEnteredValue": opt} for opt in RECOMMENDATION_OPTIONS]
    requests = [
        {
            "setDataValidation": {
                "range": {
                    "sheetId": spreadsheet.get_worksheet(sheet_index).id,
                    "startRowIndex": start_row - 1,
                    "endRowIndex": end_row,
                    "startColumnIndex": col - 1,
                    "endColumnIndex": col,
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": values,
                    },
                    "showCustomUi": True,
                    "strict": True,
                },
            }
        }
    ]
    spreadsheet.batch_update({"requests": requests})


def hex_to_rgb(hex_color: str) -> dict:
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    return {"red": r, "green": g, "blue": b}


def format_header_row(spreadsheet, sheet_id: int, row_index: int, bg_hex: str = "#1a237e") -> None:
    requests = [
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": row_index,
                    "endRowIndex": row_index + 1,
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": hex_to_rgb(bg_hex),
                        "textFormat": {
                            "foregroundColor": {"red": 1, "green": 1, "blue": 1},
                            "bold": True,
                        },
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        }
    ]
    spreadsheet.batch_update({"requests": requests})


# ---------------------------------------------------------------------------
# Sheet creation
# ---------------------------------------------------------------------------

def create_job_sheet(gc, drive_service, job_doc: dict, candidates: list, job_index: int) -> str:
    """
    Create a Google Spreadsheet for one job with:
      - Sheet 1 ("Instructions"): brief guidance for MLG reviewers
      - Sheet 2 ("Candidates"): JD header + blind candidate table with dropdown

    Returns the spreadsheet URL.
    """
    company = job_doc.get("companyName", "Unknown")
    title = job_doc.get("JobTitle", "Unknown")
    ts = datetime.utcnow().strftime("%Y%m%d")
    sheet_title = f"MLG Review — {company} {title} ({ts})"[:100]

    spreadsheet = gc.create(sheet_title)
    file_id = spreadsheet.id

    # ---- Instructions sheet ------------------------------------------------
    instructions_ws = spreadsheet.get_worksheet(0)
    instructions_ws.update_title("Instructions")
    instructions_ws.update(
        "A1",
        [
            ["MLG Candidate Review — Instructions"],
            [""],
            [
                "You will be reviewing a list of candidates for the role shown on the "
                "'Candidates' sheet."
            ],
            [
                "For each candidate, please select a Recommendation from the dropdown "
                "in column G and add any notes in column H."
            ],
            [""],
            ["Recommendation scale:"],
            ["  Strong Yes — Exceptional fit, recommend immediately"],
            ["  Yes        — Good fit, worth pursuing"],
            ["  Maybe      — Uncertain, needs more information"],
            ["  No         — Not a fit for this role"],
            ["  Strong No  — Clearly not a fit"],
            [""],
            [
                "Please do NOT share this sheet or discuss candidates with others "
                "before returning it."
            ],
        ],
    )

    # ---- Candidates sheet --------------------------------------------------
    candidates_ws = spreadsheet.add_worksheet(title="Candidates", rows=200, cols=10)

    jd_text = build_jd_text(job_doc)

    # Row 1: JD block (merged across cols A–H)
    jd_rows = jd_text.split("\n")
    candidates_ws.update("A1", [[line] for line in jd_rows])

    header_row_index = len(jd_rows) + 2  # 1-based, leave a blank row gap
    candidates_ws.update(
        f"A{header_row_index}",
        [REVIEW_SHEET_HEADERS],
    )

    # Candidate data rows
    data_rows = []
    for i, cand in enumerate(candidates, 1):
        data_rows.append(
            [
                i,
                cand.get("full_name", ""),
                cand.get("Location", ""),
                build_summary(cand),
                get_clifton_strengths(cand),
                get_recruiter_notes(cand),
                "",  # Recommendation — dropdown
                "",  # MLG Notes
            ]
        )

    if data_rows:
        candidates_ws.update(f"A{header_row_index + 1}", data_rows)

    # Format header row (dark blue)
    ws_id = candidates_ws.id
    format_header_row(spreadsheet, ws_id, header_row_index - 1, bg_hex="#1a237e")

    # Add dropdown to Recommendation column (col 7)
    if data_rows:
        add_dropdown_validation(
            spreadsheet,
            sheet_index=1,  # "Candidates" is the second worksheet (index 1)
            start_row=header_row_index + 1,
            end_row=header_row_index + len(data_rows),
            col=7,
        )

    # ---- Optional: move to folder / share ----------------------------------
    folder_id = os.getenv("DRIVE_FOLDER_ID", "")
    share_email = os.getenv("SHARE_WITH_EMAIL", "")

    if folder_id:
        move_to_folder(drive_service, file_id, folder_id)
    if share_email:
        share_with(drive_service, file_id, share_email)

    url = f"https://docs.google.com/spreadsheets/d/{file_id}"
    print(f"  Created job sheet [{job_index}]: {sheet_title}")
    print(f"    Candidates: {len(candidates)} ({sum(1 for c in candidates if c.get('_source') == 'AI Match')} AI, {sum(1 for c in candidates if c.get('_source') == 'Random')} Random)")
    print(f"    URL: {url}")
    return url


def create_xref_sheet(gc, drive_service, job_docs: list, all_candidates: list[list]) -> str:
    """
    Create a single cross-reference Google Sheet listing every candidate with
    their Source tag so we can measure AI accuracy after MLG returns sheets.

    all_candidates[i] corresponds to job_docs[i].
    Returns the spreadsheet URL.
    """
    ts = datetime.utcnow().strftime("%Y%m%d")
    sheet_title = f"MLG Cross-Reference — INTERNAL ({ts})"

    spreadsheet = gc.create(sheet_title)
    file_id = spreadsheet.id

    ws = spreadsheet.get_worksheet(0)
    ws.update_title("Cross-Reference")

    rows = [XREF_HEADERS]
    for job_doc, candidates in zip(job_docs, all_candidates):
        job_label = f"{job_doc.get('companyName', '')} — {job_doc.get('JobTitle', '')}"
        for i, cand in enumerate(candidates, 1):
            rows.append(
                [
                    job_label,
                    i,
                    str(cand.get("_id", "")),
                    cand.get("full_name", ""),
                    cand.get("Location", ""),
                    cand.get("_source", "Unknown"),
                ]
            )

    ws.update("A1", rows)
    format_header_row(spreadsheet, ws.id, 0, bg_hex="#b71c1c")

    folder_id = os.getenv("DRIVE_FOLDER_ID", "")
    if folder_id:
        move_to_folder(drive_service, file_id, folder_id)

    url = f"https://docs.google.com/spreadsheets/d/{file_id}"
    print(f"\nCreated cross-reference sheet: {sheet_title}")
    print(f"  URL: {url}")
    return url


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate MLG Google Sheets for blind candidate review.")
    parser.add_argument("--n-jobs", type=int, default=5, help="Number of jobs to process (default: 5)")
    parser.add_argument("--total-candidates", type=int, default=40, help="Candidates per sheet (default: 40)")
    args = parser.parse_args()

    print("Connecting to MongoDB…")
    db = connect_db()

    print(f"Fetching up to {args.n_jobs} jobs…")
    job_docs = get_jobs(db, args.n_jobs)
    if not job_docs:
        print("No jobs found with matches generated. Exiting.")
        sys.exit(0)

    print("Authenticating with Google…")
    gc = get_gc()
    drive_service = get_drive_service()

    job_sheet_urls = []
    all_candidates_per_job = []

    for idx, job_doc in enumerate(job_docs, 1):
        company = job_doc.get("companyName", "Unknown")
        title = job_doc.get("JobTitle", "Unknown")
        print(f"\n[{idx}/{len(job_docs)}] Processing: {company} — {title}")
        candidates = assemble_candidates(db, job_doc, args.total_candidates)
        all_candidates_per_job.append(candidates)
        url = create_job_sheet(gc, drive_service, job_doc, candidates, idx)
        job_sheet_urls.append(url)

    xref_url = create_xref_sheet(gc, drive_service, job_docs, all_candidates_per_job)

    print("\n" + "=" * 60)
    print("Done!")
    print(f"  Job sheets created: {len(job_sheet_urls)}")
    print(f"  Cross-reference:    {xref_url}")
    print("=" * 60)


if __name__ == "__main__":
    main()
