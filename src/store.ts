import { create } from 'zustand';
import { db, defaultSettings } from './db';
import { classifyCapture } from './lib/classifier';
import { newId } from './lib/domain';
import { markSyncDirty } from './lib/sync';
import type { AppSettings, ClassificationResult, Entry, EntryState, EntryType, Project, ProjectLink, TimeSession } from './types';

export type ViewMode = 'constellation' | 'list' | 'inbox';

interface OrbitState {
  projects: Project[];
  entries: Entry[];
  links: ProjectLink[];
  sessions: TimeSession[];
  settings: AppSettings;
  view: ViewMode;
  selectedProjectId?: string;
  search: string;
  loading: boolean;
  toast?: string;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setView: (view: ViewMode) => void;
  setSearch: (search: string) => void;
  selectProject: (id?: string) => void;
  notify: (message: string) => void;
  addProject: (input: Pick<Project, 'title' | 'description' | 'color'> & { deadline?: string; labels?: string[] }) => Promise<Project>;
  updateProject: (id: string, changes: Partial<Project>) => Promise<void>;
  moveProject: (id: string, x: number, y: number) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  capture: (text: string) => Promise<Entry>;
  addEntry: (projectId: string, text: string, type: EntryType, priority?: 'normal' | 'must') => Promise<Entry>;
  updateEntry: (id: string, changes: Partial<Entry>) => Promise<void>;
  setEntryState: (id: string, state: EntryState, options?: { postponeUntil?: string; droppedReason?: string }) => Promise<void>;
  assignEntry: (id: string, projectId: string, type?: EntryType) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  linkProjects: (sourceProjectId: string, targetProjectId: string, label?: string) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
  startTimer: (projectId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  addManualTime: (projectId: string, minutes: number) => Promise<void>;
  updateSettings: (changes: Partial<AppSettings>) => Promise<void>;
}

let classifierWorker: Worker | null = null;
const pending = new Map<string, (result: ClassificationResult) => void>();

function classifyAsync(text: string, projects: Project[]) {
  if (typeof Worker === 'undefined') return Promise.resolve(classifyCapture(text, projects));
  if (!classifierWorker) {
    classifierWorker = new Worker(new URL('./workers/classifier.worker.ts', import.meta.url), { type: 'module' });
    classifierWorker.onmessage = (event: MessageEvent<{ id: string; result: ClassificationResult }>) => {
      pending.get(event.data.id)?.(event.data.result);
      pending.delete(event.data.id);
    };
  }
  return new Promise<ClassificationResult>((resolve) => {
    const id = newId('classification');
    pending.set(id, resolve);
    classifierWorker!.postMessage({ id, text, projects });
  });
}

const sortNewest = <T extends { updatedAt?: string; createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());

export const useOrbitStore = create<OrbitState>((set, get) => ({
  projects: [], entries: [], links: [], sessions: [], settings: defaultSettings,
  view: 'constellation', search: '', loading: true,

  refresh: async () => {
    const [projects, entries, links, sessions, settings] = await Promise.all([
      db.projects.toArray(), db.entries.toArray(), db.links.toArray(), db.sessions.toArray(), db.settings.get('settings')
    ]);
    set({ projects: sortNewest(projects), entries: sortNewest(entries), links, sessions, settings: settings ?? defaultSettings, loading: false });
  },

  initialize: async () => {
    if (!await db.settings.get('settings')) await db.settings.put(defaultSettings);
    await get().refresh();
  },

  setView: (view) => set({ view }),
  setSearch: (search) => set({ search }),
  selectProject: (selectedProjectId) => set({ selectedProjectId }),
  notify: (toast) => {
    set({ toast });
    window.setTimeout(() => { if (get().toast === toast) set({ toast: undefined }); }, 3200);
  },

  addProject: async ({ title, description, color, deadline, labels = [] }) => {
    const now = new Date().toISOString();
    const index = get().projects.length;
    const project: Project = {
      id: newId('project'), title: title.trim(), description: description.trim(), color, deadline: deadline || undefined,
      aliases: [], labels, status: 'active', position: { x: 120 + (index % 3) * 330, y: 100 + Math.floor(index / 3) * 280 },
      createdAt: now, updatedAt: now
    };
    set((state) => ({ projects: [project, ...state.projects] }));
    try { await db.projects.add(project); await markSyncDirty(); } catch (error) {
      set((state) => ({ projects: state.projects.filter((item) => item.id !== project.id) }));
      throw error;
    }
    return project;
  },

  updateProject: async (id, changes) => {
    const previous = get().projects;
    const updatedAt = new Date().toISOString();
    set({ projects: previous.map((project) => project.id === id ? { ...project, ...changes, updatedAt } : project) });
    try { await db.projects.update(id, { ...changes, updatedAt }); await markSyncDirty(); } catch (error) { set({ projects: previous }); throw error; }
  },

  moveProject: async (id, x, y) => {
    set((state) => ({ projects: state.projects.map((project) => project.id === id ? { ...project, position: { x, y } } : project) }));
    await db.projects.update(id, { position: { x, y } });
  },

  removeProject: async (id) => {
    await db.transaction('rw', [db.projects, db.entries, db.links, db.sessions], async () => {
      await db.projects.delete(id);
      await db.entries.where('projectId').equals(id).modify({ projectId: undefined });
      await db.links.where('sourceProjectId').equals(id).delete();
      await db.links.where('targetProjectId').equals(id).delete();
      await db.sessions.where('projectId').equals(id).delete();
    });
    if (get().selectedProjectId === id) set({ selectedProjectId: undefined });
    await get().refresh();
    await markSyncDirty();
  },

  capture: async (text) => {
    const now = new Date().toISOString();
    const placeholder: Entry = {
      id: newId('entry'), text: text.trim(), type: 'update', priority: 'normal', state: 'open', labels: [],
      classification: { method: 'local-semantic', confidence: 0, originalText: text }, createdAt: now, updatedAt: now
    };
    set((state) => ({ entries: [placeholder, ...state.entries] }));
    await db.entries.add(placeholder);
    try {
      const result = get().settings.classifierEnabled ? await classifyAsync(text, get().projects) : classifyCapture(text, []);
      const entry: Entry = {
        ...placeholder, text: result.cleanText, projectId: result.projectId, type: result.type, priority: result.priority,
        labels: result.labels, classification: {
          method: result.method, confidence: result.confidence, suggestedProjectId: result.suggestedProjectId, originalText: text
        }
      };
      await db.entries.put(entry);
      await markSyncDirty();
      set((state) => ({ entries: state.entries.map((item) => item.id === entry.id ? entry : item) }));
      get().notify(entry.projectId ? 'Captured and placed in its orbit.' : 'Captured in Inbox for a quick decision.');
      return entry;
    } catch (error) {
      get().notify('Captured safely. Automatic sorting was unavailable.');
      return placeholder;
    }
  },

  addEntry: async (projectId, text, type, priority = 'normal') => {
    const now = new Date().toISOString();
    const entry: Entry = {
      id: newId('entry'), projectId, text: text.trim(), type, priority, state: 'open', labels: [],
      classification: { method: 'manual', confidence: 1, originalText: text }, createdAt: now, updatedAt: now
    };
    await db.entries.add(entry);
    await markSyncDirty();
    set((state) => ({ entries: [entry, ...state.entries] }));
    return entry;
  },

  updateEntry: async (id, changes) => {
    const updatedAt = new Date().toISOString();
    await db.entries.update(id, { ...changes, updatedAt });
    await markSyncDirty();
    set((state) => ({ entries: state.entries.map((entry) => entry.id === id ? { ...entry, ...changes, updatedAt } : entry) }));
  },

  setEntryState: async (id, state, options = {}) => {
    const changes: Partial<Entry> = {
      state, postponeUntil: options.postponeUntil, droppedReason: options.droppedReason,
      completedAt: state === 'done' ? new Date().toISOString() : undefined
    };
    await get().updateEntry(id, changes);
  },

  assignEntry: async (id, projectId, type) => {
    const project = get().projects.find((item) => item.id === projectId);
    const entry = get().entries.find((item) => item.id === id);
    if (!project || !entry) return;
    const aliases = new Set(project.aliases);
    entry.classification.originalText.split(/\s+/).filter((word) => word.length > 3).slice(0, 3).forEach((word) => aliases.add(word.toLowerCase()));
    await Promise.all([
      get().updateEntry(id, { projectId, type: type ?? entry.type, classification: { ...entry.classification, method: 'manual', confidence: 1, suggestedProjectId: undefined } }),
      get().updateProject(projectId, { aliases: [...aliases].slice(-20) })
    ]);
  },

  deleteEntry: async (id) => {
    await db.entries.delete(id);
    await markSyncDirty();
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
  },

  linkProjects: async (sourceProjectId, targetProjectId, label) => {
    if (sourceProjectId === targetProjectId || get().links.some((link) =>
      (link.sourceProjectId === sourceProjectId && link.targetProjectId === targetProjectId) ||
      (link.sourceProjectId === targetProjectId && link.targetProjectId === sourceProjectId))) return;
    const link = { id: newId('link'), sourceProjectId, targetProjectId, label, createdAt: new Date().toISOString() };
    await db.links.add(link);
    await markSyncDirty();
    set((state) => ({ links: [...state.links, link] }));
  },

  removeLink: async (id) => {
    await db.links.delete(id);
    await markSyncDirty();
    set((state) => ({ links: state.links.filter((link) => link.id !== id) }));
  },

  startTimer: async (projectId) => {
    const running = get().sessions.find((session) => !session.endedAt && session.origin === 'timer');
    if (running) await get().stopTimer();
    const session: TimeSession = { id: newId('session'), projectId, startedAt: new Date().toISOString(), origin: 'timer' };
    await db.sessions.add(session);
    set((state) => ({ sessions: [...state.sessions, session] }));
  },

  stopTimer: async () => {
    const running = get().sessions.find((session) => !session.endedAt && session.origin === 'timer');
    if (!running) return;
    const endedAt = new Date().toISOString();
    const durationMinutes = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(running.startedAt).getTime()) / 60000));
    await db.sessions.update(running.id, { endedAt, durationMinutes });
    await markSyncDirty();
    set((state) => ({ sessions: state.sessions.map((session) => session.id === running.id ? { ...session, endedAt, durationMinutes } : session) }));
  },

  addManualTime: async (projectId, minutes) => {
    const endedAt = new Date().toISOString();
    const session: TimeSession = {
      id: newId('session'), projectId, startedAt: new Date(Date.now() - minutes * 60000).toISOString(), endedAt,
      durationMinutes: minutes, origin: 'manual'
    };
    await db.sessions.add(session);
    await markSyncDirty();
    set((state) => ({ sessions: [...state.sessions, session] }));
  },

  updateSettings: async (changes) => {
    const settings = { ...get().settings, ...changes };
    await db.settings.put(settings);
    set({ settings });
  }
}));

