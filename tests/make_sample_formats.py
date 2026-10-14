"""Creates the PDF and DOCX sample resumes (fictional) used for demos and tests.
Run once:  python tests/make_sample_formats.py
"""
from pathlib import Path

import docx
import fitz

OUT = Path(__file__).resolve().parent.parent / "sample_resumes"

KARTHIK = """Karthik Reddy
FICTIONAL SAMPLE RESUME - not a real person

Summary
Data analyst with 2 years of experience in reporting and ETL.

Experience
Business Data Analyst, Demo Logistics Pvt (fictional)  Aug 2023 - Present
- Built Tableau dashboards and wrote SQL for shipment analytics.
- Cleaned datasets with Python and pandas; built simple ETL data pipelines.
- Used Excel and data visualization for monthly stakeholder reviews.

Education
B.Tech in Information Technology, Example Engineering College, 2023

Skills
SQL, Tableau, Excel, Python, pandas, ETL, data analysis, data visualization
"""

LENA = """Lena Fischer
FICTIONAL SAMPLE RESUME - not a real person

Summary
Data scientist with 4 years of experience in statistical modelling and machine learning.

Experience
Data Scientist, Example Health Analytics (fictional)  Jan 2022 - Present
- Built machine learning models with Python, scikit-learn and pandas.
- Applied statistics and hypothesis testing; presented findings with matplotlib and Power BI.
- Wrote SQL for feature engineering and managed code in Git.

Education
M.Sc. in Statistics, Sample University, 2021

Skills
Python, R programming, machine learning, statistics, scikit-learn, pandas, SQL, Git, power bi
"""


def make_pdf(path: Path, text: str):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(50, 50, 545, 790), text, fontsize=10, fontname="helv")
    doc.save(path)


def make_docx(path: Path, text: str):
    d = docx.Document()
    for line in text.splitlines():
        d.add_paragraph(line)
    d.save(path)


if __name__ == "__main__":
    make_pdf(OUT / "karthik_reddy_data_analyst.pdf", KARTHIK)
    make_docx(OUT / "lena_fischer_data_scientist.docx", LENA)
    print("Created PDF and DOCX samples in", OUT)
