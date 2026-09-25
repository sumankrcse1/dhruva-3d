# Dhruva Defence — interactive 3D presentation (web)

A browser-based, real-time version of the integrated ecosystem: environmental
sensing, early warning, soldier monitoring, command and control, translation and
the optional perimeter technologies, on one fictional high-altitude site.

It is the interactive companion to `Dhruva_Defence_Ecosystem.blend` (Cycles
stills) in the parent folder. Same zones, same camera set, same reference
dimensions — but it runs live on a laptop, a touchscreen or a projector, with no
Blender installed.

## Run it

Any static web server works; ES modules will not load from `file://`.

```bash
cd web
python3 -m http.server 8848      # then open http://localhost:8848
```

or

```bash
npx serve web
```

Everything is vendored locally (Three.js is in `vendor/`), so it runs with no
internet connection — suitable for an air-gapped demonstration machine.

Requires a browser with WebGL 2: current Chrome, Edge, Firefox or Safari.

## Driving the demonstration

| Action | Control |
| --- | --- |
| Orbit / zoom / pan | drag · scroll · right-drag |
| Open a subsystem | click its legend chip, its callout label, the gold ring on the ground, or the hardware itself |
| Guided tour | **Space**, or *Play tour* — nine chapters; chapters 2–6 are full product stories |
| Jump to a chapter | **1**–**9** |
| Callout labels | **L** |
| Data pathways | **D** |
| Night / emergency view | **N** |
| True scale ↔ exhibition scale | **S** |
| Reset to the master view | **R** |
| Close the detail panel | **Esc** |

The left rail also carries the alert-state control (NORMAL / CAUTION / ALERT /
Auto), per-class switches for the information links, and a quality selector
(High / Balanced / Performance) for weaker hardware.

The detail panel's three buttons: **Fly to** re-frames the hardware, **Isolate
zone** hides every other zone, **Trace data path** shows only the link classes
that belong to that subsystem.

`window.DHRUVA` is exposed for kiosk or remote control, e.g.
`DHRUVA.selectSystem('efm')`, `DHRUVA.goToChapter(3)`, `DHRUVA.setNight(true)`.

## Product stories

Each product has a complete story, driven by a physical model rather than a
timer. A caption box at the top explains each step as it happens.

| Chapter | Story | What drives it |
| --- | --- | --- |
| 2 · Storm → EFM | A thunderstorm drifts in; the EFM reading rises; CAUTION at 1 kV/m, ALERT and hooter at 3 kV/m | Two-charge cloud model (−40 C at 6 km, +40 C at 10 km) with ground image charges; rain at terminal velocity; hooter wavefront at 343 m/s |
| 3 · Strike → LDS | Stepped leader, return stroke, thunder; the radio pulse reaches the three ANT-50 / LRX-1 nodes at different times; hyperbolas cross at the strike | Arrival times from distance ÷ speed of light; time-of-arrival hyperbolas solved from those times; EFM shows the step change |
| 4 · Soldier health | Patrol walks wearing watches; commander's tablet shows everyone live; double time → SOLDIER 04 over the HR limit → halt → recovery | Heart rate follows each soldier's workload with a physiological lag |
| 5 · Space watch | Catalogued LEO passes; a new object rises; the station dish slews and tracks it; no catalogue match → flagged; footprint and loss-of-signal shown | Orbit rate from Kepler's third law; dish pointed by azimuth/elevation |
| 6 · Border intrusion | TX → RX microwave links along the perimeter; intruder climbs the fence and walks into the beam; RX level drops → INTRUSION | Line-of-sight hops over the ridge; loss from the body's position in each link's ellipsoid; free fall from the fence |

Sound (hooter, thunder, rain, alarms) is synthesised in the browser and starts
after the first click; toggle it under *View*. The site geometry is compressed
(storm distances 20×, orbits and time) so everything fits one exhibition view —
the captions and panels say so.

## Scale

Hero hardware defaults to **exhibition scale** so it is legible in the wide view;
the header note says so, and **S** switches everything to true scale. True-scale
figures are in each subsystem panel (the EFM sensor really is 170 mm across).

## What is reference-based, what is a placeholder

Built to the published reference dimensions, the same ones validated in
`QA_report.json`:

- **EFM-100C** — ≈170 mm dia × 130 mm sensor, 3/4 in NPT, inverted mast
  installation with tripod, junction box, drip loop and ground bond.
- **ANT-50** — 124 mm dia × 254 mm overall on the supplied 610 mm mast.
- **LRX-1** — 160 × 114 × 28 mm, six front indicators, reference connector
  arrangement, in a sheltered cabinet at each node.

Labelled placeholders, because no specification was supplied:

- the wearable's geometry and its metric fields (heart rate, SpO₂, temperature
  and battery are field names, not claims);
- the exact warning beacon and sounder hardware;
- the commander and translator screens — these are concept layouts, not approved
  Dhruva screenshots;
- the EFM sensing-face internals, which the references do not establish.

Nothing in the page asserts an operational threshold, a detection range, a
medical capability, offline or voice translation, orbital data, or a real
location. All readings, strikes, tracks, detections and log entries are
synthetic, generated by `js/sim.js` purely so the interface has something live to
show. The site, the perimeter and the restricted zone are fictional.

## Layout of the code

```
index.html            page shell: header, rail, legend, panel, modals
css/style.css         all styling
js/main.js            application: builds the world, wires the interface, runs the loop
js/layout.js          every world position in one place (anchors, fence, views)
js/sim.js             demonstration state (field, physiology, strikes, barrier, tracks)
js/stories.js         story director: steps, captions, camera shots, alerts
js/audio.js           synthesised hooter, thunder, rain and alarm tones
js/scene/storm.js     storm cell physics, rain, lightning, wavefronts, TOA hyperbolas
js/scene/story_assets.js  microwave barrier, intruder, orbiting satellites
js/data/systems.js    subsystem content: chain, specs, and the "not asserted" notes
js/scene/terrain.js   analytic heightfield + vegetation + boulders
js/scene/sky.js       sky dome, clouds, stars, lighting rig, day/night, environment map
js/scene/materials.js shared PBR library (MAT_* names match the Blender master)
js/scene/devices.js   hero hardware at reference dimensions
js/scene/installation.js  airbase, command post, perimeter, gate, roads, vehicles
js/scene/actors.js    personnel, helicopters, drone, satellites, detection overlays
js/scene/links.js     animated information links, colour-coded per data class
js/ui/*.js            callouts, HUD, detail panel, canvas dashboards, icons
vendor/three/         Three.js r180 + OrbitControls (vendored for offline use)
assets/               the supplied Dhruva Defence logo, used as-is
```

## Changing things

- **Wording, specs, chain steps, disclaimers** → `js/data/systems.js`. The legend
  strip, callouts, tour and panels all read from it.
- **Where something sits** → `js/layout.js`. Anchors, the fence line, the
  restricted zone and every camera pose live there; the scene modules follow.
- **Dashboards** → `js/ui/screens.js`. The same renderers drive the in-scene
  displays and the panel, so a change appears in both. When approved Dhruva
  screenshots arrive, replace the renderer for that dashboard.
- **Branding** → `assets/dhruva_logo.png` is used unmodified, undistorted, and is
  not applied to any third-party hardware.

## To finalise

Supply watch drawings and the metrics the hardware actually reports, the approved
commander and translator screens, the final alert hardware, and the
communications/notification design. Until then those parts stay labelled as
placeholders rather than being invented here.
