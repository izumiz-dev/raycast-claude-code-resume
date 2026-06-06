/**
 * Setup / status check.
 * Shows the resolved configuration (the .claude home, the claude binary, the WSL
 * distro) and validates it, so a freshly installed extension can be verified in
 * one place. Read-only and free — it never calls claude with -p.
 * The primary action opens the extension preferences so paths can be overridden.
 */
import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  openExtensionPreferences,
} from "@raycast/api";
import {
  claudeBinFound,
  isWindows,
  projectsDir,
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

    if (isWindows) {
      const distroOk = await wslDistroExists();
      out.push({
        id: "distro",
        title: "WSL Distro",
        value: cfg.wslDistro ?? "Ubuntu",
        status: distroOk ? "ok" : "warn",
        hint: distroOk
          ? "Distro found."
          : "This distro was not found. Set the correct name in preferences (list them with: wsl -l -q).",
      });
    }

    const projects = await readDirSafe(await projectsDir());
    out.push({
      id: "home",
      title: "Claude Home",
      value: cfg.claudeHome,
      status: projects.length > 0 ? "ok" : "warn",
      hint:
        projects.length > 0
          ? `Readable — ${projects.length} project folder(s) here.`
          : "No session history found here. If this path is wrong, set Claude Home in preferences (leave empty to auto-detect).",
    });

    const binOk = await claudeBinFound();
    out.push({
      id: "bin",
      title: "Claude Binary",
      value: cfg.claudeBin,
      status: binOk ? "ok" : "warn",
      hint: binOk
        ? "Found on PATH in your login shell."
        : "Not found in your login shell. Install Claude Code, or set an absolute path in preferences.",
    });

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
