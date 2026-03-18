"""
Fallback resume parser for when Azure Content Understanding returns empty fields.

Supports: .docx (python-docx), .pdf (pdfplumber), .doc (mammoth)

Approach:
  1. Extract raw text lines from the document (format-specific)
  2. Scan for section headers regardless of order or structure
  3. Collect content under each header until the next header
  4. Parse fields from each section

Works for varied resume layouts — does not assume any fixed section order.
"""

import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Section header vocabulary — covers common resume format variations
# ---------------------------------------------------------------------------
SECTION_HEADERS = {
    # Skills
    "skills", "technical skills", "core competencies", "key skills",
    "areas of expertise", "competencies", "top skills", "skill set",
    "technologies", "tools & technologies", "technical expertise",
    # Experience
    "experience", "work experience", "professional experience",
    "work history", "employment history", "career history",
    "employment", "positions held",
    # Summary
    "summary", "professional summary", "executive summary",
    "profile", "objective", "career objective", "about me",
    # Education
    "education", "academic background", "qualifications",
    # Other (stop collecting under previous section)
    "certifications", "awards", "publications", "languages",
    "volunteer", "references", "projects", "achievements",
}


# ---------------------------------------------------------------------------
# Text extraction (format-specific)
# ---------------------------------------------------------------------------

def _lines_from_docx(file_path: str) -> list[str]:
    from docx import Document
    doc = Document(file_path)
    return [p.text.strip() for p in doc.paragraphs if p.text.strip()]


def _lines_from_pdf(file_path: str) -> list[str]:
    import pdfplumber
    lines = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=3, y_tolerance=3)
            if text:
                lines.extend(line.strip() for line in text.splitlines() if line.strip())
    return lines


def _lines_from_doc(file_path: str) -> list[str]:
    import mammoth
    with open(file_path, "rb") as f:
        result = mammoth.extract_raw_text(f)
    return [line.strip() for line in result.value.splitlines() if line.strip()]


def _extract_lines(file_path: str) -> list[str]:
    ext = Path(file_path).suffix.lower()
    if ext == ".docx":
        return _lines_from_docx(file_path)
    elif ext == ".pdf":
        return _lines_from_pdf(file_path)
    elif ext == ".doc":
        return _lines_from_doc(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ---------------------------------------------------------------------------
# Section detection
# ---------------------------------------------------------------------------

def _is_header(line: str) -> Optional[str]:
    """Return the canonical section name if line is a known header, else None."""
    normalized = line.lower().strip().rstrip(":").strip()
    if normalized in SECTION_HEADERS:
        return normalized
    return None


def _split_into_sections(lines: list[str]) -> dict[str, list[str]]:
    """Partition lines into sections by header. Order-independent."""
    sections: dict[str, list[str]] = {}
    current = None
    for line in lines:
        header = _is_header(line)
        if header:
            current = header
            if current not in sections:
                sections[current] = []
        elif current is not None:
            sections[current].append(line)
    return sections


# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------

def _extract_location(lines: list[str]) -> Optional[str]:
    """
    Location is usually in the header block (first ~5 lines),
    looks like 'City, State' or 'City, Country'.
    """
    location_pattern = re.compile(
        r"^[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+$"
    )
    for line in lines[:6]:
        if location_pattern.match(line.strip()):
            return line.strip()
    return None


def _extract_skills(sections: dict) -> list[str]:
    """
    Look in 'skills', 'technical skills', 'core competencies', 'top skills', etc.
    Handles: comma-separated strings, bullet lists, newline-separated.
    """
    skill_sections = [
        "skills", "technical skills", "core competencies", "key skills",
        "areas of expertise", "competencies", "top skills", "skill set",
        "technologies", "tools & technologies", "technical expertise",
    ]
    for key in skill_sections:
        if key not in sections:
            continue
        content = sections[key]
        all_skills = []
        for line in content:
            # Comma-separated on one line
            if "," in line:
                all_skills.extend(s.strip() for s in line.split(",") if s.strip())
            else:
                # One skill per line (bullets already stripped)
                cleaned = line.lstrip("•▪▸-– ").strip()
                if cleaned:
                    all_skills.append(cleaned)
        if all_skills:
            return all_skills
    return []


_DATE_PATTERN = re.compile(
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?|\d{4})"
    r".{0,20}"
    r"(–|-|to)\s*(Present|\d{4}|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|"
    r"Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|"
    r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)",
    re.IGNORECASE,
)


def _is_date_line(line: str) -> bool:
    return bool(_DATE_PATTERN.search(line))


def _extract_experience(sections: dict) -> tuple[list[dict], list[dict]]:
    """
    Parse experience section into Experience and Companies lists.

    Job block pattern (flexible):
      Company Name
      Job Title          (or Title then Company — both handled)
      Date range [· Location]
      Description / bullets
    """
    exp_keys = [
        "experience", "work experience", "professional experience",
        "work history", "employment history", "career history", "employment",
    ]
    content = []
    for key in exp_keys:
        if key in sections:
            content = sections[key]
            break

    if not content:
        return [], []

    # Split content into job blocks by date lines
    blocks: list[list[str]] = []
    current_block: list[str] = []
    for line in content:
        if _is_date_line(line) and current_block:
            # Attach date to current block, then treat next non-date lines as new block
            current_block.append(line)
        elif not _is_date_line(line) and current_block and any(_is_date_line(l) for l in current_block):
            # We've passed a date line — start a new block
            blocks.append(current_block)
            current_block = [line]
        else:
            current_block.append(line)
    if current_block:
        blocks.append(current_block)

    experiences = []
    companies = []

    for block in blocks:
        if not block:
            continue

        # Find the date line index
        date_idx = next((i for i, l in enumerate(block) if _is_date_line(l)), None)

        if date_idx is None:
            continue

        time_period = block[date_idx]
        # Strip location from date line (e.g. "Jan 2018 – Present · Columbus, Ohio")
        time_period_clean = re.split(r"·|,", time_period)[0].strip()

        header_lines = block[:date_idx]

        # First line = company, second = role (or vice versa — heuristic: role is more title-like)
        company_name = None
        role = None
        if len(header_lines) >= 2:
            company_name = header_lines[0].strip()
            role = header_lines[1].strip()
        elif len(header_lines) == 1:
            role = header_lines[0].strip()

        experiences.append({
            "role": role,
            "timePeriod": time_period_clean,
            "responsibilities": None,
        })
        if company_name:
            companies.append({
                "companyName": company_name,
                "totalDuration": None,
            })

    return experiences, companies


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fallback_parse(file_path: str) -> dict:
    """
    Extract resume fields from a local file (.docx, .pdf, .doc).

    Returns a dict with the same schema as standardize_resume():
        Location, Summary, Experience, Skills, Companies, extracted_at

    Only populates fields it can confidently identify — never fabricates data.
    Returns an empty dict if extraction fails entirely.
    """
    try:
        lines = _extract_lines(file_path)
    except Exception as e:
        logger.warning(f"Fallback parser: could not extract text from {file_path}: {e}")
        return {}

    if not lines:
        return {}

    sections = _split_into_sections(lines)
    skills = _extract_skills(sections)
    experience, companies = _extract_experience(sections)
    location = _extract_location(lines)

    # Summary: take the longest paragraph in the summary section
    summary = None
    for key in ("summary", "professional summary", "executive summary", "profile", "objective"):
        if key in sections and sections[key]:
            summary = max(sections[key], key=len)
            break

    result = {"extracted_at": datetime.now().isoformat()}
    if location:
        result["Location"] = location
    if summary:
        result["Summary"] = summary
    if skills:
        result["Skills"] = skills
    if experience:
        result["Experience"] = experience
    if companies:
        result["Companies"] = companies

    logger.info(
        f"Fallback parser extracted from {Path(file_path).name}: "
        f"skills={len(skills)}, experience={len(experience)}, "
        f"location={'yes' if location else 'no'}"
    )
    return result
