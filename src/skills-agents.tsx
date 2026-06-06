/**
 * Skills / agents browser.
 * Lists, previews, copies, and opens the SKILL.md under ~/.claude/skills and the
 * .md files under ~/.claude/agents.
 * Never calls Claude, so it's free and works on both macOS and Windows.
 */
import { useEffect, useState } from "react";
import { promises as fs } from "fs";
import * as path from "path";
import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { agentsDir, readDirSafe, skillsDir } from "./lib/platform";

interface Item {
  name: string;
  file: string;
  body: string;
  kind: "skill" | "agent";
}

async function load(): Promise<Item[]> {
  const out: Item[] = [];

  // skills: <dir>/SKILL.md
  const sDir = await skillsDir();
  for (const entry of await readDirSafe(sDir)) {
    const file = path.join(sDir, entry, "SKILL.md");
    try {
      const body = await fs.readFile(file, "utf8");
      out.push({ name: entry, file, body, kind: "skill" });
    } catch {
      /* skip directories without a SKILL.md */
    }
  }
  // agents: *.md
  const aDir = await agentsDir();
  for (const entry of await readDirSafe(aDir)) {
    if (!entry.endsWith(".md")) continue;
    const file = path.join(aDir, entry);
    try {
      const body = await fs.readFile(file, "utf8");
      out.push({
        name: path.basename(entry, ".md"),
        file,
        body,
        kind: "agent",
      });
    } catch {
      /* ignore */
    }
  }
  return out;
}

export default function SkillsAgents() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const render = (kind: "skill" | "agent") =>
    items
      .filter((i) => i.kind === kind)
      .map((i) => (
        <List.Item
          key={i.file}
          title={i.name}
          icon={kind === "skill" ? Icon.Stars : Icon.Person}
          detail={<List.Item.Detail markdown={i.body || "_(empty)_"} />}
          actions={
            <ActionPanel>
              <Action.Open title="Open Definition File" target={i.file} />
              <Action.CopyToClipboard title="Copy Name" content={i.name} />
              <Action.CopyToClipboard title="Copy Contents" content={i.body} />
              <Action.ShowInFinder path={i.file} />
            </ActionPanel>
          }
        />
      ));

  return (
    <List
      isLoading={loading}
      searchBarPlaceholder="Search skills and agents"
      isShowingDetail
    >
      <List.Section title="Skills">{render("skill")}</List.Section>
      <List.Section title="Agents">{render("agent")}</List.Section>
    </List>
  );
}
