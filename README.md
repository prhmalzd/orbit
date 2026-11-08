# Orbit

Orbit is a private, offline-first visual workspace for people with many projects in motion. Capture a thought once; Orbit classifies it locally and places it in the right project, or keeps it in a small Inbox when the match is uncertain.

## Run locally

```bash
npm install
npm run dev
```

Create a production PWA build with:

```bash
npm run build
npm run preview
```

The compiled installable app is written to `dist/`. After the first load it is precached by the service worker and works without a connection.

## Capture language

Orbit recognizes project titles, aliases, and natural action language. Hashtags make the result explicit:

- `#idea`, `#do`, `#need`, `#win`, `#update` set the entry type.
- `#must` marks an entry as important.
- A project title or alias used as a hashtag assigns the project, such as `#Balcony-Garden`.
- Any other hashtag becomes a label.

All classification happens in a Web Worker on the device. Corrections made in Inbox teach project aliases locally.

## Data and backups

Orbit stores projects, entries, project links, timers, preferences, and safety snapshots in IndexedDB. The Data & preferences panel can export a readable `.orbit.json` backup or import one in merge/replace mode. Replace imports automatically create a restorable snapshot first.

By default, no account, backend, analytics, or cloud synchronization is used.

## Optional encrypted device relay

Orbit can pair devices without creating user accounts. IndexedDB remains the source of truth on every device; Vercel stores only the newest AES-GCM-encrypted workspace snapshot and a public ECDSA verification key.

To enable it on Vercel:

1. Import this Git repository into Vercel as a Vite project.
2. In the Vercel project, open **Storage**, create a **Blob** store, choose **Private**, and connect it to the project.
3. Confirm that Vercel added `BLOB_READ_WRITE_TOKEN`, then redeploy.
4. Open Orbit on the first device, select **Pair devices**, and create a device group.
5. Copy or scan the pairing key on the second device, then press **Sync now**.

The pairing key contains the encryption and signing keys. Anyone who has it can decrypt and update the shared snapshot, so transfer it directly between trusted devices and keep a private recovery copy.

Sync performs a three-way merge against the last shared snapshot. Unrelated offline changes merge automatically. Concurrent edits to the same item are held locally until the user chooses **Keep this**, **Keep other**, or **Keep both**. A local safety snapshot is created before remote data is applied.

`api/sync.ts` is a Vercel Function and is not included in the static PWA bundle. Without a connected Blob store, Orbit continues working normally as a fully local application.

## Verification

```bash
npm test
npm run build
```

The test suite covers capture classification, hashtag precedence, Inbox routing, progress semantics, time totals, weighted project selection, and backup validation.
