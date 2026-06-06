import { promises as fs } from "fs";
import * as path from "path";
import { projectsDir, readDirSafe } from "./platform";

export interface Session {
  id: string; // file name (= the session id passed to --resume)
  file: string;
  cwd: string; // working directory claude ran in (we cd here before launching)
  summary: string; // short label for the session, e.g. the first user message
  mtime: number;
}

/** Scan each JSONL line for the cwd and the first user message; usually resolves near the top even for large files. */
function extract(raw: string): { cwd: string; summary: string } {
  let cwd = "";
  let summary = "";
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (!cwd && typeof obj.cwd === "string") cwd = obj.cwd;
    if (!summary && obj.type === "user") {
      const msg = obj.message as { content?: unknown } | undefined;
      const c = msg?.content;
      if (typeof c === "string") summary = c;
      else if (Array.isArray(c)) {
        const t = c.find((p) => (p as { type?: string }).type === "text") as
          | { text?: string }
          | undefined;
        if (t?.text) summary = t.text;
      }
    }
    if (cwd && summary) break;
  }
  return { cwd, summary: summary.replace(/\s+/g, " ").trim().slice(0, 120) };
}

export async function loadSessions(limit = 200): Promise<Session[]> {
  const root = await projectsDir();
  const projects = await readDirSafe(root);
  const out: Session[] = [];

  for (const proj of projects) {
    const dir = path.join(root, proj);
    const files = await readDirSafe(dir);
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const file = path.join(dir, f);
      try {
        const stat = await fs.stat(file);
        const raw = await fs.readFile(file, "utf8");
        const { cwd, summary } = extract(raw);
        out.push({
          id: path.basename(f, ".jsonl"),
          file,
          cwd: cwd || decodeProjectDir(proj),
          summary: summary || "(no summary)",
          mtime: stat.mtimeMs,
        });
      } catch {
        // skip corrupt or unreadable files
      }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, limit);
}

/** Rough reconstruction from a projects dir name (path separators replaced with -). Unused when a cwd was found. */
function decodeProjectDir(name: string): string {
  return name.startsWith("-") ? name.replace(/-/g, "/") : name;
}
