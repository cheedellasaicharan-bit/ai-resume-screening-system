import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewScreening from "./pages/NewScreening";
import ResultsPage from "./pages/Results";
import CandidateDetail from "./pages/CandidateDetail";
import About from "./pages/About";
import { useStore } from "./store";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/screen", label: "New screening" },
  { to: "/results", label: "Candidate results" },
  { to: "/about", label: "Project information" },
];

export default function App() {
  const { error } = useStore();
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-blue-900 text-blue-50 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="px-5 py-5">
          <p className="text-lg font-bold leading-tight">Resume Screening Assistant</p>
          <p className="mt-1 text-xs text-blue-200">Compare resumes with a job description</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-white text-blue-900" : "text-blue-100 hover:bg-blue-800"}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <p className="hidden px-5 pt-6 text-xs leading-relaxed text-blue-200 md:block">
          Scores support human review. They never accept or reject a candidate.
        </p>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {error && (
          <div role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/screen" element={<NewScreening />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/candidate/:id" element={<CandidateDetail />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}
