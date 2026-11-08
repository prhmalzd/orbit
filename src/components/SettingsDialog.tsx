import { useEffect, useRef, useState } from 'react';
import { Check, Download, FileJson, History, ShieldCheck, Upload, X } from 'lucide-react';
import { db } from '../db';
import { collectExport, downloadExport, importWorkspace, validateImport } from '../lib/portable';
import type { OrbitSnapshot } from '../types';
import { useOrbitStore } from '../store';

interface Props { open: boolean; onClose: () => void }

export function SettingsDialog({ open, onClose }: Props) {
  const refresh = useOrbitStore((state) => state.refresh);
  const settings = useOrbitStore((state) => state.settings);
  const updateSettings = useOrbitStore((state) => state.updateSettings);
  const notify = useOrbitStore((state) => state.notify);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [snapshots, setSnapshots] = useState<OrbitSnapshot[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) void db.snapshots.orderBy('createdAt').reverse().limit(8).toArray().then(setSnapshots); }, [open]);
  if (!open) return null;

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('That backup is larger than Orbit can safely import.');
      const data = validateImport(JSON.parse(await file.text()));
      if (mode === 'replace' && !window.confirm('Replace this workspace? Orbit will make a safety snapshot first.')) return;
      await importWorkspace(data, mode);
      await refresh();
      notify(`Workspace ${mode === 'merge' ? 'merged' : 'restored'} successfully.`);
      onClose();
    } catch (error) { notify(error instanceof Error ? error.message : 'Import failed.'); }
  };

  const restoreSnapshot = async (snapshot: OrbitSnapshot) => {
    if (!window.confirm(`Restore the snapshot from ${new Date(snapshot.createdAt).toLocaleString()}?`)) return;
    await importWorkspace(snapshot.data, 'replace');
    await refresh();
    notify('Snapshot restored.');
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="eyebrow">YOUR LOCAL SPACE</div>
        <h2 id="settings-title">Data & preferences</h2>
        <div className="privacy-note"><ShieldCheck size={20} /><div><strong>Private by design</strong><p>Your projects live in this browser. Orbit has no account, server, analytics, or hidden sync.</p></div></div>

        <div className="settings-grid">
          <button className="settings-action" onClick={async () => downloadExport(await collectExport())}><Download size={21} /><span><strong>Export workspace</strong><small>Download a readable .orbit.json backup</small></span></button>
          <button className="settings-action" onClick={() => inputRef.current?.click()}><Upload size={21} /><span><strong>Import workspace</strong><small>Bring a backup into this device</small></span></button>
          <input ref={inputRef} className="sr-only" type="file" accept=".json,.orbit" onChange={(event) => void importFile(event.target.files?.[0])} />
        </div>

        <fieldset className="import-mode"><legend>When importing</legend>
          <label><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /><span><b>Merge</b><small>Keep what is here and add the backup.</small></span></label>
          <label><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /><span><b>Replace</b><small>Swap everything after making a snapshot.</small></span></label>
        </fieldset>

        <div className="preference-row"><span><b>Reduced motion</b><small>Turn off floating and animated connections.</small></span><button className={`toggle ${settings.reducedMotion ? 'is-on' : ''}`} onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })} role="switch" aria-checked={settings.reducedMotion}><i>{settings.reducedMotion && <Check size={12} />}</i></button></div>
        <div className="preference-row"><span><b>Automatic sorting</b><small>Classify captures locally in a background worker.</small></span><button className={`toggle ${settings.classifierEnabled ? 'is-on' : ''}`} onClick={() => updateSettings({ classifierEnabled: !settings.classifierEnabled })} role="switch" aria-checked={settings.classifierEnabled}><i>{settings.classifierEnabled && <Check size={12} />}</i></button></div>

        <section className="snapshot-list"><div className="section-title"><span><History size={15} /> Safety snapshots</span></div>
          {snapshots.length ? snapshots.map((snapshot) => <button key={snapshot.id} onClick={() => restoreSnapshot(snapshot)}><FileJson size={17} /><span><b>{snapshot.reason}</b><small>{new Date(snapshot.createdAt).toLocaleString()}</small></span><em>Restore</em></button>) : <p>No snapshots yet. Orbit makes them before imports.</p>}
        </section>
      </section>
    </div>
  );
}

