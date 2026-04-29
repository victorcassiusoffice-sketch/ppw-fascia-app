# NEW_ZONE_MAP — PPW Body-Zone Taxonomy v2 (FINAL)

**Stage 1 plan — Vic decisions locked in. No code changes in this doc.**

Author: Anatomy Map Architect (Sub-Chat)
Reports to: Dispatch
Date: 2026-04-29
Status: **FINAL — ready for Stage 4 implementation**

This doc replaces the 29-zone `NN_name_side` grid with a 17-group, 33-code problem-driven taxonomy grounded in fascia-therapy and sports-rehab literature. It covers research, taxonomy, old→new mapping, folder migration, sex toggle, hotspot polygons, and a clean handoff brief for the implementation sub-chat (also published separately at `STAGE_4_IMPLEMENTATION_BRIEF.md`).

---

## Change log (this revision)

| Item | Draft v1 | FINAL v2 | Driver |
|------|----------|----------|--------|
| Zone-group count | 18 | **17** | Q2 + Q3 mergers below |
| Code count | 35 | **33** | Same |
| Calf/heel/sole | 3 separate groups (`calf-achilles-*`, `plantar-foot-*`, plus heel implicit) | **1 merged group** `calf-*` covering full posterior lower leg unit (gastroc/soleus + Achilles + heel + plantar fascia) | **Q2** — Vic's call. Single Superficial Back Line continuity. |
| Forearm + wrist + hand | 2 separate groups (`forearm-*`, `wrist-hand-*`) | **1 merged group** `forearm-*` covering elbow-distal arm: extensors/flexors + carpal tunnel + palm + fingers | **Q3** — Vic: "will be forearm stretch". Fascia release for tennis/golfer's elbow naturally extends through wrist into palm. Clinically continuous. |
| SI joint | folded into `lower-back-*` | unchanged | **Q1** confirmed |
| Hip flexor | included with caveat | **included; description now documents psoas → L1-L5 lumbar referral pattern** (Vic's clinical note) | **Q4** confirmed |
| Jaw / TMJ | included with caveat | **included; description now documents masseter trigger-point → tension headache pattern** | **Q5** confirmed |

---

## TL;DR — six-line summary

1. **17 zone-groups → 33 codes** (down from 18/35 after Vic's mergers).
2. All 15 of Vic's named zones in; jaw/TMJ + hip flexor + IT band added.
3. Knee splits 3 ways (`knee-inside`, `knee-outside`, `knee-back`) — Vic's exact ask.
4. **`calf-*` is now a single zone covering calf + Achilles + heel + plantar fascia** as one Superficial Back Line unit.
5. **`forearm-*` now covers forearm + wrist + hand + fingers** as one fascia-continuous unit.
6. All 6 seed videos migrate without re-shoots; legacy folders preserved as stubs.

---

## 1. Research summary

### 1a. Top pain/release points in fascia therapy + sports rehab + chronic pain medicine

Cross-referencing Anatomy Trains (Tom Myers), Travell & Simons' *Myofascial Pain and Dysfunction* (3e), JOSPT/AAFP clinical practice guidelines, and chronic-pain epidemiology data, the most clinically relevant zones for a fascia-release app are:

| # | Zone | Why it matters | Source |
|---|------|----------------|--------|
| 1 | Low back | #1 cause of disability worldwide; ~80% lifetime prevalence | JOSPT 2021 LBP CPG |
| 2 | Neck | 30% of acute episodes become chronic | JOSPT 2017 Neck CPG |
| 3 | Headache (tension/migraine) | Trapezius + suboccipital + temporalis trigger points | Travell & Simons |
| 4 | Knee — multi-zone | OA, runner's knee, MCL/LCL, popliteal cysts | AAFP 2020 |
| 5 | Hip flexor (psoas) | Sitting posture epidemic; **psoas referral travels L1–L5 → lower back** (Vic's clinical note confirmed) | Brookbush, Physiopedia |
| 6 | Gluteal (med/min/piriformis) | "Dead butt", sciatic referral | Travell & Simons |
| 7 | Plantar fasciitis | Top adult foot complaint (covered inside `calf-*` per Vic) | Novus Spine |
| 8 | IT band syndrome | #1 lateral knee pain in runners/cyclists | Caddoo Rehab |
| 9 | Tennis elbow | 1–3% adult prevalence (covered inside `forearm-*`) | Physiopedia |
| 10 | Shoulder — anterior | Adhesive capsulitis, rotator-cuff anterior, pec minor | Joint Replacement Inst. |
| 11 | Trapezius | Most-injected trigger-point site in clinics | Cleveland Clinic |
| 12 | Quadratus lumborum | Hidden contributor to LBP (covered inside `lower-back-*`) | Travell & Simons |
| 13 | Hamstring | High recurrence in athletes | NIH PMC |
| 14 | Calf / Achilles | Achilles tendinopathy, gastroc trigger points | Physiopedia |
| 15 | TMJ / jaw | **Masseter trigger points → tension headache** (per Q5 confirmation); bruxism | Travell & Simons |
| 16 | Carpal/wrist | RSI, CTS (covered inside `forearm-*`) | RSI Pain Inst. |
| 17 | Upper back (rhomboid/mid-trap) | Postural collapse zone; "computer hump" | Trigger-point literature |

### 1b. Mapping pain points to Anatomy Trains fascia chains

Using Myers' 12 myofascial meridian system (8 represented in `data.js → FASCIA_CHAINS`):

| Fascia chain | Includes (key zones in v2) | Evidence (Wilke et al. 2016) |
|--------------|----------------------------|-------------------------------|
| Superficial Back Line (SBL) | `calf-*` (full posterior leg unit incl. plantar) · `hamstrings-*` · `lower-back-*` · `upper-back-*` · `traps-*` · `headache` (galea) | **Strong** — all 3 transitions verified |
| Superficial Front Line (SFL) | front shin (in `calf-*` front view) · `knee-inside-*` (quad insert) · `hip-flexor-*` (rect. fem.) · `front-shoulder-*` partial · `neck-*` (SCM front) | None dissected — theoretical |
| Lateral Line (LL) | `neck-*` (sides) · `it-band-*` · `knee-outside-*` · `calf-*` lateral (fibularis) | Moderate |
| Spiral Line (SpL) | `upper-back-*` ↔ contralateral `it-band-*` ↔ contralateral `calf-*` arch | Moderate-strong |
| Deep Front Line (DFL) | `jaw-*` · deep `neck-*` · `hip-flexor-*` (psoas) · adductor (in hip-flexor zone) · deep `calf-*` (TP/FDL/FHL/deep arch) | Theoretical |
| Sup. Back Arm Line | `traps-*` · `front-shoulder-*` (deltoid) · `forearm-*` extensors · back of hand | Verified |
| Deep Front Arm Line | `front-shoulder-*` (pec minor) · biceps · radial wrist + thumb (in `forearm-*`) | Verified |
| Functional Lines | cross-body — `front-shoulder-*` ↔ contralateral `gluteal-*`; lat ↔ contralateral glute max | **Strong** |

### 1c. Sex-specific anatomical considerations

- **Pelvic floor / groin:** female pelvis is wider (90° subpubic angle vs 65° male) and tilts more anteriorly. Female pelvis houses uterus/vagina; male pelvis houses prostate. Adductor frontal angle differs (protective in females vs males). Practical impact: `hip-flexor-*` and `gluteal-*` polygon centroids sit slightly wider on female figures; same intervention.
- **Breast tissue / chest:** `front-shoulder-*` polygon should start ~25 px lateral on female figures so taps land on anterior delt / pec minor, not breast tissue.
- **Pelvic-floor-specific protocols:** out of scope for v2 (no sensitive zones on body map). Future option lives behind the DFL chain rather than as a tap target.
- **All other zones:** anatomically equivalent across sexes; one polygon set works.

Sources cited in §Sources at end.

---

## 2. Final zone taxonomy (proposed)

**17 zone-groups → 33 individual zone codes.** All codes use kebab-case. No more `NN_` prefix. Display labels are short, mobile-friendly.

### Group A — Head & cervicothoracic (5 groups, 9 codes)

| Code | Display | Anatomy | Fascia chain | Common pain | Typical release |
|------|---------|---------|--------------|-------------|-----------------|
| `headache` | Headache | Galea aponeurotica, suboccipitals, temporalis | SBL · DFL | Tension headache, occipital neuralgia, migraine — **often initiated by masseter and upper-trap trigger points (see `jaw-*` / `traps-*`)** | Suboccipital release, temple glide, scalp glide |
| `jaw-left` / `jaw-right` | Jaw (L) / Jaw (R) | Masseter, temporalis, medial + lateral pterygoids, TMJ capsule | DFL · SFL | TMJ dysfunction, bruxism, **referred tension headache** — Travell & Simons document a clear masseter-trigger-point → temporal/frontal headache referral pattern; also drives ear/cheek pain | Masseter ball-pin, intraoral pterygoid, jaw-glide drills |
| `neck-left` / `neck-right` | Neck (L) / Neck (R) | SCM, scalenes, splenius capitis/cervicis, levator scapulae | SFL (front — SCM) · SBL (back — splenius) · LL (side) | Chronic neck pain, whiplash, levator strain, TOS contributors | SCM pin-stretch, scalene release, levator pin |
| `traps-left` / `traps-right` | Traps (L) / Traps (R) | Upper trapezius, supraspinatus | Sup. Back Arm Line · SBL | Tension headache, "carrying-stress" knot, postural collapse | Trap pincer, scapular elevation drills |
| `upper-back-left` / `upper-back-right` | Upper Back (L) / Upper Back (R) | Rhomboid major/minor, mid-trapezius, thoracic erectors, lat. dorsi upper | Spiral Line · Deep Back Arm Line · SBL | "Computer hump", interscapular ache, postural fatigue | Lacrosse-ball rhomboid, thoracic-extension drills |

### Group B — Arm (3 groups, 6 codes) — *Forearm now absorbs wrist + hand + fingers*

| Code | Display | Anatomy | Fascia chain | Common pain | Typical release |
|------|---------|---------|--------------|-------------|-----------------|
| `front-shoulder-left` / `front-shoulder-right` | Front Shoulder (L/R) | Anterior deltoid, pec minor, subscapularis, long-head biceps, coracobrachialis | Deep + Sup. Front Arm Line · SFL | Adhesive capsulitis (frozen shoulder), rotator-cuff anterior tear, impingement, pec-minor compression (TOS contributor) | Pec-minor pin, subscap fingertip, anterior-capsule mobilisation |
| `elbow-left` / `elbow-right` | Elbow (L/R) | Lateral epicondyle (ECRB origin), medial epicondyle, biceps insertion, triceps insertion, brachialis | Sup. Front + Sup. Back Arm Line | Tennis elbow, golfer's elbow, ulnar nerve irritation, biceps tendinopathy | Cross-fibre extensor common origin, brachialis pin |
| `forearm-left` / `forearm-right` | Forearm (L/R) | Extensor compartment (ECRB/ECRL/ECU/ED), flexor compartment (FCR/FCU/FDS/FDP), supinator, pronator teres + quadratus, **carpal tunnel contents, flexor retinaculum, palmar fascia, thenar/hypothenar muscles, lumbricals/interossei, finger flexors/extensors distal** | Sup. Front + Back Arm Lines (full continuity) | **Tennis elbow extends here · golfer's elbow · RSI · carpal tunnel syndrome · De Quervain's · trigger finger · thumb CMC arthritis · palmar fasciitis · finger trigger points** | Forearm rolling, extensor pin-and-stretch, carpal-stretch, flexor retinaculum glide, intrinsic ball, finger glides |

> **Merger rationale (Q3):** Vic's videos use "forearm stretch" terminology and naturally extend down through the wrist and hand. Fascia continuity is real — the forearm flexor sheath becomes the flexor retinaculum becomes the palmar aponeurosis. Splitting this into 3 groups added clicks and arbitrary boundaries without clinical payoff. One zone per side, broad polygon from elbow to fingertips.

### Group C — Trunk (1 group, 2 codes)

| Code | Display | Anatomy | Fascia chain | Common pain | Typical release |
|------|---------|---------|--------------|-------------|-----------------|
| `lower-back-left` / `lower-back-right` | Lower Back (L/R) | Quadratus lumborum, iliocostalis lumborum, multifidus, thoracolumbar fascia, lumbar erectors, **SI joint envelope** | SBL · Spiral Line | Mechanical LBP, QL spasm, SI-joint irritation, facet stiffness, sciatic referral, **psoas-driven L1–L5 referral (see `hip-flexor-*` cross-link)** | QL release, ball-on-erectors, cat-cow, child's pose |

> SI joint folded in per Vic Q1; psoas → lumbar referral cross-link documented per Vic Q4.

### Group D — Hip & thigh (4 groups, 8 codes)

| Code | Display | Anatomy | Fascia chain | Common pain | Typical release |
|------|---------|---------|--------------|-------------|-----------------|
| `hip-flexor-left` / `hip-flexor-right` | Hip Flexor (L/R) | **Psoas major + minor, iliacus**, rectus femoris (top), TFL, sartorius origin, adductor longus/brevis origin, pectineus, **inguinal canal envelope, groin** | DFL (psoas → diaphragm continuity) · SFL (rect. fem.) | Anterior hip pinch, "tight hips" from sitting, **psoas-driven lower-back pain (psoas referral travels along L1–L5 spinal segments — release psoas to release lumbar)**, TFL trigger points → outer-hip pain, groin strain in male athletes | Lunge psoas stretch, TFL ball, couch stretch, supine psoas release with thumb-press, groin stretch (frog) |
| `gluteal-left` / `gluteal-right` | Gluteal (L/R) | Gluteus maximus/medius/minimus, piriformis, deep external rotators (gemelli, obturator int/ext, quadratus femoris) | SBL (G.max → ITB) · Functional Lines · DFL partial | Piriformis syndrome, glute-med tendinopathy, "dead butt", sciatic referral, SI co-contributor | Glute-med ball, piriformis figure-4, deep-rotator lacrosse |
| `it-band-left` / `it-band-right` | IT Band (L/R) | Iliotibial tract, vastus lateralis underlying, fascia lata | Lateral Line | ITB syndrome (lateral knee pain), TFL referred lateral hip | Side-lying foam-roll, vastus-lateralis pin, contralateral TFL release |
| `hamstrings-left` / `hamstrings-right` | Hamstrings (L/R) | Biceps femoris, semitendinosus, semimembranosus | SBL | Hamstring strain (chronic), proximal-hamstring tendinopathy, sciatic referral | Active stretch, ball-on-belly, eccentric loading |

### Group E — Knee & lower leg (4 groups, 8 codes) — *Calf now absorbs Achilles + heel + plantar*

| Code | Display | Anatomy | Fascia chain | Common pain | Typical release |
|------|---------|---------|--------------|-------------|-----------------|
| `knee-inside-left` / `knee-inside-right` | Knee — Inside (L/R) | MCL, pes anserinus (sartorius+gracilis+semitendinosus), medial meniscus, vastus medialis (VMO) | SFL (quad) · DFL (adductor) | MCL sprain, pes anserine bursitis, medial meniscal pain, VMO weakness | VMO pin, pes anserine glide, adductor-magnus release |
| `knee-outside-left` / `knee-outside-right` | Knee — Outside (L/R) | LCL, ITB insertion at Gerdy's tubercle, vastus lateralis distal, lateral meniscus, biceps femoris insertion, popliteus | LL · SBL distal | ITB friction syndrome, LCL sprain, lateral meniscal tear, popliteus | ITB-insertion glide, VL distal pin, popliteus mobilisation |
| `knee-back-left` / `knee-back-right` | Knee — Back (L/R) | Popliteal fossa, gastrocnemius medial/lateral heads (origins), semimembranosus, popliteus, Baker's cyst territory | SBL | Popliteal fascia tightness, hamstring-tendinopathy referral, Baker's cyst, gastroc-origin pain | Gentle popliteal glide, gastroc origin pin, calf scoop |
| `calf-left` / `calf-right` | Calf (L/R) | **Gastrocnemius (medial + lateral heads), soleus, plantaris, Achilles tendon, calcaneal heel pad, plantar fascia (medial/lateral/central bands), short toe flexors, intrinsic foot muscles, deep posterior compartment (TP, FDL, FHL)** | **SBL (full continuity — calf → Achilles → heel → plantar arch as one fascia unit)** · DFL (deep arch + TP) · LL (fibularis lateral) | **Achilles tendinopathy · gastroc trigger points → calf cramp · posterior shin splints · heel-pain syndrome · plantar fasciitis · fallen arch · Morton's neuroma · ball-of-foot pain** — all treated as one continuous SBL release | Calf scoop, Achilles cross-friction, soleus deep pin, plantar lacrosse-roll, deep-arch glide, towel scrunch |

> **Merger rationale (Q2):** Vic's call. Treating calf-Achilles-heel-plantar as one fascia-continuous unit matches how the SBL actually behaves — release one part and the chain releases. Single click target on the body map; broad polygon spanning back-of-knee down to toes (back view) and ankle/foot (front view).

---

## 3. Old → new mapping (29 codes)

Status legend: ✅ keep · 🔄 rename · 🔀 split · ➕ merge · ❌ deprecate · 🆕 new

| Old code | Action | New code(s) | Notes / video assets |
|----------|--------|-------------|----------------------|
| `01_head_both` | 🔀 split | `headache` + `jaw-left` + `jaw-right` | Headache is canonical heir; jaw is new addition. INSTRUCTIONS.txt preserved. |
| `02_neck_left` | 🔄 rename | `neck-left` | Clean 1:1. |
| `02_neck_right` | 🔄 rename | `neck-right` | Clean 1:1. |
| `03_shoulder_left` | 🔄 rename + scope | `front-shoulder-left` | **Existing video "Shoulder Release Protocol" (`zL6IwRT_uvM`) lands at `videos/zones/front-shoulder-left/beginner/media.json`.** |
| `03_shoulder_right` | 🔄 rename + scope | `front-shoulder-right` | Existing `media.json` lands here. |
| `04_upper_arm_left` | ❌ deprecate | (none) | Biceps/triceps/brachialis fall under `elbow-*` (insertion side) and `front-shoulder-*` (origin). Legacy stub with deprecation note. |
| `04_upper_arm_right` | ❌ deprecate | (none) | Same. |
| `05_forearm_left` | 🔄 rename + expand | `forearm-left` | Renamed; **scope now extends through wrist, palm, fingers** (Q3 merger). Clean 1:1 for the rename, but the new zone covers more territory than the old. |
| `05_forearm_right` | 🔄 rename + expand | `forearm-right` | Same. |
| `06_hip_left` | 🔀 split | `hip-flexor-left` + `gluteal-left` | **Existing video "Hip Opener — Release your Hips" (`HwF0KleMGhc`) is hip-flexor-focused → lands at `videos/zones/hip-flexor-left/beginner/media.json`.** Glute side starts empty. |
| `06_hip_right` | 🔀 split | `hip-flexor-right` + `gluteal-right` | "Hip Opener" mirror → `hip-flexor-right/beginner/media.json`. |
| `07_thigh_left` | 🔀 split | `hip-flexor-left` (top) + `hamstrings-left` (back) + `knee-inside-left` (VMO bottom) | Old front+back conflated. Re-route by view (front view → hip-flexor / knee-inside; back view → hamstrings). |
| `07_thigh_right` | 🔀 split | mirror | Same. |
| `08_ankle_left` | ➕ merge | **`calf-left`** | Ankle folds into the merged calf-Achilles-heel-plantar unit (Q2). Old folder kept as legacy stub. |
| `08_ankle_right` | ➕ merge | **`calf-right`** | Same. |
| `09_chest_left` | ❌ deprecate | (none) | Pec minor → `front-shoulder-*`. Legacy stub. |
| `09_chest_right` | ❌ deprecate | (none) | Same. |
| `10_lower_arm_left` | ➕ merge | **`forearm-left`** | "Lower arm" was anatomically forearm-distal + wrist; merged into the expanded forearm zone (Q3). Legacy stub. |
| `10_lower_arm_right` | ➕ merge | **`forearm-right`** | Same. |
| `11_lateral_arm_left` | ❌ deprecate | (none) | Lateral arm = lateral deltoid/triceps long-head — folds into `front-shoulder-*` (delt) and `upper-back-*` (triceps origin). Legacy stub. |
| `11_lateral_arm_right` | ❌ deprecate | (none) | Same. |
| `12_lower_back_left` | 🔄 rename | `lower-back-left` | **Existing video "Lower Back Pain Release Protocol" (`Uro31OnQ1uw`) lands here.** Clean 1:1. |
| `12_lower_back_right` | 🔄 rename | `lower-back-right` | Clean 1:1. |
| `13_knee_left` | 🔀 split | `knee-inside-left` + `knee-outside-left` + `knee-back-left` | Vic's explicit split. Old folder retired (legacy stub). |
| `13_knee_right` | 🔀 split | mirror × 3 | Same. |
| `14_foot_left` | ➕ merge | **`calf-left`** | Foot folds entirely into the merged calf unit (sole = plantar fascia = SBL distal end). Per Q2. |
| `14_foot_right` | ➕ merge | **`calf-right`** | Same. |
| `15_itband_left` | 🔄 rename | `it-band-left` | Clean 1:1 (kebab-case only). |
| `15_itband_right` | 🔄 rename | `it-band-right` | Clean 1:1. |
| — | 🆕 new | `traps-left` / `traps-right` | Brand new — pulled out of old `02_neck` + `03_shoulder` overlap. |
| — | 🆕 new | `upper-back-left` / `upper-back-right` | Brand new — replaces what was implicitly nowhere. |
| — | 🆕 new | `hamstrings-left` / `hamstrings-right` | Brand new — was buried under `07_thigh_*` back view. |

**Net change:** 29 old codes → 33 new codes. 6 deprecated, 3 split, 7 renamed 1:1, 6 merged into bigger units, 6 added new.

---

## 4. Folder structure migration

### 4a. Existing folder tree

```
public/videos/
  zones/                  ← 29 leaf folders (NN_name_side)
  lifestyle_protocols/    ← 10 lifestyles × 29 zones + _all
  modules/audio/daytime_stress/media.json
  tests/                  ← yes/no test trees per zone-group
```

### 4b. Migration rules (do not delete legacy)

1. **Add 33 new leaf folders** under `public/videos/zones/<new-code>/{beginner,intermediate,advanced}/INSTRUCTIONS.txt` — each `INSTRUCTIONS.txt` follows existing format (`Zone: <code>\nLevel: <level>\n\nDrop video here named: video.mp4`).
2. **Migrate the 6 existing seed `media.json` files** — copy (don't move):

   | Current path | New path | Title |
   |--------------|----------|-------|
   | `zones/12_lower_back_left/{level}/media.json` | `zones/lower-back-left/{level}/media.json` | Lower Back Pain Release Protocol |
   | `zones/12_lower_back_right/{level}/media.json` | `zones/lower-back-right/{level}/media.json` | (mirror) |
   | `zones/03_shoulder_left/{level}/media.json` | `zones/front-shoulder-left/{level}/media.json` | Shoulder Release Protocol |
   | `zones/03_shoulder_right/{level}/media.json` | `zones/front-shoulder-right/{level}/media.json` | (mirror) |
   | `zones/06_hip_left/{level}/media.json` | `zones/hip-flexor-left/{level}/media.json` | Hip Opener — Release your Hips |
   | `zones/06_hip_right/{level}/media.json` | `zones/hip-flexor-right/{level}/media.json` | (mirror) |
   | `lifestyle_protocols/office/_all/{level}/media.json` | unchanged | Seated Office Worker |
   | `lifestyle_protocols/standing_long/_all/{level}/media.json` | unchanged | Standing for Long Hours |
   | `modules/audio/daytime_stress/media.json` | unchanged | Daytime Stress & Mind Clearing |

3. **Leave the 29 old folders in place** — legacy stubs. Add `LEGACY_NOTE.txt` per old folder pointing to new code, e.g.:

   ```
   # LEGACY — superseded by `calf-left` (Q2 merger 2026-04-29)
   # Do not add new media here.
   ```

4. **`INSTRUCTIONS.txt` files are sacred — never delete** (per Vic's rule). Both old + new INSTRUCTIONS files coexist on disk.

5. **Lifestyle protocols subtree** — generate the same 33-zone structure under each of 10 lifestyle folders. Old 29-zone trees become legacy stubs.

6. **Tests subtree** (`public/videos/tests/<group>/test_NN/...`) — `TESTS_BY_GROUP` keys updated to new group names (proposed counts in §8/Brief).

### 4c. New folder tree (post-migration)

```
public/videos/
  zones/
    headache/{beginner,intermediate,advanced}/INSTRUCTIONS.txt   ← single (no L/R)
    jaw-left/...
    jaw-right/...
    neck-left/...
    neck-right/...
    traps-left/...
    traps-right/...
    upper-back-left/...
    upper-back-right/...
    front-shoulder-left/{beginner}/{INSTRUCTIONS.txt,media.json}  ← seeded
    front-shoulder-right/{beginner}/{INSTRUCTIONS.txt,media.json} ← seeded
    elbow-left/...
    elbow-right/...
    forearm-left/...                                              ← absorbs old 05/10
    forearm-right/...
    lower-back-left/{beginner}/{INSTRUCTIONS.txt,media.json}      ← seeded
    lower-back-right/{beginner}/{INSTRUCTIONS.txt,media.json}     ← seeded
    hip-flexor-left/{beginner}/{INSTRUCTIONS.txt,media.json}      ← seeded (psoas/iliacus/groin/inguinal)
    hip-flexor-right/{beginner}/{INSTRUCTIONS.txt,media.json}     ← seeded
    gluteal-left/...
    gluteal-right/...
    it-band-left/...
    it-band-right/...
    hamstrings-left/...
    hamstrings-right/...
    knee-inside-left/...
    knee-inside-right/...
    knee-outside-left/...
    knee-outside-right/...
    knee-back-left/...
    knee-back-right/...
    calf-left/...                                                 ← absorbs old 08/14, plus new heel + plantar
    calf-right/...

    [legacy stubs — 01_head_both ... 15_itband_right with LEGACY_NOTE.txt]

  lifestyle_protocols/<lifestyle>/<new-code>/{beginner,intermediate,advanced}/INSTRUCTIONS.txt
  modules/audio/daytime_stress/media.json     ← unchanged
  tests/<new-group>/test_NN/...               ← updated group names
```

---

## 5. Sex toggle plan

### 5a. Goal

Two anatomical figures (male / female), front + back each = **4 PNG files** total, plus per-sex polygon overrides where needed.

### 5b. Asset spec

| File | Size | Description |
|------|------|-------------|
| `body_front_male.png` | 1024×1024 | Male anatomical front silhouette, A-pose, translucent grey-cream on black bg |
| `body_back_male.png` | 1024×1024 | Male back |
| `body_front_female.png` | 1024×1024 | Female anatomical front silhouette, A-pose, translucent grey-cream on black bg |
| `body_back_female.png` | 1024×1024 | Female back |

Generated via the same Sub-Chat 3 / OpenArt pipeline that produced the existing PNGs. Vic owns the prompt iteration (separate task).

Existing `body_front.png` / `body_back.png` retired or aliased to `body_front_male.png` for backwards-compat (or kept as `_neutral` fallback).

### 5c. Per-sex polygon overrides

Only **4 zone-groups** need per-sex coord variants because hip width and shoulder framing differ:

| Zone-group | Why a sex variant is needed |
|-----------|------------------------------|
| `front-shoulder-*` | Female chest framing — shift centroid ~25 px lateral to avoid breast tissue |
| `hip-flexor-*` | Wider female pelvis — centroid shifts ~10 px lateral |
| `gluteal-*` | Same — wider female pelvis on back view |
| `lower-back-*` | Lumbar lordosis sits slightly higher on female figure |

All 13 other zone-groups share polygon coords across sexes.

### 5d. Data structure (proposed for Sub-Chat 4)

```js
export const HOTSPOTS_FRONT = {
  shared: [ /* 13 zone groups × L/R polygons */ ],
  male:   [ /* 4 overrides */ ],
  female: [ /* 4 overrides */ ],
};
// Resolve at render: getHotspots('front', sex) = [...shared, ...HOTSPOTS_FRONT[sex]]
```

### 5e. Per-sex media.json — NOT separate

**ONE video catalogue serves both sexes.** Vic's protocols are gender-neutral. Sex toggle = anatomical illustration + minor hotspot calibration only. If a future zone needs sex-specific intervention, extend `media.json` schema with `sex_overrides`. Out of scope for v2.

### 5f. UX wiring

- New setting in `/settings`: `Body figure: ◯ Male  ◯ Female  (◯ Default)`
- localStorage key: `ppw.bodyFigure` — values `male` | `female` | `neutral`
- BodyMap reads it, picks base PNG + polygon-override set.
- Default: `neutral` (current PNGs as fallback).

---

## 6. Hotspot specification

ViewBox: **600 × 1200** (sacred). Centerline x=300. Left/right are from **viewer's perspective** (figure faces you on FRONT view).

Locked y-landmarks:
- Top of head: y≈80 · Shoulders: y≈260 · Mid-chest: y≈360 · Navel: y≈500
- Hip line: y≈640 · Mid-thigh: y≈840 · Knees: y≈980 · Ankles: y≈1130 · Feet: y≈1180

### 6a. Front view polygons (HOTSPOTS_FRONT)

| Code | cx | cy | Polygon (rough — implementer to refine against real PNGs) |
|------|----|----|------------------------------------------------------------|
| `headache` | 300 | 110 | `262,82 320,76 348,90 358,118 340,140 300,148 260,140 242,118 252,90` |
| `jaw-left` | 270 | 170 | `258,148 290,148 295,168 290,188 270,200 252,188 250,168` |
| `jaw-right` | 330 | 170 | `310,148 342,148 350,168 348,188 330,200 310,188 305,168` |
| `neck-left` | 275 | 220 | `258,200 290,200 295,222 290,245 275,255 258,245 252,222` |
| `neck-right` | 325 | 220 | `310,200 342,200 348,222 342,245 325,255 310,245 305,222` |
| `traps-left` | 240 | 265 | `210,250 268,248 280,260 270,278 250,290 225,290 212,278 205,265` |
| `traps-right` | 360 | 265 | `332,248 390,250 395,265 388,278 375,290 350,290 332,278 320,260` |
| `front-shoulder-left` | 200 | 285 | `170,260 230,255 246,275 240,300 220,318 195,320 170,308 158,290` |
| `front-shoulder-right` | 400 | 285 | `370,255 430,260 442,290 430,308 405,320 380,318 360,300 354,275` |
| `elbow-left` | 145 | 475 | `120,455 165,450 175,475 168,498 145,508 122,500 110,478` |
| `elbow-right` | 455 | 475 | `435,450 480,455 490,478 478,500 455,508 432,498 425,475` |
| `forearm-left` | 125 | 600 | `108,508 165,505 172,580 168,665 150,705 122,710 95,690 90,610 95,520` (broad: elbow → fingertips) |
| `forearm-right` | 475 | 600 | `435,505 492,508 510,520 505,610 500,690 478,710 450,705 432,665 428,580` |
| `hip-flexor-left` | 265 | 600 | `230,560 296,560 298,605 285,635 268,650 245,648 225,625 220,580` |
| `hip-flexor-right` | 335 | 600 | `304,560 370,560 380,580 375,625 355,648 332,650 315,635 302,605` |
| `it-band-left` | 220 | 850 | `205,720 240,718 248,800 245,890 240,955 218,955 200,890 195,810` |
| `it-band-right` | 380 | 850 | `360,718 395,720 405,810 400,890 382,955 360,955 355,890 352,800` |
| `knee-inside-left` | 282 | 985 | `268,960 296,960 298,985 296,1010 282,1025 270,1015 265,990` |
| `knee-inside-right` | 318 | 985 | `304,960 332,960 335,990 330,1015 318,1025 304,1010 302,985` |
| `knee-outside-left` | 240 | 985 | `218,960 252,955 258,985 252,1010 235,1025 218,1015 210,990` |
| `knee-outside-right` | 360 | 985 | `348,955 382,960 390,990 382,1015 365,1025 348,1010 342,985` |
| `calf-left` | 270 | 1140 | `255,1108 295,1108 296,1130 294,1155 275,1170 295,1170 296,1188 280,1198 255,1198 240,1188 245,1170 258,1158 252,1135` (front view: ankle + foot top) |
| `calf-right` | 330 | 1140 | `305,1108 345,1108 348,1135 342,1158 355,1170 304,1170 304,1188 320,1198 345,1198 360,1188 355,1170 325,1170 306,1155` (mirror) |

### 6b. Back view polygons (HOTSPOTS_BACK)

Most front polygons mirror onto back view (head, jaw, neck, traps, elbow, forearm, IT band, knee-outside). Back view adds these zones:

| Code | cx | cy | Polygon |
|------|----|----|---------|
| `upper-back-left` | 255 | 350 | `215,310 296,310 296,355 296,400 270,415 240,412 218,395 212,360` |
| `upper-back-right` | 345 | 350 | `304,310 385,310 388,360 382,395 360,412 332,415 304,400 304,355` |
| `lower-back-left` | 265 | 560 | `220,510 295,510 295,565 295,610 270,628 235,625 215,600 215,540` |
| `lower-back-right` | 335 | 560 | `304,510 380,510 385,540 385,600 365,625 335,628 304,610 304,565` |
| `gluteal-left` | 265 | 690 | `220,640 296,635 298,690 280,725 255,738 232,728 218,705 215,665` |
| `gluteal-right` | 335 | 690 | `304,635 380,640 385,665 382,705 368,728 345,738 320,725 304,690` |
| `hamstrings-left` | 265 | 860 | `228,740 295,740 298,820 295,890 290,945 268,955 232,952 222,895 220,820` |
| `hamstrings-right` | 335 | 860 | `304,740 372,740 378,820 378,895 368,952 332,955 310,945 305,890 304,820` |
| `knee-back-left` | 282 | 985 | `255,960 296,960 298,985 296,1015 282,1030 264,1018 252,990` |
| `knee-back-right` | 318 | 985 | `304,960 345,960 348,990 336,1018 318,1030 304,1015 302,985` |
| `calf-left` | 270 | 1080 | `245,1030 295,1030 298,1075 296,1115 280,1145 295,1170 296,1188 280,1198 255,1198 240,1188 245,1170 258,1145 240,1115 240,1075` (back view: full posterior calf → Achilles → heel → sole) |
| `calf-right` | 330 | 1080 | `304,1030 355,1030 360,1075 358,1115 342,1145 355,1170 360,1188 345,1198 320,1198 304,1188 304,1170 320,1145 304,1115 304,1075` (mirror) |

**Front-only zones:** `hip-flexor-*`, `knee-inside-*` (medial knee best presented from front; back implementer can decide whether to also render on back view).

**Back-only zones:** `upper-back-*`, `lower-back-*`, `gluteal-*`, `hamstrings-*`, `knee-back-*`. (Calf appears on both views with different polygon shapes.)

These are starting coords. Stage 4 implementer refines each polygon by overlaying on the actual male/female PNGs and adjusting tracks ±5–15 px to match opaque-pixel boundaries.

---

## 7. Open questions for Vic — RESOLVED

All 5 open questions answered as of 2026-04-29:

| # | Question | Resolution |
|---|----------|------------|
| Q1 | SI joint as separate zone? | **Folded into `lower-back-*`.** SI joint envelope documented in zone description. |
| Q2 | Heel as separate zone? | **MERGED into single `calf-*` zone** covering calf + Achilles + heel + plantar fascia as one SBL unit. |
| Q3 | Fingers as separate zone? | **MERGED into `forearm-*`** alongside wrist + hand. Single fascia-continuous unit from elbow to fingertips. |
| Q4 | Hip flexor inclusion? | **Included.** Description documents psoas referral L1–L5 → lower back (Vic's clinical note). |
| Q5 | Jaw / TMJ inclusion? | **Included.** Description documents masseter trigger-point → tension headache pattern. |

---

## 8. Stage 4 Implementation Brief — see separate file

The 1-page paste-able brief for the Stage 4 implementer lives at `STAGE_4_IMPLEMENTATION_BRIEF.md`. Compact summary embedded below; full version in that file.

### Compact summary

**Goal:** rewire `src/data.js` and `public/videos/zones/` to the v2 taxonomy. Backwards-compat preserved via legacy stubs.

**Order of operations:**
1. Backup `src/data.js` → `data.js.backup4`.
2. Rewrite `ZONES`, `HOTSPOTS_FRONT`, `HOTSPOTS_BACK`, `TESTS_BY_GROUP`, `LIFESTYLE_ZONES`, `FASCIA_CHAINS` per §2/§3/§5/§6.
3. Write `tools/migrate_zones_v2.mjs` (idempotent) — creates 33 new folders, copies 6 seed `media.json` files, adds `LEGACY_NOTE.txt` to 29 old folders, mirrors structure under all 10 lifestyle folders.
4. Update `ZONE_LABEL_OVERRIDES` in `src/App.jsx` with new short labels.
5. Add sex toggle setting + localStorage key + BodyMap polygon resolver.
6. Add backwards-compat read shim — translate old codes saved in user localStorage to new codes on read.
7. Smoke test: 33 polygons render, no overlap, taps route correctly, 6 seed videos still play, lifestyle pre-selects work, old localStorage routines migrate.

**Key code blocks** (LIFESTYLE_ZONES, FASCIA_CHAINS, ZONE_LABEL_OVERRIDES, TESTS_BY_GROUP) are in `STAGE_4_IMPLEMENTATION_BRIEF.md`.

---

## Sources

Anatomy Trains:
- [About Anatomy Trains — myofascial linkage](https://www.anatomytrains.com/about-us/)
- [The Spiral Line](https://www.massagetherapy-brighton.co.uk/anatomy-trains-the-spiral-line/)
- [Wilke et al. — Evidence-Based Myofascial Chains](https://www.anatomytrains.com/wp-content/uploads/2016/05/wilke-pdf.pdf)
- [Theoretical Fascial Models — biotensegrity, fascintegrity, myofascial chains](https://pmc.ncbi.nlm.nih.gov/articles/PMC7096016/)

Trigger points / Travell & Simons:
- [Trigger Point Injection — StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK542196/)
- [Trigger Points: Diagnosis and Management — AAFP](https://www.aafp.org/pubs/afp/issues/2002/0215/p653.html)
- [Travell, Simons & Simons' Myofascial Pain — LWW](https://osteopathicmedicine.lwwhealthlibrary.com/book.aspx?bookid=3060)

Clinical pain epidemiology / CPGs:
- [JOSPT — Neck Pain CPG 2017](https://www.jospt.org/doi/10.2519/jospt.2017.0302)
- [JOSPT — Low Back Pain CPG 2021](https://www.jospt.org/doi/10.2519/jospt.2021.0304)
- [AAFP — Chronic Musculoskeletal Pain](https://www.aafp.org/pubs/afp/issues/2020/1015/p465.html)
- [Springer — Chronic Musculoskeletal Pain Management](https://link.springer.com/article/10.1007/s40122-021-00235-2)

Specific pain conditions:
- [Lateral Epicondylitis — Physiopedia](https://www.physio-pedia.com/Lateral_Epicondylitis)
- [IT Band Syndrome — Caddoo Rehab](https://caddoorehab.com/conditions-we-treat/it-band-syndrome/)
- [Plantar Fasciitis — Novus Spine](https://novusspinecenter.com/pain-conditions/plantar-fasciitis)
- [Hip Flexors — Physiopedia](https://www.physio-pedia.com/Hip_Flexors)
- [Iliopsoas Tendinopathy — Physiopedia](https://www.physio-pedia.com/Iliopsoas_Tendinopathy)
- [Differentiating Buttock Pain and SI Joint — Physiopedia](https://www.physio-pedia.com/Differentiating_Buttock_Pain_and_Sacroiliac_Joint_Disorders)
- [SI Joint vs Piriformis — Piedmont PMR](https://piedmontpmr.com/si-joint-pain-piriformis-syndrome-3/)

Sex-specific anatomy:
- [Inguinal-Pubic-Adductor Sex Differences — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11355124/)
- [Pelvic Floor Anatomy — Physiopedia](https://www.physio-pedia.com/Pelvic_Floor_Anatomy)
- [Female Pelvic Floor Fascia Anatomy — MDPI Life](https://www.mdpi.com/2075-1729/11/9/900)
- [Anatomy, Pelvic Floor — StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK482200/)
- [Physiology, Fascia — StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK568725/)

---

**End of plan. FINAL — handoff to Stage 4 implementer via `STAGE_4_IMPLEMENTATION_BRIEF.md`.**
