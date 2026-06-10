# Claude Code Resume

**Resume any past Claude Code session, not just the last one — from Raycast, on macOS and Windows.**

`claude --continue` only takes you back to the most recent session per directory. This extension reads your full session history (the JSONL transcripts under `~/.claude/projects`) and lets you jump back into *any* session, with enough recall to know which one you want before you commit: Claude's auto title, the first prompt, the latest prompt, and the last reply.

![Resume Claude Code Session — session list with detail panel showing title, first prompt, latest prompt, and last reply](metadata/claude-code-resume-2.png)

## Commands

| Command | What it does |
|---|---|
| **Resume Claude Code Session** | Browse session history (newest first) → resume any session (`claude -r <id>`) in its original directory |
| **Open Claude Code Project** | Pick a recent project → start a new session or continue the last one |
| **Check Claude Code Setup** | Verify detected `.claude` stores and the `claude` binary per environment; open preferences to override |

> The session list is newest-first, so pressing Enter on the top row doubles as "resume last".
> Where launching isn't possible (terminal not found, etc.), the command is copied to the clipboard and a Toast tells you.

![Open Claude Code Project — project list](metadata/claude-code-resume-1.png)

![Check Claude Code Setup — platform, terminal, store, and binary status](metadata/claude-code-resume-3.png)

## What makes this different

There are other Claude Code extensions on the Store; this one fills a different gap:

| | [Claude Code Launcher](https://www.raycast.com/stephendolan/claude-code-launcher) | [Claude Sessions](https://www.raycast.com/kud/claude-sessions) | **Claude Code Resume** (this) |
|---|---|---|---|
| Resume a specific past session (`claude -r <id>`) | — | — | **Yes** |
| Session recall (title, first/latest prompt, last reply) | — | — | **Yes** |
| Project list source | Hand-curated favorites | `~/.claude.json` registry | **Auto-derived from session history** |
| Windows support | macOS only | macOS only | **macOS + Windows (WSL + native PowerShell)** |

## Design

- **The primary action is "launch"** — the extension's job is to take you there. Copy is the fallback.
- Launches **interactive `claude`** only (the flat-rate path). No `-p`, no metered billing.
- **No extra binaries required** — the `claude` CLI on PATH is the only hard dependency.
- Sessions open in **your real login shell**, so mise, node, and MCP tools are available.
- We only read files under `~/.claude`, so browsing is **completely free**.

## Settings (⌘,)

| Setting | macOS | Windows |
|---|---|---|
| Claude Home | empty (auto `~/.claude`) | empty — both stores are auto-detected; set only to force a single store |
| Claude Binary | `claude` | `claude` |
| macOS Terminal | `Terminal.app` (default), `iTerm2`, or `Ghostty` | — |
| WSL Distro | — | e.g. `Ubuntu` (check with `wsl -l -q`) |
| Windows Shell | — | `pwsh` (default) or `powershell` |

> **Ghostty (known behavior):** Ghostty has no AppleScript interface, so each session opens as a separate app instance — one Dock icon per session. Add `quit-after-last-window-closed = true` to your Ghostty config (`~/.config/ghostty/config`) so finished instances clean themselves up.

### Windows: two backends, auto-detected

On Windows you may run Claude Code from **WSL** and/or **natively from PowerShell**, and each keeps its own `.claude`. The extension reads **both** and tags each session so it relaunches in the right place:

- **WSL sessions** — store is `~/.claude` inside WSL. Launch runs `wt + wsl` with a login shell.
- **Windows-native sessions** — store is `C:\Users\<you>\.claude`. Launch runs `wt + PowerShell` with a temp `.ps1` that rebuilds PATH/PATHEXT from the persisted environment before running `claude`.

Use **Check Claude Code Setup** to see which stores were detected and whether `claude` resolves in each environment.

## Tips

- **Bind a global hotkey to `Resume Claude Code Session`** (e.g. ⌥⌘C) to jump back into where you left off from anywhere.
- **Bind a hotkey to `Open Claude Code Project`** to start Claude in any recent repo in a couple of keystrokes.

---

## Development

### Prerequisites

The toolchain is pinned with [mise](https://mise.jdx.dev/). Everything — Node version, pnpm version, and all build tasks — is declared in `mise.toml`.

```bash
cd raycast-claude-code-resume
mise install            # install pinned Node / pnpm
mise run install        # pnpm install
mise run dev            # load into Raycast in dev mode
```

Other tasks: `mise run build` · `mise run lint` · `mise run reset` (full reset + rebuild) · `mise run doctor` (environment check).

> `ray develop` only runs **on the same OS as the Raycast app**. `node_modules` is per-OS (native esbuild), so to test Windows backends you must clone and run dev natively on Windows.

### Developing for Windows

```powershell
# PowerShell — install mise once: winget install jdx.mise
git clone https://github.com/izumiz-dev/raycast-claude-code-resume
cd raycast-claude-code-resume
mise trust
mise install
mise run install
mise run dev
```

- Enable **Auto-reload on Save** in Raycast → Preferences → Advanced/Developer.
- If hot reload isn't kicking in: after `mise run build`, run `start raycast://extensions/raycast/raycast/reload-extensions`.

### Store screenshots

Screenshots are in `metadata/` (2000×1250, generated with Raycast's Window Capture `⇧⌘6`). To regenerate them, run the demo store generator first to get a realistic session list, then take new captures:

```bash
node scripts/demo-store.mjs          # generates ~/demo-claude with fictional sessions
# Point "Claude Home" preference at ~/demo-claude, take captures, then clear it
```
