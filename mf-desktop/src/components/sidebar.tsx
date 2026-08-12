"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  Home,
  Kanban,
  LayoutList,
  MessageCircle,
  Plus,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MasterfabricMark } from "@/components/masterfabric-mark";
import { cn } from "@/lib/utils";
import { initials, memberLabel } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import type { WorkspaceTab } from "@/lib/types";

function NavItem({
  icon,
  label,
  tab,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tab: WorkspaceTab;
  active: boolean;
  badge?: React.ReactNode;
  onClick: (tab: WorkspaceTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      data-active={active ? "true" : "false"}
      className={cn(
        "mf-nav-item flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition",
        active
          ? "bg-foreground text-background hover:bg-foreground hover:text-background"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center [&_svg]:size-4 [&_svg]:stroke-[1.75]",
          active ? "opacity-100" : "opacity-80",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
    </button>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const {
    orgs,
    projects,
    orgId,
    projectId,
    setOrgId,
    setProjectId,
    createProject,
    createOrganization,
    todos,
    tab,
    setTab,
    setViewMode,
  } = useWorkspace();

  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  // Extra-org form only when an org already exists; first-run create lives in WorkspaceSetup.
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(
    () =>
      tab === "team" ||
      tab === "chat" ||
      tab === "purchases" ||
      tab === "projects",
  );

  const openCount = useMemo(
    () => todos.filter((t) => t.status === "OPEN").length,
    [todos],
  );

  const showOrgCreate = creatingOrg && orgs.length > 0;
  const showProjectCreate =
    creating || (Boolean(orgId) && projects.length === 0);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (
      tab === "team" ||
      tab === "chat" ||
      tab === "purchases" ||
      tab === "projects"
    ) {
      setMoreOpen(true);
    }
  }, [tab]);

  async function onCreateProject() {
    const name = projectName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createProject(name);
      setProjectName("");
      setCreating(false);
      setTab("backlog");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onCreateOrg() {
    const name = orgName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createOrganization(name);
      setOrgName("");
      setCreatingOrg(false);
      onClose();
    } catch {
      // Workspace error banner is set by createOrganization.
    } finally {
      setBusy(false);
    }
  }

  function onNav(t: WorkspaceTab) {
    if (t === "board") setViewMode("board");
    if (t === "backlog") setViewMode("list");
    setTab(t);
    onClose();
  }

  const secondaryActive =
    tab === "team" ||
    tab === "chat" ||
    tab === "purchases" ||
    tab === "projects";

  const nav = (
    <aside
      id="mf-sidebar"
      className={cn(
        "flex h-full w-[min(100vw,248px)] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div className="mf-sidebar-brand">
        <div className="mf-sidebar-brand-mark" aria-hidden>
          <MasterfabricMark title="MasterFabric" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mf-sidebar-brand-name truncate">
            <span>Master</span>
            <span>Fabric</span>
          </p>
          <p className="mf-sidebar-brand-product truncate">Project Tracker</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
        <div className="flex min-w-0 flex-col gap-1 px-2.5 py-3">
          <section className="mb-1.5 flex flex-col gap-1.5 px-0.5">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Organization
              </p>
              {orgs.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setCreatingOrg((v) => !v)}
                  title="Create organization"
                  aria-label="Create organization"
                >
                  <Plus />
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled
                      title="Open Home to create"
                      aria-label="Open Home to create"
                    >
                      <Plus />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Use Home to create your first organization
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {orgs.length > 0 ? (
              <Select
                value={orgId ?? undefined}
                onValueChange={(v) => setOrgId(v || null)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <div
                className="rounded-md border border-dashed border-border bg-muted/30 px-2.5 py-2"
                data-testid="sidebar-no-org"
              >
                <p className="text-[12px] font-medium text-foreground">
                  No organization yet
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Create one from Home to unlock projects.
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto px-0 text-[11px]"
                  onClick={() => onNav("dashboard")}
                >
                  Open setup
                </Button>
              </div>
            )}
            {showOrgCreate ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-2">
                <Input
                  autoFocus
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onCreateOrg();
                    if (e.key === "Escape") {
                      setCreatingOrg(false);
                      setOrgName("");
                    }
                  }}
                  placeholder="Organization name"
                  className="h-8"
                  aria-label="Organization name"
                />
                <Button
                  size="sm"
                  disabled={busy || !orgName.trim()}
                  className="h-7"
                  onClick={() => void onCreateOrg()}
                >
                  Create organization
                </Button>
              </div>
            ) : null}
          </section>

          <Separator className="my-1.5" />

          <p className="mb-1 px-1 text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Work
          </p>
          <NavItem
            icon={<Home className="size-4" />}
            label="Home"
            tab="dashboard"
            active={tab === "dashboard"}
            onClick={onNav}
          />
          <NavItem
            icon={<LayoutList className="size-4" />}
            label="Backlog"
            tab="backlog"
            active={tab === "backlog" || tab === "issues"}
            badge={
              openCount > 0 ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    "tabular-nums text-[10px]",
                    (tab === "backlog" || tab === "issues") &&
                      "border-transparent bg-background/20 text-background hover:bg-background/25",
                  )}
                >
                  {openCount}
                </Badge>
              ) : undefined
            }
            onClick={onNav}
          />
          <NavItem
            icon={<Kanban className="size-4" />}
            label="Board"
            tab="board"
            active={tab === "board"}
            onClick={onNav}
          />
          <NavItem
            icon={<CalendarRange className="size-4" />}
            label="Sprints"
            tab="sprints"
            active={tab === "sprints"}
            onClick={onNav}
          />
          <NavItem
            icon={<BarChart3 className="size-4" />}
            label="Reports"
            tab="reports"
            active={tab === "reports"}
            onClick={onNav}
          />
          <NavItem
            icon={<ClipboardList className="size-4" />}
            label="My Work"
            tab="personal"
            active={tab === "personal"}
            onClick={onNav}
          />

          {orgId ? (
            <>
              <Separator className="my-2" />
              <section className="flex min-w-0 flex-col gap-0.5">
                <div className="flex w-full min-w-0 items-center gap-1 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setProjectsOpen((v) => !v)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    aria-expanded={projectsOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "size-3 shrink-0 text-muted-foreground transition",
                        !projectsOpen && "-rotate-90",
                      )}
                    />
                    <span className="truncate text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Projects
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setCreating((v) => !v)}
                    title="New project"
                    aria-label="New project"
                  >
                    <Plus />
                  </Button>
                </div>

                {projectsOpen && (
                  <>
                    {showProjectCreate && (
                      <div className="mb-1 flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                        <Input
                          autoFocus={projects.length === 0}
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void onCreateProject();
                            if (e.key === "Escape") setCreating(false);
                          }}
                          placeholder="Project name"
                          className="h-8"
                        />
                        <Button
                          size="sm"
                          disabled={busy || !projectName.trim()}
                          className="h-7"
                          onClick={() => void onCreateProject()}
                        >
                          Create project
                        </Button>
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {projects.map((p) => (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setProjectId(p.id);
                                setTab("issues");
                                onClose();
                              }}
                              title={p.name}
                              className={cn(
                                "flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium transition",
                                projectId === p.id && tab === "issues"
                                  ? "bg-accent text-foreground"
                                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  projectId === p.id
                                    ? "bg-foreground"
                                    : "bg-muted-foreground/40",
                                )}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {p.name}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            {p.name}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {projects.length === 0 && !showProjectCreate && (
                        <div className="rounded-md border border-dashed border-border px-2 py-2">
                          <p className="text-[12px] font-medium">No projects</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Use + to create your first project.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            </>
          ) : null}

          <Separator className="my-2" />

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase transition hover:bg-muted/50",
              secondaryActive && "text-foreground",
            )}
            aria-expanded={moreOpen}
          >
            <ChevronDown
              className={cn(
                "size-3 shrink-0 transition",
                !moreOpen && "-rotate-90",
              )}
            />
            More
          </button>
          {moreOpen ? (
            <div className="flex flex-col gap-0.5">
              <NavItem
                icon={<FolderKanban className="size-4" />}
                label="All projects"
                tab="projects"
                active={tab === "projects"}
                onClick={onNav}
              />
              <NavItem
                icon={<Users className="size-4" />}
                label="Team"
                tab="team"
                active={tab === "team"}
                onClick={onNav}
              />
              <NavItem
                icon={<MessageCircle className="size-4" />}
                label="Chat"
                tab="chat"
                active={tab === "chat"}
                onClick={onNav}
              />
              <NavItem
                icon={<ShoppingCart className="size-4" />}
                label="Purchases"
                tab="purchases"
                active={tab === "purchases"}
                onClick={onNav}
              />
              <NavItem
                icon={<Settings className="size-4" />}
                label="Settings"
                tab="settings"
                active={tab === "settings"}
                onClick={onNav}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto shrink-0 border-t border-border p-2.5">
        <button
          type="button"
          onClick={() => onNav("settings")}
          className={cn(
            "flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-lg px-2 py-2 text-left transition",
            tab === "settings" ? "bg-accent" : "hover:bg-muted/70",
          )}
        >
          <Avatar className="shrink-0">
            <AvatarFallback className="text-[10px]">
              {initials(memberLabel(user?.displayName, user?.email, "?"))}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold">
              {memberLabel(user?.displayName, user?.email, "Account")}
            </p>
            <p className="truncate text-[10.5px] text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      {nav}
    </>
  );
}
