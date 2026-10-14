export interface Education { level: string; detail: string }
export interface JDInfo {
  required_skills: string[];
  preferred_skills: string[];
  education: string | null;
  min_experience_years: number | null;
}
export interface Config { weights: { text: number; skills: number; experience: number }; threshold: number; text_sim_cap: number }
export interface Candidate {
  id: string;
  name: string;
  filename: string;
  final_score: number;
  scores: { text: number; skills: number | null; experience: number | null };
  unavailable: Record<string, string>;
  matched_required: string[];
  missing_required: string[];
  matched_preferred: string[];
  skills: string[];
  education: Education | null;
  experience_years: number | null;
  experience_source: string | null;
  extraction: Record<string, string>;
  explanation: string;
  corrected: boolean;
  text?: string;
  rank?: number;
  total?: number;
  jd?: JDInfo;
}
export interface Results {
  has_results: boolean;
  screened_at?: string;
  jd?: JDInfo;
  config?: Config;
  candidates: Candidate[];
  failed: { filename: string; error: string }[];
  total_uploaded: number;
  warnings?: string[];
  stats: null | {
    processed: number;
    average_score: number;
    above_threshold: number;
    skill_coverage: { skill: string; count: number; required: boolean }[];
  };
}
export interface SampleData { resumes: string[]; job_descriptions: { id: string; title: string; text: string }[] }
