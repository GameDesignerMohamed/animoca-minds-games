# RECOMP · 7-Day Week

The recomp training program (13.5% → 12% body fat · maintain weight · gain muscle) as an installable, offline-first PWA.

No build step, no dependencies, no backend. All training data lives in `localStorage` on your device.

## Features

- **7-day week view** — Upper A / Run / Lower / Core / Upper B / Run / Off, with today's session auto-highlighted and finished days ticked off.
- **5×5 logging** — tap `+` once to log a full set at target reps, adjust reps/RPE from there. Load input per lift.
- **Automatic progression** — all 25 reps at RPE ≤ 8 → next session's target shows `+2.5 kg` (upper) / `+5 kg` (lower); otherwise "repeat load". Prefills the load input next time.
- **Accessory tracking** — set dots per exercise, last-used load remembered across sessions.
- **Rest timers** — one tap per block (3–4 min mains, 60–90 s supersets), ring countdown, +30 s, beep + vibration at zero.
- **Week counter & deload** — set your program start date once; week 6 of every 6-week block shows the deload banner (half the sets, same loads).
- **The Log** — per-lift history with load, rep string, and pass/repeat verdict, plus the next target.
- **Rules & banned list** — the five rules, banned/frozen exercises, and the shoulder protocol, always one tap away.
- **Offline-first** — service worker precaches everything; works airplane-mode in the gym basement. Installable to the home screen (standalone, portrait).

## Run it

Any static file server:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

Or deploy the folder as-is to GitHub Pages / Netlify / Vercel — all paths are relative, so it works from any base path.

## Structure

```
index.html            app shell
css/app.css           all styling
js/program.js         the program as data (days, lifts, rules)
js/app.js             logging, progression, timers, rendering
sw.js                 offline cache (bump VERSION to ship updates)
manifest.webmanifest  install metadata
icons/                generated barbell mark
```

## Editing the program

Everything about the program — exercises, sets, rest times, rules — is plain data in `js/program.js`. Change it there; no other file needs touching. After any change, bump `VERSION` in `sw.js` so installed clients pick it up.
