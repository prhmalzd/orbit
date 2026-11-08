import { db, defaultSettings } from '../db';
import type { OrbitExport, OrbitSnapshot } from '../types';
import { newId } from './domain';

export async function collectExport(): Promise<OrbitExport> {
  const [projects, entries, links, sessions, settings] = await Promise.all([
    db.projects.toArray(), db.entries.toArray(), db.links.toArray(), db.sessions.toArray(), db.settings.get('settings')
  ]);
  return {
    app: 'Orbit', schemaVersion: 1, exportedAt: new Date().toISOString(),
    projects, entries, links, sessions, settings: settings ?? defaultSettings
  };
}

export async function createSnapshot(reason: string): Promise<OrbitSnapshot> {
  const snapshot = { id: newId('snapshot'), createdAt: new Date().toISOString(), reason, data: await collectExport() };
  await db.snapshots.put(snapshot);
  return snapshot;
}

export function validateImport(value: unknown): OrbitExport {
  if (!value || typeof value !== 'object') throw new Error('This file does not contain an Orbit workspace.');
  const candidate = value as Partial<OrbitExport>;
  if (candidate.app !== 'Orbit' || candidate.schemaVersion !== 1) throw new Error('Unsupported Orbit backup version.');
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.entries) || !Array.isArray(candidate.links) || !Array.isArray(candidate.sessions)) {
    throw new Error('The backup is incomplete or malformed.');
  }
  for (const project of candidate.projects) {
    if (!project || typeof project.id !== 'string' || typeof project.title !== 'string') throw new Error('The backup contains an invalid project.');
  }
  for (const entry of candidate.entries) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string') throw new Error('The backup contains an invalid entry.');
  }
  return candidate as OrbitExport;
}

export async function importWorkspace(data: OrbitExport, mode: 'merge' | 'replace') {
  await createSnapshot(`Before ${mode} import`);
  await db.transaction('rw', [db.projects, db.entries, db.links, db.sessions, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([db.projects.clear(), db.entries.clear(), db.links.clear(), db.sessions.clear()]);
      await db.settings.put(data.settings ?? defaultSettings);
      await db.projects.bulkPut(data.projects);
      await db.entries.bulkPut(data.entries);
      await db.links.bulkPut(data.links);
      await db.sessions.bulkPut(data.sessions);
      return;
    }

    const idMap = new Map<string, string>();
    const existingProjectIds = new Set((await db.projects.toCollection().primaryKeys()).map(String));
    const projects = data.projects.map((project) => {
      const id = existingProjectIds.has(project.id) ? newId('project') : project.id;
      idMap.set(project.id, id);
      return { ...project, id };
    });
    const existingEntryIds = new Set((await db.entries.toCollection().primaryKeys()).map(String));
    const entries = data.entries.map((entry) => ({
      ...entry,
      id: existingEntryIds.has(entry.id) ? newId('entry') : entry.id,
      projectId: entry.projectId ? idMap.get(entry.projectId) ?? entry.projectId : undefined
    }));
    const links = data.links.map((link) => ({
      ...link, id: newId('link'), sourceProjectId: idMap.get(link.sourceProjectId) ?? link.sourceProjectId,
      targetProjectId: idMap.get(link.targetProjectId) ?? link.targetProjectId
    }));
    const sessions = data.sessions.map((session) => ({
      ...session, id: newId('session'), projectId: idMap.get(session.projectId) ?? session.projectId
    }));
    await db.projects.bulkPut(projects);
    await db.entries.bulkPut(entries);
    await db.links.bulkPut(links);
    await db.sessions.bulkPut(sessions);
  });
}

export function downloadExport(data: OrbitExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `orbit-${new Date().toISOString().slice(0, 10)}.orbit.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

