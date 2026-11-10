import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, put } from '@vercel/blob';

interface PairingTransferPayload { version: 1; salt: string; iv: string; ciphertext: string }
interface StoredPairing { expiresAt: string; payload: PairingTransferPayload }

async function readPairing(pathname: string) {
  try {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text()) as StoredPairing;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  const action = body?.action;
  const code = body?.code;
  if ((action !== 'create' && action !== 'claim') || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return response.status(400).json({ error: 'A valid six-digit pairing code is required.' });
  }

  const pathname = `orbit-pairing/${code}.json`;
  if (action === 'claim') {
    const stored = await readPairing(pathname);
    if (!stored) return response.status(404).json({ error: 'That pairing code is invalid or expired.' });
    await del(pathname);
    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      return response.status(410).json({ error: 'That pairing code expired. Create a new one on your other device.' });
    }
    return response.status(200).json({ payload: stored.payload });
  }

  const payload = body?.payload as PairingTransferPayload | undefined;
  const expiresAt = body?.expiresAt;
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : 0;
  if (!payload || payload.version !== 1 || typeof payload.salt !== 'string' || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string' || payload.ciphertext.length > 20_000) {
    return response.status(400).json({ error: 'The encrypted pairing transfer is incomplete.' });
  }
  if (expiry <= Date.now() || expiry > Date.now() + 2 * 60_000 + 10_000) {
    return response.status(400).json({ error: 'The pairing expiry is invalid.' });
  }

  const existing = await readPairing(pathname);
  if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
    return response.status(409).json({ error: 'Please try a different code.' });
  }
  if (existing) await del(pathname);
  try {
    await put(pathname, JSON.stringify({ expiresAt, payload } satisfies StoredPairing), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false
    });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return response.status(409).json({ error: 'Please try a different code.' });
    throw error;
  }
  return response.status(201).json({ expiresAt });
}
