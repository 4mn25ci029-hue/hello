import { useEffect, useState } from 'react';

let cachedKey: string | null = null;

export function useMapsApiKey(): { apiKey: string; loading: boolean } {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const initial = envKey || cachedKey || '';

  const [apiKey, setApiKey] = useState<string>(initial);
  const [loading, setLoading] = useState<boolean>(!initial);

  useEffect(() => {
    if (initial) {
      cachedKey = initial;
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch('/api/config/maps')
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data: { apiKey?: string }) => {
        if (cancelled) return;
        const resolved = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
        cachedKey = resolved;
        setApiKey(resolved);
      })
      .catch(() => {
        if (!cancelled) setApiKey('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initial]);

  return { apiKey, loading };
}
