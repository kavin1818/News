"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny URL-query state shared across components.
 *
 * - `useQueryParam(key, fallback)` behaves like useState, persisted in the
 *   address bar (replaceState — no history spam) so any view combination is
 *   deep-linkable (e.g. `/?view=handoff&layout=board&story=<id>`).
 * - All hook instances stay in sync via a module-level store, and browser
 *   back/forward (popstate) is reflected live.
 * - Server snapshot always returns the fallback, which is safe because every
 *   consumer renders inside the client-only mounted subtree.
 */

const listeners = new Set<() => void>();

let cache: URLSearchParams | null = null;

function params(): URLSearchParams {
  if (!cache) cache = new URLSearchParams(window.location.search);
  return cache;
}

function refresh() {
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", refresh);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", refresh);
  };
}

export function useQueryParam(
  key: string,
  fallback: string
): [string, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => params().get(key) ?? fallback,
    () => fallback
  );

  const setValue = useCallback(
    (v: string | null) => {
      const next = new URLSearchParams(window.location.search);
      if (v === null || v === "" || v === fallback) next.delete(key);
      else next.set(key, v);
      const qs = next.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      );
      refresh();
    },
    [key, fallback]
  );

  return [value, setValue];
}
