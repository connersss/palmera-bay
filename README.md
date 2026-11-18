# Vistamar — an open-world crime game for make.fun gta6-01

A sun-soaked coastal city you can explore on foot and by car. Steal cars,
outrun the VCPD, run jobs for Mara Voss, earn taxi fares, and clear your heat
at the Pay & Spray.

## Play

- **WASD / arrows** — walk, or drive when in a car
- **E** — steal / exit a car
- **F** — punch, or shoot when the pistol is out
- **2** — switch between fists and pistol
- **P / Esc** — pause, **R** — restart after Busted / Wasted

## The city

Vistamar is a 3200×2400 open world: eight avenues and six streets, a plaza
park, a beach and marina, and named places — Mara's Garage, Vistamar Bank,
Pay & Spray, St. Anselm Hospital. Traffic follows the road graph, pedestrians
walk the sidewalks and flee fast cars, and the wanted level (0–5 stars) brings
foot cops and VCPD interceptors after you.

## Jobs

Six story missions for Mara Voss, from stealing your first car to the big
bank score, plus taxi fares any time you are in a yellow cab. Cash, missions
completed and best score are saved in the browser.

## Tech

Plain static files under `game/` — no build step, no network requests, no
libraries. Canvas 2D rendering, a seeded city generator, WebAudio synth
sound, and a `?shot=` mode that stages real gameplay frames for screenshots.

Run it with `node serve.ts` and open http://localhost:8080.
