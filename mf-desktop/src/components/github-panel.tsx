"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FolderGit2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/password-field";
import {
  type AppGithubIntegration,
  type GithubRepoRef,
  coreAppsIntegrationsUrl,
  fetchAppGithubIntegration,
  openGithubUrl,
  parseGithubRepo,
  readGithubLinkPrefs,
  resolveGithubRepo,
  resolveGithubToken,
  writeGithubLinkPrefs,
} from "@/lib/github";

/**
 * Project-level GitHub repo connection (Settings).
 * Task ↔ PR/issue links live in the issue drawer, not here.
 */
export function GithubRepoSettings({ compact = false }: { compact?: boolean }) {
  const [repoInput, setRepoInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [ref, setRef] = useState<GithubRepoRef | null>(null);
  const [token, setToken] = useState("");
  const [mfGithub, setMfGithub] = useState<AppGithubIntegration>(null);
  const [hydrated, setHydrated] = useState(false);

  const hydrate = useCallback(async () => {
    const prefs = await readGithubLinkPrefs();
    const nextRef = resolveGithubRepo(prefs.githubRepo);
    const nextToken = resolveGithubToken(prefs.githubToken);
    setRef(nextRef);
    setToken(nextToken);
    setRepoInput(prefs.githubRepo?.trim() || nextRef?.slug || "");
    setTokenSaved(Boolean(prefs.githubToken?.trim()));
    setTokenInput("");
    setHydrated(true);
    const ig = await fetchAppGithubIntegration();
    setMfGithub(ig);
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function saveLink() {
    const parsed = parseGithubRepo(repoInput);
    if (!parsed) {
      toast.error("Use owner/repo or a github.com URL");
      return;
    }
    const prefs = await readGithubLinkPrefs();
    const nextToken = tokenInput.trim();
    if (nextToken) {
      await writeGithubLinkPrefs({
        githubRepo: parsed.slug,
        githubToken: nextToken,
      });
    } else if (tokenSaved || prefs.githubToken) {
      await writeGithubLinkPrefs({ githubRepo: parsed.slug });
    } else {
      await writeGithubLinkPrefs({
        githubRepo: parsed.slug,
        clearToken: true,
      });
    }
    toast.success(`Linked ${parsed.slug}`);
    await hydrate();
  }

  async function clearLink() {
    await writeGithubLinkPrefs({ githubRepo: "", clearToken: true });
    toast.success("GitHub link cleared");
    await hydrate();
  }

  if (!hydrated) {
    return (
      <p className="text-[13px] text-muted-foreground">Loading GitHub…</p>
    );
  }

  return (
    <div
      className={compact ? "space-y-3" : "space-y-4"}
      data-testid="github-repo-settings"
    >
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">MF app OAuth (sign-in):</span>
          {mfGithub ? (
            <Badge variant="secondary" className="rounded-md font-medium">
              GitHub enabled · client {mfGithub.clientId.slice(0, 8)}…
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-md font-medium">
              Not configured in Core Apps
            </Badge>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => openGithubUrl(coreAppsIntegrationsUrl())}
          >
            Open Core Apps
            <ExternalLink className="size-3" />
          </button>
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Default <span className="font-mono">owner/repo</span> for task links
        (issue drawer: paste PR/issue URL or <span className="font-mono">#123</span>
        ). Optional PAT for private repos. Links are stored on this desktop —
        the Project Tracker API has no per-task GitHub field yet.
      </p>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void saveLink();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gh-repo">Repository</Label>
            <Input
              id="gh-repo"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo"
              className="h-9"
              autoComplete="off"
              data-testid="github-repo-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-token">
              Personal access token{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <PasswordField
              id="gh-token"
              value={tokenInput}
              onChange={setTokenInput}
              placeholder={
                tokenSaved || token
                  ? "•••••••• (leave blank to keep)"
                  : "ghp_… or github_pat_…"
              }
              groupClassName="h-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            <Link2 className="mr-1.5 size-3.5" />
            Save repository
          </Button>
          {ref ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openGithubUrl(`https://github.com/${ref.slug}`)}
              >
                <FolderGit2 className="mr-1.5 size-3.5" />
                Open repo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void clearLink()}
              >
                Disconnect
              </Button>
            </>
          ) : null}
        </div>
      </form>

      {ref ? (
        <p className="text-[12px] text-muted-foreground">
          Linked:{" "}
          <span className="font-mono font-medium text-foreground">
            {ref.slug}
          </span>
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          No default repository — full github.com URLs still work on tasks.
        </p>
      )}
    </div>
  );
}

/** @deprecated Prefer Settings → GitHub; kept for any lingering tab route. */
export function GithubPanel() {
  return (
    <div className="flex h-full flex-col" data-testid="github-panel">
      <div className="mf-panel-header">
        <h2 className="mf-panel-title flex items-center gap-2">
          <FolderGit2 className="size-4 shrink-0" />
          GitHub
        </h2>
        <p className="mf-panel-sub">
          Repository connection for linking PRs and issues inside tasks
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 mf-scroll">
        <GithubRepoSettings />
      </div>
    </div>
  );
}
