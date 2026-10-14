import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../store";
import { api } from "../api";
import { DISCLAIMER, Empty, PageHeader, ScoreBadge, Spinner } from "../components/ui";

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-blue-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { results, loading } = useStore();
  if (loading && !results) return <Spinner label="Loading…" />;
  if (!results?.has_results || !results.stats)
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Summary of the latest screening." />
        <Empty title="No screening yet">
          Paste a job description and add resumes (or use the built-in fictional samples).{" "}
          <Link to="/screen" className="btn-primary mt-4">Start a screening</Link>
        </Empty>
      </>
    );

  const { stats, candidates, config, failed, total_uploaded } = results;
  const chart = candidates.map((c) => ({ name: c.name, score: c.final_score }));
  const coverage = stats.skill_coverage.map((s) => ({ ...s, pct: Math.round((s.count / Math.max(1, stats.processed)) * 100) }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Summary of the latest screening.">
        <a className="btn-secondary" href={api.csvUrl}>Download CSV report</a>
        <Link to="/screen" className="btn-primary">New screening</Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Resumes uploaded" value={total_uploaded} />
        <Stat label="Processed successfully" value={stats.processed} note={failed.length ? `${failed.length} could not be read` : "All files were read"} />
        <Stat label={`Scoring ${config?.threshold}+ (review first)`} value={stats.above_threshold} note="A threshold only helps order your review. Nobody is rejected." />
        <Stat label="Average match score" value={stats.average_score} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold text-slate-900">Match score by candidate</h2>
          <div className="h-72" role="img" aria-label="Bar chart of match scores">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} fontSize={11} height={70} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="score" name="Match score" radius={[3, 3, 0, 0]}>
                  {chart.map((d, i) => <Cell key={i} fill={d.score >= (config?.threshold ?? 60) ? "#1d4ed8" : "#93c5fd"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-1 font-semibold text-slate-900">Skills coverage</h2>
          <p className="mb-3 text-xs text-slate-500">Share of processed candidates whose resume mentions each skill. Dark bars are required skills.</p>
          {coverage.length === 0 ? <p className="text-sm text-slate-500">No skills were detected in the job description.</p> : (
            <div style={{ height: Math.max(200, coverage.length * 30) }}>
              <ResponsiveContainer>
                <BarChart data={coverage} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} />
                  <YAxis type="category" dataKey="skill" width={110} fontSize={11} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" name="Candidates with skill" radius={[0, 3, 3, 0]}>
                    {coverage.map((d, i) => <Cell key={i} fill={d.required ? "#1d4ed8" : "#93c5fd"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Top candidates</h2>
          <Link to="/results" className="text-sm font-semibold text-blue-700 hover:underline">See all results</Link>
        </div>
        <table className="w-full min-w-[480px]">
          <thead><tr><th className="th">Rank</th><th className="th">Candidate</th><th className="th">Score</th><th className="th">Missing required skills</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.slice(0, 5).map((c, i) => (
              <tr key={c.id}>
                <td className="td">{i + 1}</td>
                <td className="td"><Link className="font-semibold text-blue-700 hover:underline" to={`/candidate/${c.id}`}>{c.name}</Link></td>
                <td className="td"><ScoreBadge score={c.final_score} /></td>
                <td className="td text-slate-600">{c.missing_required.length ? c.missing_required.join(", ") : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-4 max-w-3xl text-xs text-slate-500">{DISCLAIMER}</p>
    </>
  );
}
