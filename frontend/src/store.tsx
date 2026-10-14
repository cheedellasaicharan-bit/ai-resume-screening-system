import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { Results } from "./types";

interface Store { results: Results | null; loading: boolean; error: string | null; refresh: () => Promise<void>; set: (r: Results) => void }
const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setResults(await api.results()); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return <Ctx.Provider value={{ results, loading, error, refresh, set: setResults }}>{children}</Ctx.Provider>;
}
