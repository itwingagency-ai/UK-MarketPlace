import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';

/**
 * useFetch — generic hook for GET requests with loading / error state.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useFetch('/admin/overview');
 */
export default function useFetch(url, options = {}) {
  const { immediate = true, params = {} } = options;
  const paramsString = JSON.stringify(params);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const fetchData = useCallback(
    async (overrideParams) => {
      setLoading(true);
      setError(null);

      // Abort previous in-flight request
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const res = await client.get(url, {
          params: overrideParams || JSON.parse(paramsString),
          signal: controller.signal,
        });
        if (controllerRef.current === controller) {
          setData(res.data);
          setLoading(false);
        }
        return res.data;
      } catch (err) {
        if (controllerRef.current === controller) {
          if (err.name !== 'CanceledError') {
            setError(err.response?.data?.message || err.message || 'Request failed');
          }
          setLoading(false);
        }
        return null;
      }
    },
    [url, paramsString]
  );

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [immediate, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
