import { describe, expect, it } from 'vitest';
import { classifyCapture } from './classifier';
import type { Project } from '../types';

const projects: Project[] = [
  {
    id: 'garden', title: 'Balcony Garden', description: 'Growing herbs and vegetables outside', aliases: ['plants'],
    labels: ['home'], color: '#8eb69b', status: 'active', position: { x: 0, y: 0 }, createdAt: '2026-01-01', updatedAt: '2026-01-01'
  },
  {
    id: 'book', title: 'Write a Book', description: 'Drafting a science fiction novel', aliases: ['novel'],
    labels: ['writing'], color: '#e78b5c', status: 'active', position: { x: 0, y: 0 }, createdAt: '2026-01-01', updatedAt: '2026-01-01'
  }
];

describe('classifyCapture', () => {
  it('lets explicit hashtags override inference', () => {
    const result = classifyCapture('Buy soil tomorrow #Balcony-Garden #need #must', projects.map((p) => p.id === 'garden' ? { ...p, aliases: [...p.aliases, 'Balcony-Garden'] } : p));
    expect(result.projectId).toBe('garden');
    expect(result.type).toBe('need');
    expect(result.priority).toBe('must');
    expect(result.method).toBe('hashtag');
  });

  it('infers action language and a matching project locally', () => {
    const result = classifyCapture('Write the next novel chapter', projects);
    expect(result.projectId).toBe('book');
    expect(result.type).toBe('action');
  });

  it('routes uncertain thoughts to inbox', () => {
    const result = classifyCapture('Remember the blue one', projects);
    expect(result.projectId).toBeUndefined();
  });

  it('treats an @ project mention as an explicit assignment', () => {
    const result = classifyCapture('Write the next chapter @Write-a-Book #do', projects);
    expect(result.projectId).toBe('book');
    expect(result.cleanText).toBe('Write the next chapter');
    expect(result.confidence).toBe(1);
  });
});

