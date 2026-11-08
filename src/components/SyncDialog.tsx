import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, Check, Cloud, Copy, KeyRound, Link2, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Unlink, X } from 'lucide-react';
import { db } from '../db';
import { useOrbitStore } from '../store';
import type { SyncConfig, SyncConflict } from '../types';
import { createPairingIdentity, exportPairingKey, importPairingKey } from '../lib/sync-crypto';
import { defaultDeviceName, markSyncDirty, resolveSyncConflict, syncNow } from '../lib/sync';

function recordLabel(record: unknown, fallback: string) {
  if (!record || typeof record !== 'object') return 'Deleted';
  const value = record as Record<string, unknown>;
  return String(value.title ?? value.text ?? value.label ?? fallback);
}

export function SyncControl() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<SyncConfig>();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [syncing, setSyncing] = useState(false);
  const refreshWorkspace = useOrbitStore((state) => state.refresh);

  const refreshState = useCallback(async () => {
    setConfig(await db.syncConfig.get('sync'));
    setConflicts(await db.syncConflicts.toArray());
  }, []);

  const performSync = useCallback(async (quiet = false) => {
    if (!await db.syncConfig.get('sync') || !navigator.onLine || await db.syncConflicts.count()) return;
    setSyncing(true);
    try { await syncNow(); await refreshWorkspace(); await refreshState(); }
    catch (error) { if (!quiet) throw error; }
    finally { setSyncing(false); }
  }, [refreshState, refreshWorkspace]);

  useEffect(() => {
    void refreshState().then(() => performSync(true));
    const onOnline = () => void performSync(true);
    const onVisible = () => { if (document.visibilityState === 'visible') void performSync(true); };
    window.addEventListener('online', onOnline);
    window.addEventListener('orbit-sync-state', refreshState);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => void performSync(true), 60_000);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('orbit-sync-state', refreshState); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(interval); };
  }, [performSync, refreshState]);

  return <>
    <button className={`sync-status-button ${conflicts.length ? 'has-conflict' : ''}`} onClick={() => setOpen(true)}>
      {syncing ? <LoaderCircle className="spin" size={15} /> : conflicts.length ? <AlertTriangle size={15} /> : config ? <Cloud size={15} /> : <Link2 size={15} />}
      <span>{conflicts.length ? `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}` : config ? config.dirtySince ? 'Waiting to sync' : 'Synced' : 'Pair devices'}</span>
    </button>
    {open && <SyncDialog
      config={config}
      conflicts={conflicts}
      syncing={syncing}
      onClose={() => setOpen(false)}
      onRefresh={refreshState}
      onSync={async () => {
        try { await performSync(); }
        catch (error) { useOrbitStore.getState().notify(error instanceof Error ? error.message : 'Sync failed.'); }
      }}
    />}
  </>;
}

interface DialogProps {
  config?: SyncConfig;
  conflicts: SyncConflict[];
  syncing: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSync: () => Promise<void>;
}

function SyncDialog({ config, conflicts, syncing, onClose, onRefresh, onSync }: DialogProps) {
  const notify = useOrbitStore((state) => state.notify);
  const refreshWorkspace = useOrbitStore((state) => state.refresh);
  const [joinKey, setJoinKey] = useState('');
  const [deviceName, setDeviceName] = useState(defaultDeviceName());
  const [showPairing, setShowPairing] = useState(false);
  const [pairingKey, setPairingKey] = useState(config ? exportPairingKey(config) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (config) setPairingKey(exportPairingKey(config)); }, [config]);

  const create = async () => {
    setBusy(true);
    try {
      const created = await createPairingIdentity(deviceName.trim() || defaultDeviceName());
      await db.syncConfig.put(created.config);
      setPairingKey(created.pairingKey);
      setShowPairing(true);
      await onRefresh();
      notify('Pairing space created. Keep the key private.');
    } finally { setBusy(false); }
  };

  const join = async () => {
    setBusy(true);
    try {
      const joined = importPairingKey(joinKey, deviceName.trim() || defaultDeviceName());
      await db.syncConfig.put(joined);
      await markSyncDirty(false);
      setJoinKey('');
      await onRefresh();
      notify('Device paired. Sync to receive the shared workspace.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Pairing failed.'); }
    finally { setBusy(false); }
  };

  const resolve = async (conflict: SyncConflict, choice: 'local' | 'remote' | 'both') => {
    await resolveSyncConflict(conflict, choice);
    await refreshWorkspace();
    await onRefresh();
    if (await db.syncConflicts.count() === 0) {
      notify('All conflicts resolved. Orbit will upload the merged workspace.');
      await onSync();
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal sync-modal" role="dialog" aria-modal="true" aria-labelledby="sync-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="eyebrow">ENCRYPTED DEVICE RELAY</div>
        <h2 id="sync-title">{config ? 'Your devices share a private orbit' : 'Pair your devices'}</h2>

        {!config ? <>
          <div className="sync-explainer"><ShieldCheck size={22} /><div><b>No account. No readable cloud data.</b><p>Orbit stores one encrypted snapshot in Vercel Blob. The pairing key never leaves your devices.</p></div></div>
          <label className="sync-label">This device’s name<input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></label>
          <div className="pair-choice">
            <button onClick={create} disabled={busy}><KeyRound size={20} /><span><b>Start a device group</b><small>Generate the key on your first device.</small></span></button>
            <div><span>or</span></div>
            <label><Smartphone size={20} /><span><b>Join another device</b><small>Paste the key shown by a paired device.</small></span><textarea value={joinKey} onChange={(event) => setJoinKey(event.target.value)} placeholder="Paste pairing key" rows={3} /><button onClick={join} disabled={busy || !joinKey.trim()}>Pair this device</button></label>
          </div>
        </> : <>
          <div className="sync-summary">
            <div className="sync-orb"><Cloud size={24} /><i /></div>
            <div><b>{config.deviceName}</b><span>{config.dirtySince ? 'Local changes are waiting' : config.lastSyncedAt ? `Synced ${new Date(config.lastSyncedAt).toLocaleString()}` : 'Ready for first sync'}</span><small>Remote version {config.lastRemoteVersion}</small></div>
            <button className="primary-button" onClick={onSync} disabled={syncing || conflicts.length > 0 || !navigator.onLine}>{syncing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Sync now</button>
          </div>

          {conflicts.length > 0 && <section className="conflict-section">
            <div className="conflict-title"><AlertTriangle size={18} /><div><b>Choose what to keep</b><p>Both devices changed the same item after their last shared version. Nothing will be uploaded until you decide.</p></div></div>
            <div className="conflict-list">{conflicts.map((conflict) => <article key={conflict.id}>
              <span>{conflict.entity.slice(0, -1)}</span>
              <div className="conflict-versions"><div><small>THIS DEVICE</small><p>{recordLabel(conflict.localRecord, conflict.recordId)}</p></div><div><small>OTHER DEVICE</small><p>{recordLabel(conflict.remoteRecord, conflict.recordId)}</p></div></div>
              <footer><button onClick={() => resolve(conflict, 'local')}>Keep this</button><button onClick={() => resolve(conflict, 'remote')}>Keep other</button><button onClick={() => resolve(conflict, 'both')}>Keep both</button></footer>
            </article>)}</div>
          </section>}

          <section className="pairing-share">
            <div className="section-title"><span><KeyRound size={15} /> Pair another device</span></div>
            <p>This key can decrypt your workspace. Only show it directly to a device you trust.</p>
            {!showPairing ? <button className="secondary-wide" onClick={() => setShowPairing(true)}>Show pairing key</button> : <div className="pairing-key-view">
              <div className="qr-wrap"><QRCodeSVG value={pairingKey} size={154} level="L" /></div>
              <div><textarea readOnly value={pairingKey} rows={5} aria-label="Pairing key" /><button onClick={async () => { await navigator.clipboard.writeText(pairingKey); notify('Pairing key copied.'); }}><Copy size={14} /> Copy key</button></div>
            </div>}
          </section>

          <div className="sync-footnote"><Check size={14} /><span>Automatic sync runs after changes, when Orbit opens, and when this device comes back online.</span></div>
          <button className="disconnect-button" onClick={async () => {
            if (!window.confirm('Disconnect this device? Local Orbit data will stay here.')) return;
            await db.syncConfig.clear(); await db.syncConflicts.clear(); await onRefresh(); notify('This device is no longer paired.');
          }}><Unlink size={14} /> Disconnect this device</button>
        </>}
      </section>
    </div>
  );
}

