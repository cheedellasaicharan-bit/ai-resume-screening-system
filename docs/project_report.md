# AI Resume Screening System: Project Report

## Abstract
Recruiters receive more resumes than they can read closely. This project is a local web application that extracts text from PDF, DOCX and TXT resumes, compares each one with a job description, and ranks candidates with an explainable job-description match score. It uses TF-IDF vectors and cosine similarity for text relevance, a configurable skills dictionary for required-skill matching, and simple rules for education and experience. The output supports human review; it does not decide who is hired.

## Objectives
1. Process many resumes at once. 2. Rank them against one job description. 3. Explain every score. 4. Let people correct extraction errors. 5. Avoid protected attributes and automatic rejection. 6. Run locally with free tools.

## Methodology
1. **Text extraction.** PyMuPDF (PDF), python-docx (DOCX), plain reading (TXT). Files are checked for type, size, signature and readable text.
2. **Cleaning and normalisation.** Remove emails, URLs and phone numbers; map skill aliases to one token (for example "sklearn" and "scikit learn" both become scikit-learn); lower-case; remove punctuation.
3. **Text similarity.** TfidfVectorizer (unigrams and bigrams, English stop words, sublinear term frequency) is fitted on the job description plus all resumes. The cosine similarity of each resume to the job description is scaled so that 0.5 equals 100.
4. **Skill extraction.** Dictionary terms matched with word boundaries, so "Java" does not match "JavaScript". Missing required skills are listed.
5. **Education and experience.** Highest education keyword found. Experience comes from phrases such as "5 years of experience"; otherwise it is estimated by merging date ranges in the Experience section; otherwise it is "not determined".
6. **Scoring.** Final = (w_text x Text + w_skills x Skills + w_exp x Experience) / sum of the weights of available components. Default weights 50/35/15. Unavailable components are reported and left out, never treated as zero.
7. **Human review.** Reviewers correct skills, education and experience and the score recalculates.

## Architecture
```
Browser (React, TypeScript, Tailwind, Recharts)
   | HTTP /api/*  (Vite proxy in development)
FastAPI (backend/app.py)
   |-- resume_parser.py   validation, PDF/DOCX/TXT extraction, name guess
   |-- matching_engine.py cleaning, skills, education, experience, TF-IDF, scoring
   |-- skills.json        editable skills dictionary
   `-- in-memory session store -> JSON results, CSV export (pandas)
```

## Responsible AI
Scores are labelled job-description match scores. Protected characteristics are neither inferred nor used, and names can be hidden. The threshold only orders the review queue. Scoring components are explained in the interface and all extracted data can be corrected.

## Limitations
Keyword methods miss synonyms and cannot judge skill depth; "X or Y" requirements count as two skills; experience may be missing or estimated; scanned PDFs need OCR; layout and length affect TF-IDF. Results on fictional samples show behaviour, not real-world accuracy.

## Conclusion
A small, explainable pipeline built from standard open-source tools can organise a large resume pool and cut first-pass reading time when people review its output. Future work: embedding-based synonym matching, OCR, "X or Y" requirement groups, and a bias audit on real, consented data.
