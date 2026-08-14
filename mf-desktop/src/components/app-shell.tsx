"use client";

import { useEffect, useRef, useState } from "react";
import {
  Command as CommandIcon,
  Filter,
  GanttChart,
  LayoutGrid,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Table2,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { ChatPanel } from "@/components/chat-panel";
import { CommandPalette } from "@/components/command-palette";
import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { DashboardPanel } from "@/components/dashboard-panel";
import { IssueBoard } from "@/components/issue-board";
import { IssueDrawer } from "@/components/issue-drawer";
import { IssueList } from "@/components/issue-list";
import { IssueTimeline } from "@/components/issue-timeline";
import { PersonalTodosPanel } from "@/components/personal-todos-panel";
import { ProjectsPanel } from "@/components/projects-panel";
import { PurchasesPanel } from "@/components/purchases-panel";
import { ReportsPanel } from "@/components/reports-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { Sidebar } from "@/components/sidebar";
import { SprintsPanel } from "@/components/sprints-panel";
import { TeamPanel } from "@/components/team-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { useDesktopNotifications } from "@/lib/desktop-notifications";
import { FOCUS_PRESETS, useFocusTimer } from "@/lib/focus-timer";
import { initials, memberLabel } from "@/lib/format";
import { isUnreachableApiMessage } from "@/lib/operator-errors";
import { keyCombo } from "@/lib/platform";
import type { AssigneeFilter } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

export function AppShell() {
  const { user } = useAuth();
  const {
    org,
    project,
    tab,
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    members,
    query,
    setQuery,
    todos,
    orgTodos,
    personalTodos,
    selectedTodoId,
    setSelectedTodoId,
    setSelectedPersonalId,
    setProjectId,
    createTodo,
    refreshTodos,
    refreshPurchases,
    refreshPersonal,
    refreshChat,
    loading,
    error,
    clearError,
    refreshOrgs,
    filteredTodos,
    setTab,
    createIssueSignal,
  } = useWorkspace();
  const focus = useFocusTimer();

  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useDesktopNotifications(user, orgTodos, personalTodos);

  const handledCreateSignal = useRef(0);
  useEffect(() => {
    // Only open on a *new* signal — do not re-open when `project` changes
    // (e.g. opening an issue from Dashboard switches project and used to
    // resurrect the create dialog because createIssueSignal stayed > 0).
    if (
      createIssueSignal > 0 &&
      createIssueSignal !== handledCreateSignal.current &&
      project
    ) {
      handledCreateSignal.current = createIssueSignal;
      setCreateOpen(true);
    }
  }, [createIssueSignal, project]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (createOpen) {
          setCreateOpen(false);
          return;
        }
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (filtersOpen) {
          setFiltersOpen(false);
          return;
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
          return;
        }
        if (selectedTodoId) {
          setSelectedTodoId(null);
          return;
        }
        setSelectedPersonalId(null);
      }

      if (typing) return;

      if (
        (e.key === "c" || e.key === "C") &&
        (tab === "issues" || tab === "backlog" || tab === "board")
      ) {
        e.preventDefault();
        if (project) setCreateOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "1" && tab === "issues") {
        setViewMode("list");
      } else if (e.key === "2" && tab === "issues") {
        setViewMode("board");
      } else if (e.key === "3" && tab === "issues") {
        setViewMode("timeline");
      } else if (e.key === "?") {
        setHelpOpen((v) => !v);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    createOpen,
    filtersOpen,
    helpOpen,
    paletteOpen,
    project,
    selectedTodoId,
    setSelectedTodoId,
    setSelectedPersonalId,
    setViewMode,
    sidebarOpen,
    tab,
  ]);

  // Native app menu (File/Edit/View/Window/Help) hands off Cmd+N, Cmd+K,
  // Cmd+, Cmd+1/2/3, and the focus-timer toggle here — the single source of
  // truth for those combos (no duplicate renderer-level listener, so a menu
  // accelerator can never double-fire an action).
  useEffect(() => {
    const off = window.mfDesktop?.menu.onAction((action) => {
      switch (action) {
        case "new-issue":
          if (project) setCreateOpen(true);
          break;
        case "command-palette":
          setPaletteOpen(true);
          break;
        case "settings":
          setTab("settings");
          break;
        case "shortcuts-help":
          setHelpOpen(true);
          break;
        case "toggle-focus-timer":
          if (focus.running) focus.stop();
          else focus.start(FOCUS_PRESETS[0].seconds);
          break;
        case "view-list":
          if (showIssueChrome) setViewMode("list");
          break;
        case "view-board":
          if (showIssueChrome) setViewMode("board");
          break;
        case "view-timeline":
          if (showIssueChrome) setViewMode("timeline");
          break;
        default:
          break;
      }
    });
    return () => off?.();
  }, [project, tab, setTab, setViewMode, focus]);

  // Native notification click — refocus the right issue / personal todo.
  useEffect(() => {
    const off = window.mfDesktop?.notifications.onClick((id) => {
      if (id.startsWith("p:")) {
        setSelectedPersonalId(id.slice("p:".length));
        setTab("personal");
        return;
      }
      const cleanId = id.startsWith("assigned:") ? id.slice("assigned:".length) : id;
      const todo =
        orgTodos.find((t) => t.id === cleanId) ?? todos.find((t) => t.id === cleanId);
      if (todo) {
        if (todo.projectId !== project?.id) setProjectId(todo.projectId);
        setSelectedTodoId(todo.id);
      }
      setTab("issues");
    });
    return () => off?.();
  }, [
    orgTodos,
    todos,
    project?.id,
    setProjectId,
    setSelectedTodoId,
    setSelectedPersonalId,
    setTab,
  ]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [tab]);

  const hasSearch =
    tab === "issues" ||
    tab === "backlog" ||
    tab === "board" ||
    tab === "purchases" ||
    tab === "personal";

  function refresh() {
    if (tab === "purchases") void refreshPurchases();
    else if (tab === "personal") void refreshPersonal();
    else if (tab === "chat") void refreshChat();
    else if (tab === "sprints" || tab === "reports") {
      void refreshTodos();
    } else void refreshTodos();
  }

  const tabLabel =
    tab === "dashboard"
      ? "Home"
      : tab === "backlog"
        ? "Backlog"
        : tab === "board"
          ? "Board"
          : tab === "sprints"
            ? "Sprints"
            : tab === "reports"
              ? "Reports"
              : tab === "projects"
                ? "Projects"
                : tab === "personal"
                  ? "My Work"
                  : tab === "purchases"
                    ? "Purchases"
                    : tab === "team"
                      ? "Team"
                      : tab === "chat"
                        ? "Chat"
                        : tab === "integrations"
                          ? "Integrations"
                          : tab === "settings"
                            ? "Settings"
                            : "Issues";

  const title =
    (tab === "issues" ||
      tab === "backlog" ||
      tab === "board" ||
      tab === "sprints" ||
      tab === "reports") &&
    project
      ? project.name
      : tabLabel;

  const assigneeOptions: { value: AssigneeFilter; label: string }[] = [
    { value: "all", label: "All assignees" },
    { value: "me", label: "Assigned to me" },
    { value: "unassigned", label: "Unassigned" },
    ...members.map((m) => ({
      value: `member:${m.userId}` as AssigneeFilter,
      label: memberLabel(m.userNickname),
    })),
  ];

  const showIssueChrome =
    tab === "issues" || tab === "backlog" || tab === "board";
  const showStatusChrome = showIssueChrome || tab === "personal";
  const padless = tab === "chat";
  const showToolbarRow = showIssueChrome || showStatusChrome || hasSearch;
  const showNewIssue = showIssueChrome && Boolean(project);
  const showRefresh =
    tab === "issues" ||
    tab === "backlog" ||
    tab === "board" ||
    tab === "sprints" ||
    tab === "reports" ||
    tab === "purchases" ||
    tab === "personal" ||
    tab === "chat" ||
    tab === "dashboard";

  const showProjectCrumb =
    Boolean(project) &&
    (tab === "issues" ||
      tab === "backlog" ||
      tab === "board" ||
      tab === "sprints" ||
      tab === "reports" ||
      tab === "purchases" ||
      tab === "dashboard" ||
      tab === "projects");

  function openCreate() {
    if (project) setCreateOpen(true);
  }

  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <header className="z-10 border-b border-border bg-card">
            {/* Primary row — never overflows: title + primary actions only */}
            <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                aria-controls="mf-sidebar"
                aria-expanded={sidebarOpen}
              >
                <Menu />
              </Button>

              <div className="min-w-0 flex-1">
                <Breadcrumb className="hidden min-w-0 sm:block">
                  <BreadcrumbList className="gap-1 font-mono text-[10px] tracking-wide">
                    <BreadcrumbItem>
                      <span className="max-w-[8rem] truncate text-muted-foreground">
                        {org?.name ?? "org"}
                      </span>
                    </BreadcrumbItem>
                    {showProjectCrumb ? (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <span className="max-w-[8rem] truncate text-muted-foreground">
                            {project?.name}
                          </span>
                        </BreadcrumbItem>
                      </>
                    ) : null}
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="max-w-[10rem] truncate font-medium text-foreground">
                        {tabLabel}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate font-heading text-[14px] font-semibold tracking-tight sm:text-[15px]">
                    {title}
                  </h1>
                  {showIssueChrome && project ? (
                    <Badge
                      variant="secondary"
                      className="rounded-sm font-mono text-[10px] tabular-nums"
                    >
                      {filteredTodos.length}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="hidden sm:inline-flex"
                      onClick={() => setPaletteOpen(true)}
                      aria-label="Command palette"
                    >
                      <CommandIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Command palette <Kbd className="ml-1">{keyCombo(["mod", "K"])}</Kbd>
                  </TooltipContent>
                </Tooltip>

                {showRefresh ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="hidden sm:inline-flex"
                        onClick={refresh}
                        aria-label="Refresh"
                      >
                        <RefreshCw className={cn(loading && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                ) : null}

                {/* Mobile: filters / views overflow */}
                {(showIssueChrome || showStatusChrome || hasSearch) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="md:hidden"
                    onClick={() => setFiltersOpen(true)}
                    aria-label="Filters and views"
                  >
                    <Filter />
                  </Button>
                )}

                {showNewIssue ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={openCreate}
                    aria-label="New issue"
                  >
                    <Plus data-icon="inline-start" />
                    <span className="hidden sm:inline">New issue</span>
                    <Kbd className="ml-1 hidden h-4 min-w-4 px-1 font-mono text-[11px] xl:inline-flex">
                      C
                    </Kbd>
                  </Button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  className="ml-0.5 hidden size-7 items-center justify-center rounded-md border border-border bg-card transition hover:bg-muted/50 md:flex"
                  aria-label="Account settings"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[11px]">
                      {initials(
                        memberLabel(user?.displayName, user?.email, "?"),
                      )}
                    </AvatarFallback>
                  </Avatar>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="md:hidden"
                      aria-label="More actions"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {showRefresh ? (
                        <DropdownMenuItem onClick={refresh}>
                          <RefreshCw />
                          Refresh
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => setTab("settings")}>
                        Account
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTab("chat")}>
                        Chat
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Secondary toolbar — tablet/desktop only; wraps cleanly */}
            {showToolbarRow ? (
              <div className="hidden h-9 items-center gap-1.5 border-t border-border bg-slate-50/40 px-3 md:flex sm:px-4">
                {hasSearch ? (
                  <div className="relative min-w-0 flex-1 max-w-[14rem]">
                    <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        tab === "purchases"
                          ? "Search purchases…"
                          : tab === "personal"
                            ? "Search todos…"
                            : "Search issues…"
                      }
                      className="h-7 bg-white pl-7 pr-8 text-[12px]"
                    />
                    <Kbd className="pointer-events-none absolute top-1/2 right-1.5 hidden h-4 min-w-4 -translate-y-1/2 px-1 font-mono text-[11px] sm:inline-flex">
                      /
                    </Kbd>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1" />
                )}

                {showStatusChrome ? (
                  <ToggleGroup
                    type="single"
                    value={statusFilter}
                    onValueChange={(v) => {
                      if (v) setStatusFilter(v as typeof statusFilter);
                    }}
                    variant="outline"
                    size="sm"
                    className="hidden h-7 lg:flex"
                  >
                    <ToggleGroupItem value="all" className="h-7 px-2 text-[11.5px]">
                      All
                    </ToggleGroupItem>
                    <ToggleGroupItem value="OPEN" className="h-7 px-2 text-[11.5px]">
                      Open
                    </ToggleGroupItem>
                    <ToggleGroupItem value="DONE" className="h-7 px-2 text-[11.5px]">
                      Done
                    </ToggleGroupItem>
                  </ToggleGroup>
                ) : null}

                {/* Tablet: status behind dropdown */}
                {showStatusChrome ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="lg:hidden"
                      >
                        <Filter data-icon="inline-start" />
                        {statusFilter === "all"
                          ? "All"
                          : statusFilter === "OPEN"
                            ? "Open"
                            : "Done"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup
                        value={statusFilter}
                        onValueChange={(v) =>
                          setStatusFilter(v as typeof statusFilter)
                        }
                      >
                        <DropdownMenuRadioItem value="all">
                          All
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="OPEN">
                          Open
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="DONE">
                          Done
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {showIssueChrome ? (
                  <Select
                    value={assigneeFilter}
                    onValueChange={(v) =>
                      setAssigneeFilter(v as AssigneeFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="h-7 w-[8.75rem] text-[11.5px]">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {assigneeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : null}

                {showIssueChrome ? (
                  <>
                    <Separator orientation="vertical" className="mx-0.5 h-5" />
                    <ToggleGroup
                      type="single"
                      value={viewMode}
                      onValueChange={(v) => {
                        if (
                          v === "list" ||
                          v === "board" ||
                          v === "timeline"
                        ) {
                          setViewMode(v);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="h-7"
                    >
                      <ToggleGroupItem
                        value="list"
                        aria-label="List view"
                        className="h-7 gap-1 px-1.5 text-[11.5px]"
                      >
                        <Table2 />
                        <span className="hidden xl:inline">List</span>
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="board"
                        aria-label="Board view"
                        className="h-7 gap-1 px-1.5 text-[11.5px]"
                      >
                        <LayoutGrid />
                        <span className="hidden xl:inline">Board</span>
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="timeline"
                        aria-label="Timeline view"
                        className="h-7 gap-1 px-1.5 text-[11.5px]"
                      >
                        <GanttChart />
                        <span className="hidden xl:inline">Timeline</span>
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </>
                ) : null}
              </div>
            ) : null}
          </header>

          {/* Mobile filters sheet */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side="bottom" className="gap-4 rounded-t-xl">
              <SheetHeader>
                <SheetTitle>Filters & views</SheetTitle>
              </SheetHeader>
              {hasSearch ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="h-9 bg-muted/40 pl-8"
                  />
                </div>
              ) : null}
              {showStatusChrome ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Status
                  </p>
                  <ToggleGroup
                    type="single"
                    value={statusFilter}
                    onValueChange={(v) => {
                      if (v) setStatusFilter(v as typeof statusFilter);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <ToggleGroupItem value="all" className="flex-1">
                      All
                    </ToggleGroupItem>
                    <ToggleGroupItem value="OPEN" className="flex-1">
                      Open
                    </ToggleGroupItem>
                    <ToggleGroupItem value="DONE" className="flex-1">
                      Done
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : null}
              {showIssueChrome ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Assignee
                  </p>
                  <Select
                    value={assigneeFilter}
                    onValueChange={(v) =>
                      setAssigneeFilter(v as AssigneeFilter)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {assigneeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {showIssueChrome ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    View
                  </p>
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(v) => {
                      if (
                        v === "list" ||
                        v === "board" ||
                        v === "timeline"
                      ) {
                        setViewMode(v);
                        setFiltersOpen(false);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <ToggleGroupItem value="list" className="flex-1 gap-1">
                      <Table2 />
                      List
                    </ToggleGroupItem>
                    <ToggleGroupItem value="board" className="flex-1 gap-1">
                      <LayoutGrid />
                      Board
                    </ToggleGroupItem>
                    <ToggleGroupItem value="timeline" className="flex-1 gap-1">
                      <GanttChart />
                      Timeline
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ) : null}
            </SheetContent>
          </Sheet>

          {error ? (
            <Alert
              variant="destructive"
              className="rounded-none border-x-0 border-t-0"
              data-testid="workspace-error-banner"
            >
              <AlertDescription className="flex items-start gap-3">
                <p className="min-w-0 flex-1 break-words leading-relaxed">
                  {error}
                </p>
                {isUnreachableApiMessage(error) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0"
                    onClick={() => {
                      clearError();
                      void refreshOrgs();
                    }}
                  >
                    <RefreshCw data-icon="inline-start" />
                    Retry
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={clearError}
                  aria-label="Dismiss error"
                >
                  <X />
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
            <div
              key={tab}
              className={cn(
                "mf-panel-swap h-full overflow-hidden bg-card",
                padless ? "" : "border-0",
              )}
            >
              {tab === "dashboard" ? (
                <DashboardPanel />
              ) : tab === "projects" ? (
                <ProjectsPanel />
              ) : tab === "purchases" ? (
                <PurchasesPanel />
              ) : tab === "personal" ? (
                <PersonalTodosPanel />
              ) : tab === "team" ? (
                <TeamPanel />
              ) : tab === "chat" ? (
                <ChatPanel />
              ) : tab === "sprints" ? (
                <SprintsPanel />
              ) : tab === "reports" ? (
                <ReportsPanel />
              ) : tab === "settings" || tab === "integrations" ? (
                <SettingsPanel />
              ) : tab === "board" ? (
                <>
                  <IssueBoard />
                  <IssueDrawer />
                </>
              ) : tab === "backlog" ? (
                <>
                  <IssueList />
                  <IssueDrawer />
                </>
              ) : (
                <>
                  {viewMode === "list" ? (
                    <IssueList />
                  ) : viewMode === "timeline" ? (
                    <IssueTimeline />
                  ) : (
                    <IssueBoard />
                  )}
                  <IssueDrawer />
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <CreateIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members}
        onCreate={async (input) => {
          await createTodo(input);
        }}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onShowShortcuts={() => setHelpOpen(true)}
      />
    </AuthGate>
  );
}
