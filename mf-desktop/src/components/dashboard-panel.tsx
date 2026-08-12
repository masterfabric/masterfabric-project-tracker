"use client";

import { useMemo, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Plus,
  SquareStack,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { IllusWelcomeOps } from "@/components/ops-illustrations";
import {
  formatDue,
  memberLabel,
  orgMemberLabel,
  shortIssueId,
} from "@/lib/format";
import { FOCUS_PRESETS, useFocusTimer } from "@/lib/focus-timer";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { Todo } from "@/lib/types";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardSkeleton() {
  return (
    <div className="mf-dash h-full overflow-y-auto">
      <div className="mf-dash-inner">
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </div>
  );
}

function DashEmpty({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="border-0 py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CheckCircle2 />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{copy}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

function SnapshotPill({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "warn";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${value} ${label}`}
      className={cn(
        "mf-dash-pill",
        tone === "warn" && value > 0 && "mf-dash-pill-warn",
      )}
    >
      <span className="mf-dash-pill-value">{value}</span>
      <span className="mf-dash-pill-label">{label}</span>
    </button>
  );
}

function barWidth(count: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.max(count > 0 ? 6 : 0, Math.round((count / max) * 100))}%`;
}

export function DashboardPanel() {
  const { user } = useAuth();
  const focus = useFocusTimer();
  const {
    org,
    projects,
    orgTodos,
    todos,
    orgMembers,
    setTab,
    setProjectId,
    setSelectedTodoId,
    setStatusFilter,
    setAssigneeFilter,
    projectId,
    requestCreateIssue,
    loading,
  } = useWorkspace();

  const issuePool: Todo[] = orgTodos.length > 0 ? orgTodos : todos;
  const now = Date.now();
  const week = 1000 * 60 * 60 * 24 * 7;
  const bootstrapping =
    loading && !org && projects.length === 0 && issuePool.length === 0;

  const stats = useMemo(() => {
    const open = issuePool.filter((t) => t.status === "OPEN");
    const done = issuePool.filter((t) => t.status === "DONE");
    const mine = open.filter((t) => t.assignedToUserId === user?.id).length;
    const overdue = open.filter(
      (t) => t.dueAt && new Date(t.dueAt).getTime() < now,
    ).length;
    const dueSoon = open.filter((t) => {
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt).getTime() - now;
      return d >= 0 && d < week;
    }).length;
    const todo = issuePool.filter((t) => t.boardColumn === "TODO").length;
    const doing = issuePool.filter((t) => t.boardColumn === "DOING").length;
    const review = issuePool.filter((t) => t.boardColumn === "REVIEW").length;
    const doneCol = issuePool.filter(
      (t) => t.boardColumn === "DONE" || t.status === "DONE",
    ).length;
    return {
      open: open.length,
      done: done.length,
      mine,
      overdue,
      dueSoon,
      todo,
      doing,
      review,
      doneCol,
      total: issuePool.length,
      completion:
        issuePool.length === 0
          ? 0
          : Math.round((done.length / issuePool.length) * 100),
    };
  }, [issuePool, user?.id, now, week]);

  const pipelineMax = Math.max(
    stats.todo,
    stats.doing,
    stats.review,
    stats.doneCol,
    1,
  );
  const pipelineTotal = Math.max(
    stats.todo + stats.doing + stats.review + stats.doneCol,
    1,
  );

  const workloadRows = useMemo(() => {
    const active = orgMembers.filter((m) => m.membershipStatus === "ACTIVE");
    const byUser = new Map<string, number>();
    for (const t of issuePool) {
      if (t.status !== "OPEN" || !t.assignedToUserId) continue;
      byUser.set(
        t.assignedToUserId,
        (byUser.get(t.assignedToUserId) ?? 0) + 1,
      );
    }
    const unassigned = issuePool.filter(
      (t) => t.status === "OPEN" && !t.assignedToUserId,
    ).length;

    const rows = active
      .map((m) => ({
        id: m.userID,
        label: orgMemberLabel(m, user),
        count: byUser.get(m.userID) ?? 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    if (unassigned > 0) {
      rows.push({ id: "__unassigned", label: "Unassigned", count: unassigned });
    }
    return rows;
  }, [issuePool, orgMembers, user]);

  const workloadMax = Math.max(...workloadRows.map((r) => r.count), 1);

  const firstName =
    memberLabel(user?.displayName, user?.email, "there").split(/\s+/)[0] ||
    "there";

  const focusList = useMemo(() => {
    return [...issuePool]
      .filter((t) => t.status === "OPEN")
      .sort((a, b) => {
        const aMine = a.assignedToUserId === user?.id ? 0 : 1;
        const bMine = b.assignedToUserId === user?.id ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;
        const aOver = a.dueAt && new Date(a.dueAt).getTime() < now ? 0 : 1;
        const bOver = b.dueAt && new Date(b.dueAt).getTime() < now ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, 8);
  }, [issuePool, now, user?.id]);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  function openIssue(todo: Todo) {
    if (todo.projectId !== projectId) setProjectId(todo.projectId);
    setSelectedTodoId(todo.id);
    setTab("issues");
  }

  function browseIssues(opts?: {
    status?: "all" | "OPEN" | "DONE";
    assignee?: "all" | "me";
  }) {
    setStatusFilter(opts?.status ?? "all");
    setAssigneeFilter(opts?.assignee ?? "all");
    setTab("issues");
  }

  function startFocus(todo?: Todo) {
    const target = todo ?? focusList[0];
    if (!target) {
      requestCreateIssue();
      return;
    }
    focus.start(FOCUS_PRESETS[0].seconds, target.title);
    openIssue(target);
  }

  if (bootstrapping) {
    return <DashboardSkeleton />;
  }

  if (!org) {
    return <WorkspaceSetup mode="no-org" />;
  }

  if (projects.length === 0) {
    return <WorkspaceSetup mode="no-project" />;
  }

  const hour = new Date().getHours();
  const greeting = greetingFor(hour);
  const focusHint =
    stats.overdue > 0
      ? `${stats.overdue} overdue — start here`
      : stats.mine > 0
        ? `${stats.mine} assigned to you`
        : stats.open > 0
          ? `${stats.open} open in the org`
          : "You're all caught up";

  const pipeStages = [
    {
      id: "todo" as const,
      label: "To-do",
      hint: "Board · Todo",
      count: stats.todo,
      icon: Circle,
      fill: "mf-dash-workload-fill-soft",
      status: "OPEN" as const,
    },
    {
      id: "doing" as const,
      label: "In progress",
      hint: "Board · Doing",
      count: stats.doing,
      icon: SquareStack,
      fill: "mf-dash-workload-fill-accent",
      status: "OPEN" as const,
    },
    {
      id: "review" as const,
      label: "In review",
      hint: "Board · Review",
      count: stats.review,
      icon: SquareStack,
      fill: "mf-dash-workload-fill-accent",
      status: "OPEN" as const,
    },
    {
      id: "done" as const,
      label: "Completed",
      hint: "Board · Done",
      count: stats.doneCol,
      icon: CheckCircle2,
      fill: "mf-dash-workload-fill-ink",
      status: "DONE" as const,
    },
  ];

  return (
    <div className="mf-dash h-full overflow-y-auto mf-scroll">
      <div className="mf-dash-inner mf-dash-stagger">
        <header className="mf-dash-welcome">
          <div className="mf-dash-welcome-copy">
            <p className="mf-dash-welcome-eyebrow">
              {greeting}, {firstName}
            </p>
            <h2 className="mf-dash-welcome-title">{org.name}</h2>
            <p className="mf-dash-welcome-sub">{focusHint}</p>
            <div className="mf-dash-welcome-progress">
              <div className="mf-home-progress-meta">
                <span>Org progress</span>
                <span className="tabular-nums">{stats.completion}%</span>
              </div>
              <div className="mf-dash-progress">
                <div
                  className="mf-dash-progress-fill"
                  style={{ width: `${stats.completion}%` }}
                />
              </div>
            </div>
            <div className="mf-dash-welcome-cta-row">
              <Button
                type="button"
                size="sm"
                className="mf-dash-cta h-8 px-3"
                onClick={() => requestCreateIssue()}
              >
                <Plus data-icon="inline-start" />
                New issue
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={() => startFocus()}
                disabled={focusList.length === 0 && stats.open === 0}
              >
                <Timer data-icon="inline-start" />
                Focus
              </Button>
            </div>
          </div>
          <div className="mf-dash-welcome-art" aria-hidden>
            <IllusWelcomeOps className="mf-dash-welcome-svg" />
          </div>
        </header>

        <section aria-label="At a glance" className="mf-dash-pills">
          <SnapshotPill
            label="Open"
            value={stats.open}
            onClick={() => browseIssues({ status: "OPEN" })}
          />
          <SnapshotPill
            label="Overdue"
            value={stats.overdue}
            tone="warn"
            onClick={() => browseIssues({ status: "OPEN" })}
          />
          <SnapshotPill
            label="Due this week"
            value={stats.dueSoon}
            onClick={() => browseIssues({ status: "OPEN" })}
          />
          <SnapshotPill
            label="Mine"
            value={stats.mine}
            onClick={() => browseIssues({ status: "OPEN", assignee: "me" })}
          />
        </section>

        <div className="mf-dash-viz-grid">
          <section className="mf-dash-card" aria-label="Process pipeline">
            <div className="mf-dash-card-head">
              <div className="min-w-0">
                <h3 className="mf-dash-card-title">Process pipeline</h3>
                <p className="mf-dash-card-hint">Todo → Doing → Review → Done</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-muted-foreground"
                onClick={() => browseIssues({ status: "OPEN" })}
              >
                Open
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>

            <div className="mf-dash-pipe-body">
              <div
                className="mf-dash-pipe-stack"
                role="img"
                aria-label={`Pipeline: ${stats.todo} to-do, ${stats.doing} in progress, ${stats.review} in review, ${stats.doneCol} completed`}
              >
                {pipeStages.map((col) =>
                  col.count > 0 ? (
                    <div
                      key={col.id}
                      className={cn("mf-dash-pipe-seg", col.fill)}
                      style={{
                        flexGrow: col.count,
                        flexBasis: 0,
                        minWidth: col.count > 0 ? "0.75rem" : 0,
                      }}
                      title={`${col.label}: ${col.count}`}
                    />
                  ) : null,
                )}
                {stats.todo + stats.doing + stats.review + stats.doneCol === 0 ? (
                  <div className="mf-dash-pipe-seg mf-dash-pipe-seg-empty" />
                ) : null}
              </div>

              <div className="mf-dash-pipe-legend">
                {pipeStages.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => browseIssues({ status: col.status })}
                    className="mf-dash-pipe-row"
                  >
                    <span className="mf-dash-pipe-row-meta">
                      <col.icon className="size-3 text-muted-foreground" />
                      <span className="mf-dash-pipe-row-label">{col.label}</span>
                      <span className="mf-dash-pipe-row-count">{col.count}</span>
                    </span>
                    <span className="mf-dash-workload-track">
                      <span
                        className={cn("mf-dash-workload-fill", col.fill)}
                        style={{ width: barWidth(col.count, pipelineMax) }}
                      />
                    </span>
                    <span className="mf-dash-pipe-row-pct tabular-nums">
                      {Math.round((col.count / pipelineTotal) * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mf-dash-card" aria-label="Workload">
            <div className="mf-dash-card-head">
              <div className="min-w-0">
                <h3 className="mf-dash-card-title">Workload</h3>
                <p className="mf-dash-card-hint">Open issues by owner</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-muted-foreground"
                onClick={() => setTab("team")}
              >
                Team
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>

            {workloadRows.length === 0 ? (
              <div className="mf-dash-workload-empty">
                <p className="text-[12.5px] font-medium">No open assignments</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Assign issues to see owner bars here.
                </p>
              </div>
            ) : (
              <div className="mf-dash-workload-bars mf-dash-workload-compact">
                {workloadRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="mf-dash-workload-row"
                    onClick={() =>
                      browseIssues({
                        status: "OPEN",
                        assignee: row.id === user?.id ? "me" : "all",
                      })
                    }
                  >
                    <span className="mf-dash-workload-label truncate">
                      {row.label}
                    </span>
                    <span className="mf-dash-workload-track">
                      <span
                        className={cn(
                          "mf-dash-workload-fill",
                          row.id === "__unassigned"
                            ? "mf-dash-workload-fill-soft"
                            : "mf-dash-workload-fill-ink",
                        )}
                        style={{ width: barWidth(row.count, workloadMax) }}
                      />
                    </span>
                    <span className="mf-dash-workload-count">{row.count}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mf-dash-card mf-dash-card-primary">
          <div className="mf-dash-card-head">
            <div className="min-w-0">
              <h3 className="mf-dash-card-title">What&apos;s next</h3>
              <p className="mf-dash-card-hint">
                Open the top item, or start a focus session
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-muted-foreground"
              onClick={() => browseIssues()}
            >
              All issues
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>

          {focusList.length === 0 ? (
            <DashEmpty
              title="You're clear"
              copy="No open issues waiting. Create one when you're ready."
              action={
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => requestCreateIssue()}
                >
                  <Plus data-icon="inline-start" />
                  New issue
                </Button>
              }
            />
          ) : (
            <ul className="mf-dash-focus-list">
              {focusList.map((todo, index) => {
                const overdue =
                  !!todo.dueAt && new Date(todo.dueAt).getTime() < now;
                const mine = todo.assignedToUserId === user?.id;
                const proj = projectNameById.get(todo.projectId);
                return (
                  <li key={todo.id}>
                    <div
                      className="mf-dash-focus-item"
                      style={{ animationDelay: `${0.03 + index * 0.025}s` }}
                    >
                      <button
                        type="button"
                        className="mf-dash-focus-main"
                        onClick={() => openIssue(todo)}
                      >
                        <span
                          className={cn(
                            "mf-dash-focus-status",
                            overdue && "mf-dash-focus-status-warn",
                          )}
                          aria-hidden
                        >
                          {overdue ? (
                            <AlertCircle className="size-3.5" />
                          ) : (
                            <Circle className="size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {shortIssueId(todo.id)}
                            </span>
                            <span className="truncate text-[13px] font-medium leading-snug tracking-tight">
                              {todo.title}
                            </span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                            {mine ? (
                              <Badge
                                variant="secondary"
                                className="rounded-sm px-1.5 py-0 text-[10px]"
                              >
                                Yours
                              </Badge>
                            ) : null}
                            {proj ? <span>{proj}</span> : null}
                            {todo.dueAt ? (
                              <span
                                className={cn(
                                  overdue && "font-medium text-foreground",
                                )}
                              >
                                · {formatDue(todo.dueAt)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <ArrowRight className="mf-dash-focus-arrow size-3.5 shrink-0" />
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mf-dash-focus-timer h-7 shrink-0 px-2 text-muted-foreground"
                        aria-label={`Focus on ${todo.title}`}
                        onClick={() => startFocus(todo)}
                      >
                        <Timer className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {projects.length > 1 ? (
          <section className="mf-home-projects" aria-label="Projects">
            <p className="mf-home-projects-label">Projects</p>
            <div className="mf-home-projects-row">
              {projects.slice(0, 6).map((p) => {
                const open = issuePool.filter(
                  (t) => t.projectId === p.id && t.status === "OPEN",
                ).length;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "mf-home-project-chip",
                      projectId === p.id && "mf-home-project-chip-active",
                    )}
                    onClick={() => {
                      setProjectId(p.id);
                      setTab("issues");
                    }}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {open}
                    </span>
                  </button>
                );
              })}
              {projects.length > 6 ? (
                <button
                  type="button"
                  className="mf-home-project-chip"
                  onClick={() => setTab("projects")}
                >
                  +{projects.length - 6} more
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
