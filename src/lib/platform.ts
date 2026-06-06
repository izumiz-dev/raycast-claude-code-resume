/**
 * Path resolution, command building, and "launch into an interactive session".
 *
 * Concept (see docs/raycast-claude-code/07):
 *  - The launcher's job is to take you there. The primary action launches; copy is the fallback.
 *  - We launch interactive claude (the flat-rate path). We never use -p (avoids metered billing).
 *  - OS differences are confined to "how the terminal is opened" (mac: Terminal / Windows: wt + wsl).
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { getPreferenceValues } from "@raycast/api";

interface Prefs {
  claudeHome?: string;
  claudeBin?: string;
  wslDistro?: string;
}

export const isWindows = process.platform === "win32";
export const isMac = process.platform === "darwin";

export function prefs(): Prefs {
  return getPreferenceValues<Prefs>();
}

let cachedClaudeHome: string | undefined;

/**
 * Resolve the path to `.claude`.
 *  - mac/Linux: ~/.claude
 *  - Windows: a UNC path into WSL. We must NOT assume the WSL Linux username equals
 *    the Windows username (os.userInfo() here is the Windows user, which often differs),
 *    so we ask WSL for the real $HOME and build the UNC path from it.
 * Async because the Windows branch shells out to WSL; the result is cached.
 */
export async function claudeHome(): Promise<string> {
  const p = prefs().claudeHome?.trim();
  if (p) return p;
  if (isWindows) {
    if (cachedClaudeHome) return cachedClaudeHome;
    const distro = prefs().wslDistro?.trim() || "Ubuntu";
    const home = await wslHome(distro); // e.g. /home/foo
    cachedClaudeHome = wslToUncPath(distro, `${home}/.claude`);
    return cachedClaudeHome;
  }
  return path.join(os.homedir(), ".claude");
}

export const projectsDir = async () =>
  path.join(await claudeHome(), "projects");
export const skillsDir = async () => path.join(await claudeHome(), "skills");
export const agentsDir = async () => path.join(await claudeHome(), "agents");

export const claudeBin = () => prefs().claudeBin?.trim() || "claude";

export function shArg(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** For the copy fallback. `cd <cwd> && claude <extra...>` */
export function buildCommand(extra: string[], cwd?: string): string {
  const body = `${claudeBin()}${extra.length ? " " + extra.map(shArg).join(" ") : ""}`;
  return cwd ? `cd ${shArg(cwd)} && ${body}` : body;
}

export async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

/** Resolved, human-readable view of the current configuration (for the Setup command). */
export async function resolvedConfig(): Promise<{
  platform: string;
  claudeHome: string;
  claudeBin: string;
  wslDistro?: string;
}> {
  return {
    platform: isWindows ? "Windows (WSL)" : isMac ? "macOS" : "Linux",
    claudeHome: await claudeHome(),
    claudeBin: claudeBin(),
    wslDistro: isWindows ? prefs().wslDistro?.trim() || "Ubuntu" : undefined,
  };
}

/**
 * Check that the claude binary resolves in the user's login shell — i.e. the exact
 * environment launchInteractive() runs in (login + interactive, so mise is loaded).
 * Only used to surface a hint in the Setup view: a false negative is harmless because
 * launchInteractive() runs `claude` directly, never `command -v` (e.g. fish doesn't
 * support `command -v` the POSIX way, so it may report not-found even when claude works).
 */
export async function claudeBinFound(): Promise<boolean> {
  const cmd = `command -v ${shArg(claudeBin())}`;
  try {
    if (isWindows) {
      const distro = prefs().wslDistro?.trim() || "Ubuntu";
      const shell = await wslLoginShell(distro);
      const out = await runCapture("wsl.exe", [
        "-d",
        distro,
        "--",
        shell,
        "-lic",
        cmd,
      ]);
      return out.trim().length > 0;
    }
    const shell = process.env.SHELL || "/bin/zsh";
    const out = await runCapture(shell, ["-lic", cmd]);
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/** Windows: check the configured WSL distro exists (always true off Windows). */
export async function wslDistroExists(): Promise<boolean> {
  if (!isWindows) return true;
  const distro = prefs().wslDistro?.trim() || "Ubuntu";
  try {
    // `wsl -l -q` prints one distro per line, but as UTF-16: read as a utf8
    // string each char is interleaved with non-printable bytes — strip them.
    const out = await runCapture("wsl.exe", ["-l", "-q"]);
    const names = out
      .split(/\r?\n/)
      .map((s) =>
        s
          .replace(/[^\x20-\x7E]/g, "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    return names.includes(distro.toLowerCase());
  } catch {
    return false;
  }
}

function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: false }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

/**
 * Actually launch an interactive claude session (the primary action).
 * Throws on failure, so the caller can fall back to copying.
 * @param cwd   launch directory (the cwd from the session JSONL; mac=native / Windows=a WSL Linux path)
 * @param extra args for claude (e.g. ["-r", "<id>"] / ["--continue"] / ['"prompt"'])
 */
export async function launchInteractive(
  cwd: string | undefined,
  extra: string[] = [],
): Promise<void> {
  const inner = `${claudeBin()}${extra.length ? " " + extra.map(shArg).join(" ") : ""}`;
  // cd to cwd → launch claude → exec the user's shell so the window stays open.
  const bodyFor = (shell: string) =>
    `${cwd ? `cd ${shArg(cwd)} && ` : ""}${inner}\nexec ${shArg(shell)}\n`;

  if (isWindows) {
    const distro = prefs().wslDistro?.trim() || "Ubuntu";
    // Open in the user's login shell (zsh/bash/fish/etc). Tools like node/npx are
    // enabled via mise in that shell's rc (.zshrc etc), so hardcoding bash would
    // leave MCP's npx and friends missing. Using the login shell reproduces "the
    // same environment as the user's everyday terminal".
    const shell = await wslLoginShell(distro);
    const winTmp = path.join(os.tmpdir(), `raycast-claude-${Date.now()}.sh`);
    await fs.writeFile(winTmp, bodyFor(shell), { encoding: "utf8" });
    const wslPath = winToWslPath(winTmp);
    // <shell> -lic = login + interactive init → .zprofile/.zshrc etc are read and
    // mise (node/npx) is loaded. We only pass `source <path>`, so there's no ; and
    // wt doesn't spawn extra tabs.
    const sourceCmd = `source ${shArg(wslPath)}`;
    try {
      await run("wt.exe", [
        "-w",
        "0",
        "wsl.exe",
        "-d",
        distro,
        "--",
        shell,
        "-lic",
        sourceCmd,
      ]);
    } catch {
      await run("wsl.exe", ["-d", distro, "--", shell, "-lic", sourceCmd]);
    }
    return;
  }

  // macOS: use Terminal's `do script` to open in the user's shell.
  // Terminal starts a login interactive shell by default, so mise and the rest are set up.
  const shell = process.env.SHELL || "/bin/zsh";
  const tmp = path.join(os.tmpdir(), `raycast-claude-${Date.now()}.sh`);
  await fs.writeFile(tmp, bodyFor(shell), { mode: 0o755 });
  await run("osascript", [
    "-e",
    'tell application "Terminal" to activate',
    "-e",
    `tell application "Terminal" to do script "source ${tmp}"`,
  ]);
}

/** C:\\Users\\..\\Temp\\x.sh → /mnt/c/Users/../Temp/x.sh (for access from WSL) */
function winToWslPath(p: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (!m) return p.replace(/\\/g, "/");
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
}

function runCapture(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { windowsHide: true, encoding: "utf8" },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

/** Ask WSL for the user's $HOME (e.g. /home/foo). Falls back to /home/<windows-user>. */
async function wslHome(distro: string): Promise<string> {
  try {
    const out = await runCapture("wsl.exe", [
      "-d",
      distro,
      "--",
      "sh",
      "-c",
      "echo $HOME",
    ]);
    const home = out.trim().split("\n").pop()?.trim();
    if (home && home.startsWith("/")) return home;
  } catch {
    // ignore → fall back below
  }
  // Best-effort only, and often wrong: os.userInfo() here is the Windows user, which
  // need not match the WSL Linux user (the very assumption we query $HOME to avoid).
  // We reach this only when the WSL query itself failed, in which case little works anyway.
  return `/home/${os.userInfo().username}`;
}

/** /home/foo/.claude → \\wsl.localhost\Ubuntu\home\foo\.claude */
function wslToUncPath(distro: string, p: string): string {
  const rel = p.replace(/^\/+/, "").replace(/\//g, "\\");
  return `\\\\wsl.localhost\\${distro}\\${rel}`;
}

/** Get the WSL user's login shell (the shell field in /etc/passwd). Falls back to bash. */
async function wslLoginShell(distro: string): Promise<string> {
  try {
    const out = await runCapture("wsl.exe", [
      "-d",
      distro,
      "--",
      "sh",
      "-c",
      "getent passwd $(id -u) | cut -d: -f7",
    ]);
    const sh = out.trim().split("\n").pop()?.trim();
    if (sh && sh.startsWith("/")) return sh;
  } catch {
    // ignore → fall back to bash
  }
  return "bash";
}
