# AFTERSTATE

**Your World. Your Rules.**

AFTERSTATE is a cinematic 3D open-world browser game. This repository contains the first playable foundation.

## Version 0.1.0 — First World

- Three.js 3D city environment
- Third-person character controller
- First-person / third-person camera toggle (V)
- Keyboard movement, sprint and jump
- Pointer-lock mouse look
- Touch movement and look controls
- Responsive cinematic title screen
- Optional Supabase client configuration, using the existing KDS AI project

## Development

Requirements: Node.js 22+

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the Supabase URL and publishable key in `.env.local`. Never use a Supabase service-role or secret key in browser code.

## GitHub Pages

The GitHub Actions workflow builds and deploys the site to:

https://lordlolqdh.github.io/afterstate/

Add these repository Actions secrets to enable Supabase in the deployed build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Backend and security

AFTERSTATE is configured to use the existing KDS AI Supabase project. AFTERSTATE-specific tables must use an `afterstate_` prefix and have Row Level Security enabled. Existing KDS AI tables and functions must not be modified.

Supabase Realtime can support an early presence prototype. A large action-game multiplayer world with authoritative movement, physics, combat and anti-cheat will eventually need a dedicated authoritative game server; a browser client and database alone cannot safely provide that.

## Current scope

Version 0.1 is a single-player movement prototype. Accounts, persistent saves, vehicles, combat, AI NPC schedules and full multiplayer are later milestones.
