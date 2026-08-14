"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  GitPullRequest,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type TodoGithubLink,
  getTodoGithubLinks,
  githubStatusBadgeClass,
  openGithubUrl,
  readGithubLinkPrefs,
  refreshTodoGithubLink,
  removeTodoGithubLink,
  resolveAndFetchGithubLink,
  resolveGithubRepo,
  resolveGithubToken,
  setTodoGithubLinks,
  upsertTodoGithubLink,
} from "@/lib/github";

export function IssueGithubSection({
  orgId,
  projectId,
  todoId,
}: {
  orgId: string;
  projectId: string;
  todoId: string;
}) {
  const [links, setLinks] = useState<TodoGithubLink[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repoSlug, setRepoSlug] = useState<string | null>(null);
  const [token, setToken] = useState("");

  const hydrate = useCallback(async () => {
    setLinks(getTodoGithubLinks(orgId, projectId, todoId));
    const prefs = await readGithubLinkPrefs();
    const ref = resolveGithubRepo(prefs.githubRepo);
    setRepoSlug(ref?.slug ?? null);
    setToken(resolveGithubToken(prefs.githubToken));
  }, [orgId, projectId, todoId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function onLink(e: FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    setBusy(true);
    try {
      const prefs = await readGithubLinkPrefs();
      const ref = resolveGithubRepo(prefs.githubRepo);
      const tok = resolveGithubToken(prefs.githubToken);
      const link = await resolveAndFetchGithubLink(raw, ref, tok);
      const next = upsertTodoGithubLink(orgId, projectId, todoId, link);
      setLinks(next);
      setInput("");
      toast.success(
        `Linked ${link.kind === "pr" ? "PR" : "issue"} #${link.number}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link GitHub");
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    if (links.length === 0) return;
    setRefreshing(true);
    try {
      const prefs = await readGithubLinkPrefs();
      const tok = resolveGithubToken(prefs.githubToken);
      const next: TodoGithubLink[] = [];
      for (const link of links) {
        try {
          next.push(await refreshTodoGithubLink(link, tok));
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `#${link.number}: ${err.message}`
              : `Failed to refresh #${link.number}`,
          );
          next.push(link);
        }
      }
      setTodoGithubLinks(orgId, projectId, todoId, next);
      setLinks(next);
      toast.success("GitHub status refreshed");
    } finally {
      setRefreshing(false);
    }
  }

  function onRemove(linkId: string) {
    const next = removeTodoGithubLink(orgId, projectId, todoId, linkId);
    setLinks(next);
    toast.success("GitHub link removed");
  }

  return (
    <section className="flex flex-col gap-3" data-testid="issue-github-section">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            GitHub
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Link a PR or issue to this task
            {repoSlug ? (
              <>
                {" "}
                · default{" "}
                <span className="font-mono text-foreground/80">{repoSlug}</span>
              </>
            ) : (
              <> · set default repo in Settings</>
            )}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            Stored on this desktop only (API has no task external-link field
            yet).
          </p>
        </div>
        {links.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={refreshing}
            aria-label="Refresh GitHub status"
            onClick={() => void onRefresh()}
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
            />
          </Button>
        ) : null}
      </div>

      {links.length > 0 ? (
        <ul className="space-y-1.5" data-testid="issue-github-links">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2"
            >
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 shrink-0 rounded-md capitalize",
                  githubStatusBadgeClass(link.status),
                )}
                data-testid="issue-github-status"
              >
                {link.status}
              </Badge>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => openGithubUrl(link.htmlUrl)}
              >
                <p className="flex items-center gap-1 truncate text-[13px] font-medium">
                  <GitPullRequest className="size-3 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {link.kind === "pr" ? "PR" : "Issue"} #{link.number}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[12px] text-foreground">
                  {link.title || `${link.owner}/${link.repo}`}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {link.owner}/{link.repo}
                </p>
              </button>
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Open on GitHub"
                  onClick={() => openGithubUrl(link.htmlUrl)}
                >
                  <ExternalLink className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove GitHub link"
                  onClick={() => onRemove(link.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[12.5px] text-muted-foreground">
          No GitHub links yet. Paste a PR URL, issue URL, or{" "}
          <span className="font-mono">#123</span>.
        </p>
      )}

      <form
        onSubmit={(e) => void onLink(e)}
        className="flex gap-2"
        data-testid="issue-github-link-form"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="PR URL, issue URL, or #123"
          className="flex-1"
          disabled={busy}
          data-testid="issue-github-link-input"
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="outline"
          size="icon"
          disabled={busy || !input.trim()}
          aria-label="Link GitHub"
          data-testid="issue-github-link-submit"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2 className="size-4" />
          )}
        </Button>
      </form>
    </section>
  );
}
