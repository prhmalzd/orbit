import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CalendarDays, Check, Clock3, Lightbulb, PackageOpen, Sparkles } from 'lucide-react';
import type { Entry, Project } from '../types';
import { formatDuration, projectMinutes, projectProgress } from '../lib/domain';
import { useOrbitStore } from '../store';

export interface ProjectNodeData extends Record<string, unknown> {
  project: Project;
  entries: Entry[];
}

const typeIcon = {
  idea: Lightbulb,
  action: Check,
  need: PackageOpen,
  achievement: Sparkles,
  update: Clock3
};

export const ProjectNode = memo(({ data, selected }: NodeProps) => {
  const { project, entries } = data as unknown as ProjectNodeData;
  const sessions = useOrbitStore((state) => state.sessions);
  const selectProject = useOrbitStore((state) => state.selectProject);
  const progress = projectProgress(entries, project.id);
  const minutes = projectMinutes(sessions, project.id);
  const latest = entries.filter((entry) => entry.projectId === project.id && entry.state !== 'dropped').slice(0, 3);
  const achievements = entries.filter((entry) => entry.projectId === project.id && entry.type === 'achievement').length;

  return (
    <article
      className={`project-node ${selected ? 'is-selected' : ''}`}
      style={{ '--project-color': project.color } as React.CSSProperties}
      onDoubleClick={() => selectProject(project.id)}
      aria-label={`${project.title} project`}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="project-node__glow" />
      <header>
        <div className="progress-orbit" style={{ '--progress': progress ?? 0 } as React.CSSProperties}>
          <span>{progress == null ? <Sparkles size={15} /> : `${progress}%`}</span>
        </div>
        <div className="project-node__heading">
          <div className="eyebrow">{project.labels[0] ?? 'PROJECT ORBIT'}</div>
          <h2>{project.title}</h2>
        </div>
        <button className="node-open" onClick={() => selectProject(project.id)} aria-label={`Open ${project.title}`}>↗</button>
      </header>

      {project.description && <p className="project-node__description">{project.description}</p>}

      <div className="project-node__meta">
        {project.deadline && <span><CalendarDays size={13} /> {new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
        <span><Clock3 size={13} /> {minutes ? formatDuration(minutes) : 'No time yet'}</span>
        {progress == null && achievements > 0 && <span><Sparkles size={13} /> {achievements} wins</span>}
      </div>

      <div className="entry-peek">
        {latest.length ? latest.map((entry) => {
          const Icon = typeIcon[entry.type];
          return <div className={`entry-peek__item type-${entry.type}`} key={entry.id}><Icon size={13} /><span>{entry.text}</span>{entry.priority === 'must' && <b>!</b>}</div>;
        }) : <div className="entry-peek__empty">Quiet orbit — add the first thought</div>}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </article>
  );
});

ProjectNode.displayName = 'ProjectNode';

