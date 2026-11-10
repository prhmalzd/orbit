import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { codeFromPairingQr, PAIRING_QR_PREFIX } from './pairing';
import { openPairingKey, sealPairingKey } from './sync-crypto';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

describe('short pairing', () => {
  it('round-trips the long device identity through a six-digit encrypted transfer', async () => {
    const identity = 'private-device-identity';
    const sealed = await sealPairingKey(identity, '042731');
    await expect(openPairingKey(sealed, '042731')).resolves.toBe(identity);
    await expect(openPairingKey(sealed, '042732')).rejects.toThrow('invalid or expired');
  });

  it('reads only Orbit pairing QR values', () => {
    expect(codeFromPairingQr(`${PAIRING_QR_PREFIX}123456`)).toBe('123456');
    expect(() => codeFromPairingQr('https://example.com')).toThrow('not an Orbit pairing code');
  });
});
