import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, put } from '@vercel/blob';

interface StoredIdentity { workspaceId: string; publicKey: JsonWebKey; createdAt: string }
interface WritePayload { iv: string; ciphertext: string; deviceId: string; baseVersion: number }
interface StoredBundle extends Omit<WritePayload, 'baseVersion'> { version: number; updatedAt: string }
interface LatestPointer { version: number; bundlePath: string; updatedAt: string }

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function readJson<T>(pathname: string): Promise<T | null> {
  return (await readJsonWithMetadata<T>(pathname))?.data ?? null;
}

async function readJsonWithMetadata<T>(pathname: string): Promise<{ data: T; etag: string } | null> {
  try {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return { data: JSON.parse(await new Response(result.stream).text()) as T, etag: result.blob.etag };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

async function latestBundle(workspaceId: string) {
  const pointerPath = `orbit-sync/${workspaceId}/latest.json`;
  const pointer = await readJsonWithMetadata<LatestPointer>(pointerPath);
  if (!pointer) return { bundle: null as StoredBundle | null, pointer: null as LatestPointer | null, pointerEtag: undefined as string | undefined, pointerPath };
  return { bundle: await readJson<StoredBundle>(pointer.data.bundlePath), pointer: pointer.data, pointerEtag: pointer.etag, pointerPath };
}

async function verifySignature(publicKey: JsonWebKey, signature: string, message: string) {
  const key = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Uint8Array.from(decodeBase64Url(signature)), new TextEncoder().encode(message));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest).toString('base64url');
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    return response.status(503).json({ error: 'Encrypted sync is not connected to a Vercel Blob store yet.' });
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const { action, workspaceId, timestamp, signature } = body ?? {};
  if ((action !== 'read' && action !== 'write') || typeof workspaceId !== 'string' || !/^[a-f0-9]{32}$/i.test(workspaceId)) {
    return response.status(400).json({ error: 'Invalid sync request.' });
  }
  if (typeof timestamp !== 'string' || Math.abs(Date.now() - new Date(timestamp).getTime()) > 5 * 60_000 || typeof signature !== 'string') {
    return response.status(401).json({ error: 'Expired or unsigned sync request.' });
  }

  const identityPath = `orbit-sync/${workspaceId}/identity.json`;
  let identity = await readJson<StoredIdentity>(identityPath);

  if (action === 'read') {
    if (!identity) return response.status(404).json({ error: 'This workspace has not uploaded a snapshot yet.' });
    const valid = await verifySignature(identity.publicKey, signature, `read\n${workspaceId}\n${timestamp}\n`);
    if (!valid) return response.status(403).json({ error: 'The pairing signature was rejected.' });
    const { bundle } = await latestBundle(workspaceId);
    response.setHeader('cache-control', 'no-store');
    return response.status(200).json({ bundle });
  }

  const payload = body.payload as WritePayload | undefined;
  const digest = body.digest as string | undefined;
  const publicKey = body.publicKey as JsonWebKey | undefined;
  if (!payload || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string' || typeof payload.deviceId !== 'string' || typeof payload.baseVersion !== 'number' || typeof digest !== 'string') {
    return response.status(400).json({ error: 'The encrypted snapshot is incomplete.' });
  }
  if (payload.ciphertext.length > 12_000_000) return response.status(413).json({ error: 'The encrypted snapshot is too large.' });
  if (await sha256(JSON.stringify(payload)) !== digest) return response.status(400).json({ error: 'The snapshot digest does not match.' });

  const verificationKey = identity?.publicKey ?? publicKey;
  if (!verificationKey || !await verifySignature(verificationKey, signature, `write\n${workspaceId}\n${timestamp}\n${digest}`)) {
    return response.status(403).json({ error: 'The pairing signature was rejected.' });
  }
  if (!identity) {
    identity = { workspaceId, publicKey: verificationKey, createdAt: new Date().toISOString() };
    await put(identityPath, JSON.stringify(identity), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
  }

  const current = await latestBundle(workspaceId);
  const currentVersion = current.bundle?.version ?? 0;
  if (payload.baseVersion !== currentVersion) return response.status(409).json({ error: 'A newer snapshot is already available.', version: currentVersion });

  const version = currentVersion + 1;
  const updatedAt = new Date().toISOString();
  const stored: StoredBundle = { version, updatedAt, deviceId: payload.deviceId, iv: payload.iv, ciphertext: payload.ciphertext };
  const pathname = `orbit-sync/${workspaceId}/bundle-${String(version).padStart(12, '0')}-${Date.now()}-${crypto.randomUUID()}.json`;
  await put(pathname, JSON.stringify(stored), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
  const pointer: LatestPointer = { version, bundlePath: pathname, updatedAt };
  try {
    await put(current.pointerPath, JSON.stringify(pointer), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false,
      allowOverwrite: !!current.pointerEtag, ...(current.pointerEtag ? { ifMatch: current.pointerEtag } : {})
    });
  } catch (error) {
    await del(pathname);
    if (error instanceof BlobPreconditionFailedError || await readJson<LatestPointer>(current.pointerPath)) {
      return response.status(409).json({ error: 'A newer snapshot is already available.' });
    }
    throw error;
  }
  if (current.pointer?.bundlePath && current.pointer.bundlePath !== pathname) await del(current.pointer.bundlePath);
  response.setHeader('cache-control', 'no-store');
  return response.status(200).json({ version, updatedAt });
}

