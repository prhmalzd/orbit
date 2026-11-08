import { useEffect, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { useOrbitStore } from '../store';

const colors = ['#e78b5c', '#e9b872', '#8eb69b', '#79a9d1', '#b191d4', '#d97878'];

interface Props { open: boolean; onClose: () => void }

export function NewProjectDialog({ open, onClose }: Props) {
  const addProject = useOrbitStore((state) => state.addProject);
  const selectProject = useOrbitStore((state) => state.selectProject);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(colors[0]);

  useEffect(() => { if (!open) { setTitle(''); setDescription(''); setDeadline(''); } }, [open]);
  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const project = await addProject({ title, description, deadline, color });
    onClose();
    selectProject(project.id);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal project-form" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-project-title">
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="eyebrow">NEW ORBIT</div>
        <h2 id="new-project-title">What are you making room for?</h2>
        <label>Project name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A book, a business, a better balcony…" /></label>
        <label>What is it about?<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A sentence is enough. Orbit uses this to understand future notes." rows={3} /></label>
        <div className="form-row">
          <label><span><CalendarDays size={14} /> Deadline, if it has one</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
          <fieldset className="color-field"><legend>Orbit color</legend><div>{colors.map((item) => <button type="button" key={item} className={color === item ? 'is-active' : ''} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Use ${item}`} />)}</div></fieldset>
        </div>
        <button className="primary-button wide" type="submit" disabled={!title.trim()}>Create orbit</button>
      </form>
    </div>
  );
}

