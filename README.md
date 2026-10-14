# AI Resume Screening System

A local web application that compares many resumes with a job description and ranks candidates by a transparent **job-description match score**. Built as a college AI/ML project with TF-IDF, cosine similarity and a configurable skills dictionary. No paid APIs; everything runs locally.

> **Responsible use:** the score is decision support only. It is not a probability of being hired or a validated prediction of job performance. No candidate is rejected automatically; a person must review the results.

## Features
- Paste a job description and see the detected required skills, preferred skills, education and experience. Edit them before screening.
- Upload many PDF / DOCX / TXT resumes (drag and drop, validation, upload progress, per-file error messages) or use the 8 included fictional samples.
- Skill, education and experience extraction. Fields that cannot be found are labelled "Could not be determined" and are never silently counted as zero. A reviewer can correct every field and the score recalculates.
- Score = 50% text similarity + 35% required-skill match + 15% experience match. Sliders change the weights. Unavailable components are left out and the remaining weights are re-balanced.
- Dashboard (totals, average, threshold count, score chart, skills coverage), ranked table with search, score-range and skill filters and sorting, candidate detail page, CSV export, option to hide names.

## Project structure
```
backend/            app.py, resume_parser.py, matching_engine.py, skills.json, requirements.txt
frontend/           React + TypeScript + Tailwind + Recharts (Vite)
sample_resumes/     8 fictional resumes (TXT, PDF, DOCX) and demo_job_descriptions/
tests/              pytest suite, sample-format generator, expected-results generator
docs/               expected_results.md, project_report.md, demo_guide.md
```

## Installation
Requires Python 3.10+ and Node.js 18+.

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
Check http://localhost:8000/health. API docs: http://localhost:8000/docs.

**Frontend** (second terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. The dev server forwards `/api/*` to the backend on port 8000.

## Using it
1. Open **New screening** and click a **Demo** job description button (or paste your own).
2. Click **Detect requirements** and fix any skills the detector got wrong.
3. Tick **Include the fictional sample resumes** and/or drop your own files.
4. Click **Run screening**. Review **Candidate results**, open a candidate, correct fields if needed, and download the CSV.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Backend status |
| POST | `/screen` | Form fields: `job_description`, `files` (many), `use_samples`, `anonymize`, `config` (JSON), `jd_overrides` (JSON) |
| GET | `/results` | Latest ranked results and dashboard statistics |
| GET | `/candidate/{id}` | One candidate with extracted text |
| PATCH | `/candidate/{id}` | Reviewer corrections; the score recalculates |
| POST | `/parse-jd` | Detect requirements from a job description |
| GET | `/export/csv` | Ranked CSV report |
| GET | `/samples` | Sample resume names and demo job descriptions |

Limits: PDF, DOCX and TXT only; 5 MB per file; 50 files per screening. Results are kept in memory for one session; restarting the backend clears them.

## Testing
```bash
pip install -r backend/requirements.txt
python tests/make_sample_formats.py    # only if the sample PDF/DOCX are missing
pytest tests -v
```
The 29 tests cover single and multiple uploads, PDF/DOCX/TXT extraction, empty job description, corrupted, oversized and unsupported files, skill matching, score calculation (including unknown experience), ranking, manual correction, anonymised names and CSV export. For frontend and backend integration, run both servers and follow "Using it"; the Vite proxy forwards every call.

Expected rankings are in `docs/expected_results.md` (regenerate with `python tests/generate_expected_results.py`). Summary with default settings:

| Job description | Rank 1 | Rank 2 | Last |
|---|---|---|---|
| Python Developer | Priya Nair (73.5) | David Okafor (39.8) | Sam Walker (7.5) |
| Data Analyst | Rahul Menon (71.5) | Karthik Reddy (54.7) | Sam Walker (11.0) |
| Machine Learning Intern | Ananya Rao (61.1) | Meera Iyer (47.2) | Sam Walker (9.9) |

## Customising skills
Edit `backend/skills.json`. Each key is the skill name shown in the app; its list holds the spellings that count as that skill. Restart the backend afterwards.

## Limitations
Keyword and TF-IDF methods cannot understand meaning or depth of skill, miss synonyms that are not in the dictionary, treat "X or Y" requirements as two required skills, depend on resume wording and length, and cannot read scanned image PDFs (no OCR). Experience is stated or estimated from date ranges and may be wrong. Always check extracted data and decide as a person.


## Deploy frontend and backend together on Render

This repository includes `render.yaml` for a single-domain deployment. In Render, choose **New + → Blueprint** and connect this repository. Render will read the configuration and create one web service.

The build installs Python dependencies, builds the Vite frontend, and the FastAPI app serves the generated `frontend/dist` files. The frontend's `/api/*` requests are rewritten to the matching FastAPI endpoints on the same domain.

If deploying manually, use:
- Build command: `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build`
- Start command: `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Note: screening results are stored in memory and are cleared whenever the service restarts. This is a prototype suitable for demonstration, not persistent multi-user production use.
