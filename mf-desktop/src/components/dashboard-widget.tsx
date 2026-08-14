import { useEffect, useMemo } from "react";
import { Timer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import {
  formatFocusRemaining,
  useFocusTimer,
} from "@/lib/focus-timer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardWidget() {
  const { user, ready } = useAuth();
  const {
    personalTodos,
    todos,
    chatMessages,
    refreshPersonal,
    refreshTodos,
    refreshChat,
  } = useWorkspace();
  const focus = useFocusTimer();

  useEffect(() => {
    if (user) {
      void refreshPersonal();
      void refreshTodos();
      void refreshChat();
    }
  }, [user, refreshPersonal, refreshTodos, refreshChat]);

  const openPersonal = useMemo(
    () => personalTodos.filter((t) => !t.completed).slice(0, 5),
    [personalTodos],
  );
  const openIssues = useMemo(
    () => todos.filter((t) => t.status === "OPEN").slice(0, 5),
    [todos],
  );
  const unreadHint = chatMessages.length;

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[14px] font-medium">Sign in required</p>
        <Button size="sm" onClick={() => void window.mfDesktop?.showMain()}>
          Open main window
        </Button>
      </div>
    );
  }

  return (
    <div className="hud-canvas flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">Dashboard</p>
          <p className="text-[11px] text-muted-foreground">Glance overview</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void window.mfDesktop?.showMain()}
        >
          Open app
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 mf-scroll">
        <section
          className={cn(
            "rounded-xl border border-border p-3",
            focus.running && "ring-1 ring-foreground/20",
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Timer className="size-3.5" />
            Focus
          </div>
          <p className="font-mono text-[22px] font-semibold tabular-nums">
            {focus.running
              ? formatFocusRemaining(focus.remainingMs)
              : "—"}
          </p>
          {focus.taskTitle ? (
            <p className="mt-1 truncate text-[12px] text-muted-foreground">
              {focus.taskTitle}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border p-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            My work ({openPersonal.length})
          </p>
          <ul className="space-y-1.5">
            {openPersonal.length === 0 ? (
              <li className="text-[12px] text-muted-foreground">All clear</li>
            ) : (
              openPersonal.map((t) => (
                <li key={t.id} className="truncate text-[13px]">
                  {t.title}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Open issues ({openIssues.length})
          </p>
          <ul className="space-y-1.5">
            {openIssues.length === 0 ? (
              <li className="text-[12px] text-muted-foreground">None open</li>
            ) : (
              openIssues.map((t) => (
                <li key={t.id} className="truncate text-[13px]">
                  {t.title}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Chat
          </p>
          <p className="mt-1 text-[13px]">
            {unreadHint} recent message{unreadHint === 1 ? "" : "s"} loaded
          </p>
        </section>
      </div>
    </div>
  );
}
