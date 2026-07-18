import { useCallback, useState } from 'react';

/** Reads/writes a JSON-serializable value in localStorage, falling back to
 * `initialValue` and resetting silently if the stored value is corrupt —
 * corrupt user-facing storage should never crash the app. */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((previous: T) => T)) => {
      setStoredValue((previous) => {
        const next = value instanceof Function ? value(previous) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage can fail (quota, private mode); the in-memory value still updates.
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
