"""Backend tests. Run from the project root:  pytest tests -v"""
import io
import sys
from pathlib import Path

import docx
import fitz
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import app as app_module  # noqa: E402
from matching_engine import (extract_education, extract_experience, find_skills, merge_config,  # noqa: E402
                             parse_job_description, score_candidate, text_similarities)
from resume_parser import ParseError, extract_text  # noqa: E402

SAMPLES = ROOT / "sample_resumes"
client = TestClient(app_module.app)
JD_PY = (SAMPLES / "demo_job_descriptions" / "python_developer.txt").read_text()
JD_DA = (SAMPLES / "demo_job_descriptions" / "data_analyst.txt").read_text()
JD_ML = (SAMPLES / "demo_job_descriptions" / "machine_learning_intern.txt").read_text()


def txt_file(name, text):
    return ("files", (name, text.encode(), "text/plain"))


@pytest.fixture(autouse=True)
def fresh_state():
    app_module.reset_state()


# ---------------------------------------------------------------- health / extraction
def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_extract_txt():
    assert "Python" in extract_text("a.txt", (SAMPLES / "priya_nair_python_developer.txt").read_bytes())


def test_extract_pdf():
    text = extract_text("k.pdf", (SAMPLES / "karthik_reddy_data_analyst.pdf").read_bytes())
    assert "Tableau" in text and "Karthik" in text


def test_extract_docx():
    text = extract_text("l.docx", (SAMPLES / "lena_fischer_data_scientist.docx").read_bytes())
    assert "scikit-learn" in text


def test_extract_pdf_generated_in_test():
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Jane Doe fictional resume with Python and SQL skills for testing")
    assert "Python" in extract_text("x.pdf", doc.tobytes())


def test_extract_docx_generated_in_test():
    d = docx.Document()
    d.add_paragraph("Fictional person with Python, SQL and Docker experience for testing")
    buf = io.BytesIO()
    d.save(buf)
    assert "Docker" in extract_text("x.docx", buf.getvalue())


@pytest.mark.parametrize("name,data", [
    ("bad.pdf", b"this is not a pdf at all, just text pretending"),
    ("bad.docx", b"this is not a zip archive either, sorry about that"),
    ("empty.txt", b""),
    ("notes.exe", b"MZ\x90\x00"),
    ("tiny.txt", b"hi"),
])
def test_invalid_files_raise(name, data):
    with pytest.raises(ParseError):
        extract_text(name, data)


def test_oversized_file_rejected():
    with pytest.raises(ParseError):
        extract_text("big.txt", b"a" * (5 * 1024 * 1024 + 1))


# ---------------------------------------------------------------- matching pieces
def test_skill_matching_boundaries():
    assert "java" in find_skills("Experienced in Java development")
    assert "java" not in find_skills("Experienced in JavaScript only")
    assert "c++" in find_skills("Systems work in C++.")
    assert "scikit-learn" in find_skills("used sklearn daily")


def test_parse_job_description():
    jd = parse_job_description(JD_PY)
    assert {"python", "sql", "docker", "git"} <= set(jd["required_skills"])
    assert set(jd["preferred_skills"]) == {"aws", "ci/cd"}
    assert jd["min_experience_years"] == 3 and jd["education"] == "Bachelor's"


def test_education_and_experience_extraction():
    assert extract_education("M.Tech in AI\nB.Tech in CS")["level"] == "Master's"
    assert extract_education("Studied cooking") is None
    assert extract_experience("I have 6 years of professional experience") == (6.0, "stated")
    years, source = extract_experience("Experience\nDev, Acme  Jan 2020 - Jan 2022\nEducation\nB.Tech 2015 - 2019")
    assert source == "estimated" and years == 2.0
    assert extract_experience("No dates or claims here") == (None, None)


def test_text_similarity_orders_relevant_first():
    docs = [(SAMPLES / f).read_text() for f in ("priya_nair_python_developer.txt", "sam_walker_fresher_generalist.txt")]
    sims = text_similarities(JD_PY, docs)
    assert sims[0] > sims[1] > 0


def test_score_formula_and_missing_experience_not_zero():
    jd = {"required_skills": ["python", "sql"], "preferred_skills": [], "min_experience_years": 4}
    cfg = merge_config(None)
    known = score_candidate({"skills": ["python", "sql"], "experience_years": 4}, jd, 0.5, cfg)
    assert known["final_score"] == 100.0
    unknown = score_candidate({"skills": ["python", "sql"], "experience_years": None}, jd, 0.5, cfg)
    assert unknown["scores"]["experience"] is None and "experience" in unknown["unavailable"]
    assert unknown["final_score"] == 100.0  # weights renormalised, not penalised
    half = score_candidate({"skills": ["python"], "experience_years": 2}, jd, 0.25, cfg)
    # 0.5*50 + 0.35*50 + 0.15*50 = 50
    assert half["final_score"] == 50.0


def test_custom_weights():
    cfg = merge_config({"weights": {"text": 0, "skills": 100, "experience": 0}})
    jd = {"required_skills": ["python", "sql"], "preferred_skills": [], "min_experience_years": None}
    assert score_candidate({"skills": ["python"], "experience_years": None}, jd, 0.9, cfg)["final_score"] == 50.0


# ---------------------------------------------------------------- API
def test_empty_job_description_rejected():
    r = client.post("/screen", data={"job_description": "   "}, files=[txt_file("a.txt", "x" * 50)])
    assert r.status_code == 400 and "empty" in r.json()["detail"].lower()


def test_no_files_rejected():
    assert client.post("/screen", data={"job_description": JD_PY}).status_code == 400


def test_single_upload():
    r = client.post("/screen", data={"job_description": JD_PY},
                    files=[txt_file("one.txt", (SAMPLES / "priya_nair_python_developer.txt").read_text())])
    body = r.json()
    assert r.status_code == 200 and body["stats"]["processed"] == 1
    assert body["candidates"][0]["final_score"] > 60


def test_sample_ranking_python_developer():
    body = client.post("/screen", data={"job_description": JD_PY, "use_samples": "true"}).json()
    names = [c["name"] for c in body["candidates"]]
    assert names[0] == "Priya Nair" and names[-1] == "Sam Walker"
    scores = [c["final_score"] for c in body["candidates"]]
    assert scores == sorted(scores, reverse=True)
    assert body["stats"]["processed"] == 8 and body["failed"] == []


def test_ranking_changes_with_job_description():
    top = lambda jd: client.post("/screen", data={"job_description": jd, "use_samples": "true"}).json()["candidates"][0]["name"]
    assert top(JD_PY) == "Priya Nair"
    assert top(JD_DA) == "Rahul Menon"
    assert top(JD_ML) == "Ananya Rao"


def test_mixed_upload_with_bad_files():
    files = [txt_file("good.txt", (SAMPLES / "rahul_menon_data_analyst.txt").read_text()),
             ("files", ("broken.pdf", b"garbage garbage garbage garbage", "application/pdf")),
             ("files", ("virus.exe", b"MZ....", "application/octet-stream")),
             ("files", ("karthik.pdf", (SAMPLES / "karthik_reddy_data_analyst.pdf").read_bytes(), "application/pdf"))]
    body = client.post("/screen", data={"job_description": JD_DA}, files=files).json()
    assert body["stats"]["processed"] == 2 and len(body["failed"]) == 2 and body["total_uploaded"] == 4


def test_results_and_candidate_endpoints():
    assert client.get("/results").json()["has_results"] is False
    assert client.get("/candidate/C-001").status_code == 404
    client.post("/screen", data={"job_description": JD_PY, "use_samples": "true"})
    assert client.get("/results").json()["has_results"] is True
    cid = client.get("/results").json()["candidates"][0]["id"]
    detail = client.get(f"/candidate/{cid}").json()
    assert detail["rank"] == 1 and "text" in detail


def test_manual_correction_recomputes_score():
    body = client.post("/screen", data={"job_description": JD_PY, "use_samples": "true"}).json()
    sam = next(c for c in body["candidates"] if c["name"] == "Sam Walker")
    r = client.patch(f"/candidate/{sam['id']}", json={"skills": ["python", "sql", "git", "docker", "fastapi", "rest api", "unit testing", "flask"],
                                                       "experience_years": 3})
    assert r.json()["final_score"] > sam["final_score"] + 30
    assert r.json()["corrected"] is True and r.json()["extraction"]["skills"] == "manual"


def test_anonymize():
    body = client.post("/screen", data={"job_description": JD_PY, "use_samples": "true", "anonymize": "true"}).json()
    assert all(c["name"].startswith("Candidate C-") for c in body["candidates"])


def test_csv_export():
    assert client.get("/export/csv").status_code == 404
    client.post("/screen", data={"job_description": JD_PY, "use_samples": "true"})
    r = client.get("/export/csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.splitlines()
    assert lines[0].startswith("Rank,Candidate ID,Name") and "Priya Nair" in lines[1]
    assert "decision-support" in r.text


def test_csv_formula_injection_is_neutralised():
    evil = "=HYPERLINK(\"http://x\")\nPython developer with SQL and Docker experience, testing only."
    client.post("/screen", data={"job_description": JD_PY, "anonymize": "false"}, files=[txt_file("e.txt", evil)])
    assert "\n=HYPERLINK" not in client.get("/export/csv").text
