import { get, set, del, keys } from "idb-keyval";
import type { Project } from "./types";

const PREFIX = "project:";

export async function listProjects(): Promise<Project[]> {
  const ks = await keys();
  const projectKeys = ks.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX));
  const out: Project[] = [];
  for (const k of projectKeys) {
    const p = await get<Project>(k);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(p: Project): Promise<void> {
  await set(PREFIX + p.id, p);
}

export async function deleteProject(id: string): Promise<void> {
  await del(PREFIX + id);
}

export async function duplicateProject(p: Project): Promise<Project> {
  const copy: Project = { ...p, id: crypto.randomUUID(), name: p.name + " copy", updatedAt: Date.now() };
  await saveProject(copy);
  return copy;
}
