import { useMemo } from 'react';
import { ArrowRight, Dices, Sparkles, X } from 'lucide-react';
import { pickProject } from '../lib/domain';
import { useOrbitStore } from '../store';

interface Props { open: boolean; onClose: () => void }

export function RandomProjectDialog({ open, onClose }: Props) {
  const projects = useOrbitStore((state) => state.projects);
  const entries = useOrbitStore((state) => state.entries);
  const selectProject = useOrbitStore((state) => state.selectProject);
  const choice = useMemo(() => open ? pickProject(projects, entries) : null, [open, projects, entries]);
  if (!open) return null;
  const next = choice?.project ? entries.find((entry) => entry.projectId === choice.project.id && (entry.type === 'action' || entry.type === 'need') && entry.state === 'open') : undefined;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal random-modal" role="dialog" aria-modal="true" aria-labelledby="random-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="dice-orbit"><Dices size={30} /><i /></div>
        <div className="eyebrow">LET ORBIT CHOOSE</div>
        {choice ? <>
          <h2 id="random-title">Spend a little time on<br /><span style={{ color: choice.project.color }}>{choice.project.title}</span></h2>
          <p>{choice.reason}</p>
          {next && <div className="next-suggestion"><Sparkles size={16} /><span><small>A GOOD NEXT MOVE</small>{next.text}</span></div>}
          <button className="primary-button wide" onClick={() => { selectProject(choice.project.id); onClose(); }}>Open this orbit <ArrowRight size={17} /></button>
        </> : <><h2 id="random-title">Nothing is asking for you.</h2><p>Add a doable thing to an active project, then come back when you want Orbit to choose.</p></>}
      </section>
    </div>
  );
}

