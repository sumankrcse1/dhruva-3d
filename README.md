# Dhruva Defence — integrated field ecosystem

Open **Dhruva_Defence_Ecosystem.blend** in Blender. The scene uses metres, Cycles, and a 3840 × 2160 output preset. Authored with the installed Blender 5.2.2; compatibility with Blender 4.x has not been tested.

## Presentation

- Numpad 0: active camera. Space: play the 740-frame demonstration.
- Timeline camera markers: 0 overview; 100 EFM; 200 network; 300 warning; 400 wearable; 500 command; 600 translator; 700 architecture.
- Toggle **08_DATA_VISUALIZATION** in the Outliner to show/hide animated information links.
- Use the requested named zone collections and `HOTSPOT_` empties to isolate and locate equipment.
- Select **SYSTEM_DEMO_CONTROLS** → Object Properties → Custom Properties. Thresholds are deliberately unset (zero, `thresholds_confirmed=False`). The alert animation is scripted and is not a live threshold evaluator.
- Individual cameras include an additional **CAM_09_LRX_RECEIVER** close-up.
- For clickable camera and alert controls, open Blender's Text Editor, select the packed **presentation_controls.py** text, and press **Run Script**. The 3D View sidebar then has an **Exhibition** tab. This is optional; the scene opens without executing scripts.
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

The editable procedural builder is `scripts/build_scene.py`; it rebuilds from an empty scene and saves a new master. Apply `validate_scene.py`, then `refine_scene.py`, then `finalize_scene.py`, and finally `polish_scene.py` once in that order to reproduce the delivered refinements. The refinement scripts are build stages, not repeatable interactive commands. `scripts/render_views.py` renders the ten requested views from the saved master. Call Blender in background with `--python scripts/render_views.py`; append `-- preview` for reduced-resolution QA or `-- 1 2` to select numbered views. Product close-ups automatically hide information links to keep the hardware readable.
