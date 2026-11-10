import type { PairingTransferPayload, SyncConfig } from '../types';
import { exportPairingKey, importPairingKey, openPairingKey, sealPairingKey } from './sync-crypto';

export const PAIRING_LIFETIME_MS = 2 * 60_000;
export const PAIRING_QR_PREFIX = 'orbit-pair-v1:';

function sixDigitCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return value.toString().padStart(6, '0');
}

async function pairingRequest(body: Record<string, unknown>) {
  const response = await fetch('/api/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Pairing service is unavailable.');
  return result ?? {};
}

export async function createShortPairing(config: SyncConfig) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = sixDigitCode();
    const payload = await sealPairingKey(exportPairingKey(config), code);
    const expiresAt = new Date(Date.now() + PAIRING_LIFETIME_MS).toISOString();
    try {
      await pairingRequest({ action: 'create', code, expiresAt, payload });
      return { code, expiresAt, qrValue: `${PAIRING_QR_PREFIX}${code}` };
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('different code')) throw error;
    }
  }
  throw new Error('Could not reserve a pairing code. Please try again.');
}

export async function claimShortPairing(rawCode: string, deviceName: string) {
  const code = rawCode.replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) throw new Error('Enter all six digits.');
  const result = await pairingRequest({ action: 'claim', code });
  const pairingKey = await openPairingKey(result.payload as PairingTransferPayload, code);
  return importPairingKey(pairingKey, deviceName);
}

export function codeFromPairingQr(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith(PAIRING_QR_PREFIX)) throw new Error('That QR code is not an Orbit pairing code.');
  const code = trimmed.slice(PAIRING_QR_PREFIX.length).replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) throw new Error('That Orbit pairing code is incomplete.');
  return code;
}
