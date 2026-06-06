# Claude Code Launcher (Raycast extension)

**Concept: make Raycast the "front door" to your Claude Code sessions.**
From anywhere, in a single stroke, without remembering paths or hashes, and keeping
your current context, drop straight *into the session*.

## Design pillars

- **The primary action is "launch".** The launcher's job is to take you there. Copy is the fallback for when launching isn't possible.
- What we launch is **interactive claude (the flat-rate path)**. We never use `-p`, so there is **zero metered billing**.
- **No extra binaries required** (the `claude` CLI is enough).
- OS differences are confined to "how the terminal opens" (mac: Terminal via `osascript` / Windows: `wt + wsl`) → **works on both macOS and Windows (WSL)**.
- We only read files under `~/.claude`, so reading is **completely free**.

## Commands

All UI text is in English. The command name (the manifest `name`) and what Enter does:

| Command (title) | mode | Enter |
|---|---|---|
| **Resume Claude Code Session** (`list-sessions`) | view | Search history (newest first) → resume the chosen session (`claude -r <id>`) |
| **Open Claude Code Project** (`open-project`) | view | A few chars of a repo → start claude there (`Start New Session` / `Continue Last Session`) |
| **Browse Claude Code Skills & Agents** (`skills-agents`) | view | Preview / copy / open files under `~/.claude/skills` and `agents` |
| **Check Claude Code Setup** (`setup`) | view | Verify the resolved `.claude` path, claude binary, and WSL distro → open preferences to override |

> The old `Resume Last` and `Search Sessions` are merged into `list-sessions` (newest first, so the top row is the most recent and pressing Enter to resume it doubles as "resume last"). `CLI Cheatsheet`, the slash-command runner, `Send to Claude Code`, and the usage/quota command were removed.
> Where launching isn't possible, the command is copied to the clipboard automatically and a Toast tells you.

## Install (environment pinned with mise + pnpm)

```bash
cd raycast-claude-launcher
mise install            # install the tools pinned in mise.toml (Node / pnpm)
mise run install        # clean dependency resolution (pnpm install)
mise run dev            # load into Raycast in dev mode (on macOS / Raycast for Windows)
```

Others: `mise run build` / `mise run lint` / `mise run reset` (full reset → rebuild) / `mise run doctor` (environment check).

> The environment is **strictly pinned with mise** (`min_version`, `mise.lock`, exact pins, and `pnpm.overrides` to unify `@types/react` at 19.0.10).
> Raycast doesn't run on this repo's host (Linux/WSL), so the build is verified by syncing to Windows. `assets/icon.png` is a flat placeholder — replace it.

## Development (write on WSL, test on Windows)

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

## Settings (⌘,)

| Setting | mac | Windows (WSL) |
|---|---|---|
| Claude Home | empty (auto `~/.claude`) | empty — the WSL home is queried automatically; set a UNC path only to override, e.g. `\\wsl.localhost\Ubuntu\home\you\.claude` |
| claude binary | `claude` | `claude` |
| WSL distro name | — | e.g. `Ubuntu` |

### Windows (WSL) key points
- Auth and sessions both live in **`~/.claude` inside WSL**. Run `claude login` inside WSL.
- Launching writes a temp script (`cd <cwd> && claude ...`, plus `exec <login-shell>` so the window stays open) and runs `wt -w 0 wsl -d <distro> -- <login-shell> -lic "source <script>"` to enter the logged-in session inside WSL (falls back to plain `wsl` if `wt` is unavailable).
- A session's `cwd` is a WSL Linux path, so it can be `cd`'d into directly.

## Recommended setup
- **Bind a global hotkey to `list-sessions`** (e.g. ⌥⌘C) → jump back into where you left off from anywhere.
- **Bind a hotkey to `open-project`** too → start Claude in any recent repo in a couple of keystrokes.
