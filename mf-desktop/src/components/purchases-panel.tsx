"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, Package, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PurchaseStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";
import { WorkspaceSetup } from "@/components/workspace-setup";

const STATUSES: PurchaseStatus[] = ["REQUESTED", "PURCHASED", "CANCELLED"];

export function PurchasesPanel() {
  const {
    project,
    purchases,
    query,
    createPurchase,
    updatePurchaseStatus,
    deletePurchase,
  } = useWorkspace();
  const q = query.trim().toLowerCase();
  const visible = q
    ? purchases.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.productPurpose.toLowerCase().includes(q),
      )
    : purchases;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [link, setLink] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);

  if (!project) {
    return <WorkspaceSetup mode="select-project" />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const name = productName.trim();
    const p = Number(price);
    const qty = Number(quantity);
    if (!name) return;
    if (!(p > 0) || p > 1_000_000) {
      setError("Price must be greater than 0 and at most 1,000,000");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) {
      setError("Quantity must be a whole number from 1 to 1,000,000");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPurchase({
        productName: name,
        price: p,
        quantity: qty,
        productPurpose: purpose.trim() || undefined,
        productLink: link.trim() || undefined,
        currency,
      });
      setProductName("");
      setPrice("0");
      setQuantity("1");
      setPurpose("");
      setLink("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mf-panel-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="mf-panel-title">Purchases</h2>
          <p className="mf-panel-sub">
            Same purchase lines as the mobile project screen
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mf-btn mf-btn-primary w-full shrink-0 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {open ? "Close form" : "Add purchase"}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="space-y-3 border-b border-border/70 bg-card/40 px-5 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mf-label">Product</span>
              <input
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="mf-input"
              />
            </label>
            <label>
              <span className="mf-label">Purpose</span>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mf-input"
              />
            </label>
            <label>
              <span className="mf-label">Price</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setError(null);
                }}
                className="mf-input"
              />
            </label>
            <label>
              <span className="mf-label">Quantity</span>
              <input
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError(null);
                }}
                className="mf-input"
              />
            </label>
            <label>
              <span className="mf-label">Currency</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="mf-input"
              />
            </label>
            <label>
              <span className="mf-label">Product link</span>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://"
                className="mf-input"
              />
            </label>
          </div>
          {error ? (
            <p className="rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mf-btn mf-btn-primary"
          >
            Save purchase
          </button>
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 mf-scroll">
        {visible.length === 0 ? (
          <div className="mf-empty">
            <div className="mf-empty-icon">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="mf-empty-title">
                {purchases.length === 0
                  ? "No purchases yet"
                  : "No purchases match"}
              </p>
              <p className="mf-empty-copy mt-1.5">
                {purchases.length === 0
                  ? "Add a purchase line to track product requests for this project."
                  : "Try a different search."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="mx-auto grid max-w-4xl gap-3">
            {visible.map((p) => (
              <li key={p.id} className="mf-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-tight">
                      {p.productName}
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {p.quantity} × {p.price.toFixed(2)} {p.currency}
                      {p.productPurpose ? ` · ${p.productPurpose}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this purchase?")) {
                        void deletePurchase(p.id);
                      }
                    }}
                    className="mf-btn mf-btn-ghost mf-btn-danger !p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void updatePurchaseStatus(p.id, s)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition",
                          p.status === s
                            ? "bg-accent text-primary"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {p.productLink ? (
                    <a
                      href={p.productLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-primary sm:ml-auto"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open link
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
