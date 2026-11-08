import { Inbox as InboxIcon, Sparkles } from 'lucide-react';
import { useOrbitStore } from '../store';
import type { EntryType } from '../types';

const types: EntryType[] = ['idea', 'action', 'need', 'achievement', 'update'];

export function Inbox() {
  const entries = useOrbitStore((state) => state.entries.filter((entry) => !entry.projectId && entry.state !== 'dropped'));
  const projects = useOrbitStore((state) => state.projects.filter((project) => project.status === 'active'));
  const assignEntry = useOrbitStore((state) => state.assignEntry);
  const deleteEntry = useOrbitStore((state) => state.deleteEntry);

  return (
    <section className="inbox-view">
      <div className="section-heading">
        <div><div className="eyebrow">GENTLE TRIAGE</div><h1>Inbox</h1><p>Orbit wasn’t certain where these belonged. A tap teaches it for next time.</p></div>
        <span>{entries.length} waiting</span>
      </div>
      {!entries.length ? <div className="inbox-empty"><div><InboxIcon size={42} /><Sparkles size={18} /></div><h2>Your inbox is clear.</h2><p>Everything you captured has found an orbit.</p></div> :
      <div className="inbox-stack">{entries.map((entry) => {
        const suggested = projects.find((project) => project.id === entry.classification.suggestedProjectId);
        return (
          <article className="inbox-item" key={entry.id}>
            <div className="inbox-item__copy"><span className="entry-kind">{entry.type}</span><p>{entry.text}</p><small>{Math.round(entry.classification.confidence * 100)}% confidence</small></div>
            <div className="inbox-item__controls">
              <select defaultValue={entry.type} aria-label="Entry type" onChange={() => undefined}>{types.map((type) => <option key={type}>{type}</option>)}</select>
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

