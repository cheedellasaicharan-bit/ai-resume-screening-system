import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useStore } from "../store";
import { Chip, DISCLAIMER, ErrorBox, PageHeader, ScoreBadge, Spinner } from "../components/ui";
import type { Candidate } from "../types";

function Status({ value }: { value: string }) {
  if (value === "not_found") return <Chip tone="gray">Could not be determined</Chip>;
  if (value === "estimated") return <Chip tone="blue">Estimated from dates</Chip>;
  if (value === "manual") return <Chip tone="green">Corrected by reviewer</Chip>;
  return <Chip tone="blue">Extracted</Chip>;
}

function Bar({ label, value, weight, reason }: { label: string; value: number | null; weight: number; reason?: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm"><span>{label} <span className="text-xs text-slate-400">(weight {weight}%)</span></span>
        <span className="font-semibold">{value === null ? "Not available" : `${value.toFixed(0)}/100`}</span></div>
      <div className="mt-1 h-2 rounded bg-slate-100">{value !== null && <div className="h-2 rounded bg-blue-700" style={{ width: `${value}%` }} />}</div>
      {value === null && reason && <p className="mt-1 text-xs text-slate-500">{reason} Left out of the score instead of counting as zero.</p>}
    </div>
  );
}

export default function CandidateDetail() {
  const { id = "" } = useParams();
  const { refresh, results } = useStore();
  const [c, setC] = useState<Candidate | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState("");
  const [edu, setEdu] = useState("");
  const [years, setYears] = useState("");
  const [name, setName] = useState("");
  const [showText, setShowText] = useState(false);

  const load = (cand: Candidate) => {
    setC(cand); setSkills(cand.skills.join(", ")); setEdu(cand.education?.detail ?? "");
    setYears(cand.experience_years === null ? "" : String(cand.experience_years)); setName(cand.name);
  };
  useEffect(() => { setC(null); api.candidate(id).then(load).catch((e) => setError(e.message)); }, [id]);

  const save = async () => {
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = { name, skills: skills.split(",").map((s) => s.trim()).filter(Boolean), education: edu };
      if (years.trim() === "") body.clear_experience = true;
      else if (isNaN(Number(years))) { setError("Experience must be a number of years."); setSaving(false); return; }
      else body.experience_years = Number(years);
      load(await api.correct(id, body));
      await refresh();
    } catch (e) { setError((e as Error).message); }
    setSaving(false);
  };

  if (error && !c) return <><PageHeader title="Candidate details" /><ErrorBox message={error} /><Link to="/results" className="btn-secondary mt-4">Back to results</Link></>;
  if (!c) return <Spinner label="Loading candidate…" />;
  const w = results?.config?.weights ?? { text: 50, skills: 35, experience: 15 };
  const tot = w.text + w.skills + w.experience || 1;
  const pct = (n: number) => Math.round((n / tot) * 100);

  return (
    <>
      <PageHeader title={c.name} subtitle={`${c.filename} · rank ${c.rank} of ${c.total}`}>
        <Link to="/results" className="btn-secondary">Back to results</Link>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <section className="card">
            <div className="mb-4 flex items-center gap-3"><ScoreBadge score={c.final_score} /><h2 className="font-semibold">Job-description match score</h2>
              {c.corrected && <Chip tone="green">Recalculated after correction</Chip>}</div>
            <p className="mb-4 text-sm text-slate-600">{c.explanation}</p>
            <Bar label="Text similarity" value={c.scores.text} weight={pct(w.text)} />
            <Bar label="Required skill match" value={c.scores.skills} weight={pct(w.skills)} reason={c.unavailable.skills} />
            <Bar label="Experience match" value={c.scores.experience} weight={pct(w.experience)} reason={c.unavailable.experience} />
          </section>

          <section className="card">
            <h2 className="mb-3 font-semibold">Skills</h2>
            <p className="mb-1 text-sm font-semibold text-slate-700">Matched required skills</p>
            <div className="mb-3 flex flex-wrap gap-1">{c.matched_required.map((s) => <Chip key={s}>{s}</Chip>)}{!c.matched_required.length && <span className="text-sm text-slate-400">None</span>}</div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Missing required skills</p>
            <div className="mb-3 flex flex-wrap gap-1">{c.missing_required.map((s) => <Chip key={s} tone="red">{s}</Chip>)}{!c.missing_required.length && <span className="text-sm text-slate-500">None</span>}</div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Preferred skills found</p>
            <div className="mb-3 flex flex-wrap gap-1">{c.matched_preferred.map((s) => <Chip key={s} tone="gray">{s}</Chip>)}{!c.matched_preferred.length && <span className="text-sm text-slate-400">None</span>}</div>
            <p className="mb-1 text-sm font-semibold text-slate-700">All skills found in resume</p>
            <div className="flex flex-wrap gap-1">{c.skills.map((s) => <Chip key={s} tone="gray">{s}</Chip>)}{!c.skills.length && <span className="text-sm text-slate-400">No known skills detected</span>}</div>
          </section>

          <section className="card">
            <button className="font-semibold text-blue-700 hover:underline" onClick={() => setShowText(!showText)} aria-expanded={showText}>
              {showText ? "Hide" : "Show"} extracted resume text</button>
            {showText && <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{c.text}</pre>}
          </section>
        </div>

        <section className="card h-fit xl:col-span-2">
          <h2 className="font-semibold">Extracted information</h2>
          <p className="mb-4 mt-1 text-xs text-slate-500">Check these against the resume. Corrections recalculate the score immediately.</p>
          <label className="mb-3 block text-sm font-semibold text-slate-700">Name <input className="input mt-1 font-normal" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700"><span>Skills (comma separated)</span><Status value={c.extraction.skills} /></div>
            <textarea className="input h-24" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </div>
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700"><span>Education</span><Status value={c.extraction.education} /></div>
            <input className="input" value={edu} placeholder="Not determined" onChange={(e) => setEdu(e.target.value)} />
          </div>
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700"><span>Experience (years)</span><Status value={c.extraction.experience} /></div>
            <input className="input" value={years} placeholder="Not determined" inputMode="decimal" onChange={(e) => setYears(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Leave blank if unknown. It will not be scored as zero.</p>
          </div>
          {error && <div className="mb-3"><ErrorBox message={error} /></div>}
          <button className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save corrections"}</button>
        </section>
      </div>
      <p className="mt-6 max-w-3xl text-xs text-slate-500">{DISCLAIMER}</p>
    </>
  );
}
