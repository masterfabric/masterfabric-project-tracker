/**
 * Lightweight scene / transition helpers for the dev CLI (no extra deps).
 * Skips motion on non-TTY, CI, or MF_CLI_NO_ANIM=1.
 */

/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ESC = {
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  clearScreen: "\x1b[2J\x1b[H",
  clearLine: "\x1b[2K\r",
};

export function shouldAnimate() {
  return Boolean(process.stdout.isTTY) && !process.env.CI && !process.env.MF_CLI_NO_ANIM;
}

export async function withHiddenCursor(fn) {
  if (!shouldAnimate()) return fn();
  process.stdout.write(ESC.hideCursor);
  try {
    return await fn();
  } finally {
    process.stdout.write(ESC.showCursor);
  }
}

/** Full clear + home — use sparingly between major scenes. */
export function clearFrame() {
  if (shouldAnimate()) process.stdout.write(ESC.clearScreen);
  else console.log();
}

/**
 * Typewriter line (single line, no newline until end).
 * @param {string} text
 * @param {(s: string) => string} style
 * @param {{ msPerChar?: number, caret?: boolean }} opts
 */
export async function typeLine(text, style, opts = {}) {
  const { msPerChar = 22, caret = true } = opts;
  if (!shouldAnimate()) {
    console.log(style(text));
    return;
  }
  let acc = "";
  for (const ch of text) {
    acc += ch;
    process.stdout.write(ESC.clearLine + style(acc) + (caret ? "\x1b[90m▍\x1b[0m" : ""));
    await sleep(msPerChar);
  }
  process.stdout.write("\n");
}

/**
 * Staggered multi-line block.
 * @param {string[]} lines
 * @param {(s: string) => string} style
 * @param {{ delayMs?: number }} opts
 */
export async function revealLines(lines, style, opts = {}) {
  const { delayMs = 18 } = opts;
  if (!shouldAnimate()) {
    for (const line of lines) console.log(style(line));
    return;
  }
  for (const line of lines) {
    console.log(style(line));
    await sleep(delayMs);
  }
}

/** Horizontal rule that “draws” left → right. */
export async function sweepRule(chalk, colorFn = (s) => s) {
  const cols = Math.min(process.stdout.columns || 72, 72);
  const width = Math.max(24, cols - 6);
  if (!shouldAnimate()) {
    console.log(colorFn(chalk.dim("─".repeat(width))));
    return;
  }
  let acc = "";
  const step = Math.max(1, Math.floor(width / 14));
  for (let i = 0; i < width; i += step) {
    acc += "─".repeat(Math.min(step, width - acc.length));
    process.stdout.write(ESC.clearLine + colorFn(chalk.dim(acc)) + "\r");
    await sleep(6);
  }
  process.stdout.write("\n");
}

/** Short “scene bridge” — subtle pulse then optional caption. */
export async function sceneBridge(chalk, caption) {
  if (!shouldAnimate()) {
    if (caption) console.log(chalk.dim(`\n${caption}\n`));
    return;
  }
  const frames = [" · ", " • ", " ○ ", " ● "];
  for (let r = 0; r < 2; r++) {
    for (const f of frames) {
      process.stdout.write(ESC.clearLine + chalk.cyan(f) + "\r");
      await sleep(45);
    }
  }
  process.stdout.write(ESC.clearLine);
  if (caption) {
    console.log();
    console.log(chalk.dim(caption));
    console.log();
  }
}

/**
 * Welcome: logo typing + framed intro blocks.
 * @param {'start' | 'stop'} action
 * @param {typeof import('chalk').default} chalk
 */
export async function playWelcomeScene(action, chalk) {
  const isStart = action === "start";

  const devBlurb = [
    chalk.dim("  mf-expo/  Expo + React Native app"),
    chalk.dim("  mf-go/    GraphQL API · Postgres · Redis · RabbitMQ (Docker)"),
    chalk.dim("  Stack:    Node + npm here · Docker Desktop for local backend"),
    chalk.dim("  Config:   repo-root local.env (optional, see .env.example)"),
  ];

  if (!shouldAnimate()) {
    console.log();
    console.log(chalk.bold.white("  ╭  MasterFabric dev CLI"));
    console.log(chalk.dim("  │  Monorepo: mf-expo (Expo) ↔ mf-go (Go GraphQL)"));
    console.log(chalk.dim(`  │  Mode: ${isStart ? "Start" : "Stop"} stack`));
    console.log(chalk.bold.white("  ╯"));
    console.log();
    for (const line of devBlurb) console.log(line);
    console.log();
    const title = isStart ? "Start MasterFabric" : "Stop MasterFabric";
    console.log(chalk.cyan.bold(`  ${isStart ? "▶" : "■"}  ${title}`));
    return;
  }

  await withHiddenCursor(async () => {
    clearFrame();
    await typeLine("MasterFabric", (s) => chalk.bold.cyan(s), { msPerChar: 26 });
    await sleep(60);
    await typeLine("  dev orchestration CLI", (s) => chalk.dim(s), { msPerChar: 12, caret: false });
    console.log();
    await revealLines(devBlurb, (line) => line, { delayMs: 16 });
    console.log();
    await sweepRule(chalk, (s) => s);

    const block = [
      `  ${isStart ? "▶" : "■"}  ${isStart ? "Start stack" : "Stop stack"}`,
      "  mf-expo (Expo) ↔ mf-go (GraphQL + Docker infra)",
      "  Optional: local.env for EXPO_PUBLIC_GRAPHQL_URL",
    ];
    await revealLines(block, (line) => (line.startsWith("  ▶") || line.startsWith("  ■") ? chalk.white.bold(line) : chalk.dim(line)), {
      delayMs: 28,
    });

    console.log();
    if (isStart) {
      await revealLines(
        [
          chalk.dim("  Next: pick a target — all · mf-go · mf-expo · live"),
          chalk.green("  Default: CLI exits — your shell stays free."),
          chalk.dim("  Tear down: npm run stop-all"),
          chalk.dim("  This CLI stays open: Ctrl+C = npm run stop-all (use start-all:detach to exit early)"),
        ],
        (line) => line,
        { delayMs: 22 }
      );
    } else {
      await revealLines(
        [
          chalk.dim("  Stops tracked PIDs, docker-down, pkill Expo,"),
          chalk.dim("  then clears stray listeners on dev ports."),
        ],
        (line) => line,
        { delayMs: 20 }
      );
    }
    console.log();
    await sweepRule(chalk, (s) => chalk.dim(s));
    await sleep(120);
  });
}

/**
 * Compact “environment” scene: disk + ports with a soft reveal.
 * @param {() => void} renderFn — synchronous printer (existing helpers)
 */
export async function playEnvironmentScene(renderFn, chalk) {
  if (!shouldAnimate()) {
    renderFn();
    return;
  }
  console.log(chalk.bold.magenta("\n  ◆ Environment snapshot"));
  await sleep(90);
  renderFn();
  await sleep(100);
}

/**
 * Outro panel after successful start/stop.
 * @param {'start' | 'stop'} action
 * @param {typeof import('chalk').default} chalk
 * @param {string[]} lines
 */
export async function playDoneScene(action, chalk, lines) {
  const ok = action === "start" ? "Ready" : "Stopped";
  if (!shouldAnimate()) {
    console.log(chalk.green(`\n  ✓ ${ok}`));
    for (const line of lines) console.log(chalk.dim(line));
    console.log();
    return;
  }
  await withHiddenCursor(async () => {
    console.log();
    for (const line of lines) {
      console.log(chalk.dim(line));
      await sleep(14);
    }
    await sleep(80);
    const plain = `  ✓ ${ok}`;
    for (let i = 0; i <= plain.length; i++) {
      process.stdout.write(ESC.clearLine + chalk.green.bold(plain.slice(0, i)) + "\r");
      await sleep(8);
    }
    process.stdout.write("\n\n");
  });
}
