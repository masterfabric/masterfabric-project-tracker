#!/usr/bin/env node

import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import {
  playWelcomeScene,
  sceneBridge,
  playEnvironmentScene,
  playDoneScene,
} from "./cli-ui.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PID_FILE = join(ROOT, ".cli-pids.json");
const LOCAL_ENV = join(ROOT, "local.env");

function loadLocalEnv() {
  if (!existsSync(LOCAL_ENV)) return;
  const content = readFileSync(LOCAL_ENV, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}
loadLocalEnv();

// Dev ports: Expo / Metro (mf-go runs in masterfabric-core-base)
const DEV_PORTS = [
  { port: 8081, label: "Expo Metro" },
  { port: 19000, label: "Expo dev server" },
  { port: 19001, label: "Expo dev tools" },
];

/** Host ports to SIGTERM after stopping Expo (pkill can miss orphaned node). */
const EXPO_LISTENER_PORTS = [8081, 19000, 19001];

// Prod GraphQL URL from local.env (EXPO_PUBLIC_GRAPHQL_URL). Override with MASTERFABRIC_LIVE_GRAPHQL_URL if needed.
const LIVE_GRAPHQL_URL =
  process.env.MASTERFABRIC_LIVE_GRAPHQL_URL || process.env.EXPO_PUBLIC_GRAPHQL_URL || "";

const CORE_BASE_HINT =
  "Backend: run mf-go from masterfabric-core-base; Particular from masterfabric-particulars (setup-project-tracker.sh).";

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function getDirSize(dir) {
  try {
    const out = execSync(`du -sk "${dir}" 2>/dev/null`, { encoding: "utf8" });
    const kb = parseInt(out.split("\t")[0], 10);
    return kb * 1024;
  } catch {
    return 0;
  }
}

function showSpaceUsage() {
  const mfExpo = join(ROOT, "mf-expo");
  const sizes = {
    "mf-expo": existsSync(mfExpo) ? getDirSize(mfExpo) : 0,
  };
  console.log(chalk.dim("\n  📦 Space usage:"));
  console.log(chalk.dim(`     mf-expo  ${formatBytes(sizes["mf-expo"]).padStart(10)}`));
  console.log();
}

function printBackendReminder() {
  console.log(chalk.cyan.bold("\n  Backend (not started by this CLI)"));
  console.log(
    chalk.dim(
      "  mf-go GraphQL lives in masterfabric-core-base (`cd mf-go && make docker-infra && make run`).\n" +
        "  Org projects hop via particular-project-tracker in masterfabric-particulars:\n" +
        "    ./scripts/setup-project-tracker.sh --start\n" +
        "  Point EXPO_PUBLIC_DEV_GRAPHQL_URL at core-base (default http://localhost:8080/graphql)."
    )
  );
  console.log();
}

function getListenerPidsOnPort(port) {
  try {
    const out = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: "utf8" }).trim();
    if (!out) return [];
    return out.split(/\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function processCommForPid(pid) {
  try {
    return execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/** Do not SIGTERM Docker Desktop / Colima port-forward helpers — killing them can crash the engine. */
function isDockerEngineRelatedComm(comm) {
  const c = (comm || "").toLowerCase();
  return (
    c.includes("docker-proxy") ||
    c.includes("com.docker") ||
    c === "docker" ||
    c.includes("vpnkit") ||
    c.includes("limactl")
  );
}

function killListenersOnPort(port) {
  if (process.platform === "win32") {
    try {
      execSync(`lsof -ti :${port} | xargs kill -15 2>/dev/null || true`, {
        encoding: "utf8",
        stdio: "pipe",
        shell: true,
      });
    } catch {
      /* ignore */
    }
    return;
  }
  const pids = getListenerPidsOnPort(port);
  for (const pid of pids) {
    const comm = processCommForPid(pid);
    const skip = isDockerEngineRelatedComm(comm);
    if (skip) continue;
    try {
      execSync(`kill -15 ${pid}`, { encoding: "utf8", stdio: "pipe", shell: true });
    } catch {
      /* ignore */
    }
  }
}

function killListenersOnPorts(ports) {
  for (const p of ports) killListenersOnPort(p);
}

/**
 * For each port: show listener if any, SIGTERM, then report if anything still bound.
 * @param {number[]} ports
 * @param {string} title
 */
function stopPortsWithCliReport(ports, title) {
  console.log(chalk.bold.magenta(`\n  ▸ ${title}`));
  const uniq = [...new Set(ports)];
  let signaled = 0;
  for (const port of uniq) {
    const usage = getPortUsage(port);
    const label = (DEV_PORTS.find((d) => d.port === port)?.label || `port ${port}`).padEnd(26);
    if (usage) {
      console.log(chalk.yellow(`     :${String(port).padEnd(5)}  ${label}  ${usage.name} (PID ${usage.pid})  → SIGTERM`));
      killListenersOnPort(port);
      signaled++;
    } else {
      console.log(chalk.dim(`     :${String(port).padEnd(5)}  ${label}  (idle)`));
    }
  }
  const stuck = uniq.filter((p) => getPortUsage(p));
  if (stuck.length) {
    console.log(
      chalk.red(
        `     ⚠ Still in use: ${stuck.map((p) => `:${p} (${getPortUsage(p)?.name || "?"})`).join(", ")} — close that app or run stop-all again.`
      )
    );
  } else {
    console.log(
      chalk.green(`     ✓ Port group clear (${signaled} listener(s) signaled; ${uniq.length - signaled} already idle).`)
    );
  }
}

/**
 * SIGTERM anything listening on the given ports so the next bind succeeds (orphaned locals, stale runs).
 * Skip with MF_CLI_SKIP_PORT_FREE=1 if you manage ports yourself.
 */
function freePortsForNextStart(portList, description) {
  if (process.env.MF_CLI_SKIP_PORT_FREE === "1") return;
  const uniq = [...new Set(portList)];
  const spin = ora({ text: description, color: "yellow" }).start();
  killListenersOnPorts(uniq);
  const doneText = `${description.replace(/\s*…\s*$/, "").trim()} — listeners cleared`;
  spin.succeed(doneText);
}

function getPortUsage(port) {
  try {
    const out = execSync(`lsof -i :${port} 2>/dev/null | awk 'NR>1 {print $1, $2}'`, { encoding: "utf8" });
    const lines = out.trim().split(/\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const first = lines[0].split(/\s+/);
    return { name: first[0] || "?", pid: first[1] || "?" };
  } catch {
    return null;
  }
}

function showPortUsage() {
  console.log(chalk.dim("\n  🔌 Dev port usage:"));
  for (const { port, label } of DEV_PORTS) {
    const usage = getPortUsage(port);
    if (usage) {
      console.log(chalk.yellow(`     :${String(port).padEnd(5)}  ${label.padEnd(14)}  ← ${usage.name} (PID ${usage.pid})`));
    } else {
      console.log(chalk.dim(`     :${String(port).padEnd(5)}  ${label.padEnd(14)}  — free`));
    }
  }
  console.log();
}

/**
 * Inquirer puts the TTY in raw mode for arrow keys. If we don't turn it off, many
 * terminals send Ctrl+C as a control character on stdin instead of raising SIGINT,
 * so the process never sees "stop" and looks "stuck".
 */
function restoreTerminalAfterInquirer() {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore
    }
  }
}

/** Return shell prompt / other stdin usage after CLI work (avoids “stuck” TTY). */
function releaseTerminalStdin() {
  restoreTerminalAfterInquirer();
  try {
    process.stdin.removeAllListeners("data");
    process.stdin.removeAllListeners("readable");
    if (process.stdin.isPaused && !process.stdin.isPaused()) {
      process.stdin.pause();
    }
  } catch {
    /* ignore */
  }
}

const SHUTDOWN_TIMEOUT_MS = 45_000;

async function showMenu(action, forceLive = false) {
  if (forceLive) return "live";
  /** `npm run stop-all` should tear down everything without an interactive prompt. */
  if (action === "stop") return "all";

  const choices = [
    {
      name: "  all      — Start mf-expo (mf-go must already run from masterfabric-core-base)",
      value: "all",
    },
    { name: "  mf-expo  — Expo / Metro only", value: "mf-expo" },
    { name: "  live     — Expo only, points at EXPO_PUBLIC_GRAPHQL_URL", value: "live" },
  ];
  const { target } = await inquirer.prompt([
    {
      type: "list",
      name: "target",
      message: chalk.white("Select target:"),
      choices,
      default: "all",
      pageSize: 6,
    },
  ]);
  return target;
}

function runBackground(cmd, args, cwd, label, env = process.env) {
  const proc = spawn(cmd, args, {
    cwd: cwd || ROOT,
    stdio: "inherit",
    shell: false,
    detached: true, // Child becomes process group leader; kill(-pid) stops entire tree
    env,
  });
  proc.unref();
  return proc.pid;
}

function loadPids() {
  try {
    if (existsSync(PID_FILE)) {
      return JSON.parse(readFileSync(PID_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function savePids(pids) {
  try {
    writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
  } catch {}
}

function killPid(pid) {
  if (!pid) return;
  try {
    // On Unix: kill process group (-pid) so children (npm→expo→metro) all stop
    if (process.platform !== "win32") {
      process.kill(-pid, "SIGTERM");
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
}

async function startMfExpo(runIos = false) {
  freePortsForNextStart(EXPO_LISTENER_PORTS, "Freeing Expo / Metro ports…");
  const cwd = join(ROOT, "mf-expo");
  const spinner = ora({
    text: runIos ? "Starting mf-expo + iOS (expo run:ios)..." : "Starting mf-expo (Expo dev server)...",
    color: "cyan",
  }).start();
  const cmd = runIos ? ["run", "ios"] : ["start"];
  const pid = runBackground("npm", cmd, cwd, "mf-expo");
  savePids({ ...loadPids(), mfExpo: pid });
  spinner.succeed(runIos ? `mf-expo + iOS running (PID ${pid})` : `mf-expo running (PID ${pid})`);
}

async function startMfExpoLive(runIos = false) {
  if (!LIVE_GRAPHQL_URL) {
    ora({ text: "EXPO_PUBLIC_GRAPHQL_URL not set. Copy local.env.example to local.env and add your prod URL.", color: "red" }).fail();
    process.exit(1);
  }
  freePortsForNextStart(EXPO_LISTENER_PORTS, "Freeing Expo / Metro ports…");
  const cwd = join(ROOT, "mf-expo");
  const spinner = ora({
    text: runIos
      ? "Starting mf-expo (live) + iOS..."
      : "Starting mf-expo (live) — Expo against production GraphQL...",
    color: "cyan",
  }).start();
  const cmd = runIos ? ["run", "ios"] : ["start"];
  const env = { ...process.env, EXPO_PUBLIC_GRAPHQL_URL: LIVE_GRAPHQL_URL };
  const pid = runBackground("npm", cmd, cwd, "mf-expo", env);
  savePids({ ...loadPids(), mfExpo: pid });
  spinner.succeed(`mf-expo (live) running (PID ${pid})`);
}

async function stopMfExpo() {
  console.log(chalk.bold.white("\n  ═ mf-expo / Metro ═════════════════════════════════════"));

  let s = ora({ text: "① Tracked mf-expo npm process (detached process group)…", color: "yellow" }).start();
  const pids = loadPids();
  const mfExpoPid = pids.mfExpo;
  if (mfExpoPid) {
    killPid(mfExpoPid);
    delete pids.mfExpo;
    savePids(pids);
    s.succeed(`① mf-expo CLI — SIGTERM on group leader PID ${mfExpoPid}`);
  } else {
    s.succeed("① mf-expo CLI — no PID in .cli-pids.json (often: Expo in another Terminal)");
  }

  s = ora({ text: "② pkill leftover Expo / Metro patterns…", color: "yellow" }).start();
  try {
    execSync('pkill -f "expo start" 2>/dev/null || true', { cwd: ROOT });
    execSync('pkill -f "react-native.*start" 2>/dev/null || true', { cwd: ROOT });
  } catch {}
  s.succeed("② Pattern kill — expo start / react-native start (best effort)");

  console.log(chalk.dim("  ③ Free Metro / dev-server ports…"));
  stopPortsWithCliReport(EXPO_LISTENER_PORTS, "SIGTERM listeners on Expo / Metro ports");
}

async function shutdownAll(started) {
  if (started.mfExpo) await stopMfExpo();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const action = args.find((a) => a === "start" || a === "stop");
  const runIos = args.includes("--ios");
  const forceLive = args.includes("--live");
  /**
   * Default: stay attached after start — Ctrl+C runs the same teardown as `npm run stop-all`.
   * `--detach`: exit right after start (old behavior; use another terminal for stop-all).
   */
  const holdTerminal = !args.includes("--detach");
  return { action, runIos, forceLive, holdTerminal };
}

async function main() {
  const { action, runIos, forceLive, holdTerminal } = parseArgs();
  if (!action) {
    console.log(chalk.bold.white("\n  MasterFabric Project Tracker CLI"));
    console.log(chalk.dim("  Starts mf-expo only. Requires Node and npm.\n"));
    console.log(chalk.dim(`  ${CORE_BASE_HINT}\n`));
    console.log(chalk.cyan("  Usage (from repository root)"));
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log("    npm run start-all           Start mf-expo (menu). Stays attached — Ctrl+C = stop-all.");
    console.log("    npm run start-all:detach    Start, then exit immediately (run stop-all in another shell).");
    console.log("    npm run start-all:ios       Expo uses `npm run ios` (simulator / device).");
    console.log("    npm run start-all:live      Expo only; uses EXPO_PUBLIC_GRAPHQL_URL from local.env.");
    console.log("    npm run start-all:live:ios  Live GraphQL + `npm run ios`.");
    console.log("    npm run stop-all            Stop tracked Expo / Metro processes.");
    console.log();
    console.log(chalk.dim("  After start-all: press Ctrl+C in the same terminal (or run `npm run stop-all` elsewhere)."));
    console.log(
      chalk.dim(
        "  Before starts, stray processes on Expo ports get SIGTERM (set MF_CLI_SKIP_PORT_FREE=1 to skip)."
      )
    );
    console.log();
    process.exit(1);
  }

  await playWelcomeScene(action, chalk);
  await playEnvironmentScene(() => showSpaceUsage(), chalk);
  if (action === "start") printBackendReminder();
  await sceneBridge(chalk, "Opening target menu — ↑/↓ to move, Enter to confirm.");
  const target = await showMenu(action, forceLive);
  restoreTerminalAfterInquirer();

  const started = { mfExpo: false };

  if (action === "start") {
    if (target === "all" || target === "mf-expo") {
      await startMfExpo(runIos);
      started.mfExpo = true;
    } else if (target === "live") {
      await startMfExpoLive(runIos);
      started.mfExpo = true;
    }

    /** @type {string[]} */
    const doneLines = [];
    doneLines.push("  mf-expo is running (or was started in the background).");
    doneLines.push(`  ${CORE_BASE_HINT}`);
    if (target === "live") {
      doneLines.push(`  GraphQL: ${LIVE_GRAPHQL_URL}`);
    } else {
      doneLines.push(
        `  Dev GraphQL: ${process.env.EXPO_PUBLIC_DEV_GRAPHQL_URL || "http://localhost:8080/graphql"}`
      );
    }
    await playDoneScene("start", chalk, doneLines);

    if (!holdTerminal) {
      console.log(chalk.cyan.bold("\n  Detach mode — CLI exiting (Expo keeps running)."));
      console.log(
        chalk.dim(
          "  Stop later:  npm run stop-all\n" +
            "  Next time, omit :detach to stay attached — Ctrl+C will run stop-all for you.\n"
        )
      );
      releaseTerminalStdin();
      process.exit(0);
    }

    restoreTerminalAfterInquirer();
    try {
      process.stdin.removeAllListeners("keypress");
    } catch {
      /* ignore */
    }
    try {
      if (typeof process.stdin.isPaused === "function" && process.stdin.isPaused()) {
        process.stdin.resume();
      }
    } catch {
      /* ignore */
    }

    console.log(
      chalk.dim(
        `\n  Dev stack is running. ${chalk.whiteBright("Ctrl+C")} here = ${chalk.whiteBright("npm run stop-all")} (same teardown; max ${SHUTDOWN_TIMEOUT_MS / 1000}s).\n` +
          "  Press Ctrl+C again while stopping to bail out immediately — then run npm run stop-all if needed.\n"
      )
    );

    let shuttingDown = false;
    const handleShutdown = async () => {
      if (shuttingDown) {
        console.log(chalk.red("\n  Second interrupt — exiting immediately (child processes may still run).\n"));
        console.log(chalk.dim("  Run: npm run stop-all\n"));
        releaseTerminalStdin();
        process.exit(1);
      }
      shuttingDown = true;
      console.log(chalk.bold.cyan("\n  Teardown (same steps as npm run stop-all)"));
      showPortUsage();
      console.log(chalk.yellow("  Working through Expo → ports…\n"));

      const forceTimer = setTimeout(() => {
        console.log(
          chalk.red(
            `\n  Shutdown still running after ${SHUTDOWN_TIMEOUT_MS / 1000}s — forcing exit. Run: npm run stop-all\n`
          )
        );
        releaseTerminalStdin();
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);

      try {
        await shutdownAll(started);
        clearTimeout(forceTimer);
        console.log(chalk.dim("\n  🔌 Port check after stop:"));
        showPortUsage();
        console.log(chalk.green("\n  ✓ Teardown steps finished — see any warnings above if a port stayed busy.\n"));
        releaseTerminalStdin();
        process.exit(0);
      } catch (e) {
        clearTimeout(forceTimer);
        console.error(chalk.red("\n  Stop error:"), e.message);
        releaseTerminalStdin();
        process.exit(1);
      }
    };
    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
  } else {
    console.log(chalk.bold.cyan("\n  MasterFabric — stop"));
    console.log(chalk.dim("  Order: Expo / Metro → dev ports.\n"));
    showPortUsage();
    console.log();

    if (target === "all" || target === "mf-expo" || target === "live") await stopMfExpo();

    console.log(chalk.dim("\n  🔌 Port check after stop:"));
    showPortUsage();

    await playDoneScene("stop", chalk, [
      "  Each step above lists what was signaled; yellow = listeners that got SIGTERM.",
      "  If a port still shows busy, close the listed app or run npm run stop-all again.",
      "  mf-go / Particular (if running) are managed in core-base / particulars — not stopped here.",
    ]);
  }
}

main().catch((e) => {
  console.error(chalk.red("\n  Error:"), e.message);
  process.exit(1);
});
