import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Hash, Sparkles } from 'lucide-react';
import { useOrbitStore } from '../store';

export function CaptureBar() {
  const capture = useOrbitStore((state) => state.capture);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setBusy(true);
    try { await capture(text); } finally { setBusy(false); inputRef.current?.focus(); }
  };

  return (
    <form className={`capture-bar ${busy ? 'is-thinking' : ''}`} onSubmit={submit}>
      <div className="capture-spark"><Sparkles size={18} aria-hidden="true" /></div>
      <label className="sr-only" htmlFor="orbit-capture">Capture a thought</label>
      <input
        ref={inputRef}
        id="orbit-capture"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Drop a thought here…  try #idea, #must, or a project name"
        autoComplete="off"
      />
      <span className="capture-hint"><Hash size={13} /> sorts itself</span>
      <button className="capture-submit" type="submit" disabled={!value.trim() || busy} aria-label="Capture thought">
        <ArrowUp size={18} />
      </button>
    </form>
  );
}

