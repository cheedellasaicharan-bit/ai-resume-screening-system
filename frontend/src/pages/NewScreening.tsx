import { DragEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, screen } from "../api";
import { useStore } from "../store";
import { Chip, ErrorBox, PageHeader, Spinner } from "../components/ui";
import type { JDInfo, SampleData } from "../types";

const ALLOWED = [".pdf", ".docx", ".txt"];
const MAX_MB = 5;

function SkillEditor({ title, skills, onChange, tone }: { title: string; skills: string[]; onChange: (s: string[]) => void; tone: "blue" | "gray" }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim().toLowerCase(); if (v && !skills.includes(v)) onChange([...skills, v]); setDraft(""); };
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-700">{title}</p>
      <div className="flex flex-wrap gap-1">
        {skills.length === 0 && <span className="text-sm text-slate-400">None detected</span>}
        {skills.map((s) => (
          <button key={s} type="button" onClick={() => onChange(skills.filter((x) => x !== s))} title="Remove skill" aria-label={`Remove ${s}`}>
            <Chip tone={tone}>{s} ×</Chip>
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input" value={draft} placeholder="Add a skill" onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-secondary" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function NewScreening() {
  const nav = useNavigate();
  const { set } = useStore();
  const [jd, setJd] = useState("");
  const [info, setInfo] = useState<JDInfo | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [samples, setSamples] = useState<SampleData | null>(null);
  const [useSamples, setUseSamples] = useState(false);
  const [anonymize, setAnonymize] = useState(false);
  const [weights, setWeights] = useState({ text: 50, skills: 35, experience: 15 });
  const [threshold, setThreshold] = useState(60);
  const [busy, setBusy] = useState<"" | "detect" | "upload" | "process">("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { api.samples().then(setSamples).catch(() => undefined); }, []);

  const addFiles = (list: FileList | File[]) => {
    const errs: string[] = [];
    const ok: File[] = [];
    Array.from(list).forEach((f) => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED.includes(ext)) errs.push(`${f.name}: unsupported type. Use PDF, DOCX or TXT.`);
      else if (f.size > MAX_MB * 1024 * 1024) errs.push(`${f.name}: larger than ${MAX_MB} MB.`);
      else if (f.size === 0) errs.push(`${f.name}: file is empty.`);
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) ok.push(f);
    });
    setFileErrors(errs);
    setFiles((prev) => [...prev, ...ok]);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); };

  const detect = async () => {
    setError(""); setBusy("detect");
    try { setInfo(await api.parseJd(jd)); } catch (e) { setError((e as Error).message); setInfo(null); }
    finally { setBusy(""); }
  };

  const total = weights.text + weights.skills + weights.experience;
  const submit = async () => {
    setError("");
    if (!jd.trim()) return setError("Job description is empty. Paste or type a job description first.");
    if (!files.length && !useSamples) return setError("Add at least one resume or tick “Include the fictional sample resumes”.");
    if (total <= 0) return setError("At least one scoring weight must be above zero.");
    const f = new FormData();
    f.append("job_description", jd);
    files.forEach((file) => f.append("files", file));
    f.append("use_samples", String(useSamples));
    f.append("anonymize", String(anonymize));
    f.append("config", JSON.stringify({ weights, threshold }));
    if (info) f.append("jd_overrides", JSON.stringify(info));
    setBusy("upload"); setProgress(0);
    try {
      const res = await screen(f, (p) => { setProgress(p); if (p >= 100) setBusy("process"); });
      set(res);
      nav("/results");
    } catch (e) { setError((e as Error).message); setBusy(""); }
  };

  return (
    <>
      <PageHeader title="New screening" subtitle="1. Add the job description. 2. Check the detected requirements. 3. Add resumes and run the screening." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Job description</h2>
            <div className="flex flex-wrap gap-1">
              {samples?.job_descriptions.map((d) => (
                <button key={d.id} className="btn-secondary !px-2 !py-1 text-xs" type="button" onClick={() => { setJd(d.text); setInfo(null); }}>
                  Demo: {d.title}
                </button>
              ))}
            </div>
          </div>
          <label className="sr-only" htmlFor="jd">Job description</label>
          <textarea id="jd" className="input h-64 resize-y" value={jd} onChange={(e) => { setJd(e.target.value); setInfo(null); }}
            placeholder="Paste the job description here. Headings such as “Required skills” and “Preferred skills” help the detector." />
          <div className="mt-3"><button type="button" className="btn-secondary" disabled={!jd.trim() || busy !== ""} onClick={detect}>
            {busy === "detect" ? <Spinner label="Detecting…" /> : "Detect requirements"}</button></div>

          {info && (
            <div className="mt-4 space-y-4 rounded-md border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs text-slate-600">Detected automatically. Remove or add skills if the detector got it wrong. Your edits are used for scoring.</p>
              <SkillEditor title="Required skills" skills={info.required_skills} tone="blue" onChange={(s) => setInfo({ ...info, required_skills: s })} />
              <SkillEditor title="Preferred skills (shown, not scored)" skills={info.preferred_skills} tone="gray" onChange={(s) => setInfo({ ...info, preferred_skills: s })} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="font-semibold text-slate-700">Education</p><p>{info.education ?? <span className="text-slate-400">Not determined</span>}</p></div>
                <label className="font-semibold text-slate-700">Minimum experience (years)
                  <input type="number" min={0} className="input mt-1 font-normal" value={info.min_experience_years ?? ""} placeholder="Not stated"
                    onChange={(e) => setInfo({ ...info, min_experience_years: e.target.value === "" ? null : Number(e.target.value) })} />
                </label>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="card">
            <h2 className="mb-2 font-semibold text-slate-900">Resumes</h2>
            <div role="button" tabIndex={0} aria-label="Upload resumes: drop files here or press Enter to browse"
              onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-8 text-center text-sm ${drag ? "border-blue-600 bg-blue-50" : "border-slate-300 hover:border-blue-400"}`}>
              <p className="font-semibold text-slate-800">Drop resumes here or click to browse</p>
              <p className="mt-1 text-slate-500">PDF, DOCX or TXT, up to {MAX_MB} MB each</p>
              <input ref={input} type="file" multiple accept=".pdf,.docx,.txt" className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {fileErrors.length > 0 && <div className="mt-3"><ErrorBox message={fileErrors.join(" ")} /></div>}
            {files.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {files.map((f) => (
                  <li key={f.name + f.size} className="flex items-center justify-between py-1.5">
                    <span className="truncate">{f.name} <span className="text-slate-400">({Math.max(1, Math.round(f.size / 1024))} KB)</span></span>
                    <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => setFiles(files.filter((x) => x !== f))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={useSamples} onChange={(e) => setUseSamples(e.target.checked)} />
              <span>Include the fictional sample resumes{samples ? ` (${samples.resumes.length} files)` : ""}. They contain no real personal information.</span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} />
              <span>Hide candidate names and show anonymous IDs.</span>
            </label>
          </div>

          <div className="card">
            <h2 className="mb-1 font-semibold text-slate-900">Scoring settings</h2>
            <p className="mb-3 text-xs text-slate-500">Weights are relative: they are re-balanced to total 100%. If a component cannot be determined it is left out, never counted as zero.</p>
            {([["text", "Text similarity (TF-IDF)"], ["skills", "Required skill match"], ["experience", "Experience match"]] as const).map(([k, label]) => (
              <label key={k} className="mb-2 block text-sm">
                <span className="flex justify-between"><span>{label}</span><span className="font-semibold">{total > 0 ? Math.round((weights[k] / total) * 100) : 0}%</span></span>
                <input type="range" min={0} max={100} value={weights[k]} className="w-full" onChange={(e) => setWeights({ ...weights, [k]: +e.target.value })} />
              </label>
            ))}
            <label className="block text-sm">
              <span className="flex justify-between"><span>Review-first threshold</span><span className="font-semibold">{threshold}</span></span>
              <input type="range" min={0} max={100} value={threshold} className="w-full" onChange={(e) => setThreshold(+e.target.value)} />
              <span className="text-xs text-slate-500">Used only for the dashboard count. No candidate is rejected below it.</span>
            </label>
          </div>
        </section>
      </div>

      <div className="mt-6 space-y-3">
        {error && <ErrorBox message={error} />}
        {busy === "upload" && (
          <div aria-live="polite"><p className="mb-1 text-sm text-slate-600">Uploading… {progress}%</p>
            <div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-blue-700 transition-all" style={{ width: `${progress}%` }} /></div></div>
        )}
        {busy === "process" && <Spinner label="Reading resumes and calculating scores…" />}
        <button type="button" className="btn-primary" disabled={busy !== ""} onClick={submit}>Run screening</button>
      </div>
    </>
  );
}
