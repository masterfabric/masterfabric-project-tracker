import { mfGoOrganizations } from '@/src/shared/services/mf-go-api';
import type {
  OrganizationNewsPayload,
  OrganizationPayload,
} from '@/src/shared/services/mf-go-api';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

export type OrgNewsFeedItem = OrganizationNewsPayload & { organizationName: string };

const PER_ORG_LIMIT = 12;
const HOME_FEED_CAP = 24;

/** Keeps the org-news skeleton visible long enough that fast fetches do not flash (ms). */
const ORG_NEWS_SKELETON_MIN_MS = 1200;

async function fetchMergedOrgNews(organizations: OrganizationPayload[]): Promise<OrgNewsFeedItem[]> {
  if (organizations.length === 0) return [];
  const results = await Promise.all(
    organizations.map(async (org) => {
      try {
        const news = await mfGoOrganizations.organizationNews(org.id, PER_ORG_LIMIT);
        return news.map((n) => ({ ...n, organizationName: org.name }));
      } catch {
        return [] as OrgNewsFeedItem[];
      }
    })
  );
  const merged = results.flat();
  merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return merged.slice(0, HOME_FEED_CAP);
}

/**
 * Loads recent organization news for every org the user belongs to, merged newest-first.
 * Refetches when the Home tab gains focus (similar to keeping org chat useful).
 */
export function useOrganizationNewsFeed(
  organizations: OrganizationPayload[],
  enabled: boolean
): { items: OrgNewsFeedItem[]; loading: boolean; refresh: () => Promise<void> } {
  const [items, setItems] = useState<OrgNewsFeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeed = useCallback(async () => {
    return fetchMergedOrgNews(enabled ? organizations : []);
  }, [enabled, organizations]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      const start = Date.now();
      fetchFeed()
        .then(async (data) => {
          if (!alive) return;
          const elapsed = Date.now() - start;
          const remaining = ORG_NEWS_SKELETON_MIN_MS - elapsed;
          if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
          if (alive) setItems(data);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [fetchFeed])
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const start = Date.now();
    try {
      const data = await fetchFeed();
      const elapsed = Date.now() - start;
      const remaining = ORG_NEWS_SKELETON_MIN_MS - elapsed;
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [fetchFeed]);

  return { items, loading, refresh };
}
