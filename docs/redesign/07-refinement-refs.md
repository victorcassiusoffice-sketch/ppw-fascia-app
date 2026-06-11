# Refinement 2 — Vic's reference set → implementation map (2026-06-11)

Source of truth: `PPW-Second-Brain/06-Roadmap/09-Fascia-App/redesign-refs-2026-06-11/LABELS.md`
(9 labelled refs + design laws). REF-02 has no label yet — nothing here depends on it.

| Ref | Pattern | Implementation |
|---|---|---|
| REF-01 | Dark glass sections w/ bright edge rims; stack boxes carry video thumbnails; user-selectable backgrounds | `--glass-rim` specular edges on cards/deck; thumbnail tile in stack rows; backgrounds feature (below) |
| REF-03 | Pages = composed panels; elements rearrange between pages, content staggers after the panel lands | Directional panel slide between tab routes (x by tab order) + existing per-page staggered entries; nav dot already glides as the shared element |
| REF-04 | Small control GROWS in place into its options panel; dark-nature scene = a default background | Add-Stack button ↔ sheet `layoutId` morph; BG-1 `nature` |
| REF-05 | Soft-grey neumorphic ground = second default; press→open liquid feel | BG-2 `grey`; pressScale already app-wide |
| REF-06 | Media thumbnail tile inside the glass stack card (ignore the blue) | Row thumb (YouTube id-derived / oEmbed `thumbnailUrl`) + fallback app chip |
| REF-07 | Overlapping glass capsule deck; selected card lifts to front | `.stack-deck` overlap + FM lift on open/selected card; dnd/selection logic untouched |
| REF-08 | Circular glass disc w/ fine bright rim (icon-only) · glass capsule (labelled) | `.glass-disc` on row action icons + `.glass-capsule` grammar |
| REF-09 | Pill-track toggle, refractive glass knob, icon etched in knob | `.glass-switch` for ThemeToggle (sun/moon in knob) + Settings IF toggle |

## Backgrounds feature (new)

- LS key `ppw.background` (ADDITIVE — no existing key changes):
  `{ kind: 'auto' | 'nature' | 'grey' | 'custom', mediaId?: string }`. Default
  `auto` = theme-resolved (dark → nature, light → grey).
- BG-nature = `assets/backgrounds/fascia_fluid_motion.png` full-bleed (derived
  from the existing organic asset — NO paid generation; REF-04's foliage mood,
  PPW's own fascia texture). BG-grey = pure CSS soft-grey gradient (REF-05).
  Custom = user photo via the existing IndexedDB media store.
- `<AppBackground />` renders the layer + a per-theme **scrim tier**
  (`--bg-image-scrim`) so glass keeps AA contrast over any image; writes
  `data-bg` on `<html>` — full-bleed image backgrounds suppress the hero-art
  zone (no texture-on-texture).

## Apps row (new feature, Vic verbatim label 4/5)

Add Stack gains an APPS row: YouTube + Spotify chips + Custom. Chip → link
flow with app-specific placeholder; paste URL/share-link → title + thumbnail
resolved (YouTube: existing oEmbed/id-derived thumb; Spotify: public oEmbed,
lazy + cached + offline-silent). Stored as ADDITIVE fields on the user stack:
`appKind`, `thumbnailUrl`. **Spotify = link-out + metadata only** — playback
stays behind the existing legal gate (no SDK, no Premium, no keys).

## Laws honoured

Everything liquid glass · sections · minimalistic · liquid navigation ·
transform/opacity only · no blur on moving elements · reduced-motion collapse.
