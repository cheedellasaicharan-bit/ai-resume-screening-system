import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store";
import { api } from "../api";
import { Chip, DISCLAIMER, Empty, PageHeader, ScoreBadge, Spinner } from "../components/ui";

type Sort = "score" | "name" | "experience";

export default function ResultsPage() {
  const { results, loading } = useStore();
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [skill, setSkill] = useState("");
  const [sort, setSort] = useState<Sort>("score");

  const rows = useMemo(() => {
    const all = results?.candidates ?? [];
    const term = q.trim().toLowerCase();
    const filtered = all.filter((c) =>
      c.final_score >= minScore && c.final_score <= maxScore &&
      (!skill || c.skills.includes(skill)) &&
      (!term || [c.name, c.filename, ...c.skills].some((s) => s.toLowerCase().includes(term))));
    return [...filtered].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "experience" ? (b.experience_years ?? -1) - (a.experience_years ?? -1)
      : b.final_score - a.final_score);
  }, [results, q, minScore, maxScore, skill, sort]);

  if (loading && !results) return <Spinner label="Loading…" />;
  if (!results?.has_results)
    return (
      <>
        <PageHeader title="Candidate results" />
        <Empty title="No results yet"><Link to="/screen" className="btn-primary">Start a screening</Link></Empty>
      </>
    );
  const skillOptions = [...results.jd!.required_skills, ...results.jd!.preferred_skills];
  const threshold = results.config!.threshold;

  return (
    <>
      <PageHeader title="Candidate results" subtitle="Ranked by job-description match score, highest first. Open a candidate to review and correct extracted information.">
        <a className="btn-primary" href={api.csvUrl}>Download CSV</a>
      </PageHeader>

      {results.failed.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p className="font-semibold">{results.failed.length} file(s) could not be processed:</p>
          <ul className="mt-1 list-disc pl-5">{results.failed.map((f) => <li key={f.filename}><b>{f.filename}</b>: {f.error}</li>)}</ul>
        </div>
      )}

      <div className="card mb-4 grid gap-3 md:grid-cols-5">
        <label className="text-xs font-semibold text-slate-600 md:col-span-2">Search name, file or skill
          <input className="input mt-1 font-normal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. docker" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Matched skill
          <select className="input mt-1 font-normal" value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Any</option>{skillOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Score range: {minScore}–{maxScore}
          <div className="mt-2 flex gap-2">
            <input aria-label="Minimum score" type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Math.min(+e.target.value, maxScore))} className="w-full" />
            <input aria-label="Maximum score" type="range" min={0} max={100} value={maxScore} onChange={(e) => setMaxScore(Math.max(+e.target.value, minScore))} className="w-full" />
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-600">Sort by
          <select className="input mt-1 font-normal" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="score">Match score</option><option value="name">Name</option><option value="experience">Experience</option>
          </select>
        </label>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className="th">#</th><th className="th">Candidate</th><th className="th">Score</th><th className="th">Matched skills</th>
              <th className="th">Missing required</th><th className="th">Education</th><th className="th">Experience</th><th className="th">Why</th><th className="th"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={9}>No candidates match these filters. Widen the score range or clear the search.</td></tr>}
            {rows.map((c, i) => (
              <tr key={c.id} className="hover:bg-blue-50/40">
                <td className="td text-slate-500">{i + 1}</td>
                <td className="td"><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-500">{c.filename}</p>
                  {c.corrected && <Chip tone="green">Corrected</Chip>}</td>
                <td className="td"><ScoreBadge score={c.final_score} />{c.final_score >= threshold && <p className="mt-1 text-xs text-slate-500">≥ {threshold}</p>}</td>
                <td className="td max-w-[200px]"><div className="flex flex-wrap gap-1">{[...c.matched_required, ...c.matched_preferred].map((s) => <Chip key={s}>{s}</Chip>)}
                  {c.matched_required.length + c.matched_preferred.length === 0 && <span className="text-slate-400">None</span>}</div></td>
                <td className="td max-w-[180px]"><div className="flex flex-wrap gap-1">{c.missing_required.map((s) => <Chip key={s} tone="red">{s}</Chip>)}
                  {c.missing_required.length === 0 && <span className="text-slate-500">None</span>}</div></td>
                <td className="td">{c.education ? c.education.level : <span className="text-slate-400">Not determined</span>}</td>
                <td className="td">{c.experience_years === null ? <span className="text-slate-400">Not determined</span>
                  : `${c.experience_years} yrs${c.experience_source === "estimated" ? " (est.)" : ""}`}</td>
                <td className="td max-w-[260px] text-xs text-slate-600">{c.explanation}</td>
                <td className="td"><Link className="btn-secondary whitespace-nowrap" to={`/candidate/${c.id}`}>View details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-3xl text-xs text-slate-500">{DISCLAIMER}</p>
    </>
  );
}
