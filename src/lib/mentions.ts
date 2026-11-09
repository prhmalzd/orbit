import type { Project } from '../types';

export interface MentionMatch { start: number; query: string }

export function getMentionMatch(value: string): MentionMatch | null {
  const match = value.match(/(^|\s)@([\p{L}\p{N}_-]*)$/u);
  if (!match || match.index == null) return null;
  return { start: match.index + match[1].length, query: match[2].replaceAll('-', ' ').toLocaleLowerCase() };
}

export function findProjectSuggestions(value: string, projects: Project[]) {
  const mention = getMentionMatch(value);
  if (!mention) return [];
  const query = mention.query;
  const ranked = projects
    .filter((project) => project.status === 'active')
    .map((project) => {
      const candidates = [project.title, ...project.aliases];
      const normalized = candidates.map((candidate) => candidate.toLocaleLowerCase());
      const starts = normalized.some((candidate) => candidate.startsWith(query));
      const contains = normalized.some((candidate) => candidate.includes(query));
      return { project, rank: starts ? 0 : contains ? 1 : 2 };
    })
    .filter((item) => !query || item.rank < 2);
  const bestRank = query && ranked.length ? Math.min(...ranked.map((item) => item.rank)) : 2;
  return ranked
    .filter((item) => !query || item.rank === bestRank)
    .sort((left, right) => left.project.title.localeCompare(right.project.title))
    .slice(0, 6)
    .map((item) => item.project);
}

export function insertProjectMention(value: string, project: Project) {
  const mention = getMentionMatch(value);
  if (!mention) return value;
  const slug = project.title.trim().replace(/\s+/g, '-');
  return `${value.slice(0, mention.start)}@${slug} `;
}
