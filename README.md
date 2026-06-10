# Claude Code Resume (Raycast extension)

**Resume any past Claude Code session, not just the last one — from Raycast, on macOS and Windows.**

`claude --continue` only takes you back to the most recent session per directory. This extension
reads your real session history (the JSONL transcripts under `~/.claude/projects`) and lets you
jump back into *any* session, with enough recall to know which one you want before you commit:
Claude's auto title, the first prompt, the latest prompt, and the last reply.

## What makes this different

There are other Claude Code extensions on the Store; this one fills a different gap:

| | [Claude Code Launcher](https://www.raycast.com/stephendolan/claude-code-launcher) | [Claude Sessions](https://www.raycast.com/kud/claude-sessions) | **Claude Code Resume** (this) |
|---|---|---|---|
| Resume a specific past session (`claude -r <id>`) | — | — (project-level `--continue` only) | **Yes** |
| Session recall (title, first/latest prompt, last reply) | — | — | **Yes** (parsed from the JSONL transcripts) |
| Project list | Manually saved favorites | From `~/.claude.json` registry | **Auto-derived from session history** — nothing to register |
| Windows support | macOS only | macOS only | **macOS + Windows (WSL and native PowerShell, auto-detected)** |

In short: *Claude Code Launcher* is a hand-curated project bookmarker, *Claude Sessions* manages
the project registry, and **this extension is about getting back into a specific conversation** —
including on Windows, where no Claude Code extension worked before.

## Design pillars

- **The primary action is "launch".** The extension's job is to take you there. Copy is the fallback for when launching isn't possible.
- What we launch is **interactive claude (the flat-rate path)**. We never use `-p`, so there is **zero metered billing**.
- **No extra binaries required** (the `claude` CLI is enough).
- Sessions open in **your real login shell**, so your everyday dev environment (mise, node, npx for MCP) is available.
- OS differences are confined to "how the terminal opens" (mac: Terminal.app / iTerm2 / Ghostty; Windows: `wt + wsl` for WSL sessions, `wt + PowerShell` for Windows-native ones).
- We only read files under `~/.claude`, so browsing is **completely free**.

## Commands

| Command (title) | mode | Enter |
|---|---|---|
| **Resume Claude Code Session** (`list-sessions`) | view | Search history (newest first) → resume the chosen session (`claude -r <id>`) |
| **Open Claude Code Project** (`open-project`) | view | A few chars of a repo → start claude there (`Start New Session` / `Continue Last Session`) |
| **Check Claude Code Setup** (`setup`) | view | Verify the detected `.claude` stores, the claude binary per environment, and the WSL distro → open preferences to override |

> The session list is newest first, so the top row is the most recent and pressing Enter on it doubles as "resume last".
> Where launching isn't possible, the command is copied to the clipboard automatically and a Toast tells you.
> The session detail is recall-first: it shows Claude's auto title, the first prompt, the latest prompt, and the last reply (parsed from the JSONL) so you can tell what a session was about before resuming — the command is kept below as a fallback.

## Settings (⌘,)

| Setting | mac | Windows |
|---|---|---|
| Claude Home | empty (auto `~/.claude`) | empty — both stores are auto-detected (see below); set a path only to force a single store |
| Claude Binary | `claude` | `claude` |
| WSL Distro | — | e.g. `Ubuntu` (only if you use WSL) |
| Windows Shell | — | `pwsh` (default) or `powershell` — used to launch Windows-native sessions |
| macOS Terminal | `Terminal.app` (default), `iTerm2`, or `Ghostty` | — |

### Windows: two backends, auto-detected

On Windows you may run Claude Code from **WSL** and/or **natively from PowerShell/cmd**, and
each keeps its own `.claude`. The extension reads **both** and tags each session so it relaunches
in the right place (none of the paths are hardcoded to a user):

- **WSL sessions.** Store is `~/.claude` inside WSL (the home is queried, not assumed). `cwd` is a
  Linux path. Launch writes a temp `.sh` and runs `wt -w 0 wsl -d <distro> -- <login-shell> -lic
  "source <script>"` (falls back to plain `wsl` if `wt` is missing), with `exec <login-shell>` so
  the window stays open. Run `claude login` inside WSL.
- **Windows-native sessions.** Store is `C:\Users\<you>\.claude` (via the OS home). `cwd` is a
  Windows path. Launch writes a temp `.ps1` and runs `wt -w 0 <pwsh|powershell> -NoExit
  -ExecutionPolicy Bypass -File <script>` (falls back to the shell directly), which `Set-Location`s
  into the dir and runs `claude`. Run `claude login` in PowerShell.

When the session list mixes both, a small `WSL` / `Windows/native` tag distinguishes them. Use the
**Check Claude Code Setup** command to see which stores were detected and whether `claude` resolves
in each environment.

## Recommended setup

- **Bind a global hotkey to `list-sessions`** (e.g. ⌥⌘C) → jump back into where you left off from anywhere.
- **Bind a hotkey to `open-project`** too → start Claude in any recent repo in a couple of keystrokes.

---

## Development

### Install (environment pinned with mise + pnpm)

```bash
cd raycast-claude-launcher
mise install            # install the tools pinned in mise.toml (Node / pnpm)
mise run install        # clean dependency resolution (pnpm install)
mise run dev            # load into Raycast in dev mode (on macOS / Raycast for Windows)
```

Others: `mise run build` / `mise run lint` / `mise run reset` (full reset → rebuild) / `mise run doctor` (environment check).

> The environment is **strictly pinned with mise** (`min_version`, `mise.lock`, exact pins, and `pnpm.overrides` to unify `@types/react` at 19.0.10).

### Developing for Windows (write on WSL, test on Windows)

`ray develop` only runs **on the same OS as the Raycast app** (it connects over same-OS local IPC).
And because of native deps like esbuild, **node_modules is per-OS**. So run dev natively on Windows.

| Step | Where | Command |
|---|---|---|
| Type check / bundle check (fast) | WSL | `mise run build` |
| Sync source WSL → Windows | WSL | `mise run sync` (watch: `mise run sync-watch`) |
| Real dev (hot reload) | **Windows native** | `npm install` → `npm run dev` |

Write code on WSL, leave `mise run sync-watch` running, and every save auto-copies to the
Windows-side `C:\Users\<you>\dev\raycast-claude-launcher` (the Windows username is resolved
automatically, not hardcoded), where `npm run dev` hot-reloads.
(`node_modules` is rebuilt per OS, so it's excluded from the sync. `--inplace` lets it overwrite
even under `ray develop`'s file lock. To change the destination: `WIN_DEST=/mnt/c/... mise run sync`
or `scripts/sync-to-windows.sh <dest>`.)

```powershell
# Windows (PowerShell). Install Node on Windows; copy the code via git.
git clone <repo> C:\Users\user\dev\raycast-claude-launcher
cd C:\Users\user\dev\raycast-claude-launcher
npm install     # rebuild the Windows-native node_modules (WSL's can't be reused)
npm run dev     # = ray develop. A green icon means dev is running.
```

- In Raycast → Preferences → Advanced/Developer, turn **Auto-reload on Save** ON.
- If hot reload isn't kicking in: after `npm run build`, run `start raycast://extensions/raycast/raycast/reload-extensions`.
- Windows developer support is in beta — "unfinished but usable in practice". If `ray develop` isn't found, confirm Raycast Windows' Developer features are enabled.
