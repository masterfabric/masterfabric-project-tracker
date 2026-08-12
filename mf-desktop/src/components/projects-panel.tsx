"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceSetup } from "@/components/workspace-setup";
import { formatRelative } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export function ProjectsPanel() {
  const {
    org,
    projects,
    projectId,
    setProjectId,
    setTab,
    createProject,
    renameProject,
    deleteProject,
    orgTodos,
    todos,
  } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const pool = orgTodos.length > 0 ? orgTodos : todos;

  const rows = useMemo(
    () =>
      projects.map((p) => {
        const open = pool.filter(
          (t) => t.projectId === p.id && t.status === "OPEN",
        ).length;
        return { project: p, open };
      }),
    [projects, pool],
  );

  async function onCreate() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await createProject(n);
      setName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  }

  if (!org) {
    return <WorkspaceSetup mode="no-org" />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-[22px] font-semibold tracking-tight">
              Projects
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {projects.length} in {org.name}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-md"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus data-icon="inline-start" />
            New project
          </Button>
        </div>

        {creating ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="Project name"
              className="h-9 max-w-sm"
            />
            <Button
              size="sm"
              className="h-9 rounded-md"
              disabled={busy}
              onClick={() => void onCreate()}
            >
              Create
            </Button>
          </div>
        ) : null}

        {projects.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border px-5 py-8">
            <p className="text-[14px] font-medium">Create your first project</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Projects hold issues, purchases, and the pipeline.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-4 h-9 rounded-md"
              onClick={() => setCreating(true)}
            >
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
            {rows.map(({ project: p, open }) => {
              const active = projectId === p.id;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "group flex items-center gap-3 px-3.5 py-2.5",
                    active && "bg-muted/40",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setProjectId(p.id);
                      setTab("issues");
                    }}
                  >
                    {renamingId === p.id ? (
                      <Input
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            const n = renameValue.trim();
                            if (!n) return;
                            void renameProject(n).then(() =>
                              setRenamingId(null),
                            );
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="h-8 max-w-xs"
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="truncate text-[14px] font-medium">
                          {p.name}
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                          Updated {formatRelative(p.updatedAt)}
                        </p>
                      </>
                    )}
                  </button>
                  {open > 0 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-md tabular-nums"
                    >
                      {open} open
                    </Badge>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">
                      0 open
                    </span>
                  )}
                  <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title="Rename"
                      onClick={() => {
                        setProjectId(p.id);
                        setRenameValue(p.name);
                        setRenamingId(p.id);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title="Delete"
                      onClick={() => {
                        if (!confirm("Delete this project?")) return;
                        setProjectId(p.id);
                        void deleteProject();
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
