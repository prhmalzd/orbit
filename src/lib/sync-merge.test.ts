import { describe, expect, it } from 'vitest';
import type { Entry, OrbitExport, Project } from '../types';
import { defaultSettings } from '../db';
import { emptySyncExport, mergeWorkspaces } from './sync-merge';

const project = (changes: Partial<Project> = {}): Project => ({
  id: 'project-1', title: 'Shared project', description: '', aliases: [], labels: [], color: '#fff', status: 'active',
  position: { x: 0, y: 0 }, createdAt: '2026-01-01', updatedAt: '2026-01-01', ...changes
});

const entry = (id: string, text: string): Entry => ({
  id, projectId: 'project-1', text, type: 'idea', priority: 'normal', state: 'open', labels: [],
  classification: { method: 'manual', confidence: 1, originalText: text }, createdAt: '2026-01-01', updatedAt: '2026-01-01'
});

const workspace = (projects: Project[], entries: Entry[] = []): OrbitExport => ({
  app: 'Orbit', schemaVersion: 1, exportedAt: '2026-01-01', projects, entries, links: [], sessions: [], settings: defaultSettings
});

describe('three-way device merge', () => {
  it('combines unrelated offline additions without a conflict', () => {
    const base = workspace([project()]);
    const local = workspace([project()], [entry('local', 'Added on phone')]);
    const remote = workspace([project()], [entry('remote', 'Added on computer')]);
    const result = mergeWorkspaces(base, local, remote);
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.entries.map((item) => item.id).sort()).toEqual(['local', 'remote']);
  });

  it('detects concurrent edits to the same record', () => {
    const base = workspace([project()]);
    const local = workspace([project({ title: 'Phone title' })]);
    const remote = workspace([project({ title: 'Computer title' })]);
    const result = mergeWorkspaces(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].entity).toBe('projects');
  });

  it('carries a remote deletion when the local record stayed unchanged', () => {
    const base = workspace([project()]);
    const result = mergeWorkspaces(base, base, emptySyncExport());
    expect(result.conflicts).toHaveLength(0);
    expect(result.data.projects).toHaveLength(0);
  });

  it('flags editing a record that another device deleted', () => {
    const base = workspace([project()]);
    const local = workspace([project({ description: 'Changed offline' })]);
    const result = mergeWorkspaces(base, local, emptySyncExport());
    expect(result.conflicts).toHaveLength(1);
  });
});

