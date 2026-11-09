import { useMemo } from 'react';
import { ArrowRight, Inbox as InboxIcon, Sparkles } from 'lucide-react';
import { useOrbitStore } from '../store';
import type { EntryType } from '../types';

const types: EntryType[] = ['idea', 'action', 'need', 'achievement', 'update'];

export function Inbox() {
  const allEntries = useOrbitStore((state) => state.entries);
  const allProjects = useOrbitStore((state) => state.projects);
  const assignEntry = useOrbitStore((state) => state.assignEntry);
  const deleteEntry = useOrbitStore((state) => state.deleteEntry);
  const updateEntry = useOrbitStore((state) => state.updateEntry);
  const entries = useMemo(() => allEntries.filter((entry) => !entry.projectId && entry.state !== 'dropped'), [allEntries]);
  const projects = useMemo(() => allProjects.filter((project) => project.status === 'active'), [allProjects]);

  return (
    <section className="inbox-view">
      <div className="section-heading">
        <div><div className="eyebrow">GENTLE TRIAGE</div><h1>Inbox</h1><p>Thoughts land here only when Orbit cannot confidently choose a project.</p></div>
        <span>{entries.length} waiting</span>
      </div>
      <div className="inbox-explainer"><InboxIcon size={19} /><div><b>A safety net, not another list</b><p>Choose a project and confirm the note type. Orbit remembers that correction and gets better at placing similar thoughts.</p></div><ArrowRight size={17} /></div>
      {!entries.length ? <div className="inbox-empty"><div><InboxIcon size={42} /><Sparkles size={18} /></div><h2>Your inbox is clear.</h2><p>Everything you captured has found an orbit. New uncertain thoughts will wait here safely.</p></div> :
      <div className="inbox-stack">{entries.map((entry) => {
        const suggested = projects.find((project) => project.id === entry.classification?.suggestedProjectId);
        return (
          <article className="inbox-item" key={entry.id}>
            <div className="inbox-item__copy"><span className="entry-kind">{entry.type}</span><p>{entry.text}</p><small>{Math.round((entry.classification?.confidence ?? 0) * 100)}% confidence</small></div>
            <div className="inbox-item__controls">
              <select value={entry.type} aria-label="Entry type" onChange={(event) => void updateEntry(entry.id, { type: event.target.value as EntryType })}>{types.map((type) => <option key={type}>{type}</option>)}</select>
              <select defaultValue="" aria-label="Choose project" onChange={(event) => { if (event.target.value) void assignEntry(entry.id, event.target.value); }}>
                <option value="" disabled>Choose project…</option>
                {suggested && <option value={suggested.id}>Suggested: {suggested.title}</option>}
                {projects.filter((project) => project.id !== suggested?.id).map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}
              </select>
              <button className="text-button danger-action" onClick={() => deleteEntry(entry.id)}>Discard</button>
            </div>
          </article>
        );
      })}</div>}
    </section>
  );
}

