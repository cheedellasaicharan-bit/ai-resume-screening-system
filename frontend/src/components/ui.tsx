import type { ReactNode } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
      {label}
    </span>
  );
}

export function scoreColor(score: number) {
  return score >= 70 ? "bg-blue-700 text-white" : score >= 40 ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-600";
}

export function ScoreBadge({ score }: { score: number }) {
  return <span className={`inline-block min-w-[3.25rem] rounded-md px-2 py-1 text-center text-sm font-semibold ${scoreColor(score)}`}>{score.toFixed(1)}</span>;
}

export function Chip({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "red" | "gray" | "green" }) {
  const tones = { blue: "bg-blue-50 text-blue-800 border-blue-200", red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200", green: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <div className="mt-3 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export const DISCLAIMER =
  "Match scores compare resume text with the job description. They are decision-support information, not a probability of being hired or a prediction of job performance. A person should review every candidate.";
