# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

First Notes: a single-user piano-lesson business app (schedule, payments, directions, mileage), used mostly from an iPhone saved to the home screen. No build step, no dependencies, no tests, no git.

## Running

- `node server.js` (or `start.bat`) — serves on port 3000, bound to `0.0.0.0` so the phone can reach it over Wi-Fi. The real server is usually already running; don't start a second one on 3000.
- `index.html` is re-read on every request, so edits show up on a page refresh without restarting the server. Server changes (e.g. the change log endpoint) need a restart.
- Syntax-check the inline script after edits:
  `node -e "const h=require('fs').readFileSync('index.html','utf8');new Function([...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n'));console.log('ok')"`
- To test behavior without touching real data: copy `index.html`, `server.js`, `data.json`, `route-cache.json` to a scratch folder, change `PORT` in the copy, run it, and drive headless Edge (`msedge --headless=new --remote-debugging-port=...`) over CDP. Avoid flows that change mileage weeks — they call the paid Google Routes API.

## Files

- `server.js` — tiny HTTP server. `GET/PUT /api/data` reads/writes the whole `data.json`; `/api/geocode` proxies OpenStreetMap Nominatim (rate-limited 1/s); `/api/route` gets driving miles from Google Routes using `google-key.txt`, cached in `route-cache.json`; `POST /api/log` appends one timestamped line to `changelog.txt`.
- `changelog.txt` — action log, one plain sentence per user action. Only covers changes from 2026-10-30 on; anything earlier has to be inferred from `data.json`.
- `index.html` — the entire app: CSS, markup, and one inline script. Leaflet (from cdnjs) for the map.
- `data.json` — live data. The client loads all of it, mutates `data` in memory, and `save()` PUTs the whole object back.

## Data model (key to most changes)

Each student has base fields (`length`, `billing` weekly|monthly, `billingStart`, `rate`, `payType`, `poNumber`) plus history layered on top. **Changes always apply from a date forward; past lessons must keep their old values** — never overwrite a base field to make a change.

- `slots[]`: recurring series `{ anchor, start (minutes), until (exclusive), freq: weekly|biweekly|once, exceptions }`. `exceptions` is keyed by the lesson's **original** date: `{ cancel: true }` or `{ date, start }` for a move.
- `occurrences(from, to)` expands slots into lessons `{ s, si, orig, date, start, moved }`. Everything per-lesson (payments, overrides, billing) is keyed by `orig`, so a moved lesson keeps its payment.
- `billingChanges[]`: sorted `{ from: orig, billing?, rate?, length?, payType?, poNumber?, restart? }`. Fields are optional; unspecified ones carry forward. `billingFor(o)` folds them up to `o.orig`; `lengthFor(o)` does the same for length. Always read length via `lengthFor(o)`, never `o.s.length`.
- Monthly cycle: payment due every 28 days from the cycle start. Staying monthly keeps the cycle; it restarts only on weekly→monthly or a change with `restart: true` (the "Billing Start Date" setting).
- One-lesson overrides: `amountOverrides`, `payOverrides`, `lengthOverrides` keyed by `orig`. `paid` is keyed by the due lesson's `orig`.

## UI structure

- Pages are `<section>`s toggled with the `.hidden` class by `show*()` functions; the fixed `#homeBtn` (labelled "Back") is re-pointed per page.
- All pop-ups go through `openSheet(html)` / `closeSheet()`; `ask(title, msg)` returns a Promise<boolean>. Menus in sheets use `<details><summary class="btn">` categories.
- Drag-down-to-refresh reloads the page and restores the current page via `sessionStorage.reloadTo`.
- Stats page: `renderStats()` works off `statsWeek` (◀ Today ▶ and swipe change it). Money shows **Actual** (lessons marked paid) and **Forecast** (everything due, paid or not). The month figure runs from the 1st of the month of the week's Monday through the end of the viewed week.

## Change log

Every user action that calls `save()` must then call `logChange(text)`. Write `text` as a plain sentence starting with `Name:`, including the lesson date (`orig`) and old → new values, so history can be reconstructed from the log alone. Read form values before `closeSheet()` — it clears the sheet. Helpers: `detailDiff(before, after)` for student detail fields, `payText(p)` for payment type. Automatic saves (map geocoding) are not logged.
