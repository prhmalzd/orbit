import type { Entry, Project, TimeSession } from '../types';

export const actionableTypes = new Set(['action', 'need']);

export function projectProgress(entries: Entry[], projectId: string) {
  const actionable = entries.filter(
    (entry) => entry.projectId === projectId && actionableTypes.has(entry.type) && entry.state !== 'dropped'
  );
  if (!actionable.length) return null;
  const completed = actionable.filter((entry) => entry.state === 'done').length;
  return Math.round((completed / actionable.length) * 100);
}

export function projectMinutes(sessions: TimeSession[], projectId: string) {
  return Math.round(sessions
    .filter((session) => session.projectId === projectId)
    .reduce((total, session) => {
      if (session.durationMinutes != null) return total + session.durationMinutes;
      if (!session.endedAt) return total;
      return total + (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000;
    }, 0));
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function isAvailable(entry: Entry, now = new Date()) {
  if (entry.state !== 'postponed') return entry.state === 'open';
  return !!entry.postponeUntil && new Date(entry.postponeUntil) <= now;
}

export function pickProject(projects: Project[], entries: Entry[], now = new Date()) {
  const candidates = projects.filter((project) => {
    if (project.status !== 'active') return false;
    return entries.some((entry) => entry.projectId === project.id && actionableTypes.has(entry.type) && isAvailable(entry, now));
  });
  if (!candidates.length) return null;

  const weighted = candidates.map((project) => {
    const inactiveDays = Math.max(1, (now.getTime() - new Date(project.updatedAt).getTime()) / 86400000);
    let weight = Math.min(10, inactiveDays);
    let reason = inactiveDays > 7 ? 'It has been waiting for your attention.' : 'It has something ready to move.';
    if (project.deadline) {
      const days = (new Date(project.deadline).getTime() - now.getTime()) / 86400000;
      if (days <= 7) {
        weight += Math.max(2, 10 - Math.max(0, days));
        reason = days < 0 ? 'Its deadline has passed.' : 'Its deadline is getting close.';
      }
    }
    return { project, weight, reason };
  });

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return weighted[0];
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

