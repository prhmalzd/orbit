import { db } from '../db';
import type { OrbitExport, RemoteSyncBundle, SyncConfig, SyncConflict, SyncEntity } from '../types';
import { newId } from './domain';
import { collectExport, importWorkspace } from './portable';
import { decryptWorkspace, digestText, encryptWorkspace, signSyncRequest } from './sync-crypto';
import { emptySyncExport, mergeWorkspaces, normalizeForSync } from './sync-merge';

export type SyncResult = { status: 'synced' | 'conflicts' | 'unpaired'; conflicts?: number; version?: number };
let activeSync: Promise<SyncResult> | null = null;
let dirtyTimer: number | undefined;

function syncRecords(value: OrbitExport) {
  return JSON.stringify({ projects: value.projects, entries: value.entries, links: value.links, sessions: value.sessions });
}

export function defaultDeviceName() {
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const platform = navigator.platform || 'Device';
  return mobile ? `Mobile · ${platform}` : `Computer · ${platform}`;
}

export async function markSyncDirty(schedule = true) {
  const config = await db.syncConfig.get('sync');
  if (!config) return;
  if (!config.dirtySince) await db.syncConfig.update('sync', { dirtySince: new Date().toISOString() });
  window.dispatchEvent(new Event('orbit-sync-state'));
  if (schedule && navigator.onLine) {
    window.clearTimeout(dirtyTimer);
    dirtyTimer = window.setTimeout(() => { void syncNow(); }, 8000);
  }
}

async function requestRemote(config: SyncConfig) {
  const timestamp = new Date().toISOString();
  const signature = await signSyncRequest(config, 'read', timestamp, '');
  const response = await fetch('/api/sync', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'read', workspaceId: config.workspaceId, timestamp, signature })
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Could not read the remote snapshot.');
  return (await response.json() as { bundle: RemoteSyncBundle | null }).bundle;
}

async function writeRemote(config: SyncConfig, data: OrbitExport, baseVersion: number) {
  const encrypted = await encryptWorkspace(data, config.encryptionKey);
  const payload = { ...encrypted, deviceId: config.deviceId, baseVersion };
  const payloadText = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const digest = await digestText(payloadText);
  const signature = await signSyncRequest(config, 'write', timestamp, digest);
  const response = await fetch('/api/sync', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'write', workspaceId: config.workspaceId, timestamp, digest, signature,
      publicKey: config.signingPublicKey, payload
    })
  });
  if (response.status === 409) throw new Error('REMOTE_CHANGED');
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Could not upload the encrypted snapshot.');
  return await response.json() as { version: number; updatedAt: string };
}

async function applyMergedData(data: OrbitExport) {
  const current = await collectExport();
  const positions = new Map(current.projects.map((project) => [project.id, project.position]));
  const projects = data.projects.map((project, index) => ({
    ...project,
    position: positions.get(project.id) ?? { x: 120 + (index % 3) * 330, y: 100 + Math.floor(index / 3) * 280 }
  }));
  await importWorkspace({ ...data, projects, settings: current.settings }, 'replace');
}

async function runSync(retry = true): Promise<SyncResult> {
  const config = await db.syncConfig.get('sync');
  if (!config) return { status: 'unpaired' };
  if (!navigator.onLine) throw new Error('Orbit is offline. Your changes are safe and will sync later.');
  if (await db.syncConflicts.count()) return { status: 'conflicts', conflicts: await db.syncConflicts.count() };

  const local = normalizeForSync(await collectExport());
  const remoteBundle = await requestRemote(config);
  if (!remoteBundle) {
    const written = await writeRemote(config, local, 0);
    await db.syncConfig.update('sync', { lastRemoteVersion: written.version, lastSyncedAt: written.updatedAt, lastSyncedData: local, dirtySince: undefined });
    return { status: 'synced', version: written.version };
  }

  const remote = normalizeForSync(await decryptWorkspace(remoteBundle, config.encryptionKey));
  const base = config.lastSyncedData ? normalizeForSync(config.lastSyncedData) : emptySyncExport();
  const merged = mergeWorkspaces(base, local, remote);
  if (syncRecords(merged.data) !== syncRecords(local)) await applyMergedData(merged.data);

  if (merged.conflicts.length) {
    await db.syncConflicts.bulkPut(merged.conflicts);
    await db.syncConfig.update('sync', {
      lastRemoteVersion: remoteBundle.version, lastSyncedAt: remoteBundle.updatedAt,
      lastSyncedData: remote, dirtySince: new Date().toISOString()
    });
    return { status: 'conflicts', conflicts: merged.conflicts.length, version: remoteBundle.version };
  }

  const needsUpload = syncRecords(merged.data) !== syncRecords(remote);
  if (needsUpload) {
    try {
      const written = await writeRemote(config, normalizeForSync(merged.data), remoteBundle.version);
      await db.syncConfig.update('sync', { lastRemoteVersion: written.version, lastSyncedAt: written.updatedAt, lastSyncedData: normalizeForSync(merged.data), dirtySince: undefined });
      return { status: 'synced', version: written.version };
    } catch (error) {
      if (retry && error instanceof Error && error.message === 'REMOTE_CHANGED') return runSync(false);
      throw error;
    }
  }
  await db.syncConfig.update('sync', { lastRemoteVersion: remoteBundle.version, lastSyncedAt: remoteBundle.updatedAt, lastSyncedData: remote, dirtySince: undefined });
  return { status: 'synced', version: remoteBundle.version };
}

export function syncNow() {
  if (!activeSync) activeSync = runSync().finally(() => {
    activeSync = null;
    window.dispatchEvent(new Event('orbit-sync-state'));
  });
  return activeSync;
}

function tableFor(entity: SyncEntity) {
  if (entity === 'projects') return db.projects;
  if (entity === 'entries') return db.entries;
  if (entity === 'links') return db.links;
  return db.sessions;
}

export async function resolveSyncConflict(conflict: SyncConflict, choice: 'local' | 'remote' | 'both') {
  const table = tableFor(conflict.entity) as unknown as { put: (record: Record<string, unknown>) => Promise<unknown>; delete: (id: string) => Promise<unknown> };
  const selected = choice === 'remote' ? conflict.remoteRecord : conflict.localRecord;
  if (choice !== 'both') {
    if (selected) await table.put(selected as Record<string, unknown>);
    else await table.delete(conflict.recordId);
  } else {
    if (conflict.remoteRecord) await table.put(conflict.remoteRecord as Record<string, unknown>);
    if (conflict.localRecord) {
      const copy: Record<string, unknown> = { ...(conflict.localRecord as Record<string, unknown>), id: newId(conflict.entity.slice(0, -1)) };
      if (conflict.entity === 'projects' && typeof copy.title === 'string') copy.title = `${copy.title} (copy)`;
      await table.put(copy);
    }
  }
  await db.syncConflicts.delete(conflict.id);
  await markSyncDirty(false);
}

