"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { IssueGithubSection } from "@/components/issue-github-section";
import { formatRelative, memberLabel, shortIssueId } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function IssueDrawer() {
  const {
    selectedTodo,
    setSelectedTodoId,
    updateTodoStatus,
    updateTodoTitle,
    updateTodoDue,
    updateTodoStoryPoints,
    updateTodoDescription,
    updateTodoSprint,
    deleteTodo,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    members,
    sprints,
    orgId,
    projectId,
  } = useWorkspace();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [spLocal, setSpLocal] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(selectedTodo?.title ?? "");
    setDescription(selectedTodo?.description ?? "");
    setDueLocal(toLocalInput(selectedTodo?.dueAt ?? null));
    setSpLocal(
      selectedTodo?.storyPoints != null ? String(selectedTodo.storyPoints) : "",
    );
    setSubTitle("");
  }, [
    selectedTodo?.id,
    selectedTodo?.title,
    selectedTodo?.dueAt,
    selectedTodo?.description,
    selectedTodo?.storyPoints,
  ]);

  const open = Boolean(selectedTodo);
  const assignee = members.find(
    (m) => m.userId === selectedTodo?.assignedToUserId,
  );

  async function saveTitle() {
    if (!selectedTodo) return;
    const next = title.trim();
    if (!next || next === selectedTodo.title) return;
    setSaving(true);
    try {
      await updateTodoTitle(selectedTodo.id, next);
    } finally {
      setSaving(false);
    }
  }

  async function saveDue() {
    if (!selectedTodo) return;
    const nextIso = dueLocal ? new Date(dueLocal).toISOString() : null;
    const prev = selectedTodo.dueAt;
    if ((nextIso ?? null) === (prev ?? null)) return;
    if (
      nextIso &&
      prev &&
      Math.abs(new Date(nextIso).getTime() - new Date(prev).getTime()) < 60_000
    ) {
      return;
    }
    setSaving(true);
    try {
      await updateTodoDue(selectedTodo.id, nextIso);
    } finally {
      setSaving(false);
    }
  }

  async function onAddSubtask(e: FormEvent) {
    e.preventDefault();
    if (!selectedTodo) return;
    const t = subTitle.trim();
    if (!t) return;
    await addSubtask(selectedTodo.id, t);
    setSubTitle("");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setSelectedTodoId(null);
      }}
    >
      <SheetContent
        side="right"
        className="glass-strong w-full gap-0 border-l border-border/70 p-0 sm:max-w-[460px]"
      >
        {selectedTodo ? (
          <>
            <SheetHeader className="flex flex-row items-center gap-2 space-y-0 border-b border-border/60 px-4 py-3.5 text-left">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  void updateTodoStatus(
                    selectedTodo.id,
                    selectedTodo.status === "DONE" ? "OPEN" : "DONE",
                  )
                }
              >
                {selectedTodo.status === "DONE" ? (
                  <CheckCircle2 className="text-[var(--done)]" />
                ) : (
                  <Circle className="text-[var(--open)]" />
                )}
              </Button>
              <SheetTitle className="font-mono text-[12px] font-normal text-muted-foreground">
                {shortIssueId(selectedTodo.id)}
              </SheetTitle>
              <div className="ml-auto flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy issue id"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(selectedTodo.id)
                      .then(() => toast.success("Issue id copied"))
                      .catch(() => toast.error("Could not copy"));
                  }}
                >
                  <Copy />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Delete this issue?")) {
                      void deleteTodo(selectedTodo.id);
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100%-3.5rem)]">
              <div className="flex flex-col gap-5 p-5">
                <div className="flex flex-col gap-1">
                  <Textarea
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => void saveTitle()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void saveTitle();
                      }
                    }}
                    rows={3}
                    className="min-h-[4.5rem] resize-none border-transparent bg-transparent px-1 text-[18px] font-semibold tracking-tight shadow-none focus-visible:border-border focus-visible:ring-0"
                  />
                  <p className="px-1 text-[11px] text-muted-foreground">
                    {saving
                      ? "Saving…"
                      : "⌘/Ctrl + Enter to save · blur also saves"}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Description
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => {
                      if (!selectedTodo) return;
                      if (
                        (description ?? "") === (selectedTodo.description ?? "")
                      )
                        return;
                      void updateTodoDescription(selectedTodo.id, description);
                    }}
                    rows={4}
                    placeholder="Acceptance notes, context…"
                    className="resize-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Story points
                    </label>
                    <Input
                      value={spLocal}
                      onChange={(e) => setSpLocal(e.target.value)}
                      onBlur={() => {
                        if (!selectedTodo) return;
                        const raw = spLocal.trim();
                        if (!raw) {
                          if (selectedTodo.storyPoints != null) {
                            void updateTodoStoryPoints(selectedTodo.id, null);
                          }
                          return;
                        }
                        const n = Number(raw);
                        if (!Number.isFinite(n) || n < 0) return;
                        if (n === selectedTodo.storyPoints) return;
                        void updateTodoStoryPoints(selectedTodo.id, Math.round(n));
                      }}
                      placeholder="—"
                      className="h-8 font-mono"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Sprint
                    </label>
                    <select
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                      value={selectedTodo?.sprintId ?? ""}
                      onChange={(e) => {
                        if (!selectedTodo) return;
                        const v = e.target.value;
                        void updateTodoSprint(selectedTodo.id, v || null);
                      }}
                    >
                      <option value="">Backlog</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-[13px] text-muted-foreground">
                      Status
                    </span>
                    <Badge
                      variant="secondary"
                      className="rounded-md font-medium"
                    >
                      {selectedTodo.status === "DONE"
                        ? "Completed"
                        : selectedTodo.assignedToUserId
                          ? "In progress"
                          : "To-do"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-[13px] text-muted-foreground">
                      Assignee
                    </span>
                    <div className="text-right text-[13px]">
                      {assignee
                        ? memberLabel(assignee.userNickname)
                        : "Unassigned"}
                      <p className="text-[11px] text-muted-foreground">
                        Set when creating the issue
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[13px] text-muted-foreground">Due</span>
                    <Input
                      type="datetime-local"
                      value={dueLocal}
                      onChange={(e) => setDueLocal(e.target.value)}
                      onBlur={() => void saveDue()}
                      className="h-8 w-full sm:w-auto"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-[13px] text-muted-foreground">
                      Updated
                    </span>
                    <span className="text-[13px]">
                      {formatRelative(selectedTodo.updatedAt)}
                    </span>
                  </div>
                </div>

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                        Process steps
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Ordered subtasks — closest to a workflow without a
                        backend graph
                      </p>
                    </div>
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {selectedTodo.subtasks.filter((s) => s.completed).length}/
                      {selectedTodo.subtasks.length}
                    </span>
                  </div>

                  {selectedTodo.subtasks.length > 0 ? (
                    <ol className="relative ml-3 flex flex-col border-l border-border">
                      {[...selectedTodo.subtasks]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((s, idx) => (
                          <li
                            key={s.id}
                            className="group relative flex items-start gap-3 py-2 pl-4"
                          >
                            <span
                              className={cn(
                                "absolute top-3 -left-[5px] flex size-2.5 items-center justify-center rounded-full border-2 bg-card",
                                s.completed
                                  ? "border-foreground bg-foreground"
                                  : "border-muted-foreground",
                              )}
                            />
                            <span className="mt-0.5 w-4 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                              {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="mt-0.5"
                              onClick={() =>
                                void toggleSubtask(
                                  selectedTodo.id,
                                  s.id,
                                  !s.completed,
                                )
                              }
                            >
                              {s.completed ? (
                                <Check className="text-foreground" />
                              ) : (
                                <Circle />
                              )}
                            </Button>
                            <span
                              className={
                                s.completed
                                  ? "flex-1 pt-0.5 text-[14px] text-muted-foreground line-through"
                                  : "flex-1 pt-0.5 text-[14px]"
                              }
                            >
                              {s.title}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="opacity-0 group-hover:opacity-100"
                              onClick={() =>
                                void deleteSubtask(selectedTodo.id, s.id)
                              }
                            >
                              <Trash2 />
                            </Button>
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-[12.5px] text-muted-foreground">
                      No steps yet. Add ordered steps to sequence this task’s
                      process (Approve → next work, etc.).
                    </p>
                  )}

                  <form
                    onSubmit={(e) => void onAddSubtask(e)}
                    className="flex gap-2"
                  >
                    <Input
                      value={subTitle}
                      onChange={(e) => setSubTitle(e.target.value)}
                      placeholder="Add next step"
                      className="flex-1"
                    />
                    <Button type="submit" variant="outline" size="icon">
                      <Plus />
                    </Button>
                  </form>
                </section>

                {orgId && projectId ? (
                  <>
                    <Separator />
                    <IssueGithubSection
                      orgId={orgId}
                      projectId={projectId}
                      todoId={selectedTodo.id}
                    />
                  </>
                ) : null}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
