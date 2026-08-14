"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  IllusEmptyOrg,
  IllusEmptyProject,
  IllusSelectProject,
} from "@/components/ops-illustrations";
import {
  formatOperatorError,
  isUnreachableApiMessage,
} from "@/lib/operator-errors";
import { useWorkspace } from "@/lib/workspace";

/** Guided first-run / empty gate — org → project before Issues work. */
export function WorkspaceSetup({
  mode,
}: {
  mode: "no-org" | "no-project" | "select-project";
}) {
  const {
    projects,
    createOrganization,
    createProject,
    setProjectId,
    setTab,
    error: workspaceError,
    clearError,
    refreshOrgs,
  } = useWorkspace();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const offline =
    mode === "no-org" &&
    isUnreachableApiMessage(workspaceError) &&
    !localError &&
    !name.trim();

  async function onRetry() {
    setRetrying(true);
    setLocalError(null);
    clearError();
    try {
      await refreshOrgs();
    } finally {
      setRetrying(false);
    }
  }

  async function onSubmit() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (mode === "no-org") {
        await createOrganization(n);
      } else {
        await createProject(n);
        setTab("issues");
      }
      setName("");
    } catch (e) {
      // Never seed the input from the error — keep whatever the user typed.
      setLocalError(
        formatOperatorError(
          e,
          mode === "no-org"
            ? "Failed to create organization"
            : "Failed to create project",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (mode === "select-project") {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader className="max-w-md gap-3">
          <EmptyMedia>
            <IllusSelectProject className="h-52 w-[min(100%,22rem)]" />
          </EmptyMedia>
          <EmptyTitle>Select a project</EmptyTitle>
          <EmptyDescription>
            Issues live inside a project. Pick one below or open the projects
            list.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ul className="flex w-full max-w-xs flex-col gap-1">
            {projects.map((p) => (
              <li key={p.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-start"
                  onClick={() => {
                    setProjectId(p.id);
                    setTab("issues");
                  }}
                >
                  {p.name}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTab("projects")}
          >
            All projects
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (offline) {
    return (
      <Empty className="h-full border-0" data-testid="workspace-offline">
        <EmptyHeader className="max-w-md gap-3">
          <EmptyMedia>
            <IllusEmptyOrg className="h-52 w-[min(100%,22rem)]" />
          </EmptyMedia>
          <EmptyTitle>API unreachable</EmptyTitle>
          <EmptyDescription>
            Organizations can&apos;t load until mf-go GraphQL is reachable.
            Start the backend, confirm the GraphQL URL, then retry.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Alert variant="destructive" className="max-w-sm text-left">
            <AlertDescription>{workspaceError}</AlertDescription>
          </Alert>
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={retrying}
            onClick={() => void onRetry()}
          >
            <RefreshCw data-icon="inline-start" />
            {retrying ? "Retrying…" : "Retry connection"}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const isOrg = mode === "no-org";
  const nameId = isOrg ? "workspace-org-name" : "workspace-project-name";

  return (
    <Empty className="h-full border-0" data-testid="workspace-setup">
      <EmptyHeader className="max-w-md gap-3">
        <EmptyMedia>
          {isOrg ? (
            <IllusEmptyOrg className="h-52 w-[min(100%,22rem)]" />
          ) : (
            <IllusEmptyProject className="h-52 w-[min(100%,22rem)]" />
          )}
        </EmptyMedia>
        <EmptyTitle>
          {isOrg ? "Create your organization" : "Create your first project"}
        </EmptyTitle>
        <EmptyDescription>
          {isOrg
            ? "Organizations hold projects, team, and chat. Start here after signup."
            : "Projects hold issues. Create one to open the pipeline."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {/* Form-local errors only — workspace banner lives in AppShell. */}
        {localError ? (
          <Alert
            variant="destructive"
            className="mb-1 max-w-sm border-destructive/40 bg-destructive/5 text-left"
            data-testid="workspace-setup-error"
          >
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        ) : null}
        <form
          className="flex w-full max-w-xs flex-col gap-2 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId} className="text-[12px] text-muted-foreground">
              {isOrg ? "Organization name" : "Project name"}
            </Label>
            <Input
              id={nameId}
              autoFocus
              autoComplete={isOrg ? "organization" : "off"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isOrg ? "Acme Ops" : "Launch checklist"}
              className="h-9"
              disabled={busy}
              data-testid="workspace-setup-name"
              aria-invalid={Boolean(localError)}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-9"
            disabled={busy || !name.trim()}
          >
            <Plus data-icon="inline-start" />
            {isOrg ? "Create organization" : "Create project"}
          </Button>
        </form>
        {!isOrg ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTab("projects")}
          >
            Browse projects
          </Button>
        ) : null}
      </EmptyContent>
    </Empty>
  );
}
