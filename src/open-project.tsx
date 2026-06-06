import { useEffect, useState } from "react";
import * as path from "path";
import {
  Action,
  ActionPanel,
  Clipboard,
  closeMainWindow,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import {
  buildCommand,
  launchInteractive,
  projectsDir,
  readDirSafe,
} from "./lib/platform";
import { loadSessions } from "./lib/sessions";

interface Project {
  cwd: string;
  label: string;
  lastUsed?: number;
}

export default function OpenProject() {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sessions = await loadSessions(1000);
      const map = new Map<string, Project>();
      for (const s of sessions) {
        const cur = map.get(s.cwd);
        if (!cur || (cur.lastUsed ?? 0) < s.mtime) {
          map.set(s.cwd, {
            cwd: s.cwd,
            label: path.basename(s.cwd) || s.cwd,
            lastUsed: s.mtime,
          });
        }
      }
      for (const name of await readDirSafe(await projectsDir())) {
        const cwd = name.startsWith("-") ? name.replace(/-/g, "/") : name;
        if (!map.has(cwd))
          map.set(cwd, { cwd, label: path.basename(cwd) || cwd });
      }
      setItems(
        [...map.values()].sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0)),
      );
      setLoading(false);
    })();
  }, []);

  async function launch(p: Project, extra: string[]) {
    try {
      await closeMainWindow();
      await launchInteractive(p.cwd, extra);
    } catch {
      const cmd = buildCommand(extra, p.cwd);
      await Clipboard.copy(cmd);
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't launch — command copied to clipboard",
        message: cmd,
      });
    }
  }

  return (
    <List
      isLoading={loading}
      searchBarPlaceholder="Search projects by name or path"
    >
      {items.map((p) => (
        <List.Item
          key={p.cwd}
          title={p.label}
          subtitle={p.cwd}
          keywords={[p.cwd]}
          accessories={p.lastUsed ? [{ date: new Date(p.lastUsed) }] : []}
          actions={
            <ActionPanel>
              <Action
                title="Start New Session"
                icon={Icon.Terminal}
                onAction={() => launch(p, [])}
              />
              <Action
                title="Continue Last Session"
                icon={Icon.ArrowRight}
                onAction={() => launch(p, ["--continue"])}
              />
              <Action.CopyToClipboard
                title="Copy Launch Command"
                content={buildCommand([], p.cwd)}
              />
              <Action.CopyToClipboard
                title="Copy Directory Path"
                content={p.cwd}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
