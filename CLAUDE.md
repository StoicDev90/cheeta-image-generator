# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local, single-user web app ("Cheeta Image Generator Studio") that wraps Higgsfield's `z-image/turbo` and `xai/grok-imagine-image-2.0` models. Flask serves a compiled Vite + TypeScript frontend and proxies generation requests so the API key never reaches the browser. User-facing text is in Spanish. See [PRODUCT.md](PRODUCT.md) for product/design constraints (honest error states, no fabricated example content, billable actions made clear).

## Commands

```bash
# Backend (venv lives in .venv; deps: higgsfield-client, python-dotenv, flask)
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py          # serves http://127.0.0.1:5000

# Frontend (run in web/)
npm install
npm run build                     # tsc --noEmit && vite build -> web/dist
npm run dev                       # vite build --watch (no dev server; Flask serves web/dist)
```

There are no tests or linters configured. Type-checking happens via `tsc --noEmit` in the build script.

## Architecture

- [main.py](main.py) is the whole backend. It serves `web/dist/index.html`, `/assets/*` from `web/dist/assets`, and saved images from `/generated-images/*`. The one API route is `POST /api/generate`: it validates input (prompt 1–800 chars, resolution `1k|2k`, a fixed aspect-ratio set, seed 0–2147483647, `prompt_extend`), calls `higgsfield_client.subscribe("z-image/turbo", ...)`, maps final queue status (NSFW / Cancelled / Failed / not Completed) to distinct error responses, downloads the first image to `generated-images/image-YYYY-MM-DD-HH-MM-SS.<ext>`, and returns `{ok, file, url}` or `{ok: false, error}`.
- [web/](web/) is the frontend: a single page `web/index.html` (CSS inline) plus `web/src/main.ts`. No UI framework. Fonts are `@fontsource-variable` packages. Flask only serves the **built** output, so frontend changes are not visible until `npm run build` (or `npm run dev` watch) has run.
- The per-model config (`MODELS` in `main.py`, `MODELS` in `web/src/main.ts`) and the form options in `index.html` must be kept in sync. `POST /api/generate` takes multipart form data (`model`, optional `images` files for Grok, uploaded via `higgsfield_client.upload` and sent as `image_urls`). Images are saved to `generated-images/<model-key>/` (`z-image`, `grok`); loose legacy files are migrated at startup.

## Configuration

Credentials come from `.env.local` (gitignored), loaded by `python-dotenv` at startup: `HF_KEY=key-id:key-secret`. The server restarts are needed after changing it. `generated-images/`, `.venv/`, `node_modules/`, and `web/dist/` are gitignored.

## Design skills

`taste-skill` and `impeccable` are installed under `.claude/` (see `skills-lock.json`) and were used to design the UI; use `impeccable` for UI changes.
