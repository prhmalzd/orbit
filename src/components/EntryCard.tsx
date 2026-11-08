import { ArchiveX, Check, Circle, Clock3, Lightbulb, PackageOpen, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type { Entry } from '../types';
import { useOrbitStore } from '../store';

const icons = { idea: Lightbulb, action: Check, need: PackageOpen, achievement: Sparkles, update: Clock3 };
const labels = { idea: 'Idea', action: 'Doable', need: 'Needed', achievement: 'Win', update: 'Update' };

export function EntryCard({ entry, compact = false }: { entry: Entry; compact?: boolean }) {
  const setEntryState = useOrbitStore((state) => state.setEntryState);
  const deleteEntry = useOrbitStore((state) => state.deleteEntry);
  const Icon = icons[entry.type];
  const isActionable = entry.type === 'action' || entry.type === 'need';

  return (
    <article className={`entry-card type-${entry.type} state-${entry.state} ${entry.priority === 'must' ? 'is-must' : ''} ${compact ? 'compact' : ''}`}>
      <div className="entry-card__type"><Icon size={14} /><span>{labels[entry.type]}</span>{entry.priority === 'must' && <b>MUST</b>}</div>
      <p>{entry.text}</p>
      {entry.labels.length > 0 && <div className="tag-row">{entry.labels.map((label) => <span key={label}>#{label}</span>)}</div>}
      {entry.postponeUntil && entry.state === 'postponed' && <small>Back {new Date(entry.postponeUntil).toLocaleDateString()}</small>}
      {!compact && <footer>
        {isActionable && entry.state !== 'done' && <button onClick={() => setEntryState(entry.id, 'done')}><Circle size={15} /> Done</button>}
        {entry.state === 'done' && <button onClick={() => setEntryState(entry.id, 'open')}><RotateCcw size={15} /> Restore</button>}
        {entry.state === 'open' && <button onClick={() => {
          const date = new Date(); date.setDate(date.getDate() + 7);
          void setEntryState(entry.id, 'postponed', { postponeUntil: date.toISOString() });
        }}><Clock3 size={15} /> Next week</button>}
        {entry.state !== 'dropped' && <button onClick={() => setEntryState(entry.id, 'dropped')}><ArchiveX size={15} /> Not doing</button>}
        <button className="danger-action" onClick={() => { if (window.confirm('Delete this entry permanently?')) void deleteEntry(entry.id); }} aria-label="Delete entry"><Trash2 size={15} /></button>
      </footer>}
    </article>
  );
}

