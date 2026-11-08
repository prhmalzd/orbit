import { describe, expect, it } from 'vitest';
import { validateImport } from './portable';
import { defaultSettings } from '../db';

describe('Orbit imports', () => {
  it('accepts a complete current backup', () => {
    const backup = { app: 'Orbit', schemaVersion: 1, exportedAt: new Date().toISOString(), projects: [], entries: [], links: [], sessions: [], settings: defaultSettings } as const;
    expect(validateImport(backup).app).toBe('Orbit');
  });

  it('rejects malformed and future backups', () => {
    expect(() => validateImport({ app: 'Orbit', schemaVersion: 2 })).toThrow('Unsupported');
    expect(() => validateImport({ app: 'Orbit', schemaVersion: 1, projects: [] })).toThrow('incomplete');
  });
});

