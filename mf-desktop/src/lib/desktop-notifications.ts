import { useEffect, useRef } from "react";
import type { AuthUser, PersonalTodo, Todo } from "./types";

const DUE_KEY = "mf.desktop.notifiedDue";
const ASSIGNED_KEY = "mf.desktop.notifiedAssigned";
/** Notify once an item is due within this window (and stop once this far past due). */
const DUE_WINDOW_MS = 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 5 * 60 * 1000;

function readIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeIds(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    /* storage full/unavailable — notifications just won't dedupe across reloads */
  }
}

async function notificationsAllowed(): Promise<boolean> {
  const api = window.mfDesktop;
  if (!api) return false;
  try {
    const prefs = await api.prefs.get();
    return prefs.notificationsEnabled !== false; // default on
  } catch {
    return false;
  }
}

function fire(id: string, title: string, body: string): void {
  void window.mfDesktop?.notifications.show({ id, title, body });
}

/**
 * Fires native OS notifications for "due soon" (project + personal todos) and
 * "newly assigned to you" (project todos). Desktop-only — there is no
 * server-side push, so this only reacts to data already fetched into the
 * workspace context (see report: skipped a backend push channel).
 *
 * Dedupes per item via localStorage so relaunching the app does not re-fire.
 * The first scan per signed-in session only takes an assignment baseline —
 * it will not notify for issues that were already assigned to you before
 * this launch, only for ones that change afterward.
 */
export function useDesktopNotifications(
  user: AuthUser | null,
  orgTodos: Todo[],
  personalTodos: PersonalTodo[],
): void {
  const primedRef = useRef(false);
  const prevAssignedRef = useRef<Map<string, string | null>>(new Map());

  // Reset the assignment baseline whenever the signed-in user changes.
  useEffect(() => {
    primedRef.current = false;
    prevAssignedRef.current = new Map();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !window.mfDesktop) return;
    const currentUser = user;
    let cancelled = false;

    function scan() {
      void notificationsAllowed().then((allowed) => {
        if (cancelled) return;
        if (!allowed) {
          primedRef.current = true;
          return;
        }

        const dueNotified = readIds(DUE_KEY);
        const assignedNotified = readIds(ASSIGNED_KEY);
        const now = Date.now();
        const primed = primedRef.current;
        let dueChanged = false;
        let assignedChanged = false;

        for (const t of orgTodos) {
          const prevAssignee = prevAssignedRef.current.get(t.id) ?? null;
          prevAssignedRef.current.set(t.id, t.assignedToUserId ?? null);

          if (t.status !== "OPEN") continue;

          if (
            primed &&
            t.assignedToUserId === currentUser.id &&
            prevAssignee !== currentUser.id &&
            !assignedNotified.has(t.id)
          ) {
            fire(`assigned:${t.id}`, "Assigned to you", t.title);
            assignedNotified.add(t.id);
            assignedChanged = true;
          }

          if (t.dueAt) {
            const dueAt = new Date(t.dueAt).getTime();
            if (
              dueAt - now <= DUE_WINDOW_MS &&
              now - dueAt <= DUE_WINDOW_MS &&
              !dueNotified.has(t.id)
            ) {
              fire(t.id, "Due soon", t.title);
              dueNotified.add(t.id);
              dueChanged = true;
            }
          }
        }

        for (const t of personalTodos) {
          if (t.completed || !t.dueAt) continue;
          const key = `p:${t.id}`;
          const dueAt = new Date(t.dueAt).getTime();
          if (
            dueAt - now <= DUE_WINDOW_MS &&
            now - dueAt <= DUE_WINDOW_MS &&
            !dueNotified.has(key)
          ) {
            fire(key, "Due soon", t.title);
            dueNotified.add(key);
            dueChanged = true;
          }
        }

        primedRef.current = true;
        if (dueChanged) writeIds(DUE_KEY, dueNotified);
        if (assignedChanged) writeIds(ASSIGNED_KEY, assignedNotified);
      });
    }

    scan();
    const id = window.setInterval(scan, SCAN_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, orgTodos, personalTodos]);
}
