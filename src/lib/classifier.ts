import type { ClassificationResult, EntryPriority, EntryType, Project } from '../types';

const typeTags: Record<string, EntryType> = {
  idea: 'idea', do: 'action', task: 'action', need: 'need', win: 'achievement', achievement: 'achievement', update: 'update'
};

const patterns: Array<[EntryType, RegExp]> = [
  ['achievement', /\b(done|finished|shipped|launched|completed|won|success|fixed)\b/i],
  ['need', /\b(need|buy|requires?|waiting for|dependency|ingredient|equipment)\b/i],
  ['action', /\b(todo|call|email|write|build|make|create|send|check|review|schedule|implement|prepare|finish)\b/i],
  ['idea', /\b(idea|maybe|what if|could|concept|imagine|consider)\b/i]
];

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(' ').filter((word) => word.length > 1));
}

function similarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  left.forEach((token) => { if (right.has(token)) overlap += 1; });
  const exactBoost = normalize(a).includes(normalize(b)) ? 0.6 : 0;
  return Math.min(1, overlap / Math.sqrt(left.size * right.size) + exactBoost);
}

export function classifyCapture(text: string, projects: Project[]): ClassificationResult {
  const hashtags = [...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1]);
  const loweredTags = hashtags.map((tag) => tag.toLocaleLowerCase());
  let type: EntryType = 'update';
  let priority: EntryPriority = loweredTags.includes('must') ? 'must' : 'normal';
  let method: ClassificationResult['method'] = 'local-semantic';

  for (const tag of loweredTags) {
    if (typeTags[tag]) {
      type = typeTags[tag];
      method = 'hashtag';
      break;
    }
  }
  if (type === 'update') {
    const matched = patterns.find(([, regex]) => regex.test(text));
    if (matched) type = matched[0];
  }
  if (/\b(urgent|important|must|asap|critical)\b/i.test(text)) priority = 'must';

  const projectMatches = projects.map((project) => {
    const names = [project.title, ...project.aliases, ...project.labels];
    const tagMatch = loweredTags.find((tag) => names.some((name) => normalize(name) === normalize(tag)));
    if (tagMatch) return { id: project.id, score: 1, explicit: true };
    const corpus = `${project.title} ${project.description} ${project.aliases.join(' ')} ${project.labels.join(' ')}`;
    const normalizedText = ` ${normalize(text)} `;
    const knownNameMatch = names.some((name) => normalizedText.includes(` ${normalize(name)} `));
    return { id: project.id, score: Math.max(similarity(text, corpus), knownNameMatch ? 0.72 : 0), explicit: false };
  }).sort((a, b) => b.score - a.score);

  const top = projectMatches[0];
  const runnerUp = projectMatches[1]?.score ?? 0;
  const confidence = top ? Math.max(0, Math.min(1, top.score - runnerUp * 0.35)) : 0;
  const projectId = top && (top.explicit || confidence >= 0.56) ? top.id : undefined;
  const suggestedProjectId = top && !projectId && top.score >= 0.12 ? top.id : undefined;
  if (top?.explicit) method = 'hashtag';

  const reserved = new Set([...Object.keys(typeTags), 'must']);
  const projectNames = new Set(projects.flatMap((project) => [project.title, ...project.aliases]).map(normalize));
  const labels = hashtags.filter((tag) => !reserved.has(tag.toLocaleLowerCase()) && !projectNames.has(normalize(tag)));

  return {
    cleanText: text.replace(/\s*#[\p{L}\p{N}_-]+/gu, '').trim() || text.trim(),
    projectId,
    suggestedProjectId,
    confidence: top?.explicit ? 1 : confidence,
    type,
    priority,
    labels,
    method
  };
}

