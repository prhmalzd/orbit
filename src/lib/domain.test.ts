import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickProject, projectProgress, projectMinutes } from './domain';
import type { Entry, Project, TimeSession } from '../types';

const entry = (changes: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), projectId: 'p1', text: 'Thing', type: 'action', priority: 'normal', state: 'open', labels: [],
  classification: { method: 'manual', confidence: 1, originalText: 'Thing' }, createdAt: '2026-01-01', updatedAt: '2026-01-01', ...changes
});

const project = (changes: Partial<Project>): Project => ({
  id: 'p1', title: 'Project', description: '', aliases: [], labels: [], color: '#fff', status: 'active', position: { x: 0, y: 0 },
  createdAt: '2026-01-01', updatedAt: '2026-01-01', ...changes
});

describe('project calculations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('counts actionable and postponed work but excludes dropped entries', () => {
    const entries = [entry({ state: 'done' }), entry({ state: 'postponed' }), entry({ state: 'dropped' }), entry({ type: 'idea', state: 'done' })];
    expect(projectProgress(entries, 'p1')).toBe(50);
  });

  it('returns null progress when a project only contains notes', () => {
    expect(projectProgress([entry({ type: 'idea' })], 'p1')).toBeNull();
  });

  it('adds timer and manual sessions', () => {
    const sessions: TimeSession[] = [
      { id: 'a', projectId: 'p1', startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T10:30:00Z', origin: 'timer' },
      { id: 'b', projectId: 'p1', startedAt: '2026-01-01T11:00:00Z', endedAt: '2026-01-01T11:15:00Z', durationMinutes: 15, origin: 'manual' }
    ];
    expect(projectMinutes(sessions, 'p1')).toBe(45);
  });

  it('chooses only active projects with available work', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const choice = pickProject([project({}), project({ id: 'p2', status: 'archived' })], [entry({})], new Date('2026-02-01'));
    expect(choice?.project.id).toBe('p1');
  });
});

