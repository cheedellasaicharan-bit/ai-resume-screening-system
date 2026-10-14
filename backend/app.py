"""FastAPI backend for the AI Resume Screening System.

Run from the backend folder:  uvicorn app:app --reload --port 8000
Results are kept in memory (one screening session at a time) to keep the code simple.
"""
import io
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from matching_engine import (extract_resume_info, merge_config, parse_job_description,
                             score_candidate, text_similarities)
from resume_parser import ParseError, extract_name, extract_text

ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT / "sample_resumes"
JD_DIR = SAMPLES_DIR / "demo_job_descriptions"
MAX_FILES = 50

app = FastAPI(title="AI Resume Screening System", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# In production the frontend and API share one domain. The frontend calls /api/*;
# strip that prefix so existing FastAPI routes continue to work unchanged.
@app.middleware("http")
async def same_domain_api_prefix(request, call_next):
    if request.scope["path"].startswith("/api/"):
        request.scope["path"] = request.scope["path"][4:]
    elif request.scope["path"] == "/api":
        request.scope["path"] = "/"
    return await call_next(request)


STATE = {"jd_text": "", "jd": None, "config": None, "candidates": {}, "failed": [],
         "total_uploaded": 0, "screened_at": None}


def reset_state():
    STATE.update({"jd_text": "", "jd": None, "config": None, "candidates": {}, "failed": [],
                  "total_uploaded": 0, "screened_at": None})


# ----------------------------------------------------------------------------- helpers
def _public(c: dict, with_text: bool = False) -> dict:
    out = {k: v for k, v in c.items() if k not in ("text", "text_sim_raw", "info")}
    out["skills"] = c["info"]["skills"]
    out["education"] = c["info"]["education"]
    out["experience_years"] = c["info"]["experience_years"]
    out["experience_source"] = c["info"]["experience_source"]
    out["extraction"] = c["info"]["extraction"]
    if with_text:
        out["text"] = c["text"]
    return out


def _rescore(c: dict):
    c.update(score_candidate(c["info"], STATE["jd"], c["text_sim_raw"], STATE["config"]))


def _ranked() -> list:
    return sorted(STATE["candidates"].values(), key=lambda c: c["final_score"], reverse=True)


def _stats(ranked: list) -> dict:
    jd, cfg = STATE["jd"], STATE["config"]
    scores = [c["final_score"] for c in ranked]
    coverage = []
    for skill in jd["required_skills"] + jd["preferred_skills"]:
        count = sum(1 for c in ranked if skill in c["info"]["skills"])
        coverage.append({"skill": skill, "count": count, "required": skill in jd["required_skills"]})
    return {"processed": len(ranked),
            "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "above_threshold": sum(1 for s in scores if s >= cfg["threshold"]),
            "skill_coverage": coverage}


def _safe_csv(value):
    """Prevent spreadsheet formula injection from resume-derived text."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
        return "'" + value
    return value


# ----------------------------------------------------------------------------- endpoints
@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat(timespec="seconds")}


@app.post("/parse-jd")
def parse_jd(job_description: str = Form("")):
    if not job_description.strip():
        raise HTTPException(400, "Job description is empty. Paste or type a job description first.")
    return parse_job_description(job_description)


@app.get("/samples")
def samples():
    resumes = sorted(p.name for p in SAMPLES_DIR.iterdir() if p.suffix.lower() in (".txt", ".pdf", ".docx"))
    jds = [{"id": p.stem, "title": p.stem.replace("_", " ").title(), "text": p.read_text(encoding="utf-8")}
           for p in sorted(JD_DIR.glob("*.txt"))]
    return {"resumes": resumes, "job_descriptions": jds}


@app.post("/screen")
async def screen(
    job_description: str = Form(""),
    files: Optional[List[UploadFile]] = File(None),
    use_samples: bool = Form(False),
    anonymize: bool = Form(False),
    config: str = Form(""),
    jd_overrides: str = Form(""),
):
    if not job_description.strip():
        raise HTTPException(400, "Job description is empty. Paste or type a job description first.")
    try:
        user_cfg = json.loads(config) if config else None
        overrides = json.loads(jd_overrides) if jd_overrides else None
    except json.JSONDecodeError:
        raise HTTPException(400, "Settings could not be read (invalid JSON).")

    inputs = []  # (filename, bytes)
    for f in files or []:
        inputs.append((f.filename or "unnamed", await f.read()))
    if use_samples:
        inputs += [(p.name, p.read_bytes()) for p in sorted(SAMPLES_DIR.iterdir())
                   if p.suffix.lower() in (".txt", ".pdf", ".docx")]
    if not inputs:
        raise HTTPException(400, "No resumes provided. Upload at least one PDF, DOCX or TXT file.")
    if len(inputs) > MAX_FILES:
        raise HTTPException(400, f"Too many files ({len(inputs)}). The limit is {MAX_FILES} per screening.")

    cfg = merge_config(user_cfg)
    jd = parse_job_description(job_description)
    if overrides:
        for key in ("required_skills", "preferred_skills", "education", "min_experience_years"):
            if key in overrides:
                jd[key] = overrides[key]
    warnings = []
    if not jd["required_skills"]:
        warnings.append("No required skills were detected in the job description; only text similarity "
                        "and experience (if stated) contribute to the score.")

    parsed, failed = [], []
    for filename, data in inputs:
        try:
            parsed.append((filename, extract_text(filename, data)))
        except ParseError as exc:
            failed.append({"filename": filename, "error": str(exc)})
        except Exception as exc:  # unexpected parser failure should not stop the batch
            failed.append({"filename": filename, "error": f"Unexpected error: {exc}"})

    reset_state()
    sims = text_similarities(job_description, [t for _, t in parsed])
    for i, ((filename, text), sim) in enumerate(zip(parsed, sims), start=1):
        cid = f"C-{i:03d}"
        name = None if anonymize else extract_name(text)
        cand = {"id": cid, "name": name or f"Candidate {cid}", "filename": filename, "corrected": False,
                "text": text, "text_sim_raw": sim, "info": extract_resume_info(text)}
        STATE["candidates"][cid] = cand
    STATE.update({"jd_text": job_description, "jd": jd, "config": cfg, "failed": failed,
                  "total_uploaded": len(inputs), "screened_at": datetime.now().isoformat(timespec="seconds")})
    for c in STATE["candidates"].values():
        _rescore(c)
    result = results()
    result["warnings"] = warnings
    return result


@app.get("/results")
def results():
    if not STATE["jd"]:
        return {"has_results": False, "candidates": [], "failed": [], "total_uploaded": 0, "stats": None}
    ranked = _ranked()
    return {"has_results": True, "screened_at": STATE["screened_at"], "jd": STATE["jd"],
            "config": STATE["config"], "candidates": [_public(c) for c in ranked],
            "failed": STATE["failed"], "total_uploaded": STATE["total_uploaded"], "stats": _stats(ranked)}


@app.get("/candidate/{candidate_id}")
def candidate(candidate_id: str):
    c = STATE["candidates"].get(candidate_id)
    if not c:
        raise HTTPException(404, f"Candidate '{candidate_id}' was not found. Run a screening first.")
    rank = [x["id"] for x in _ranked()].index(candidate_id) + 1
    return {**_public(c, with_text=True), "rank": rank, "total": len(STATE["candidates"]), "jd": STATE["jd"]}


class Correction(BaseModel):
    name: Optional[str] = None
    skills: Optional[List[str]] = None
    education: Optional[str] = None
    experience_years: Optional[float] = None
    clear_experience: bool = False


@app.patch("/candidate/{candidate_id}")
def correct_candidate(candidate_id: str, body: Correction):
    """Human review: correct extracted data; the score is recomputed from the corrected values."""
    c = STATE["candidates"].get(candidate_id)
    if not c:
        raise HTTPException(404, f"Candidate '{candidate_id}' was not found.")
    info = c["info"]
    if body.name is not None and body.name.strip():
        c["name"] = body.name.strip()[:60]
    if body.skills is not None:
        info["skills"] = sorted({s.strip().lower() for s in body.skills if s.strip()})
        info["extraction"]["skills"] = "manual"
    if body.education is not None:
        text = body.education.strip()
        info["education"] = {"level": "Manual entry", "detail": text[:140]} if text else None
        info["extraction"]["education"] = "manual" if text else "not_found"
    if body.clear_experience:
        info["experience_years"], info["experience_source"] = None, None
        info["extraction"]["experience"] = "not_found"
    elif body.experience_years is not None:
        if not 0 <= body.experience_years <= 60:
            raise HTTPException(400, "Experience must be between 0 and 60 years.")
        info["experience_years"], info["experience_source"] = body.experience_years, "manual"
        info["extraction"]["experience"] = "manual"
    c["corrected"] = True
    _rescore(c)
    return candidate(candidate_id)


@app.get("/export/csv")
def export_csv():
    if not STATE["jd"]:
        raise HTTPException(404, "Nothing to export yet. Run a screening first.")
    rows = []
    for rank, c in enumerate(_ranked(), start=1):
        rows.append({
            "Rank": rank, "Candidate ID": c["id"], "Name": _safe_csv(c["name"]), "File": _safe_csv(c["filename"]),
            "Match Score": c["final_score"], "Text Similarity": c["scores"]["text"],
            "Required Skill Match": c["scores"]["skills"], "Experience Match": c["scores"]["experience"],
            "Matched Required Skills": "; ".join(c["matched_required"]),
            "Missing Required Skills": "; ".join(c["missing_required"]),
            "Education": _safe_csv(c["info"]["education"]["detail"]) if c["info"]["education"] else "Not determined",
            "Experience (years)": c["info"]["experience_years"] if c["info"]["experience_years"] is not None else "Not determined",
            "Explanation": c["explanation"], "Manually corrected": "yes" if c["corrected"] else "no",
        })
    buf = io.StringIO()
    pd.DataFrame(rows).to_csv(buf, index=False)
    buf.write("\n# Job-description match scores are decision-support only. They are not hiring probabilities.\n")
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=screening_results.csv"})


# Serve the built React application from this same Render web service.
FRONTEND_DIST = ROOT / "frontend" / "dist"

@app.get("/{full_path:path}", include_in_schema=False)
def frontend_app(full_path: str):
    # API paths should not silently return the frontend HTML.
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    requested = (FRONTEND_DIST / full_path).resolve()
    if FRONTEND_DIST.exists() and requested.is_file() and FRONTEND_DIST.resolve() in requested.parents:
        return FileResponse(requested)
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=503, detail="Frontend build not found. Check the deployment build command.")
