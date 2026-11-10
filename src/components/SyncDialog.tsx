import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, Camera, Check, Clock3, Cloud, Copy, KeyRound, Link2, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Unlink, X } from 'lucide-react';
import { db } from '../db';
import { useOrbitStore } from '../store';
import type { SyncConfig, SyncConflict } from '../types';
import { createPairingIdentity } from '../lib/sync-crypto';
import { claimShortPairing, codeFromPairingQr, createShortPairing } from '../lib/pairing';
import { defaultDeviceName, resolveSyncConflict, syncNow } from '../lib/sync';

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
    <button className={`sync-status-button ${conflicts.length ? 'has-conflict' : ''}`} onClick={() => setOpen(true)} aria-label={conflicts.length ? `Device sync has ${conflicts.length} conflicts` : config ? 'Device sync settings' : 'Pair devices'}>
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
  const [joinCode, setJoinCode] = useState('');
  const [deviceName, setDeviceName] = useState(defaultDeviceName());
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string; qrValue: string }>();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pairing) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [pairing]);

  const startPairing = async (pairingConfig: SyncConfig) => {
    const transfer = await createShortPairing(pairingConfig);
    setPairing(transfer);
    notify('Two-minute pairing code created.');
  };

  const create = async () => {
    setBusy(true);
    try {
      const created = await createPairingIdentity(deviceName.trim() || defaultDeviceName());
      await db.syncConfig.put(created.config);
      await syncNow();
      await refreshWorkspace();
      await onRefresh();
      await startPairing(created.config);
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not create the device group.'); }
    finally { setBusy(false); }
  };

  const join = async (rawCode = joinCode) => {
    setBusy(true);
    try {
      const joined = await claimShortPairing(rawCode, deviceName.trim() || defaultDeviceName());
      await db.syncConfig.put(joined);
      await syncNow();
      await refreshWorkspace();
      setJoinCode('');
      setScannerOpen(false);
      await onRefresh();
      notify('Paired and synced. Your shared workspace is ready.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Pairing failed.'); }
    finally { setBusy(false); }
  };

  const scanResult = async (value: string) => {
    try {
      const code = codeFromPairingQr(value);
      setJoinCode(code);
      await join(code);
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not read that QR code.'); }
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
          <div className="sync-explainer"><ShieldCheck size={22} /><div><b>No account. No readable cloud data.</b><p>Orbit relays an encrypted workspace through Vercel Blob. Pairing codes expire after two minutes.</p></div></div>
          <label className="sync-label">This device’s name<input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></label>
          <div className="pair-choice">
            <button onClick={create} disabled={busy}>{busy ? <LoaderCircle className="spin" size={20} /> : <KeyRound size={20} />}<span><b>Start a device group</b><small>Create the first encrypted snapshot and a six-digit code.</small></span></button>
            <div><span>or</span></div>
            <label><Smartphone size={20} /><span><b>Join another device</b><small>Enter the temporary code or scan its QR.</small></span><input className="pair-code-input" value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Six-digit pairing code" /><div className="pair-join-actions"><button type="button" onClick={() => setScannerOpen(true)} disabled={busy}><Camera size={14} /> Scan QR</button><button type="button" onClick={() => void join()} disabled={busy || joinCode.length !== 6}>{busy ? <LoaderCircle className="spin" size={14} /> : null} Pair & sync</button></div></label>
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
            <p>Create a one-time code on this device, then enter it on your phone. It expires in two minutes and disappears after one successful pairing.</p>
            {!pairing || secondsLeft === 0 ? <button className="secondary-wide" onClick={() => config && void (async () => { setBusy(true); try { await startPairing(config); } catch (error) { notify(error instanceof Error ? error.message : 'Could not create a pairing code.'); } finally { setBusy(false); } })()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <KeyRound size={14} />} Create 2-minute code</button> : <div className="pairing-code-view">
              <div className="qr-wrap"><QRCodeSVG value={pairing.qrValue} size={154} level="M" /></div>
              <div className="pair-code-panel"><span className="pair-code">{pairing.code.slice(0, 3)} {pairing.code.slice(3)}</span><small><Clock3 size={13} /> Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</small><button onClick={async () => { await navigator.clipboard.writeText(pairing.code); notify('Six-digit code copied.'); }}><Copy size={14} /> Copy code</button></div>
            </div>}
          </section>

          <div className="sync-footnote"><Check size={14} /><span>Automatic sync runs after changes, when Orbit opens, and when this device comes back online.</span></div>
          <button className="disconnect-button" onClick={async () => {
            if (!window.confirm('Disconnect this device? Local Orbit data will stay here.')) return;
            await db.syncConfig.clear(); await db.syncConflicts.clear(); await onRefresh(); notify('This device is no longer paired.');
          }}><Unlink size={14} /> Disconnect this device</button>
        </>}
      </section>
      {scannerOpen && <QrScanner onClose={() => setScannerOpen(false)} onResult={scanResult} />}
    </div>
  );
}

function QrScanner({ onClose, onResult }: { onClose: () => void; onResult: (value: string) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let stopCamera: (() => void) | undefined;
    void import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (stopped || !videoRef.current) return;
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result, _scanError, activeControls) => {
          if (!result || stopped) return;
          stopped = true;
          activeControls.stop();
          void onResult(result.getText());
        }
      );
      stopCamera = () => controls.stop();
    }).catch(() => setError('Camera scanning could not start. Check camera permission and try again.'));
    return () => { stopped = true; stopCamera?.(); };
  }, [onResult]);

  return <div className="qr-scanner-backdrop">
    <section className="qr-scanner" role="dialog" aria-modal="true" aria-label="Scan Orbit pairing QR code">
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close scanner"><X size={18} /></button>
      <Camera size={22} />
      <h3>Scan the Orbit code</h3>
      <p>Point your phone’s rear camera at the QR shown on your other device.</p>
      <div className="qr-camera"><video ref={videoRef} muted playsInline /></div>
      {error && <span className="scanner-error">{error}</span>}
      <button className="secondary-wide" onClick={onClose}>Cancel</button>
    </section>
  </div>;
}

