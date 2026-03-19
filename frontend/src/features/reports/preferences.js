import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "dentai-reports-preferences";

function getStorageKey(user) {
  const organizationId = user?.organizationId || "anonymous-org";
  const userId = user?.id || "anonymous-user";
  return `${STORAGE_PREFIX}:${organizationId}:${userId}`;
}

function readPreferences(user) {
  if (typeof window === "undefined") {
    return { favorites: [], recent: [], usage: {} };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(user));
    if (!raw) {
      return { favorites: [], recent: [], usage: {} };
    }

    return {
      favorites: [],
      recent: [],
      usage: {},
      ...JSON.parse(raw),
    };
  } catch (error) {
    console.error("Failed to read report preferences:", error);
    return { favorites: [], recent: [], usage: {} };
  }
}

function writePreferences(user, nextPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(user), JSON.stringify(nextPreferences));
}

export function useReportPreferences(user) {
  const [preferences, setPreferences] = useState(() => readPreferences(user));

  useEffect(() => {
    setPreferences(readPreferences(user));
  }, [user]);

  const updatePreferences = useCallback(
    (updater) => {
      setPreferences((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        writePreferences(user, next);
        return next;
      });
    },
    [user]
  );

  const toggleFavorite = useCallback(
    (slug) => {
      updatePreferences((current) => {
        const exists = current.favorites.includes(slug);
        return {
          ...current,
          favorites: exists
            ? current.favorites.filter((item) => item !== slug)
            : [...current.favorites, slug],
        };
      });
    },
    [updatePreferences]
  );

  const trackVisit = useCallback(
    (slug) => {
      updatePreferences((current) => {
        const usageCount = (current.usage?.[slug] || 0) + 1;
        return {
          ...current,
          recent: [slug, ...current.recent.filter((item) => item !== slug)].slice(0, 8),
          usage: {
            ...current.usage,
            [slug]: usageCount,
          },
        };
      });
    },
    [updatePreferences]
  );

  const favoriteSlugs = preferences.favorites || [];
  const recentSlugs = preferences.recent || [];

  const frequentlyUsedSlugs = useMemo(
    () =>
      Object.entries(preferences.usage || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([slug]) => slug),
    [preferences.usage]
  );

  return {
    favoriteSlugs,
    recentSlugs,
    frequentlyUsedSlugs,
    toggleFavorite,
    trackVisit,
  };
}
