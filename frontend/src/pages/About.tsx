import { DISCLAIMER, PageHeader } from "../components/ui";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card"><h2 className="mb-2 font-semibold text-slate-900">{title}</h2><div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div></section>
);

export default function About() {
  return (
    <>
      <PageHeader title="Project information" subtitle="AI/ML college project: resume screening with TF-IDF, cosine similarity and skill matching." />
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <Section title="Abstract">
          <p>Recruiters often receive far more resumes than they can read closely. This system reads resumes in PDF, DOCX and TXT format, compares each one with a job description, and ranks candidates by a transparent match score so that a human reviewer knows where to start.</p>
        </Section>
        <Section title="How the score works">
          <p><b>Final score = 50% text similarity + 35% required-skill match + 15% experience match</b> (weights are adjustable).</p>
          <ul className="list-disc pl-5">
            <li><b>Text similarity:</b> TF-IDF vectors and cosine similarity between the job description and the resume, scaled to 0–100.</li>
            <li><b>Required-skill match:</b> share of the job description’s required skills found in the resume.</li>
            <li><b>Experience match:</b> candidate years divided by requested years, capped at 100. If either number is unknown, this part is left out and the other weights are re-balanced.</li>
          </ul>
        </Section>
        <Section title="Architecture">
          <p>React + TypeScript + Tailwind front end → REST calls → FastAPI back end → <code>resume_parser.py</code> (PyMuPDF, python-docx) → <code>matching_engine.py</code> (scikit-learn, pandas) → ranked JSON and CSV.</p>
        </Section>
        <Section title="Responsible use">
          <ul className="list-disc pl-5">
            <li>Scores are decision support. They never accept or reject anyone.</li>
            <li>The system does not infer or use protected characteristics such as gender, age, religion or ethnicity. Names can be hidden.</li>
            <li>Every extracted field can be reviewed and corrected, and the score updates.</li>
          </ul>
        </Section>
        <Section title="Limitations">
          <ul className="list-disc pl-5">
            <li>Keyword matching misses synonyms that are not in the skills dictionary and cannot judge depth of skill.</li>
            <li>“X or Y” requirements are treated as two required skills. Remove one in the requirements editor if either is acceptable.</li>
            <li>Experience is read from stated phrases or estimated from date ranges, and can be wrong or missing.</li>
            <li>Scanned image PDFs have no text layer and cannot be read (no OCR).</li>
            <li>Resume layout and length influence TF-IDF similarity.</li>
          </ul>
        </Section>
        <Section title="Conclusion">
          <p>A simple, explainable pipeline can organise a large resume pool and save reading time, provided its output is checked by people. Future work: synonym handling with embeddings, OCR, and fairness audits on real data.</p>
          <p className="text-xs text-slate-500">{DISCLAIMER}</p>
        </Section>
      </div>
    </>
  );
}
