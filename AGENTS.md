# AGENTS.md — AI agent instructions for this repo

Purpose
- Provide concise, actionable guidance for AI coding agents working on this repository so they can be productive immediately.

How to run (local)
- Install dependencies: `npm install`
- Dev server: `npm run dev` (uses Vite)
- Build: `npm run build`
- Preview production build: `npm run preview`

Key scripts (see package.json)
- `dev` — Vite dev server
- `build` — Vite build (outputs `dist`)
- `preview` — Preview the production build

Important files and directories
- `index.html` — app entry
- `main.js` — app bootstrap
- `js/` — most application source files (map logic, controls, layers)
- `style.css` and `src/style.css` — styling
- `myLayers/` and `public/myLayers/` — GeoJSON assets used by the app (large data)
- `data/` and `public/data/` — additional GeoJSON tiles and data
- `vite.config.js` — dev server proxy rules and build settings
- `netlify.toml` — Netlify build and redirect rules
- `package.json` — scripts and dependencies

Conventions and notes for agents
- This is a client-side web map built with Vite and OpenLayers (see `ol` in dependencies).
- Static GeoJSON files are present in `myLayers/` and mirrored under `public/myLayers/`. Prefer linking rather than embedding these large files in responses.
- The dev server proxies several API paths (see `vite.config.js`): `/lgln-stac`, `/dgm`, `/dom`.
- When making changes, preserve the small, focused footprint — avoid large refactors unless requested.

What to do when adding instructions or skills
- Link to existing docs or files rather than copying large content.
- Keep new agent instructions minimal and focused on tasks an agent will perform (build, run, test, file locations).

Quick tasks examples
- Run dev server: `npm install && npm run dev`
- Produce a production build: `npm run build`

If you want additional, task-specific agent files (e.g., CI hooks, PR review prompts, or a skill for map-layer updates), ask and I will draft them.
