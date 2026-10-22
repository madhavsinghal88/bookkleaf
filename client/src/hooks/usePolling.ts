import { useCallback, useEffect, useRef, useState } from "react";

// Fetches data and re-fetches it every `intervalMs` while the tab is visible.
// This is how tickets update "in near-real time": the server answers unchanged
// polls with 304 (ETag), so polling is cheap. Polling was chosen over
// WebSockets/SSE because the API runs on serverless functions.
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, refresh, ...deps]);

  return { data, error, loading, refresh, setData };
}
