"""Regenerates docs/expected_results.md from the current engine (default weights 50/35/15)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from fastapi.testclient import TestClient  # noqa: E402
import app as m  # noqa: E402

client = TestClient(m.app)
out = ["# Expected results for the sample resumes", "",
       "Default settings: 50% text similarity, 35% required-skill match, 15% experience match. "
       "Scores are job-description match scores, not hiring probabilities. `n/a` means the component "
       "could not be determined and was left out of the weighted average (not counted as zero).", ""]
for jd in sorted((ROOT / "sample_resumes" / "demo_job_descriptions").glob("*.txt")):
    body = client.post("/screen", data={"job_description": jd.read_text(), "use_samples": "true"}).json()
    out += [f"## {jd.stem.replace('_', ' ').title()}", "",
            f"Required skills detected: {', '.join(body['jd']['required_skills'])}", "",
            "| Rank | Candidate | Score | Text | Skills | Experience | Years found |", "|---|---|---|---|---|---|---|"]
    f = lambda v: "n/a" if v is None else f"{v:.0f}"
    for i, c in enumerate(body["candidates"], 1):
        yrs = c["experience_years"]
        out.append(f"| {i} | {c['name']} | {c['final_score']:.1f} | {f(c['scores']['text'])} | {f(c['scores']['skills'])} | "
                   f"{f(c['scores']['experience'])} | {'not found' if yrs is None else f'{yrs:g} ({c['experience_source']})'} |")
    out.append("")
(ROOT / "docs" / "expected_results.md").write_text("\n".join(out), encoding="utf-8")
print("\n".join(out))
