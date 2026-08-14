"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { useWorkspace } from "@/lib/workspace";
import type { SprintStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_ORDER: SprintStatus[] = ["ACTIVE", "PLANNED", "CLOSED"];

export function SprintsPanel() {
  const {
    project,
    sprints,
    todos,
    createSprint,
    updateSprintStatus,
    updateTodoSprint,
    setTab,
  } = useWorkspace();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const backlog = useMemo(
    () => todos.filter((t) => !t.sprintId && t.status === "OPEN"),
    [todos],
  );

  const bySprint = useMemo(() => {
    const map = new Map<string, typeof todos>();
    for (const t of todos) {
      if (!t.sprintId) continue;
      const list = map.get(t.sprintId) ?? [];
      list.push(t);
      map.set(t.sprintId, list);
    }
    return map;
  }, [todos]);

  if (!project) {
    return <WorkspaceSetup mode="no-project" />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await createSprint({ name: n, goal: goal.trim() || undefined, status: "PLANNED" });
      setName("");
      setGoal("");
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...sprints].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Cycles
          </p>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Sprints
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan work into time-boxed iterations — Linear-style cycles for{" "}
            {project.name}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTab("board")}
        >
          Open board
        </Button>
      </div>

      <form
        onSubmit={(e) => void onCreate(e)}
        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            New sprint
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sprint name"
            className="h-8"
          />
        </div>
        <div className="min-w-0 flex-[1.4] space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Goal
          </label>
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Optional sprint goal"
            className="h-8"
          />
        </div>
        <Button type="submit" size="sm" className="h-8" disabled={busy || !name.trim()}>
          <Plus data-icon="inline-start" />
          Create
        </Button>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-16 text-center">
            <CalendarRange className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No sprints yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Create a sprint, then pull backlog issues into it.
            </p>
          </div>
        ) : (
          sorted.map((sp) => {
            const items = bySprint.get(sp.id) ?? [];
            const spTotal = items.reduce(
              (n, t) => n + (t.storyPoints ?? 0),
              0,
            );
            const doneSp = items
              .filter((t) => t.boardColumn === "DONE" || t.status === "DONE")
              .reduce((n, t) => n + (t.storyPoints ?? 0), 0);
            return (
              <article
                key={sp.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{sp.name}</h3>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-sm text-[10px]",
                          sp.status === "ACTIVE" && "bg-foreground text-background",
                        )}
                      >
                        {sp.status}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {doneSp}/{spTotal} SP · {items.length} issues
                      </span>
                    </div>
                    {sp.goal ? (
                      <p className="mt-1 text-xs text-muted-foreground">{sp.goal}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sp.status !== "ACTIVE" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        variant="outline"
                        onClick={() => void updateSprintStatus(sp.id, "ACTIVE")}
                      >
                        Activate
                      </Button>
                    ) : null}
                    {sp.status !== "CLOSED" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        variant="ghost"
                        onClick={() => void updateSprintStatus(sp.id, "CLOSED")}
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
                </div>
                {items.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                    {items.slice(0, 8).map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t.boardColumn}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        {t.storyPoints != null ? (
                          <span className="font-mono text-[10px] tabular-nums">
                            {t.storyPoints}sp
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Empty — add issues from the backlog below.
                  </p>
                )}
              </article>
            );
          })
        )}

        {backlog.length > 0 && sorted.some((s) => s.status !== "CLOSED") ? (
          <section className="rounded-lg border border-border bg-muted/20 p-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Pull from backlog
            </h3>
            <ul className="space-y-1">
              {backlog.slice(0, 12).map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-xs">{t.title}</span>
                  {sorted
                    .filter((s) => s.status !== "CLOSED")
                    .slice(0, 3)
                    .map((s) => (
                      <Button
                        key={s.id}
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        variant="outline"
                        onClick={() => void updateTodoSprint(t.id, s.id)}
                      >
                        → {s.name}
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
