import { CalendarDays, Clock3, FolderOpen, Sparkles } from 'lucide-react';
import { useOrbitStore } from '../store';
import { formatDuration, projectMinutes, projectProgress } from '../lib/domain';

export function ProjectList() {
  const projects = useOrbitStore((state) => state.projects);
  const entries = useOrbitStore((state) => state.entries);
  const sessions = useOrbitStore((state) => state.sessions);
  const search = useOrbitStore((state) => state.search.toLowerCase());
  const selectProject = useOrbitStore((state) => state.selectProject);
  const visible = projects.filter((project) => project.status !== 'archived' && (!search || project.title.toLowerCase().includes(search) || project.description.toLowerCase().includes(search)));

  return (
    <section className="list-view" aria-label="Projects list">
      <div className="section-heading"><div><div className="eyebrow">ALL PROJECTS</div><h1>A quieter view</h1></div><span>{visible.length} projects</span></div>
      <div className="project-grid">
        {visible.map((project) => {
          const progress = projectProgress(entries, project.id);
          const minutes = projectMinutes(sessions, project.id);
          const count = entries.filter((entry) => entry.projectId === project.id).length;
          return (
            <button className="list-project" style={{ '--project-color': project.color } as React.CSSProperties} key={project.id} onClick={() => selectProject(project.id)}>
              <span className="list-project__color" />
              <span className="list-project__top"><span className="eyebrow">{project.labels.join(' · ') || 'PROJECT'}</span><FolderOpen size={18} /></span>
              <strong>{project.title}</strong>
              <p>{project.description || 'No description yet.'}</p>
              <span className="list-project__stats">
                {progress == null ? <span><Sparkles size={13} /> {count} notes</span> : <span>{progress}% moved</span>}
                <span><Clock3 size={13} /> {formatDuration(minutes)}</span>
                {project.deadline && <span><CalendarDays size={13} /> {new Date(project.deadline).toLocaleDateString()}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

