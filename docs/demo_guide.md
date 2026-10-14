# Demonstration and screenshot guide

Start the backend (port 8000) and frontend (port 5173) as in the README. Use a browser window about 1440 px wide.

## Suggested demo (about 5 minutes)
1. **Project information**: explain the formula and limitations. *Screenshot 1.*
2. **New screening**: click "Demo: Python Developer", then "Detect requirements". Remove one skill and add one. *Screenshot 2.*
3. Tick "Include the fictional sample resumes". Drag a PDF and a DOCX sample into the drop zone. Try a `.exe` file to show the validation message. *Screenshot 3.*
4. Click **Run screening** (progress bar). Open **Dashboard**: totals, bar chart, skills coverage. *Screenshot 4.*
5. **Candidate results**: filter by skill "docker", sort by experience, search a name. *Screenshot 5.*
6. Open **Sam Walker**: show "Could not be determined" for experience and the note that it is left out of the score. Add skills and 3 years, save, and show the new score. *Screenshots 6 and 7.*
7. **Download CSV report** and open it in a spreadsheet. *Screenshot 8.*
8. Run again with the **Data Analyst** and **Machine Learning Intern** demo job descriptions to show the ranking change. Compare with `docs/expected_results.md`.

## Questions to prepare for
- Why TF-IDF and cosine similarity? Simple, fast, explainable, no training data needed.
- Why is the text score scaled? Cosine values between a short job description and a long resume are low, so 0.5 counts as a full match (`text_sim_cap` in `matching_engine.py`).
- Is the score a hiring prediction? No. It is a match score for human review.
- What are the weaknesses? See Limitations in the README.
