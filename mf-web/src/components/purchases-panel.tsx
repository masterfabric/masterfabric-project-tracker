"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PurchaseStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

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
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-[var(--text-muted)]">
        Select a project to manage purchases.
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const name = productName.trim();
    const p = Number(price);
    const q = Number(quantity);
    if (!name) return;
    if (!(p > 0) || p > 1_000_000) {
      setError("Price must be greater than 0 and at most 1,000,000");
      return;
    }
    if (!Number.isInteger(q) || q < 1 || q > 1_000_000) {
      setError("Quantity must be a whole number from 1 to 1,000,000");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPurchase({
        productName: name,
        price: p,
        quantity: q,
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
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2
            className="text-[15px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Purchases
          </h2>
          <p className="text-[12px] text-[var(--text-faint)]">
            Same purchase lines as the mobile project screen
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add purchase
        </button>
      </div>

      {open ? (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="space-y-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-faint)]">Product</span>
              <input
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-faint)]">Purpose</span>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-faint)]">Price</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-faint)]">Quantity</span>
              <input
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-faint)]">Currency</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-[var(--text-faint)]">Product link</span>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
          {error ? (
            <p className="text-[12px] text-[var(--danger)]">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-60"
          >
            Save purchase
          </button>
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 mf-scroll">
        {visible.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-[var(--text-faint)]">
            {purchases.length === 0 ? "No purchases yet." : "No purchases match."}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">
                      {p.productName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
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
                    className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[rgba(248,113,113,0.12)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void updatePurchaseStatus(p.id, s)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                        p.status === s
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-[var(--bg)] text-[var(--text-faint)] hover:text-[var(--text)]",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                  {p.productLink ? (
                    <a
                      href={p.productLink}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-[12px] text-[var(--accent)]"
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
