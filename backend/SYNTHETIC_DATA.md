# Synthetic Test Data

This document describes how the test database (`FetchTestingDB`) was populated with synthetic candidates and job descriptions for development and demonstration purposes.

## Candidates — `seed_resumes.py`

### Source material
Synthetic executive-level resumes generated as `.docx` files and stored locally in `backend/src/testing_resumes/`. Files are named with a numeric prefix followed by the candidate's name:
```
01_Clifton_R_Beaumont.docx
02_Denise_T_Gallagher.docx
...
```

### What the script does (per resume file)

1. **Creates a `Candidates` document** with:
   - `full_name` and `email` derived from the filename (`01_Clifton_R_Beaumont` → `Clifton R Beaumont`, `clifton.r.beaumont@test.com`)
   - `password` set to `Fetch2025!` (SHA-256 hashed with salt)
   - `status: "accepted"` — candidates are pre-approved so they appear in matching
   - 5 randomly sampled CliftonStrengths themes from all 34 themes

2. **Uploads the `.docx`** to Azure Blob Storage at `resumes/{candidate_id}/{filename}`

3. **Parses the resume** via `DocumentService.parse_and_embed_resume`:
   - Azure Content Understanding extracts `Summary`, `Skills`, `Experience`, `Companies`, `Location`
   - If any fields are empty, the text-based fallback parser (`fallback_resume_parser.py`) fills them from document sections
   - Generates and stores `profile_embedding` (skills + experience text) and `location_embedding` (geocoded coordinates)

4. **Generates a culture embedding** from the randomly assigned CliftonStrengths

### Run
```bash
cd backend
python seed_resumes.py
```

### Post-seeding backfill
If resumes were seeded before the fallback parser was added, run the backfill to populate Skills/Experience retroactively:
```bash
python backfill_resume_parsing.py --dry-run   # preview
python backfill_resume_parsing.py             # apply
```

---

## Jobs — `seed_jobs.py`

### Source material
A CSV file at `backend/testing_jobs/executive_job_postings.csv` sourced from a public Kaggle dataset of executive job postings. Relevant columns: `company`, `title`, `description`, `location`.

### What the script does

1. **Samples 100 random rows** from the CSV (drops rows missing `company` or `title`)

2. **Extracts structured fields** from the raw `description` text using Azure OpenAI (`Explanation-LLM`):
   - `Skills` — specific skills mentioned or implied
   - `Responsibilities` — key responsibilities
   - `Qualifications` — required qualifications
   - A 1-second delay is added between calls to respect rate limits

3. **Inserts a `JobDescriptions` document** with the structured fields plus `Summary` (full description text), `Locations`, and `companyName`

4. **Uploads a `.txt` file** to Azure Blob Storage at `job-descriptions/{job_id}/{company}_{title}.txt`

5. **Generates embeddings** — `profile_embedding` (job title + skills + responsibilities) and `location_embedding` (geocoded coordinates from `Locations`)

6. **Upserts a `Clients` document** for each unique company (skips if already exists)

---

## Job Culture Embeddings — `seed_job_culture.py`

Run after `seed_jobs.py` to assign CliftonStrengths to any jobs that don't yet have a culture embedding.

### What it does
- Finds all `JobDescriptions` without `culture_embedding`
- Assigns 5 randomly sampled CliftonStrengths themes and saves them to the document
- Generates and stores `culture_embedding` from those themes

### Run
```bash
cd backend
python seed_job_culture.py
```

---

## Required environment variables

All scripts read from `.env` in `backend/`:

| Variable | Used by |
|---|---|
| `MONGODB_URL` | All scripts |
| `AZURE_STORAGE_CONNECTION_STRING` | `seed_resumes.py`, `seed_jobs.py` |
| `AZURE_STORAGE_CONTAINER_NAME` | `seed_resumes.py`, `seed_jobs.py` (default: `fetch-documents`) |
| `AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY` | `seed_resumes.py` (resume parsing) |
| `AZURE_OPENAI_API_KEY` | `seed_resumes.py` (embeddings), `seed_jobs.py` (GPT extraction + embeddings) |
| `AZURE_OPENAI_BASE_URL` | Embeddings |
| `AZURE_OPENAI_EXPLANATION_BASE_URL` | `seed_jobs.py` (GPT extraction) |

---

## Recommended run order

```bash
python seed_jobs.py          # insert 100 jobs + clients
python seed_job_culture.py   # assign culture embeddings to jobs
python seed_resumes.py       # insert candidates from .docx files
python backfill_resume_parsing.py  # fill any empty Skills/Experience
```
