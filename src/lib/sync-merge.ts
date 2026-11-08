import { defaultSettings } from '../db';
import type { OrbitExport, SyncConflict, SyncEntity } from '../types';
import { newId } from './domain';

type Identified = { id: string };

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeCollection<T extends Identified>(entity: SyncEntity, baseItems: T[], localItems: T[], remoteItems: T[]) {
  const base = new Map(baseItems.map((item) => [item.id, item]));
  const local = new Map(localItems.map((item) => [item.id, item]));
  const remote = new Map(remoteItems.map((item) => [item.id, item]));
  const ids = new Set([...base.keys(), ...local.keys(), ...remote.keys()]);
  const merged: T[] = [];
  const conflicts: SyncConflict[] = [];

  for (const id of ids) {
    const baseRecord = base.get(id);
    const localRecord = local.get(id);
    const remoteRecord = remote.get(id);
    if (equal(localRecord, remoteRecord)) {
      if (localRecord) merged.push(localRecord);
    } else if (equal(localRecord, baseRecord)) {
      if (remoteRecord) merged.push(remoteRecord);
    } else if (equal(remoteRecord, baseRecord)) {
      if (localRecord) merged.push(localRecord);
    } else {
      if (localRecord) merged.push(localRecord);
      conflicts.push({
        id: newId('conflict'), entity, recordId: id, localRecord: localRecord ?? null,
        remoteRecord: remoteRecord ?? null, createdAt: new Date().toISOString()
      });
    }
  }
  return { merged, conflicts };
}

export function emptySyncExport(): OrbitExport {
  return { app: 'Orbit', schemaVersion: 1, exportedAt: new Date(0).toISOString(), projects: [], entries: [], links: [], sessions: [], settings: defaultSettings };
}

export function normalizeForSync(data: OrbitExport): OrbitExport {
  return {
    ...data,
    exportedAt: new Date().toISOString(),
    projects: data.projects.map((project) => ({ ...project, position: { x: 0, y: 0 } })),
    sessions: data.sessions.filter((session) => !!session.endedAt),
    settings: defaultSettings
  };
}

export function mergeWorkspaces(base: OrbitExport, local: OrbitExport, remote: OrbitExport) {
  const projects = mergeCollection('projects', base.projects, local.projects, remote.projects);
  const entries = mergeCollection('entries', base.entries, local.entries, remote.entries);
  const links = mergeCollection('links', base.links, local.links, remote.links);
  const sessions = mergeCollection('sessions', base.sessions, local.sessions, remote.sessions);
  return {
    data: {
      app: 'Orbit' as const, schemaVersion: 1 as const, exportedAt: new Date().toISOString(),
      projects: projects.merged, entries: entries.merged, links: links.merged, sessions: sessions.merged,
      settings: local.settings
    },
    conflicts: [...projects.conflicts, ...entries.conflicts, ...links.conflicts, ...sessions.conflicts]
  };
}

