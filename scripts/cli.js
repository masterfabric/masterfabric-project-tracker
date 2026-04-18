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

// Dev ports: mf-go, Expo, Docker infra (host-mapped)
const DEV_PORTS = [
  { port: 8080, label: "mf-go GraphQL" },
  { port: 8081, label: "Expo Metro" },
  { port: 5001, label: "pgAdmin (Postgres UI)" },
  { port: 19000, label: "Expo dev server" },
  { port: 19001, label: "Expo dev tools" },
  { port: 5433, label: "Postgres" },
  { port: 6380, label: "Redis" },
  { port: 5673, label: "RabbitMQ" },
  { port: 15673, label: "RabbitMQ UI" },
];

/** Host ports to SIGTERM after mf-go / Docker teardown (stray listeners). */
const MF_GO_LISTENER_PORTS = [8080, 5001, 5433, 6380, 5673, 15673];
/** Host ports to SIGTERM after stopping Expo (pkill can miss orphaned node). */
const EXPO_LISTENER_PORTS = [8081, 19000, 19001];

// Prod GraphQL URL from local.env (EXPO_PUBLIC_GRAPHQL_URL). Override with MASTERFABRIC_LIVE_GRAPHQL_URL if needed.
const LIVE_GRAPHQL_URL =
  process.env.MASTERFABRIC_LIVE_GRAPHQL_URL || process.env.EXPO_PUBLIC_GRAPHQL_URL || "";

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
  const mfGo = join(ROOT, "mf-go");
  const sizes = {
    "mf-expo": existsSync(mfExpo) ? getDirSize(mfExpo) : 0,
    "mf-go": existsSync(mfGo) ? getDirSize(mfGo) : 0,
  };
  console.log(chalk.dim("\n  📦 Space usage:"));
  console.log(chalk.dim(`     mf-expo  ${formatBytes(sizes["mf-expo"]).padStart(10)}`));
  console.log(chalk.dim(`     mf-go    ${formatBytes(sizes["mf-go"]).padStart(10)}`));
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

/** Explain how "all" behaves on this OS (separate windows vs background). */
function explainAllStartMode() {
  if (canOpenOsTerminalWindows()) {
    console.log(chalk.cyan.bold("\n  Separate Terminal windows"));
    console.log(
      chalk.dim(
        "  On this OS we open two windows: one for `make run` (mf-go), one for Expo.\n" +
          "  Docker infra + pgAdmin start in the background; this CLI exits so you keep this shell.\n" +
          "  When finished: `npm run stop-all` (and close the other windows if still open)."
      )
    );
  } else {
    console.log(chalk.cyan.bold("\n  Background mode"));
    console.log(
      chalk.dim(
        "  This OS has no auto “new terminal window” integration — servers run in the\n" +
          "  background with logs attached to this session where possible.\n" +
          "  Prefer macOS Terminal.app for separate windows on **all**, or start mf-go / mf-expo individually."
      )
    );
  }
  console.log();
}

function canOpenOsTerminalWindows() {
  if (process.platform === "darwin") return true;
  if (process.platform === "linux") {
    return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  }
  if (process.platform === "win32") return true;
  return false;
}

/**
 * Prefix for `make run` in a new shell so mf-go sees REDIS_* from repo-root local.env
 * (merged into this Node process by loadLocalEnv). mf-go does not read local.env itself.
 */
function mfGoRedisEnvPrefixForShell() {
  const keys = ["REDIS_URL", "REDIS_ADDR", "REDIS_PASSWORD", "REDIS_DB", "REDIS_REQUIRED"];
  const pairs = [];
  for (const key of keys) {
    const v = process.env[key];
    if (v === undefined || v === "") continue;
    pairs.push([key, String(v)]);
  }
  if (pairs.length === 0) return "";
  if (process.platform === "win32") {
    return (
      pairs.map(([k, v]) => `set "${k}=${v.replace(/"/g, '""')}"`).join(" && ") + " && "
    );
  }
  const parts = pairs.map(([k, v]) => {
    const escaped = v.replace(/'/g, "'\\''");
    return `export ${k}='${escaped}'`;
  });
  return `${parts.join(" && ")} && `;
}

/**
 * Open a new OS terminal window running `command` in `cwd`.
 * @returns {boolean} whether a window was opened (else caller may fall back)
 */
function openInNewTerminalWindow(cwd, command, windowTitle = "mf-dev") {
  const safeCwd = cwd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeCmd = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  try {
    if (process.platform === "darwin") {
      const script = [
        'tell application "Terminal"',
        "activate",
        `do script "cd \\"${safeCwd}\\" && ${safeCmd}"`,
        "end tell",
      ].join("\n");
      execSync(`osascript -e ${JSON.stringify(script)}`, { stdio: "pipe" });
      return true;
    }

    if (process.platform === "linux") {
      const bashLine = `cd ${JSON.stringify(cwd)} && ${command}; exec bash`;
      try {
        execSync(`which gnome-terminal`, { stdio: "pipe" });
        spawn("gnome-terminal", ["--", "bash", "-lc", bashLine], {
          detached: true,
          stdio: "ignore",
        }).unref();
        return true;
      } catch {
        try {
          execSync(`which konsole`, { stdio: "pipe" });
          spawn("konsole", ["-e", "bash", "-lc", bashLine], { detached: true, stdio: "ignore" }).unref();
          return true;
        } catch {
          try {
            execSync(`which xterm`, { stdio: "pipe" });
            spawn("xterm", ["-e", "bash", "-lc", bashLine], { detached: true, stdio: "ignore" }).unref();
            return true;
          } catch {
            return false;
          }
        }
      }
    }

    if (process.platform === "win32") {
      const escaped = cwd.replace(/"/g, '""');
      const title = String(windowTitle).replace(/"/g, "");
      execSync(`start "${title}" cmd /k "cd /d \\"${escaped}\\" && ${command}"`, {
        cwd: ROOT,
        shell: true,
        stdio: "pipe",
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
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
      name: "  all      — Docker infra here + mf-go & mf-expo in separate terminal windows (macOS/Linux GUI / Windows)",
      value: "all",
    },
    { name: "  mf-expo  — Expo / Metro only (GraphQL must already be up)", value: "mf-expo" },
    { name: "  mf-go    — Docker (Postgres, Redis, RabbitMQ, pgAdmin :5001) + GraphQL :8080", value: "mf-go" },
    { name: "  live     — Expo only, points at EXPO_PUBLIC_GRAPHQL_URL (no local mf-go)", value: "live" },
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

function run(cmd, args, cwd, opts = {}) {
  const silent = Boolean(opts.silent);
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: cwd || ROOT,
      stdio: silent ? "pipe" : "inherit",
      // Avoid shell: true + argv — DEP0190 and broken escaping; make/npm/docker work without a shell.
      shell: false,
    });
    let combined = "";
    if (silent) {
      const capture = (d) => {
        combined += d.toString();
        if (combined.length > 16000) combined = combined.slice(-12000);
      };
      proc.stdout?.on("data", capture);
      proc.stderr?.on("data", capture);
    }
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const tail = combined
          .trim()
          .split("\n")
          .filter(Boolean)
          .slice(-35)
          .join("\n");
        reject(
          new Error(
            tail || `${cmd} ${args.join(" ")} exited with code ${code}`
          )
        );
      }
    });
    proc.on("error", reject);
  });
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
    // On Unix: kill process group (-pid) so children (make→go, npm→expo→metro) all stop
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

/**
 * Exit with a clear message if the Docker CLI/engine is not usable (before make docker-infra).
 */
function assertDockerDaemonReachable() {
  try {
    // Use a shell here: `execSync("docker", ["info"])` can invoke the CLI incorrectly
    // on some setups (prints "Usage" and exits 0), so the preflight would be skipped.
    execSync("docker info", {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 20000,
      maxBuffer: 512 * 1024,
      shell: true,
    });
  } catch (e) {
    let detail = "";
    if (e && typeof e === "object" && "stderr" in e && e.stderr) {
      detail = String(e.stderr).trim();
    } else if (e instanceof Error && e.message) {
      detail = e.message.trim();
    }
    const firstLines = detail ? detail.split(/\n/).filter(Boolean).slice(0, 4).join("\n  ") : "";
    console.log();
    console.log(chalk.red.bold("  ✖ Docker engine not reachable — mf-go infra needs Docker running."));
    console.log(chalk.dim("  Start Docker Desktop (or the Docker service on Linux), wait until it is ready,"));
    console.log(chalk.dim("  then confirm in a terminal:"));
    console.log(chalk.cyan("    docker ps"));
    console.log();
    if (firstLines) {
      console.log(chalk.dim("  From docker:"));
      console.log(chalk.dim(`  ${firstLines}\n`));
    }
    process.exit(1);
  }
}

async function startMfGoInfraOnly() {
  assertDockerDaemonReachable();
  freePortsForNextStart(
    MF_GO_LISTENER_PORTS,
    "Freeing mf-go / Docker host ports (8080, pgAdmin, Postgres, Redis, RabbitMQ…)"
  );
  const cwd = join(ROOT, "mf-go");
  const spinner = ora({ text: "Starting mf-go infra (Postgres, Redis, RabbitMQ, pgAdmin)...", color: "cyan" }).start();
  try {
    await run("make", ["docker-infra"], cwd, { silent: true });
    spinner.succeed("mf-go infra ready (Docker)");
  } catch (e) {
    spinner.fail("mf-go infra failed");
    const msg = e instanceof Error ? e.message : String(e);
    if (msg) {
      console.log(chalk.red(`\n${msg}\n`));
    }
    console.log(
      chalk.dim(
        "  Typical fixes: start Docker Desktop, free ports 5001 / 5433 / 6380 / 5673 / 15673, then run:\n" +
          "    cd mf-go && make docker-infra\n"
      )
    );
    throw e;
  }
}

async function startMfGo() {
  await startMfGoInfraOnly();
  // GraphQL binds :8080 on the host again after Docker is up — clear stragglers (e.g. old make run).
  freePortsForNextStart([8080], "Freeing host :8080 for GraphQL…");
  const cwd = join(ROOT, "mf-go");
  const runSpinner = ora({ text: "Starting mf-go server (background)...", color: "cyan" }).start();
  const pid = runBackground("make", ["run"], cwd, "mf-go");
  savePids({ ...loadPids(), mfGo: pid });
  runSpinner.succeed(`mf-go server running (PID ${pid})`);
}

/**
 * "all" on supported OS: Docker infra (includes pgAdmin); mf-go + mf-expo each in a new terminal window.
 */
async function startAllWithSeparateTerminals(runIos, started) {
  explainAllStartMode();
  await startMfGoInfraOnly();
  freePortsForNextStart([8080], "Freeing host :8080 before mf-go terminal…");
  freePortsForNextStart(EXPO_LISTENER_PORTS, "Freeing Expo / Metro ports before mf-expo terminal…");

  const mfGoCwd = join(ROOT, "mf-go");
  const mfExpoCwd = join(ROOT, "mf-expo");
  const expoShellCmd = runIos ? "npm run ios" : "npm start";

  const mfGoCmd = `${mfGoRedisEnvPrefixForShell()}make run`;
  const openedGo = openInNewTerminalWindow(mfGoCwd, mfGoCmd, "mf-go");
  const openedExpo = openInNewTerminalWindow(mfExpoCwd, expoShellCmd, "mf-expo");

  if (!openedGo || !openedExpo) {
    ora({
      text: "Could not open one or more OS terminal windows — falling back to background for missing pieces.",
      color: "yellow",
    }).warn();
    if (!openedGo) {
      const pid = runBackground("make", ["run"], mfGoCwd, "mf-go");
      savePids({ ...loadPids(), mfGo: pid });
    }
    if (!openedExpo) {
      const cmd = runIos ? ["run", "ios"] : ["start"];
      const pid = runBackground("npm", cmd, mfExpoCwd, "mf-expo");
      savePids({ ...loadPids(), mfExpo: pid });
    }
  } else {
    console.log(chalk.green("  ✓ Opened Terminal windows for mf-go (`make run`) and mf-expo."));
    console.log(chalk.dim("    Docker + pgAdmin are running in the background. Use `npm run stop-all` when done.\n"));
  }

  started.mfGo = true;
  started.mfExpo = true;
}

async function startAllDefault(runIos, started) {
  await startMfGo();
  started.mfGo = true;
  await startMfExpo(runIos);
  started.mfExpo = true;
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

async function stopPgweb() {
  const pids = loadPids();
  if (pids.pgweb) {
    killPid(pids.pgweb);
    delete pids.pgweb;
    savePids(pids);
  }
  try {
    execSync('pkill -f "pgweb" 2>/dev/null || true', { cwd: ROOT });
  } catch {}
}

async function stopMfGo() {
  console.log(chalk.bold.white("\n  ═ mf-go / Docker ═══════════════════════════════════════"));

  let s = ora({ text: "① Legacy host pgweb binary (PID file + pkill)…", color: "yellow" }).start();
  await stopPgweb();
  s.succeed("① Legacy host pgweb — cleared (or was not running)");

  const cwd = join(ROOT, "mf-go");
  s = ora({ text: "② docker compose down (Postgres, Redis, RabbitMQ, pgAdmin…)…", color: "yellow" }).start();
  try {
    await run("make", ["docker-down"], cwd, { silent: true });
    s.succeed("② Docker — compose down finished");
  } catch (e) {
    s.warn("② Docker — compose down had issues (containers may already be down)");
  }

  s = ora({ text: "③ Tracked host `make run` / mf-go GraphQL process group…", color: "yellow" }).start();
  const pids = loadPids();
  const mfGoPid = pids.mfGo;
  if (mfGoPid) {
    killPid(mfGoPid);
    delete pids.mfGo;
    savePids(pids);
    s.succeed(`③ mf-go server — SIGTERM on process group (leader PID ${mfGoPid})`);
  } else {
    s.succeed("③ mf-go server — no PID in .cli-pids.json (often: `make run` in another Terminal)");
  }

  console.log(chalk.dim("  ④ Free host ports used by mf-go / Docker publishes…"));
  stopPortsWithCliReport(MF_GO_LISTENER_PORTS, "SIGTERM listeners on mf-go stack ports");
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
  if (started.mfGo) await stopMfGo();
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
    console.log(chalk.bold.white("\n  MasterFabric dev CLI"));
    console.log(chalk.dim("  Repo root helper for mf-go + mf-expo. Requires Node, Docker (for mf-go), and npm.\n"));
    console.log(chalk.cyan("  Usage (from repository root)"));
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log("    npm run start-all           Start (menu). Stays attached — Ctrl+C = stop-all.");
    console.log("    npm run start-all:detach    Start, then exit immediately (run stop-all in another shell).");
    console.log("    npm run start-all:ios       Expo uses `npm run ios` (simulator / device).");
    console.log("    npm run start-all:live      Expo only; uses EXPO_PUBLIC_GRAPHQL_URL from local.env.");
    console.log("    npm run start-all:live:ios  Live GraphQL + `npm run ios`.");
    console.log("    npm run stop-all            Stop Docker + PIDs + Expo — step-by-step log and per-port status.");
    console.log();
    console.log(chalk.dim("  After start-all: press Ctrl+C in the same terminal (or run `npm run stop-all` elsewhere)."));
    console.log(chalk.dim("  **all** on macOS: Docker/pgAdmin here; mf-go + mf-expo open in new terminal windows."));
    console.log(
      chalk.dim(
        "  Before starts, stray processes on dev ports get SIGTERM (set MF_CLI_SKIP_PORT_FREE=1 to skip)."
      )
    );
    console.log();
    process.exit(1);
  }

  await playWelcomeScene(action, chalk);
  await playEnvironmentScene(() => showSpaceUsage(), chalk);
  await sceneBridge(chalk, "Opening target menu — ↑/↓ to move, Enter to confirm.");
  const target = await showMenu(action, forceLive);
  restoreTerminalAfterInquirer();

  const started = { mfGo: false, mfExpo: false };

  if (action === "start") {
    if (target === "all") {
      if (canOpenOsTerminalWindows()) {
        await startAllWithSeparateTerminals(runIos, started);
      } else {
        await startAllDefault(runIos, started);
      }
    } else if (target === "mf-go") {
      await startMfGo();
      started.mfGo = true;
    } else if (target === "mf-expo") {
      await startMfExpo(runIos);
      started.mfExpo = true;
    } else if (target === "live") {
      await startMfExpoLive(runIos);
      started.mfExpo = true;
    }

    /** @type {string[]} */
    const doneLines = [];
    doneLines.push("  Services are running (or new terminal windows were opened).");
    if (started.mfGo) {
      doneLines.push("  URLs: GraphQL http://localhost:8080/graphql  |  pgAdmin http://localhost:5001");
    }
    if (target === "live") {
      doneLines.push(`  GraphQL: ${LIVE_GRAPHQL_URL}`);
    }
    if (target === "all" && canOpenOsTerminalWindows()) {
      doneLines.push(
        "  mf-go / mf-expo logs: in the two windows that just opened. Docker + pgAdmin run in the background."
      );
    }
    await playDoneScene("start", chalk, doneLines);

    if (!holdTerminal) {
      console.log(chalk.cyan.bold("\n  Detach mode — CLI exiting (servers keep running)."));
      console.log(
        chalk.dim(
          "  Stop later:  npm run stop-all\n" +
            "  Next time, omit :detach to stay attached — Ctrl+C will run stop-all for you.\n" +
            "  (If you used **all** on macOS, you can still close the mf-go / mf-expo windows manually.)"
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
      console.log(chalk.yellow("  Working through mf-go → Expo → ports…\n"));

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
    console.log(
      chalk.dim(
        "  Order: mf-go / Docker → host GraphQL & stack ports → Expo / Metro → dev ports.\n"
      )
    );
    showPortUsage();
    console.log();

    if (target === "all" || target === "mf-go") await stopMfGo();
    if (target === "all" || target === "mf-expo" || target === "live") await stopMfExpo();

    console.log(chalk.dim("\n  🔌 Port check after stop:"));
    showPortUsage();

    await playDoneScene("stop", chalk, [
      "  Each step above lists what was signaled; yellow = listeners that got SIGTERM.",
      "  If a port still shows busy, close the listed app or run npm run stop-all again.",
    ]);
  }
}

main().catch((e) => {
  console.error(chalk.red("\n  Error:"), e.message);
  process.exit(1);
});
