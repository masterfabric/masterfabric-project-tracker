/**
 * GFG-177: Persist org owner dashboard scope per organization (AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (organizationId: string) => `orgOwnerDashboard.state.v1:${organizationId}`;

export type OrgOwnerDashboardProjectFilter = string[] | null;

export interface OrgOwnerDashboardPersistedState {
  period: 'WEEK' | 'MONTH';
  periodOffset: number;
  includeSubtasks: boolean;
  projectFilter: OrgOwnerDashboardProjectFilter;
}

function isPeriod(p: unknown): p is 'WEEK' | 'MONTH' {
  return p === 'WEEK' || p === 'MONTH';
}

export async function loadOrgOwnerDashboardState(
  organizationId: string
): Promise<OrgOwnerDashboardPersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(key(organizationId));
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (!isPeriod(j.period)) return null;
    const periodOffset = typeof j.periodOffset === 'number' && j.periodOffset >= 0 ? j.periodOffset : 0;
    const includeSubtasks = Boolean(j.includeSubtasks);
    let projectFilter: OrgOwnerDashboardProjectFilter = null;
    if (j.projectFilter === null) {
      projectFilter = null;
    } else if (Array.isArray(j.projectFilter) && j.projectFilter.every((x) => typeof x === 'string')) {
      projectFilter = j.projectFilter.length ? (j.projectFilter as string[]) : null;
    }
    return { period: j.period, periodOffset, includeSubtasks, projectFilter };
  } catch {
    return null;
  }
}

export async function saveOrgOwnerDashboardState(
  organizationId: string,
  state: OrgOwnerDashboardPersistedState
): Promise<void> {
  try {
    await AsyncStorage.setItem(key(organizationId), JSON.stringify(state));
  } catch {
    // non-fatal
  }
}

/** Drop project ids that are not in the current org’s project list. */
export function sanitizeProjectFilter(
  projectFilter: OrgOwnerDashboardProjectFilter,
  validProjectIds: Set<string>
): OrgOwnerDashboardProjectFilter {
  if (projectFilter === null) return null;
  const next = projectFilter.filter((id) => validProjectIds.has(id));
  if (next.length === 0) return null;
  if (next.length === validProjectIds.size) return null;
  return next;
}
