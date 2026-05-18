# Prebrief

A macOS menu-bar app that, before each Google Calendar meeting, finds the
matching prior Granola note and shows you a quick brief of what happened
last time and what to know going in.

> Status: **M1 — Skeleton**. No real data wired up yet.
> See [`PLAN.md`](./PLAN.md) for the full plan and milestones.

## Requirements

- macOS (Apple Silicon or Intel)
- Node 20+ and pnpm (`brew install pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`)
- A Granola **Business or Enterprise** plan (Personal API keys aren't
  available on Free or Pro)
- A Google Cloud OAuth Desktop client (your own — see below)
- An Anthropic or OpenAI API key

## Develop

```sh
pnpm install
pnpm dev            # runs Vite + Electron together
pnpm typecheck
pnpm lint
pnpm test
```

The dev command starts Vite on `http://localhost:5173` and then launches
Electron pointed at it. On Linux/CI the renderer compiles but the tray
window won't be visible without a display server.

## Build a `.dmg` (on your Mac)

```sh
pnpm dist
```

The output lands in `out/`. It is **ad-hoc signed** (no Apple Developer
account required). The first time you open it, macOS Gatekeeper will
block it; right-click the app in Finder → **Open** → **Open** in the
dialog. After that it launches normally.

If you want a "just opens" experience for other people, switch to
Developer ID signing + notarization (see the comments in
[`electron-builder.yml`](./electron-builder.yml)).

## Configuration (lands in M3/M4)

- Google OAuth: you create your own client at
  https://console.cloud.google.com/apis/credentials → "Create credentials"
  → "OAuth client ID" → **Desktop app**. Paste the client ID/secret in
  Settings.
- Granola: create a Personal API key in the Granola desktop app
  (workspace name → API keys). Paste it in Settings.
- LLM: pick Anthropic or OpenAI, paste the key.

All secrets are stored in the macOS Keychain via `keytar`, never on disk
in plaintext.
