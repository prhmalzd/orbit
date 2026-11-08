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

No account, backend, analytics, or cloud synchronization is used.

## Verification

```bash
npm test
npm run build
```

The test suite covers capture classification, hashtag precedence, Inbox routing, progress semantics, time totals, weighted project selection, and backup validation.
