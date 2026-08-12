"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { useWorkspace } from "@/lib/workspace";
import type { BoardColumn } from "@/lib/types";

const COLUMNS: BoardColumn[] = ["TODO", "DOING", "REVIEW", "DONE"];

export function ReportsPanel() {
  const { project, todos, sprints, setTab } = useWorkspace();

  const stats = useMemo(() => {
    const byCol: Record<BoardColumn, number> = {
      TODO: 0,
      DOING: 0,
      REVIEW: 0,
      DONE: 0,
    };
    let openSp = 0;
    let doneSp = 0;
    let estimated = 0;
    for (const t of todos) {
      const col = t.boardColumn ?? (t.status === "DONE" ? "DONE" : "TODO");
      byCol[col] = (byCol[col] ?? 0) + 1;
      const sp = t.storyPoints ?? 0;
      if (sp > 0) estimated += 1;
      if (col === "DONE" || t.status === "DONE") doneSp += sp;
      else openSp += sp;
    }
    const active = sprints.find((s) => s.status === "ACTIVE");
    const sprintTodos = active
      ? todos.filter((t) => t.sprintId === active.id)
      : [];
    const sprintSp = sprintTodos.reduce((n, t) => n + (t.storyPoints ?? 0), 0);
    const sprintDoneSp = sprintTodos
      .filter((t) => t.boardColumn === "DONE" || t.status === "DONE")
      .reduce((n, t) => n + (t.storyPoints ?? 0), 0);
    return { byCol, openSp, doneSp, estimated, active, sprintSp, sprintDoneSp };
  }, [todos, sprints]);

  if (!project) {
    return <WorkspaceSetup mode="no-project" />;
  }

  const maxCol = Math.max(1, ...COLUMNS.map((c) => stats.byCol[c]));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Insights
        </p>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Reports
        </h2>
        <p className="text-sm text-muted-foreground">
          Workflow load and story-point pulse for {project.name}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Open SP"
          value={String(stats.openSp)}
          hint="Remaining story points"
        />
        <Stat
          label="Done SP"
          value={String(stats.doneSp)}
          hint="Completed story points"
        />
        <Stat
          label="Estimated"
          value={`${stats.estimated}/${todos.length}`}
          hint="Issues with SP set"
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Board distribution</h3>
        </div>
        <div className="space-y-2">
          {COLUMNS.map((col) => {
            const n = stats.byCol[col];
            const pct = Math.round((n / maxCol) * 100);
            return (
              <div key={col} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {col}
                </span>
                <div className="h-2 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-foreground/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-right font-mono text-[11px] tabular-nums">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold">Active sprint</h3>
        {stats.active ? (
          <>
            <p className="text-sm">{stats.active.name}</p>
            {stats.active.goal ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats.active.goal}
              </p>
            ) : null}
            <p className="mt-3 font-mono text-xs text-muted-foreground tabular-nums">
              {stats.sprintDoneSp} / {stats.sprintSp} SP complete
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full rounded-sm bg-[#0D9488]"
                style={{
                  width: `${
                    stats.sprintSp > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (stats.sprintDoneSp / stats.sprintSp) * 100,
                          ),
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active sprint.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => setTab("sprints")}
            >
              Create or activate one
            </button>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
