/// <reference lib="webworker" />
import { classifyCapture } from '../lib/classifier';
import type { Project } from '../types';

self.onmessage = (event: MessageEvent<{ id: string; text: string; projects: Project[] }>) => {
  const { id, text, projects } = event.data;
  self.postMessage({ id, result: classifyCapture(text, projects) });
};

export {};

