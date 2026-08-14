import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { GithubRepoSettings } from "@/components/github-panel";
import { initials, memberLabel } from "@/lib/format";
import { keyCombo } from "@/lib/platform";
import { graphqlUrl, setGraphqlUrl } from "mf-tracker-client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import {
  FOCUS_PRESETS,
  formatFocusRemaining,
  useFocusTimer,
} from "@/lib/focus-timer";

export function SettingsPanel() {
  const { user, logout } = useAuth();
  const { org } = useWorkspace();
  const navigate = useNavigate();
  const focus = useFocusTimer();
  const [graphqlOverride, setGraphqlOverride] = useState("");
  const [hideToTray, setHideToTray] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const prefs = await window.mfDesktop?.prefs.get();
      if (prefs?.graphqlUrl) setGraphqlOverride(prefs.graphqlUrl);
      if (prefs?.hideToTray !== undefined) setHideToTray(prefs.hideToTray);
      if (prefs?.notificationsEnabled !== undefined) {
        setNotificationsEnabled(prefs.notificationsEnabled);
      }
    })();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mf-panel-header">
        <h2 className="mf-panel-title">Settings</h2>
        <p className="mf-panel-sub">Desktop preferences &amp; account</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 mf-scroll">
        <section className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Account
          </p>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow)]">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">
                {initials(memberLabel(user?.displayName, user?.email, "?"))}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">
                {memberLabel(user?.displayName, user?.email, "Account")}
              </p>
              <p className="truncate text-[13px] text-muted-foreground">
                {user?.email}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Role: {user?.role || "—"}
              </p>
            </div>
          </div>
        </section>

        {org && (
          <section className="mb-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Organization
            </p>
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow)]">
              <p className="text-[14px] font-semibold">{org.name}</p>
              {org.description && (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {org.description}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Desktop
          </p>
          <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow)]">
            <div className="space-y-2">
              <Label htmlFor="gql">GraphQL URL</Label>
              <Input
                id="gql"
                value={graphqlOverride}
                placeholder={graphqlUrl()}
                onChange={(e) => setGraphqlOverride(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const url = graphqlOverride.trim();
                  await window.mfDesktop?.prefs.set({
                    graphqlUrl: url || undefined,
                  });
                  if (url) setGraphqlUrl(url);
                  else setGraphqlUrl(import.meta.env.VITE_GRAPHQL_URL || graphqlUrl());
                }}
              >
                Save URL
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Active: {graphqlUrl()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Leave blank to use <code className="font-mono">VITE_GRAPHQL_URL</code>{" "}
                from <code className="font-mono">npm run env:sync</code> (usually{" "}
                <code className="font-mono">http://127.0.0.1:8080/graphql</code>).
                After changing repo <code className="font-mono">local.env</code>, sync
                env and restart <code className="font-mono">npm run dev</code>. Stale
                sessions after a DB reset: sign out and sign in again.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={async () => {
                  setGraphqlOverride("");
                  await window.mfDesktop?.prefs.set({ graphqlUrl: undefined });
                  setGraphqlUrl(
                    import.meta.env.VITE_GRAPHQL_URL?.trim() ||
                      "http://127.0.0.1:8080/graphql",
                  );
                  toast.success("GraphQL URL reset to env default");
                }}
              >
                Reset to env default
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium">Hide to tray on close</p>
                <p className="text-[11px] text-muted-foreground">
                  Quit from the tray menu instead
                </p>
              </div>
              <Switch
                checked={hideToTray}
                onCheckedChange={(v) => {
                  setHideToTray(v);
                  void window.mfDesktop?.prefs.set({ hideToTray: v });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium">Desktop notifications</p>
                <p className="text-[11px] text-muted-foreground">
                  Native alerts for issues due soon or newly assigned to you
                </p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(v) => {
                  setNotificationsEnabled(v);
                  void window.mfDesktop?.prefs.set({ notificationsEnabled: v });
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void window.mfDesktop?.showDashboard()}
              >
                <LayoutDashboard className="mr-1.5 size-3.5" />
                Pin dashboard
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void window.mfDesktop?.openExternal("masterfabricexpo://")
                }
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                Open mobile
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r = await window.mfDesktop?.checkForUpdates();
                  if (!r) return;
                  setUpdateMsg(
                    r.ok
                      ? "Checked for updates"
                      : `Updates: ${r.reason ?? "unavailable"}`,
                  );
                }}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Check updates
              </Button>
            </div>
            {updateMsg ? (
              <p className="text-[11px] text-muted-foreground">{updateMsg}</p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              Tip: <span className="font-mono">{keyCombo(["mod", "K"])}</span>{" "}
              opens the command palette from anywhere in the app;{" "}
              <span className="font-mono">{keyCombo(["mod", "shift"])} Space</span>{" "}
              shows or hides this window from any app.
            </p>
          </div>
        </section>

        <section className="mb-6">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <FolderGit2 className="size-3.5" />
            GitHub
          </p>
          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow)]">
            <GithubRepoSettings compact />
          </div>
        </section>

        <section className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Focus timer
          </p>
          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow)]">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
              <Timer className="size-4" />
              {focus.running
                ? formatFocusRemaining(focus.remainingMs)
                : "Not running"}
            </div>
            <div className="flex flex-wrap gap-2">
              {FOCUS_PRESETS.map((p) => (
                <Button
                  key={p.seconds}
                  size="sm"
                  variant="secondary"
                  onClick={() => focus.start(p.seconds)}
                >
                  {p.label}
                </Button>
              ))}
              {focus.running ? (
                <Button size="sm" variant="outline" onClick={() => focus.stop()}>
                  Stop
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <Separator className="my-6" />

        <Button
          variant="outline"
          className="w-full justify-start rounded-xl"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
