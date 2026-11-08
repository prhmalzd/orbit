export type ProjectStatus = 'active' | 'completed' | 'archived';
export type EntryType = 'idea' | 'action' | 'need' | 'achievement' | 'update';
export type EntryPriority = 'normal' | 'must';
export type EntryState = 'open' | 'done' | 'postponed' | 'dropped';

export interface CanvasPosition { x: number; y: number }

export interface Project {
  id: string;
  title: string;
  description: string;
  aliases: string[];
  color: string;
  labels: string[];
  status: ProjectStatus;
  deadline?: string;
  position: CanvasPosition;
  createdAt: string;
  updatedAt: string;
}

export interface ClassificationMeta {
  method: 'hashtag' | 'local-semantic' | 'manual';
  confidence: number;
  suggestedProjectId?: string;
  originalText: string;
}

export interface Entry {
  id: string;
  projectId?: string;
  text: string;
  type: EntryType;
  priority: EntryPriority;
  state: EntryState;
  labels: string[];
  dueAt?: string;
  postponeUntil?: string;
  completedAt?: string;
  droppedReason?: string;
  classification: ClassificationMeta;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectLink {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  label?: string;
  createdAt: string;
}

export interface TimeSession {
  id: string;
  projectId: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  origin: 'timer' | 'manual';
}

export interface AppSettings {
  id: 'settings';
  theme: 'dark';
  reducedMotion: boolean;
  canvasSnap: boolean;
  classifierEnabled: boolean;
  hasOnboarded: boolean;
}

export interface OrbitSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  data: OrbitExport;
}

export interface OrbitExport {
  app: 'Orbit';
  schemaVersion: 1;
  exportedAt: string;
  projects: Project[];
  entries: Entry[];
  links: ProjectLink[];
  sessions: TimeSession[];
  settings: AppSettings;
}

export interface SyncConfig {
  id: 'sync';
  workspaceId: string;
  deviceId: string;
  deviceName: string;
  encryptionKey: string;
  signingPrivateKey: JsonWebKey;
  signingPublicKey: JsonWebKey;
  lastRemoteVersion: number;
  lastSyncedAt?: string;
  lastSyncedData?: OrbitExport;
  dirtySince?: string;
}

export type SyncEntity = 'projects' | 'entries' | 'links' | 'sessions';

export interface SyncConflict {
  id: string;
  entity: SyncEntity;
  recordId: string;
  localRecord: unknown;
  remoteRecord: unknown;
  createdAt: string;
}

export interface PairingBundle {
  version: 1;
  workspaceId: string;
  encryptionKey: string;
  signingPrivateKey: JsonWebKey;
  signingPublicKey: JsonWebKey;
}

export interface EncryptedSyncPayload {
  iv: string;
  ciphertext: string;
}

export interface RemoteSyncBundle extends EncryptedSyncPayload {
  version: number;
  updatedAt: string;
  deviceId: string;
}

export interface ClassificationResult {
  cleanText: string;
  projectId?: string;
  suggestedProjectId?: string;
  confidence: number;
  type: EntryType;
  priority: EntryPriority;
  labels: string[];
  method: ClassificationMeta['method'];
}

