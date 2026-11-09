import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { findProjectSuggestions, getMentionMatch, insertProjectMention } from './mentions';

const makeProject = (id: string, title: string, aliases: string[] = []): Project => ({
  id, title, aliases, description: '', color: '#fff', labels: [], status: 'active', position: { x: 0, y: 0 },
  createdAt: '2026-01-01', updatedAt: '2026-01-01'
});

describe('project mentions', () => {
  const projects = [makeProject('tracking', 'Tracking'), makeProject('telegram', 'Telegram Bots', ['bots']), makeProject('archive', 'Old Tool')];

  it('detects a mention being typed at the end of a capture', () => {
    expect(getMentionMatch('new thought for @T')).toEqual({ start: 16, query: 't' });
    expect(getMentionMatch('email@example.com')).toBeNull();
  });

  it('suggests active project names and aliases', () => {
    expect(findProjectSuggestions('@T', projects).map((project) => project.title)).toEqual(['Telegram Bots', 'Tracking']);
    expect(findProjectSuggestions('@bot', projects).map((project) => project.title)).toEqual(['Telegram Bots']);
  });

  it('inserts a slug that the classifier can match', () => {
    expect(insertProjectMention('Remember this for @Tel', projects[1])).toBe('Remember this for @Telegram-Bots ');
  });
});
