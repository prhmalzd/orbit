import type { EncryptedSyncPayload, OrbitExport, PairingBundle, SyncConfig } from '../types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function createPairingIdentity(deviceName: string): Promise<{ config: SyncConfig; pairingKey: string }> {
  const encryptionKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const signingKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const rawEncryptionKey = new Uint8Array(await crypto.subtle.exportKey('raw', encryptionKey));
  const bundle: PairingBundle = {
    version: 1,
    workspaceId: crypto.randomUUID().replaceAll('-', ''),
    encryptionKey: bytesToBase64(rawEncryptionKey),
    signingPrivateKey: await crypto.subtle.exportKey('jwk', signingKeys.privateKey),
    signingPublicKey: await crypto.subtle.exportKey('jwk', signingKeys.publicKey)
  };
  return {
    config: configFromBundle(bundle, deviceName),
    pairingKey: bytesToBase64(encoder.encode(JSON.stringify(bundle)))
  };
}

export function importPairingKey(pairingKey: string, deviceName: string): SyncConfig {
  let bundle: PairingBundle;
  try { bundle = JSON.parse(decoder.decode(base64ToBytes(pairingKey.trim()))) as PairingBundle; }
  catch { throw new Error('That pairing key is not valid.'); }
  if (bundle.version !== 1 || !bundle.workspaceId || !bundle.encryptionKey || !bundle.signingPrivateKey || !bundle.signingPublicKey) {
    throw new Error('That pairing key is incomplete or unsupported.');
  }
  return configFromBundle(bundle, deviceName);
}

export function exportPairingKey(config: SyncConfig) {
  const bundle: PairingBundle = {
    version: 1,
    workspaceId: config.workspaceId,
    encryptionKey: config.encryptionKey,
    signingPrivateKey: config.signingPrivateKey,
    signingPublicKey: config.signingPublicKey
  };
  return bytesToBase64(encoder.encode(JSON.stringify(bundle)));
}

function configFromBundle(bundle: PairingBundle, deviceName: string): SyncConfig {
  return {
    id: 'sync', workspaceId: bundle.workspaceId, deviceId: crypto.randomUUID(), deviceName,
    encryptionKey: bundle.encryptionKey, signingPrivateKey: bundle.signingPrivateKey,
    signingPublicKey: bundle.signingPublicKey, lastRemoteVersion: 0, dirtySince: new Date().toISOString()
  };
}

export async function encryptWorkspace(data: OrbitExport, keyValue: string): Promise<EncryptedSyncPayload> {
  const key = await crypto.subtle.importKey('raw', base64ToBytes(keyValue), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) };
}

export async function decryptWorkspace(payload: EncryptedSyncPayload, keyValue: string): Promise<OrbitExport> {
  try {
    const key = await crypto.subtle.importKey('raw', base64ToBytes(keyValue), 'AES-GCM', false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.ciphertext));
    return JSON.parse(decoder.decode(decrypted)) as OrbitExport;
  } catch { throw new Error('The remote snapshot could not be decrypted with this pairing key.'); }
}

export async function digestText(value: string) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function signSyncRequest(config: SyncConfig, action: 'read' | 'write', timestamp: string, digest: string) {
  const key = await crypto.subtle.importKey('jwk', config.signingPrivateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const message = `${action}\n${config.workspaceId}\n${timestamp}\n${digest}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

