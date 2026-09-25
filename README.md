# Dhruva Defence — integrated field ecosystem

Two deliverables, one ecosystem:

- **`web/`** — the interactive 3D presentation that runs in a browser, offline.
  `cd web && ./serve.sh`, then open http://localhost:8848. Click any subsystem to
  fly to it and open its sensor → action chain, or press Space for the guided
  tour. See [web/README.md](web/README.md).
- **`Dhruva_Defence_Ecosystem.blend`** — the Blender master for high-resolution
  Cycles stills.

Both use the same zones, the same camera set and the same reference dimensions.

Open **Dhruva_Defence_Ecosystem.blend** in Blender. The scene uses metres, Cycles, and a 3840 × 2160 output preset. Authored with the installed Blender 5.2.2; compatibility with Blender 4.x has not been tested.

## Presentation

- Numpad 0: active camera. Space: play the 740-frame demonstration.
- Timeline camera markers: 0 overview; 100 EFM; 200 network; 300 warning; 400 wearable; 500 command; 600 translator; 700 architecture.
- Toggle **08_DATA_VISUALIZATION** in the Outliner to show/hide animated information links.
- Use the requested named zone collections and `HOTSPOT_` empties to isolate and locate equipment.
- Select **SYSTEM_DEMO_CONTROLS** → Object Properties → Custom Properties. Thresholds are deliberately unset (zero, `thresholds_confirmed=False`). The alert animation is scripted and is not a live threshold evaluator.
- Individual cameras include an additional **CAM_09_LRX_RECEIVER** close-up.
- For clickable camera and alert controls, open Blender's Text Editor, select the packed **presentation_controls.py** text, and press **Run Script**. The 3D View sidebar then has an **Exhibition** tab. This is optional; the scene opens without executing scripts.
- Camera buttons temporarily disable automatic timeline camera cuts so an F12 render uses the selected view. Click **Restore timeline camera cuts** to resume the guided sequence.
- Reusable zone libraries are under **Assets/**; use File → Append → Collection. The master contains packed branding and fonts.

## What is reference-based

- ANT-50: 124 mm diameter × 254 mm overall sensor height, nominal 3/4-inch mounting mast, 610 mm supplied mast length.
- LRX-1: 160 × 114 × 28 mm enclosure, six labeled status indicators, reference-based front connector arrangement. Sheltered cutaway cabinets illustrate indoor-rated receivers.
- EFM: user-specified approximate 170 × 130 mm envelope; inverted mast, tripod, junction box, drip loop, ground bond. Detailed internal sensing geometry is withheld because the supplied references do not establish it.
- Original Dhruva logo PNG used without redesign, cropping, or aspect-ratio distortion. No Dhruva branding added to Boltek devices.
- Three illustrative network nodes → server/processing → operator information. Spacing is compressed for exhibition composition, not a proposed deployment design.

## Reference and approval limits

This is an editable **concept visualization**, not a validated operational digital twin or final product CAD model. Watch dimensions, medical metrics, actual Dhruva interface screenshots, communication protocols, notification integration, and exact warning hardware were not supplied. These remain named/labeled placeholders. The generic personnel are modeled presentation figures, not photoreal scans. The optional border/drone/satellite collection is intentionally empty because product capability was not independently confirmed.

No medical readings, offline capability, voice support, location accuracy, detection radius, operational warning thresholds, or real installation coordinates are asserted. All displayed history/events are synthetic. The Hindi/Chinese interface shows a language workflow, not a verified application screen. A synthetic demonstration chime is packed at frame 350; it is not a manufacturer's siren recording. There is no real notification connection.

To finalize: provide watch photos with dimensions, confirmed supported metrics, approved commander/translator screenshots, exact alert hardware, and approved personnel assets if photoreal people are required. Validate siting, electrical design, and grounding with the manufacturer before any real installation.

## Sources

- [Boltek EFM-100C product page](https://boltek.com/product/efm100c-electric-field-mill-kit/)
- [Boltek inverted mounting instructions](https://boltek.com/wp-content/uploads/2024/02/EFM-INV_Instructions_20220322-1.pdf)
- [Boltek LRX-1 product page](https://boltek.com/product/lrx-1-lightning-network-detector/)
- [Boltek LRX-1 specification sheet](https://boltek.com/wp-content/uploads/2024/02/LRX-1-SS-03042017.pdf)

Downloaded source sheets and the original logo are in `references/`. The supplied composition image informed the fictional mountain environment; its optional capability illustrations were not treated as instructions or verified specifications.

## Rebuild / render

The editable procedural builder is `scripts/build_scene.py`; it rebuilds from an empty scene and saves a new master. Apply `validate_scene.py`, `refine_scene.py`, `finalize_scene.py`, `polish_scene.py`, `fix_final_framing.py`, and `verify_controls.py` once in that order to reproduce the delivered refinements. Use `export_assets.py` for the product libraries. The refinement scripts are build stages, not repeatable interactive commands. `scripts/render_views.py` renders the ten requested views from the saved master. Call Blender in background with `--python scripts/render_views.py`; append `-- preview` for reduced-resolution QA or `-- 1 2` to select numbered views. Product close-ups automatically hide information links and obstructing exhibit labels to keep the hardware readable.

## Delivery checks

The master contains 1,238 objects and ten cameras. Checked EFM, ANT-50 and LRX enclosure/mast dimensions pass their specified envelopes. Sixty-four hardware meshes were checked for non-manifold edges with zero found. Branding and fonts are packed. Camera selection and restoring all eight timeline bindings were tested. See `QA_report.json` for the scope and limitations of these checks.

The ten stills are in `renders/`; `Contact_sheet.jpg` is a quick review sheet. All are 3840 × 2160 Cycles outputs, with denoising. Views 1–2 use 48 samples; the remaining views use a 16-sample delivery preset. The master keeps a 48-sample preset for further rendering. The initial Metal GPU run stalled, so delivered frames were rendered on the CPU.

Known remaining work: approved product details and interface screenshots, photoreal personnel refinement, final exhibition art direction, and any required LOD switching. The automated mesh check does not certify all assemblies as collision-free or validate real-world engineering.
