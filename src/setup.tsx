/**
 * Setup / status check.
 * Shows the resolved configuration (which .claude stores are read, the claude binary, the
 * WSL distro) and validates it, so a freshly installed extension can be verified in one
 * place. Read-only and free — it never calls claude with -p.
 * The primary action opens the extension preferences so things can be overridden.
 */
import { useEffect, useState } from "react";
import * as path from "path";
import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  openExtensionPreferences,
} from "@raycast/api";
import {
  backendLabel,
  claudeBinFound,
  claudeStores,
  isWindows,
  readDirSafe,
  resolvedConfig,
  wslDistroExists,
} from "./lib/platform";

type Status = "ok" | "warn" | "info";

interface Check {
  id: string;
  title: string;
  value: string;
  status: Status;
  hint: string;
}

function statusIcon(s: Status) {
  if (s === "ok") return { source: Icon.CheckCircle, tintColor: Color.Green };
  if (s === "warn") return { source: Icon.Warning, tintColor: Color.Yellow };
  return { source: Icon.Info, tintColor: Color.SecondaryText };
}

export default function Setup() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const cfg = await resolvedConfig();
    const out: Check[] = [];

    out.push({
      id: "platform",
      title: "Platform",
      value: cfg.platform,
      status: "info",
      hint: "How this extension opens a terminal and launches claude.",
    });

    if (cfg.macTerminal) {
      const labels: Record<string, string> = {
        terminal: "Terminal.app",
        iterm: "iTerm2",
        ghostty: "Ghostty",
      };
      out.push({
        id: "macTerminal",
        title: "Terminal",
        value: labels[cfg.macTerminal] ?? cfg.macTerminal,
        status: "info",
        hint: "The terminal app interactive sessions launch in. Change it in preferences.",
      });
    }

    if (isWindows) {
      const distroOk = await wslDistroExists();
      out.push({
        id: "distro",
        title: "WSL Distro",
        value: cfg.wslDistro ?? "Ubuntu",
        status: distroOk ? "ok" : "warn",
        hint: distroOk
          ? "Distro found."
          : "This distro was not found. If you don't use WSL you can ignore it; otherwise set the correct name in preferences (list them with: wsl -l -q).",
      });
    }

    const stores = await claudeStores();
    // Only qualify rows by environment when there's more than one (e.g. WSL + native);
    // on a single-environment host the label is just noise.
    const multi = stores.length > 1;
    for (const store of stores) {
      const projects = await readDirSafe(path.join(store.root, "projects"));
      out.push({
        id: `store-${store.backend}`,
        title: multi ? `${backendLabel(store.backend)} store` : "Claude store",
        value: store.root,
        status: projects.length > 0 ? "ok" : "warn",
        hint:
          projects.length > 0
            ? `Readable — ${projects.length} project folder(s).`
            : "No session history found here.",
      });
    }

    // One binary check per environment actually in use.
    for (const backend of [...new Set(stores.map((s) => s.backend))]) {
      const ok = await claudeBinFound(backend);
      out.push({
        id: `bin-${backend}`,
        title: multi
          ? `Claude Binary (${backendLabel(backend)})`
          : "Claude Binary",
        value: cfg.claudeBin,
        status: ok ? "ok" : "warn",
        hint: ok
          ? "Found on PATH in the launch shell."
          : "Not found in the launch shell. Install Claude Code there, or set an absolute path in preferences.",
      });
    }

    setChecks(out);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <List isLoading={loading} isShowingDetail>
      <List.Section title="Setup">
        {checks.map((c) => (
          <List.Item
            key={c.id}
            icon={statusIcon(c.status)}
            title={c.title}
            subtitle={c.value}
            detail={
              <List.Item.Detail
                markdown={`### ${c.title}\n\n\`\`\`\n${c.value}\n\`\`\`\n\n${c.hint}`}
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title="Open Extension Preferences"
                  icon={Icon.Gear}
                  onAction={openExtensionPreferences}
                />
                <Action
                  title="Re-Run Checks"
                  icon={Icon.ArrowClockwise}
                  onAction={refresh}
                />
                <Action.CopyToClipboard title="Copy Value" content={c.value} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
