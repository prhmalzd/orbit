import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, AtSign, Hash, Sparkles } from 'lucide-react';
import { useOrbitStore } from '../store';
import { findProjectSuggestions, insertProjectMention } from '../lib/mentions';

export function CaptureBar() {
  const capture = useOrbitStore((state) => state.capture);
  const projects = useOrbitStore((state) => state.projects);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => findProjectSuggestions(value, projects), [value, projects]);

  useEffect(() => { setActiveSuggestion(0); }, [value]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim() || busy) return;
    const text = value;
    setValue('');
    setMenuOpen(false);
    setBusy(true);
    try { await capture(text); } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const chooseProject = (index: number) => {
    const project = suggestions[index];
    if (!project) return;
    setValue((current) => insertProjectMention(current, project));
    setMenuOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <form className={`capture-bar ${busy ? 'is-thinking' : ''}`} onSubmit={submit}>
      <div className="capture-spark"><Sparkles size={18} aria-hidden="true" /></div>
      <label className="sr-only" htmlFor="orbit-capture">Capture a thought</label>
      <input
        ref={inputRef}
        id="orbit-capture"
        value={value}
        onChange={(event) => { setValue(event.target.value); setMenuOpen(true); }}
        onFocus={() => setMenuOpen(true)}
        onBlur={() => setMenuOpen(false)}
        onKeyDown={(event) => {
          if (!menuOpen || !suggestions.length) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSuggestion((current) => (current + 1) % suggestions.length); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length); }
          if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); }
          if (event.key === 'Enter') { event.preventDefault(); chooseProject(activeSuggestion); }
        }}
        placeholder="Drop a thought here… try @project, #idea, or #must"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={menuOpen && suggestions.length > 0}
        aria-controls="project-mention-suggestions"
        aria-activedescendant={menuOpen && suggestions.length ? `project-suggestion-${suggestions[activeSuggestion]?.id}` : undefined}
      />
      {menuOpen && suggestions.length > 0 && <div className="capture-suggestions" id="project-mention-suggestions" role="listbox" aria-label="Project suggestions">
        <div className="capture-suggestions__heading"><AtSign size={13} /><span>Attach to a project</span><small>↑↓ choose · Enter attach</small></div>
        {suggestions.map((project, index) => <button
          type="button"
          role="option"
          aria-selected={index === activeSuggestion}
          id={`project-suggestion-${project.id}`}
          className={index === activeSuggestion ? 'is-active' : ''}
          key={project.id}
          onMouseDown={(event) => { event.preventDefault(); chooseProject(index); }}
          onMouseEnter={() => setActiveSuggestion(index)}
        >
          <i style={{ background: project.color }} />
          <span><b>{project.title}</b><small>{project.description || project.aliases.join(' · ') || 'Project orbit'}</small></span>
          <em>@{project.title.replace(/\s+/g, '-')}</em>
        </button>)}
      </div>}
      <span className="capture-hint"><Hash size={13} /> sorts itself</span>
      <button className="capture-submit" type="submit" disabled={!value.trim() || busy} aria-label="Capture thought">
        <ArrowUp size={18} />
      </button>
    </form>
  );
}

