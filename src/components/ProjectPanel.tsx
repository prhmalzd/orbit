import { useMemo, useState } from 'react';
import { Archive, ArrowLeft, CalendarDays, CheckCircle2, Clock3, Link2, MoreHorizontal, Pause, Play, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useOrbitStore } from '../store';
import type { EntryType } from '../types';
import { formatDuration, isAvailable, projectMinutes, projectProgress } from '../lib/domain';
import { EntryCard } from './EntryCard';

const entryTypes: Array<{ value: EntryType; label: string }> = [
  { value: 'idea', label: 'Idea' }, { value: 'action', label: 'Doable' }, { value: 'need', label: 'Needed' },
  { value: 'achievement', label: 'Win' }, { value: 'update', label: 'Update' }
];

export function ProjectPanel() {
  const selectedId = useOrbitStore((state) => state.selectedProjectId);
  const project = useOrbitStore((state) => state.projects.find((item) => item.id === selectedId));
  const projects = useOrbitStore((state) => state.projects);
  const entries = useOrbitStore((state) => state.entries);
  const sessions = useOrbitStore((state) => state.sessions);
  const links = useOrbitStore((state) => state.links);
  const selectProject = useOrbitStore((state) => state.selectProject);
  const addEntry = useOrbitStore((state) => state.addEntry);
  const updateProject = useOrbitStore((state) => state.updateProject);
  const removeProject = useOrbitStore((state) => state.removeProject);
  const linkProjects = useOrbitStore((state) => state.linkProjects);
  const startTimer = useOrbitStore((state) => state.startTimer);
  const stopTimer = useOrbitStore((state) => state.stopTimer);
  const addManualTime = useOrbitStore((state) => state.addManualTime);
  const [filter, setFilter] = useState<'all' | 'now' | 'wins'>('all');
  const [text, setText] = useState('');
  const [type, setType] = useState<EntryType>('idea');
  const [showMore, setShowMore] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');

  const projectEntries = useMemo(() => entries.filter((entry) => entry.projectId === selectedId).filter((entry) => {
    if (filter === 'now') return (entry.type === 'action' || entry.type === 'need') && isAvailable(entry);
    if (filter === 'wins') return entry.type === 'achievement';
    return true;
  }), [entries, selectedId, filter]);

  if (!project) return null;
  const progress = projectProgress(entries, project.id);
  const minutes = projectMinutes(sessions, project.id);
  const running = sessions.find((session) => !session.endedAt && session.origin === 'timer');
  const isRunning = running?.projectId === project.id;
  const related = links.filter((link) => link.sourceProjectId === project.id || link.targetProjectId === project.id).map((link) => ({
    link, project: projects.find((item) => item.id === (link.sourceProjectId === project.id ? link.targetProjectId : link.sourceProjectId))
  })).filter((item) => item.project);

  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    await addEntry(project.id, text, type);
    setText('');
  };

  return (
    <aside className="project-panel" style={{ '--project-color': project.color } as React.CSSProperties} aria-label={`${project.title} details`}>
      <header className="panel-topbar">
        <button className="icon-button mobile-back" onClick={() => selectProject()} aria-label="Back"><ArrowLeft size={19} /></button>
        <span className="project-color-dot" />
        <span>{project.status}</span>
        <div className="panel-topbar__actions">
          <button className="icon-button" onClick={() => setShowMore(!showMore)} aria-label="Project options"><MoreHorizontal size={19} /></button>
          <button className="icon-button" onClick={() => selectProject()} aria-label="Close"><X size={19} /></button>
        </div>
        {showMore && <div className="project-menu">
          <button onClick={() => updateProject(project.id, { status: project.status === 'completed' ? 'active' : 'completed' })}><CheckCircle2 size={15} /> {project.status === 'completed' ? 'Mark active' : 'Mark complete'}</button>
          <button onClick={() => updateProject(project.id, { status: 'archived' })}><Archive size={15} /> Archive</button>
          <button className="danger-action" onClick={() => { if (window.confirm('Delete this project? Its entries will move to Inbox.')) void removeProject(project.id); }}><Trash2 size={15} /> Delete project</button>
        </div>}
      </header>

      <div className="project-panel__scroll">
        <section className="project-hero">
          <div className="eyebrow">PROJECT ORBIT</div>
          <h1>{project.title}</h1>
          <p>{project.description || 'No description yet.'}</p>
          <div className="project-labels">{project.labels.map((label) => <span key={label}>#{label}</span>)}</div>
        </section>

        <section className="project-vitals">
          <div><small>PROGRESS</small><strong>{progress == null ? `${projectEntries.length} notes` : `${progress}%`}</strong></div>
          <div><small>TIME IN ORBIT</small><strong>{formatDuration(minutes)}</strong></div>
          <div><small>DEADLINE</small><strong>{project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Open'}</strong></div>
        </section>

        <section className="focus-clock">
          <div><Clock3 size={18} /><span><b>{isRunning ? 'You are in this orbit' : running ? 'Another timer is running' : 'Ready for a focus session?'}</b><small>Time stays on this device.</small></span></div>
          <button className={isRunning ? 'stop-button' : 'secondary-button'} onClick={() => isRunning ? stopTimer() : startTimer(project.id)}>
            {isRunning ? <><Pause size={15} /> Stop</> : <><Play size={15} /> Start</>}
          </button>
        </section>

        <form className="manual-time" onSubmit={(event) => { event.preventDefault(); const minutes = Number(manualMinutes); if (minutes > 0) { void addManualTime(project.id, minutes); setManualMinutes(''); } }}>
          <input type="number" min="1" value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} placeholder="Add minutes manually" aria-label="Manual minutes" />
          <button type="submit">Add time</button>
        </form>

        <form className="project-add-entry" onSubmit={submitEntry}>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add directly to this orbit…" aria-label="Add project entry" />
          <select value={type} onChange={(event) => setType(event.target.value as EntryType)} aria-label="Entry type">
            {entryTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="submit" disabled={!text.trim()} aria-label="Add entry"><Plus size={17} /></button>
        </form>

        <nav className="segment-control" aria-label="Entry filters">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Everything</button>
          <button className={filter === 'now' ? 'is-active' : ''} onClick={() => setFilter('now')}>Ready now</button>
          <button className={filter === 'wins' ? 'is-active' : ''} onClick={() => setFilter('wins')}>Wins</button>
        </nav>

        <section className="entry-stack">
          {projectEntries.length ? projectEntries.map((entry) => <EntryCard key={entry.id} entry={entry} />) : <div className="panel-empty"><Sparkles size={26} /><p>Nothing in this view yet.</p></div>}
        </section>

        <section className="connections">
          <div className="section-title"><span><Link2 size={15} /> Connected projects</span></div>
          {related.map((item) => <button key={item.link.id} onClick={() => selectProject(item.project!.id)}><i style={{ background: item.project!.color }} />{item.project!.title}<span>↗</span></button>)}
          <label>
            <span className="sr-only">Connect another project</span>
            <select defaultValue="" onChange={(event) => { if (event.target.value) { void linkProjects(project.id, event.target.value); event.target.value = ''; } }}>
              <option value="" disabled>+ Connect another project</option>
              {projects.filter((item) => item.id !== project.id && item.status === 'active' && !related.some((relatedItem) => relatedItem.project!.id === item.id)).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
            </select>
          </label>
        </section>
      </div>
    </aside>
  );
}

