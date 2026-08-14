/** Detects macOS so shortcut hints render ⌘⇧⌥ instead of Ctrl/Shift/Alt text. */
export const isMac: boolean =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || "");

const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
};

const OTHER_LABELS: Record<string, string> = {
  mod: "Ctrl",
  shift: "Shift",
  alt: "Alt",
};

/**
 * Renders a keyboard combo for display — `keyCombo(["mod", "shift", "F"])`
 * becomes `⌘⇧F` on macOS or `Ctrl+Shift+F` elsewhere.
 */
export function keyCombo(parts: string[]): string {
  if (isMac) return parts.map((p) => MAC_SYMBOLS[p] ?? p).join("");
  return parts.map((p) => OTHER_LABELS[p] ?? p).join("+");
}
