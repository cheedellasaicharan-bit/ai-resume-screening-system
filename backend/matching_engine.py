"""Matching engine: text cleaning, skill/education/experience extraction,
TF-IDF + cosine similarity, and the configurable job-description match score.

Everything here is deterministic and keyword based. It is decision-support only.
"""
import json
import re
from datetime import date
from functools import lru_cache
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SKILLS_FILE = Path(__file__).parent / "skills.json"

DEFAULT_CONFIG = {
    # Relative weights (need not add to 100; they are re-normalised).
    "weights": {"text": 50, "skills": 35, "experience": 15},
    # Informational threshold used for the "meeting threshold" dashboard count.
    "threshold": 60,
    # Raw cosine similarity at which the text score reaches 100.
    # Resume-vs-JD cosine values are naturally low (0.2-0.5 is already a strong match).
    "text_sim_cap": 0.5,
}

EDU_LEVELS = [  # (rank, label, regex) highest first
    (4, "Doctorate", r"\bph\.?\s?d\b|\bdoctorate\b|\bdoctoral\b"),
    (3, "Master's", r"\bmaster(?:'s|s)?\b|\bm\.?\s?tech\b|\bm\.?\s?sc\b|\bmba\b|\bmca\b|\bm\.s\.?(?=\s+in\b)"),
    (2, "Bachelor's", r"\bbachelor(?:'s|s)?\b|\bb\.?\s?tech\b|\bb\.\s?e\b|\bb\.?\s?sc\b|\bbca\b|\bb\.s\.?(?=\s+in\b)|\bundergraduate degree\b"),
    (1, "Diploma", r"\bdiploma\b|\bassociate degree\b"),
]
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


# --------------------------------------------------------------------------- skills
@lru_cache(maxsize=1)
def load_skills() -> dict:
    with open(SKILLS_FILE, encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=None)
def _alias_regex(alias: str):
    return re.compile(r"(?<![A-Za-z0-9+#.])" + re.escape(alias) + r"(?![A-Za-z0-9+#])", re.IGNORECASE)


def find_skills(text: str) -> list:
    """Return canonical skill names whose name or alias appears in the text."""
    found = []
    for canonical, aliases in load_skills().items():
        if any(_alias_regex(a).search(text) for a in aliases):
            found.append(canonical)
    return found


# --------------------------------------------------------------------------- text cleaning
def clean_text(text: str) -> str:
    """Lower-case, drop emails/URLs/phones and map skill aliases to one canonical token."""
    text = re.sub(r"\S+@\S+|https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"\+?\d[\d\s\-()]{7,}\d", " ", text)
    for canonical, aliases in load_skills().items():
        token = " skill_" + re.sub(r"\W+", "_", canonical).strip("_") + " "
        for alias in sorted(aliases, key=len, reverse=True):
            text = _alias_regex(alias).sub(token, text)
    text = text.lower()
    text = re.sub(r"[^a-z0-9_\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# --------------------------------------------------------------------------- education
def extract_education(text: str):
    """Highest education level mentioned, plus the line it came from. None if not found."""
    for rank, label, pattern in EDU_LEVELS:
        regex = re.compile(pattern, re.IGNORECASE)
        for line in text.splitlines():
            if regex.search(line):
                return {"level": label, "rank": rank, "detail": line.strip()[:140]}
    return None


# --------------------------------------------------------------------------- experience
_STATED_EXP = re.compile(
    r"(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:[\w/&-]+\s+){0,3}?experience", re.IGNORECASE)
_RANGE = re.compile(
    r"(?:(?P<m1>[A-Za-z]{3,9})\.?\s+)?(?P<y1>(?:19|20)\d{2})\s*(?:-|–|—|to)\s*"
    r"(?:(?P<m2>[A-Za-z]{3,9})\.?\s+)?(?P<y2>(?:19|20)\d{2}|present|current|now)", re.IGNORECASE)


def _month_index(year: int, month_name, default: int) -> int:
    month = MONTHS.get((month_name or "")[:3].lower(), default)
    return year * 12 + month


def _experience_section(text: str) -> str:
    lines, capture, out = text.splitlines(), False, []
    for line in lines:
        head = line.strip().strip(":").lower()
        if re.fullmatch(r"(work |professional |relevant )?(experience|employment( history)?|work history|internships?)", head):
            capture = True
            continue
        if capture and re.fullmatch(r"(education|skills|technical skills|projects|certifications|summary|achievements|academic projects)", head):
            capture = False
        if capture:
            out.append(line)
    return "\n".join(out)


def extract_experience(text: str):
    """Return (years, source). source is 'stated', 'estimated' or None if undeterminable."""
    stated = [float(m.group(1)) for m in _STATED_EXP.finditer(text)]
    if stated:
        return max(stated), "stated"
    section = _experience_section(text)
    spans = []
    for m in _RANGE.finditer(section):
        y1 = int(m.group("y1"))
        if m.group("y2").isalpha():
            today = date.today()
            end = today.year * 12 + today.month
        else:
            end = _month_index(int(m.group("y2")), m.group("m2"), 6)
        start = _month_index(y1, m.group("m1"), 6)
        if end >= start:
            spans.append((start, end))
    if not spans:
        return None, None
    spans.sort()
    merged = [list(spans[0])]
    for s, e in spans[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    months = sum(e - s for s, e in merged)
    return round(months / 12, 1), "estimated"


# --------------------------------------------------------------------------- job description
def parse_job_description(text: str) -> dict:
    """Detect required skills, preferred skills, education and minimum experience."""
    required, preferred = [], []
    section = "required"
    for line in text.splitlines():
        low = line.strip().lower().strip(":")
        if re.match(r"^(preferred|nice[- ]to[- ]have|good to have|bonus|plus)", low):
            section = "preferred"
        elif re.match(r"^(required|requirements|must[- ]have|qualifications|responsibilities|key skills|skills)", low):
            section = "required"
        inline_pref = bool(re.search(r"\b(preferred|nice to have|bonus|a plus)\b", low))
        for skill in find_skills(line):
            target = preferred if (section == "preferred" or inline_pref) else required
            if skill not in target:
                target.append(skill)
    preferred = [s for s in preferred if s not in required]

    years = []
    for sentence in re.split(r"[.\n;]", text):
        if "experience" in sentence.lower():
            years += [int(m.group(1)) for m in re.finditer(r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)", sentence, re.I)]
    min_years = min(years) if years else None
    edu = extract_education(text)
    return {
        "required_skills": required,
        "preferred_skills": preferred,
        "education": edu["level"] if edu else None,
        "min_experience_years": min_years if min_years else None,  # 0 means no requirement
    }


# --------------------------------------------------------------------------- resume extraction
def extract_resume_info(text: str) -> dict:
    skills = find_skills(text)
    education = extract_education(text)
    years, source = extract_experience(text)
    return {
        "skills": skills,
        "education": ({"level": education["level"], "detail": education["detail"]} if education else None),
        "experience_years": years,
        "experience_source": source,
        "extraction": {
            "skills": "found" if skills else "not_found",
            "education": "found" if education else "not_found",
            "experience": source or "not_found",
        },
    }


# --------------------------------------------------------------------------- similarity
def text_similarities(jd_text: str, resume_texts: list) -> list:
    """TF-IDF vectors for the JD and all resumes, then cosine similarity (0-1) of each resume to the JD."""
    if not resume_texts:
        return []
    docs = [clean_text(jd_text)] + [clean_text(t) for t in resume_texts]
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    try:
        matrix = vectorizer.fit_transform(docs)
    except ValueError:  # empty vocabulary
        return [0.0] * len(resume_texts)
    return [float(x) for x in cosine_similarity(matrix[0], matrix[1:])[0]]


# --------------------------------------------------------------------------- scoring
def merge_config(user_config) -> dict:
    cfg = {"weights": dict(DEFAULT_CONFIG["weights"]), "threshold": DEFAULT_CONFIG["threshold"],
           "text_sim_cap": DEFAULT_CONFIG["text_sim_cap"]}
    if user_config:
        for key in ("text", "skills", "experience"):
            value = user_config.get("weights", {}).get(key)
            if isinstance(value, (int, float)) and value >= 0:
                cfg["weights"][key] = float(value)
        if isinstance(user_config.get("threshold"), (int, float)):
            cfg["threshold"] = float(user_config["threshold"])
    return cfg


def score_candidate(info: dict, jd: dict, text_sim_raw: float, config: dict) -> dict:
    """Compute component scores (0-100), the weighted final score and a plain-language explanation."""
    text_score = min(100.0, text_sim_raw / config["text_sim_cap"] * 100)
    required = jd["required_skills"]
    have = set(info["skills"])
    matched_req = [s for s in required if s in have]
    missing_req = [s for s in required if s not in have]
    matched_pref = [s for s in jd["preferred_skills"] if s in have]

    unavailable = {}
    skill_score = 100.0 * len(matched_req) / len(required) if required else None
    if skill_score is None:
        unavailable["skills"] = "No required skills were detected in the job description."

    exp_score = None
    need, got = jd.get("min_experience_years"), info.get("experience_years")
    if not need:
        unavailable["experience"] = "The job description does not state a minimum experience."
    elif got is None:
        unavailable["experience"] = "Candidate experience could not be determined from the resume."
    else:
        exp_score = min(100.0, 100.0 * got / need)

    components = {"text": text_score, "skills": skill_score, "experience": exp_score}
    weights = config["weights"]
    used = {k: v for k, v in components.items() if v is not None and weights[k] > 0}
    total_w = sum(weights[k] for k in used)
    final = sum(components[k] * weights[k] for k in used) / total_w if total_w else text_score

    parts = [f"Text similarity {text_score:.0f}/100"]
    if required:
        parts.append(f"matches {len(matched_req)} of {len(required)} required skills")
    if exp_score is not None:
        parts.append(f"{got:g} yrs experience vs {need} requested")
    elif "experience" in unavailable and need:
        parts.append("experience not determined (left out of score)")
    explanation = "; ".join(parts) + "."
    if missing_req:
        explanation += " Missing: " + ", ".join(missing_req[:5]) + ("…" if len(missing_req) > 5 else "") + "."

    return {
        "final_score": round(final, 1),
        "scores": {k: (round(v, 1) if v is not None else None) for k, v in components.items()},
        "components_used": sorted(used),
        "unavailable": unavailable,
        "matched_required": matched_req,
        "missing_required": missing_req,
        "matched_preferred": matched_pref,
        "explanation": explanation,
    }
