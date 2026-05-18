# Prebrief — Implementation Plan

A macOS menu-bar app that, ahead of each Google Calendar meeting, finds the
matching prior Granola note and shows you a quick brief of what happened
last time and what to know going in.

---

## 1. Tech stack & rationale

| Concern             | Choice                                    | Why                                                                                                                    |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Electron** + TypeScript                 | Easiest path to a Mac menu-bar app with rich popover UI; mature tooling.                                               |
| UI                  | **React + Vite** (renderer)               | Familiar, fast HMR; small popover is trivial.                                                                          |
| Menu bar            | **`menubar` npm package**                 | Battle-tested Tray + popover wrapper; handles positioning + dismiss-on-blur.                                           |
| Packaging           | **electron-builder** → `.dmg` + `.app`    | First-class DMG output; supports ad-hoc signing for non-App-Store distribution.                                        |
| Calendar            | `googleapis` + `google-auth-library`      | Official SDK; desktop OAuth via loopback redirect.                                                                     |
| Granola             | **Official Granola Personal API**         | Local cache is encrypted in v6+; the Personal API (`GET /v1/notes`, Bearer `grn_…`) is the supported integration path. |
| LLM                 | `@anthropic-ai/sdk` and/or `openai`       | User picks one in settings, supplies own key.                                                                          |
| Secrets             | **`keytar`** (macOS Keychain)             | OAuth refresh token + LLM API key never touch disk in plaintext.                                                       |
| Non-secret settings | **`electron-store`** (JSON in `userData`) | Provider choice, model, polling interval, etc.                                                                         |
| Logging             | `electron-log`                            | Rotating file logs in `~/Library/Logs/Prebrief/`.                                                                      |

### Why not Tauri/Swift?

- Tauri: smaller bundle, but Granola cache parsing + Google OAuth + LLM SDKs
  are all Node-ecosystem; rewriting in Rust adds work without user-visible win.
- Swift: best native fit, but doubles implementation work and you lose
  cross-platform escape hatch later.

---

## 2. Distribution (bypassing App Store)

Two distribution modes, picked at build time:

1. **Ad-hoc signed DMG** (default, no Apple Developer account needed)
   - `electron-builder` with `identity: null` → ad-hoc codesign.
   - First launch: macOS Gatekeeper will block. User right-clicks the app →
     **Open** → confirms. After that it runs normally.
   - The README will document this exact step with a screenshot.

2. **Developer ID signed + notarized DMG** (optional, if you have an
   Apple Developer account — $99/yr)
   - Just opens like any third-party app, no Gatekeeper friction.
   - Notarization happens in CI or locally via `notarytool`.

We'll ship #1 by default and leave #2 as a config switch.

**No App Store, no sandboxing, no review.** Distributed as a `.dmg` from a
GitHub Release (or any URL you control).

---

## 3. Project layout

```
meeting-briefer/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── vite.config.ts
├── README.md
├── PLAN.md
├── src/
│   ├── main/                       # Electron main process (Node)
│   │   ├── index.ts                # App bootstrap, menubar wiring
│   │   ├── ipc.ts                  # Typed IPC bridge to renderer
│   │   ├── settings.ts             # electron-store wrapper
│   │   ├── secrets.ts              # keytar wrapper
│   │   ├── google/
│   │   │   ├── oauth.ts            # Loopback OAuth flow
│   │   │   └── calendar.ts         # Events fetch + polling loop
│   │   ├── granola/
│   │   │   ├── cache.ts            # Locate + parse cache-v3.json
│   │   │   └── types.ts            # Inferred Granola types
│   │   ├── matcher.ts              # Match upcoming event → prior note
│   │   ├── summarizer/
│   │   │   ├── index.ts            # Provider router
│   │   │   ├── anthropic.ts
│   │   │   ├── openai.ts
│   │   │   └── prompt.ts           # Shared system + user prompt builders
│   │   ├── scheduler.ts            # Triggers briefs N minutes before events
│   │   └── log.ts
│   ├── preload/
│   │   └── index.ts                # Exposes typed bridge via contextBridge
│   └── renderer/                   # React popover UI
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── views/
│       │   ├── Brief.tsx           # The summary popover
│       │   ├── Settings.tsx        # API keys, provider, calendar auth
│       │   └── Empty.tsx           # "No upcoming meeting" state
│       └── styles.css
├── assets/
│   ├── tray-iconTemplate.png       # 16x16 + @2x menu-bar icon
│   └── icon.icns                   # App icon
└── test/
    ├── matcher.test.ts
    ├── granola-cache.test.ts
    └── fixtures/
        └── granola-cache.sample.json
```

---

## 4. Core component design

### 4.1 Granola client (`src/main/granola/client.ts`)

**Why not the local files?** Granola encrypted `cache-v6.json` and
`granola.db` in v6 (March 2026). Reading them is no longer viable for
third-party tools. The supported integration is the **Granola Personal
API**.

- **Auth**: user pastes a `grn_…` Personal API key (created in Granola
  desktop app → workspace name → API keys) in settings; we store it in
  Keychain. Sent as `Authorization: Bearer grn_…`.
- **Host**: `https://public-api.granola.ai` (note the `public-` prefix;
  the bare `api.granola.ai` host is the internal API and returns 404).
- **Endpoints**:
  - `GET /v1/notes?created_after=ISO&cursor=...` — paginated list.
    Response: `{ notes: [{ id: "not_…", title, summary, owner, ... }], hasMore, cursor }`.
  - `GET /v1/notes/{id}?include=transcript` — single note with body and
    `transcript: [{ speaker: { source: "microphone"|"system" }, text, ... }]`.
- **Plan requirement**: Business or Enterprise. Free and Pro plans do not
  expose Personal API keys. On Enterprise, a workspace admin may have
  disabled "Allow personal API keys".
- **Rate limits**: 25 burst, 5 req/s sustained, per user. We'll add a
  simple token-bucket so the background poller never trips it.
- **Polling**: no webhooks exist; we poll every 5 min and also on-demand
  right before each scheduled brief.
- **Note availability**: Granola only returns notes with a generated AI
  summary and transcript; unprocessed notes are excluded — means if a
  meeting _just_ ended, its note may not be in our matcher's window yet.
- **Caching**: keep a local index (`userData/granola-index.sqlite` via
  `better-sqlite3`) of `{id, title, createdAt}` for fast matching;
  fetch full bodies only for the matched note(s).
- **Plan check**: on first connect, hit the API once and surface a clear
  error if the user's plan doesn't allow Personal API access (we'll show
  a link to the upgrade page rather than failing silently).
- **Fallback**: if the user _cannot_ enable the Personal API on their
  plan, the app degrades to "calendar-only" mode and shows upcoming
  meeting metadata without a prior-meeting brief.

Public surface:

```ts
type GranolaNote = {
  id: string;                 // e.g. "not_1d3tmYTlCICgjy"
  title: string;
  createdAt: Date;
  updatedAt: Date;
  summary?: string;           // Granola's AI-generated summary
  transcript?: string;        // joined transcript text, fetched lazily
  rawText: string;            // concatenated body for LLM context
};

listRecentNotes(opts: { since: Date }): Promise<GranolaNote[]>
getNote(id: string, opts?: { includeTranscript?: boolean }): Promise<GranolaNote>
```

### 4.2 Google Calendar (`src/main/google/`)

- **OAuth**: desktop loopback flow.
  - You create an OAuth Client ID (type: Desktop) in Google Cloud Console
    once and paste it into settings (or we ship a public one — see open
    questions).
  - On "Connect Calendar" click, main process opens a localhost server on
    a random port, opens the consent URL in the user's default browser,
    catches the code, exchanges for tokens, stores refresh token in
    Keychain via keytar.
- **Poller**: every 60s, fetch events from `primary` calendar in
  `[now, now + 30min]` window. Track briefed event IDs in memory + on disk
  so we don't double-brief.
- **Scope**: `https://www.googleapis.com/auth/calendar.readonly`.

### 4.3 Matcher (`src/main/matcher.ts`)

Per your spec: match by title, expect weekly recurrence, search 1 week
back and 1 week forward.

Algorithm:

1. Normalize titles: lowercase, strip punctuation, collapse whitespace,
   strip common prefixes like `[recurring]`, `weekly:`, etc.
2. Candidates = Granola notes with `createdAt` in
   `[upcomingStart - 8 days, upcomingStart - 1 hour]`.
   (One week back, plus a day of slack; excluding the very recent past
   so we don't match the meeting against itself if it just finished.)
3. Score each candidate:
   - Title similarity (token-set ratio via `fast-fuzzy` or simple Jaccard
     over normalized tokens). Threshold ≥ 0.7.
   - Bonus for `createdAt` near `upcomingStart - 7 days` (±1 day).
4. Pick the top-scoring candidate. If none clears the threshold, surface
   "no prior meeting found" in the popover instead of guessing.

Returns: `{ note: GranolaNote, confidence: number } | null`.

This is unit-testable with fixtures — no Granola needed in CI.

### 4.4 Summarizer (`src/main/summarizer/`)

- Provider router based on settings; only the active provider's SDK loads.
- Shared prompt scaffold:
  - **System**: "You produce 1-paragraph briefings for an upcoming meeting
    using notes from the previous instance of the same meeting. Be terse
    and concrete. No filler. Three sections: _Last time_, _Open threads_,
    _Heads-up_. Each ≤3 short bullets."
  - **User**: structured payload with upcoming event (title, time,
    attendees, description) + prior note's title, date, and body.
- Output is plain markdown, rendered in the popover with `react-markdown`.
- Cache briefs by `{eventId, granolaNoteId, model}` so re-opening the
  popover doesn't re-bill the API.

### 4.5 Scheduler (`src/main/scheduler.ts`)

- N minutes before an event (default 5, configurable), trigger:
  1. Match → get prior note (or null).
  2. If found, summarize.
  3. Update tray badge to a dot; the popover content is now ready.
  4. Optionally fire a native notification ("Brief ready for _Standup_").
- If user manually opens the popover, show whatever's queued or fall
  back to "next upcoming meeting" on demand.

### 4.6 Menu-bar popover (renderer)

States:

- **Brief ready**: title, time, "Last met on X", markdown brief, "Open in
  Granola" link, "Dismiss" button. **Esc** dismisses immediately. Click
  outside also dismisses (menubar default).
- **No prior note**: title, time, attendees, "No prior meeting found".
- **No upcoming meeting**: next event in the next 24h, or a friendly empty.
- **Needs setup**: missing Google auth, missing LLM key — link to Settings.

Settings view (opened from a gear icon, in the same popover or a child
window):

- Connect Google Calendar / Disconnect
- LLM provider: Anthropic | OpenAI
- API key field (write-only; reads from Keychain show "•••• set")
- Model (default `claude-sonnet-4` / `gpt-4o-mini`, editable)
- Brief lead time (default 5 min)
- Granola cache path override
- "Test now" button → runs the full pipeline against the next event

---

## 5. Security

- **OAuth refresh token** and **LLM API key**: macOS Keychain via `keytar`,
  service name `com.prebrief.app`. Never serialized to JSON on disk.
- **Granola cache**: read-only, never re-written.
- **Renderer**: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`. All privileged ops go through a typed IPC bridge.
- **Outbound network**: only `googleapis.com` and the chosen LLM endpoint.
  No telemetry.

---

## 6. Milestones

Each milestone ends in a runnable state I can demo to you.

1. **M1 — Skeleton (run locally)**
   - Electron + Vite + React scaffold, menubar with placeholder popover,
     settings view, IPC bridge, logging.

2. **M2 — Granola cache reader**
   - Parse your real cache (you'll point me at the path), build fixtures,
     `loadGranolaNotes()` + matcher unit tests passing.

3. **M3 — Google Calendar**
   - OAuth desktop flow, poller, "Next meeting" displayed in popover.

4. **M4 — Briefs end-to-end**
   - Matcher + summarizer wired; popover renders the markdown brief 5 min
     before a meeting; notification fires.

5. **M5 — Packaging**
   - `electron-builder` config, ad-hoc signed `.dmg`, README install
     instructions ("right-click → Open the first time").

6. **M6 — Polish**
   - Empty/error states, brief caching, Esc to dismiss, tray badge,
     "Open in Granola" deep link, icon assets.
