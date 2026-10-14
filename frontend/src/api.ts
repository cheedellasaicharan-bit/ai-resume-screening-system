import type { Candidate, Results, SampleData, JDInfo } from "./types";

const BASE = "/api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try { msg = (await res.json()).detail ?? msg; } catch { /* keep default */ }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await handle<T>(await fetch(BASE + path, init));
  } catch (e) {
    if (e instanceof TypeError) throw new Error("Cannot reach the backend. Start it with: uvicorn app:app --port 8000");
    throw e;
  }
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  results: () => request<Results>("/results"),
  samples: () => request<SampleData>("/samples"),
  candidate: (id: string) => request<Candidate>(`/candidate/${id}`),
  parseJd: (text: string) => {
    const f = new FormData();
    f.append("job_description", text);
    return request<JDInfo>("/parse-jd", { method: "POST", body: f });
  },
  correct: (id: string, body: object) =>
    request<Candidate>(`/candidate/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  csvUrl: `${BASE}/export/csv`,
};

/** Upload with progress (fetch cannot report upload progress, XHR can). */
export function screen(form: FormData, onProgress: (pct: number) => void): Promise<Results> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/screen`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error("Cannot reach the backend. Start it with: uvicorn app:app --port 8000"));
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as Results);
      else reject(new Error(body?.detail ? String(body.detail) : `Screening failed (${xhr.status}).`));
    };
    xhr.send(form);
  });
}
