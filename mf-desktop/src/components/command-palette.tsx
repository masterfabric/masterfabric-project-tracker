"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  GanttChart,
  Home,
  LayoutGrid,
  LayoutList,
  MessageCircle,
  Plus,
  Settings,
  ShoppingCart,
  Table2,
  Timer,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { shortIssueId } from "@/lib/format";
import { keyCombo } from "@/lib/platform";
import { FOCUS_PRESETS, useFocusTimer } from "@/lib/focus-timer";
import type { WorkspaceTab } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/** Cmd+K quick jump — projects, issues, views, and top actions in one place. */
export function CommandPalette({
  open,
  onClose,
  onShowShortcuts,
}: {
  open: boolean;
  onClose: () => void;
  onShowShortcuts: () => void;
}) {
  const {
    org,
    project,
    projects,
    orgTodos,
    todos,
    tab,
    setTab,
    setProjectId,
    setViewMode,
    setSelectedTodoId,
    requestCreateIssue,
  } = useWorkspace();
  const focus = useFocusTimer();

  function run(fn: () => void) {
    onClose();
    fn();
  }

  function goTab(t: WorkspaceTab) {
    run(() => setTab(t));
  }

  function openIssue(todoId: string, todoProjectId: string) {
    run(() => {
      if (todoProjectId !== project?.id) setProjectId(todoProjectId);
      setSelectedTodoId(todoId);
      setTab("backlog");
    });
  }

  // Prefer the org-wide cache (covers every project) with a fallback to the
  // current project's list before it has loaded.
  const searchPool = orgTodos.length > 0 ? orgTodos : todos;
  const issueItems = useMemo(() => searchPool.slice(0, 30), [searchPool]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Command Palette"
      description="Jump to a project, issue, view, or action"
    >
      <CommandInput placeholder="Jump to a project, issue, or action…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          {project ? (
            <CommandItem onSelect={() => run(() => requestCreateIssue())}>
              <Plus />
              New issue
              <CommandShortcut>{keyCombo(["mod", "N"])}</CommandShortcut>
            </CommandItem>
          ) : null}
          <CommandItem
            onSelect={() =>
              run(() =>
                focus.running ? focus.stop() : focus.start(FOCUS_PRESETS[0].seconds),
              )
            }
          >
            <Timer />
            {focus.running ? "Stop focus timer" : "Start 25m focus timer"}
          </CommandItem>
          <CommandItem onSelect={() => run(onShowShortcuts)}>
            <ClipboardList />
            Keyboard shortcuts
            <CommandShortcut>{keyCombo(["mod", "/"])}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => goTab("dashboard")}>
            <Home />
            Home
          </CommandItem>
          <CommandItem onSelect={() => goTab("backlog")}>
            <LayoutList />
            Backlog
          </CommandItem>
          <CommandItem onSelect={() => goTab("board")}>
            <LayoutList />
            Board
          </CommandItem>
          <CommandItem onSelect={() => goTab("sprints")}>
            <ClipboardList />
            Sprints
          </CommandItem>
          <CommandItem onSelect={() => goTab("reports")}>
            <ClipboardList />
            Reports
          </CommandItem>
          <CommandItem onSelect={() => goTab("personal")}>
            <ClipboardList />
            My Work
          </CommandItem>
          <CommandItem onSelect={() => goTab("projects")}>
            <FolderKanban />
            All projects
          </CommandItem>
          <CommandItem onSelect={() => goTab("team")}>
            <Users />
            Team
          </CommandItem>
          <CommandItem onSelect={() => goTab("chat")}>
            <MessageCircle />
            Chat
          </CommandItem>
          <CommandItem onSelect={() => goTab("purchases")}>
            <ShoppingCart />
            Purchases
          </CommandItem>
          <CommandItem onSelect={() => goTab("settings")}>
            <Settings />
            Settings
            <CommandShortcut>{keyCombo(["mod", ","])}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {tab === "issues" && project ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="View">
              <CommandItem onSelect={() => run(() => setViewMode("list"))}>
                <Table2 />
                List view
                <CommandShortcut>{keyCombo(["mod", "1"])}</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => setViewMode("board"))}>
                <LayoutGrid />
                Board view
                <CommandShortcut>{keyCombo(["mod", "2"])}</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => setViewMode("timeline"))}>
                <GanttChart />
                Timeline view
                <CommandShortcut>{keyCombo(["mod", "3"])}</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}

        {org && projects.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name}`}
                  onSelect={() =>
                    run(() => {
                      setProjectId(p.id);
                      setTab("issues");
                    })
                  }
                >
                  <FolderKanban />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {issueItems.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Issues">
              {issueItems.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${shortIssueId(t.id)} ${t.title}`}
                  onSelect={() => openIssue(t.id, t.projectId)}
                >
                  <CheckCircle2
                    className={t.status === "DONE" ? "text-muted-foreground" : ""}
                  />
                  <span className="truncate">{t.title}</span>
                  <CommandShortcut className="font-mono">
                    {shortIssueId(t.id)}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
