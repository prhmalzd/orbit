import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, Entry, OrbitSnapshot, Project, ProjectLink, SyncConfig, SyncConflict, TimeSession } from './types';

class OrbitDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  links!: EntityTable<ProjectLink, 'id'>;
  sessions!: EntityTable<TimeSession, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  snapshots!: EntityTable<OrbitSnapshot, 'id'>;
  syncConfig!: EntityTable<SyncConfig, 'id'>;
  syncConflicts!: EntityTable<SyncConflict, 'id'>;

  constructor() {
    super('orbit-workspace');
    this.version(1).stores({
      projects: 'id, status, updatedAt, *labels',
      entries: 'id, projectId, state, type, priority, createdAt, postponeUntil, *labels',
      links: 'id, sourceProjectId, targetProjectId',
      sessions: 'id, projectId, startedAt, endedAt',
      settings: 'id',
      snapshots: 'id, createdAt'
    });
    this.version(2).stores({
      projects: 'id, status, updatedAt, *labels',
      entries: 'id, projectId, state, type, priority, createdAt, postponeUntil, *labels',
      links: 'id, sourceProjectId, targetProjectId',
      sessions: 'id, projectId, startedAt, endedAt',
      settings: 'id',
      snapshots: 'id, createdAt',
      syncConfig: 'id, workspaceId, deviceId',
      syncConflicts: 'id, entity, recordId, createdAt'
    });
  }
}

export const db = new OrbitDatabase();

export const defaultSettings: AppSettings = {
  id: 'settings',
  theme: 'dark',
  reducedMotion: false,
  canvasSnap: false,
  classifierEnabled: true,
  hasOnboarded: false
};

