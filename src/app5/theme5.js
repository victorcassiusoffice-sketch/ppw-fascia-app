// ─────────────────────────────────────────────────────────────────────────
// theme5.js — New Design (Claude Design "PPW Fascia App") theme engine.
//
// Ported ~verbatim from the prototype's DCLogic script (the `{{ vars }}`
// computation + its SOFT / GLASS / GROUNDS palette tables). Produces a string
// of CSS custom properties for a given skin/background/soft-colourway/intensity,
// applied inline on the app shell (style={{ ...parseVars(themeVars(state)) }}).
//
// Three registers (New Design overrules — this is the authoritative look):
//   • soft-neumorphism  (DEFAULT: skin:'soft', bg:'grey', soft:'graphite')
//   • glass             (translucent + blur)
//   • gel / glass-over-scene (clear skin over photographic scenes)
//
// Scene/photo backgrounds reference bundled assets (assets/glass/*.png etc.);
// until those are copied in, unknown backgrounds degrade to their base colour.
// The default graphite skin needs NO image assets and renders fully.
// ─────────────────────────────────────────────────────────────────────────

/* Graphite — sampled from the embossed PPW logo. Further colourways arrive
   with matching logo variants. */
export const SOFT = {
  graphite: { base: '#7E8286', light: 'rgba(255,255,255,.40)', dark: 'rgba(34,38,42,.60)', accent: '#3E434A', ink: '#24282C', rim: '#8E9296', well: '#6F7377', accInk: '#FFFFFF', name: 'Graphite', deep: '#33373B', accDeep: '#17191C', ground: 'radial-gradient(135% 110% at 25% 8%, #97999C 0%, #82868A 46%, #676B6E 100%)', glossA: '.16', rimGlowA: '.14', emboss: 'rgba(255,255,255,.48)', labelSh: 'rgba(0,0,0,.32)', logo: 'assets/ppw-logo-graphite.png', mark: 'assets/ppw-mark-graphite.png' },
  silver: { base: '#C8CCCE', light: 'rgba(255,255,255,.78)', dark: 'rgba(96,102,108,.52)', accent: '#5C6268', ink: '#33383C', rim: '#B4B8BB', well: '#B9BDBF', accInk: '#FFFFFF', name: 'Silver', deep: '#7E8489', accDeep: '#33373B', ground: 'radial-gradient(135% 110% at 25% 8%, #D6DADB 0%, #C9CDCF 46%, #B9BCBE 100%)', glossA: '.30', rimGlowA: '.35', emboss: 'rgba(255,255,255,.8)', labelSh: 'rgba(0,0,0,.22)', logo: 'assets/ppw-logo-silver.png', mark: 'assets/ppw-mark-silver.png' },
  ivory: { base: '#E0DFDA', light: 'rgba(255,255,255,.92)', dark: 'rgba(150,148,138,.56)', accent: '#6E6A61', ink: '#3A372F', rim: '#CFCEC8', well: '#D2D1CB', accInk: '#FFFFFF', name: 'Ivory', deep: '#96948A', accDeep: '#3A372F', ground: 'radial-gradient(135% 110% at 25% 8%, #EDECE9 0%, #E0E0DA 46%, #CDCDC5 100%)', glossA: '.45', rimGlowA: '.55', emboss: 'rgba(255,255,255,.95)', labelSh: 'rgba(0,0,0,.2)', logo: 'assets/ppw-logo-ivory.png', mark: 'assets/ppw-mark-ivory.png' },
  black: { base: '#1C1E20', lite: '#4A4E53', light: 'rgba(255,255,255,.08)', dark: 'rgba(0,0,0,.78)', accent: '#3C4147', ink: '#E6E8EA', rim: '#33373B', well: '#0C0D0F', accInk: '#FFFFFF', name: 'Black', deep: '#000000', accDeep: '#0A0B0C', ground: 'radial-gradient(135% 110% at 25% 8%, #2B2D2F 0%, #1B1D1F 46%, #0E0F10 100%)', glossA: '.05', rimGlowA: '.06', emboss: 'rgba(0,0,0,.6)', labelSh: 'rgba(0,0,0,.5)', thumb: 'linear-gradient(145deg, #6E747B 0%, #43484E 100%)', logo: 'assets/ppw-logo-black.png', mark: 'assets/ppw-mark-black.png' },
  gloft: { base: '#C9C8C3', light: 'rgba(255,255,255,.85)', dark: 'rgba(120,112,100,.55)', accent: '#A5814F', ink: '#453F36', rim: '#B7B6B1', well: '#B5B4AF', accInk: '#FFFFFF', name: 'Gloft', deep: '#7A7468', accDeep: '#4A3A22', ground: 'radial-gradient(135% 110% at 25% 8%, #D8D9D4 0%, #C6C5C0 46%, #A4A3A0 100%)', glossA: '.34', rimGlowA: '.4', emboss: 'rgba(255,255,255,.88)', labelSh: 'rgba(70,50,30,.3)', halo: '0 0 22px rgba(232,168,120,.38)', logo: 'assets/ppw-logo-gloft.png', mark: 'assets/ppw-mark-gloft.png' },
  indigo: { base: '#2C4164', lite: '#5F7DA6', light: 'rgba(160,190,235,.24)', dark: 'rgba(4,10,24,.7)', accent: '#6B89B8', ink: '#DFE7F2', rim: '#3E567C', well: '#1A2A47', accInk: '#FFFFFF', name: 'Indigo', deep: '#0A1428', accDeep: '#101B30', ground: 'radial-gradient(135% 110% at 25% 8%, #4E6584 0%, #31476B 46%, #12294A 100%)', glossA: '.10', rimGlowA: '.10', emboss: 'rgba(0,10,30,.5)', labelSh: 'rgba(0,0,0,.35)', thumb: 'linear-gradient(145deg, #8FA6C8 0%, #5F7699 100%)', halo: '0 0 20px rgba(120,160,220,.22)', logo: 'assets/ppw-logo-indigo.png', mark: 'assets/ppw-mark-indigo.png' },
  /* Crimson — matched to the red neumorphic logo Vic supplied 2026-07-06. */
  crimson: { base: '#A94745', lite: '#D07A76', light: 'rgba(255,190,185,.30)', dark: 'rgba(70,15,14,.62)', accent: '#6E211F', ink: '#3B1210', rim: '#B85955', well: '#933B39', accInk: '#FFFFFF', name: 'Crimson', deep: '#5F1F1E', accDeep: '#3A1010', ground: 'radial-gradient(135% 110% at 25% 8%, #C05C58 0%, #A94745 46%, #7E2C2A 100%)', glossA: '.14', rimGlowA: '.16', emboss: 'rgba(255,255,255,.28)', labelSh: 'rgba(0,0,0,.32)', logo: 'assets/ppw-logo-crimson.png' },
  gel: { name: 'Glass', gel: true, base: 'linear-gradient(145deg, #FAFBFC 0%, #D9DDE0 45%, #AFB5B9 100%)', accent: 'rgba(255,255,255,.95)', rim: '#C6CBCF', dark: 'rgba(120,128,136,.4)' },
};

/* Glass backgrounds — Vic's own uploaded photo set (2026-07-06, replaces the
   prototype's built-in scenes per his instruction). Keys map to
   public/assets/backgrounds/<key>.png. Glass character (frosted/clear) and
   text ink (light/dark) are USER TOGGLES now, not per-scene presets. */
export const BGS = {
  zen: 'Zen', serene: 'Serene', peaceful: 'Peaceful', peaceful2: 'Calm',
  studio: 'Studio', elegant: 'Elegant', symmetry: 'Symmetry', distant: 'Distant',
  boho: 'Boho', temple: 'Temple', giza: 'Giza', savanna: 'Savanna',
  jungle: 'Jungle', island: 'Island', deepblue: 'Deep Blue', vibrant: 'Vibrant', rust: 'Rust',
};
export const bgUrl = (key) => `${import.meta.env.BASE_URL}assets/backgrounds/${BGS[key] ? key : 'zen'}.png`;

const GROUNDS = {
  grey: '#878E96 url("assets/bg-grey.png") center/cover no-repeat',
  slate: 'radial-gradient(130% 100% at 25% 10%, #3A3F48 0%, #22252B 45%, #121419 100%)',
  nature: 'radial-gradient(90% 60% at 72% 18%, rgba(98,142,86,.55) 0%, rgba(0,0,0,0) 60%), radial-gradient(70% 55% at 15% 40%, rgba(54,98,68,.5) 0%, rgba(0,0,0,0) 65%), radial-gradient(60% 40% at 55% 62%, rgba(70,116,74,.28) 0%, rgba(0,0,0,0) 70%), radial-gradient(120% 80% at 50% 110%, rgba(14,34,22,.95) 0%, rgba(0,0,0,0) 72%), linear-gradient(178deg, #16211A 0%, #0C130D 55%, #070B08 100%)',
};

// themeVars(state, glassIntensityProp?) → CSS custom-property string.
// Faithful port of the prototype's vars computation.
export function themeVars(S, glassIntensityProp) {
  const intensity = S.intensity || glassIntensityProp || 'standard';
  const blurPx = { low: '6px', standard: '12px', high: '20px' }[intensity] || '12px';
  const heavyPx = { low: '10px', standard: '18px', high: '26px' }[intensity] || '18px';

  const isGlass = S.skin === 'glass';
  const theme = (S.bg === 'grey' && !S.customBgUrl) ? 'light' : 'dark';
  const natureGlow = S.bg === 'nature' && !S.customBgUrl;
  const glowVars = theme !== 'dark'
    ? '--glow-1:radial-gradient(circle, rgba(255,255,255,.95), rgba(255,255,255,0) 70%);--glow-2:radial-gradient(circle, rgba(150,180,255,.5), rgba(150,180,255,0) 70%);--glow-3:radial-gradient(circle, rgba(255,190,130,.42), rgba(255,190,130,0) 70%);--glow-op:1;'
    : natureGlow
      ? '--glow-1:radial-gradient(circle, rgba(190,255,160,.32), rgba(190,255,160,0) 70%);--glow-2:radial-gradient(circle, rgba(255,205,100,.26), rgba(255,205,100,0) 70%);--glow-3:radial-gradient(circle, rgba(90,210,150,.3), rgba(90,210,150,0) 70%);--glow-op:1;'
      : '--glow-1:radial-gradient(circle, rgba(150,185,255,.38), rgba(150,185,255,0) 70%);--glow-2:radial-gradient(circle, rgba(232,119,46,.32), rgba(232,119,46,0) 70%);--glow-3:radial-gradient(circle, rgba(110,215,225,.24), rgba(110,215,225,0) 70%);--glow-op:1;';

  let vars = '';
  if (isGlass && theme === 'dark') {
    const ground = S.customBgUrl ? ('#15171C url(' + S.customBgUrl + ') center/cover no-repeat') : (GROUNDS[S.bg] || GROUNDS.slate);
    vars = '--ground:' + ground + ';' +
      '--scrim:linear-gradient(180deg, rgba(6,8,12,.34) 0%, rgba(6,8,12,0) 22%, rgba(6,8,12,0) 58%, rgba(6,8,12,.46) 100%);' +
      '--ink:#F4F5F7;--dim:rgba(244,245,247,.62);' +
      '--surface:linear-gradient(133deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.05) 32%, rgba(255,255,255,.015) 58%, rgba(255,255,255,.06) 100%);' +
      '--surface-strong:linear-gradient(133deg, rgba(255,255,255,.2) 0%, rgba(255,255,255,.08) 32%, rgba(255,255,255,.035) 58%, rgba(255,255,255,.09) 100%);' +
      '--gloss:linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.03) 34%, rgba(255,255,255,0) 55%, rgba(255,255,255,.045) 100%);' +
      '--blur:blur(' + blurPx + ') saturate(168%) brightness(1.05);' +
      '--blur-heavy:blur(' + heavyPx + ') saturate(168%) brightness(1.05);' +
      '--rim:rgba(255,255,255,.36);' +
      '--elev:0 18px 44px -14px rgba(0,0,0,.62), 0 2px 8px rgba(0,0,0,.26), inset 0 1.5px 0 rgba(255,255,255,.6), inset -1.5px 0 0 rgba(255,255,255,.15), inset 1px 0 0 rgba(255,255,255,.07), inset 0 -18px 36px -20px rgba(255,255,255,.24);' +
      '--elev-hi:0 28px 64px -16px rgba(0,0,0,.7), 0 4px 14px rgba(0,0,0,.34), inset 0 1.5px 0 rgba(255,255,255,.7), inset -1.5px 0 0 rgba(255,255,255,.2), inset 0 -18px 36px -20px rgba(255,255,255,.3);' +
      '--inset:inset 0 3px 10px rgba(0,0,0,.4), inset 0 1px 0 rgba(0,0,0,.2);' +
      '--track:rgba(0,0,0,.3);' +
      '--accent:#E8772E;' +
      '--acc-surf:linear-gradient(133deg, rgba(232,119,46,.5) 0%, rgba(232,119,46,.24) 55%, rgba(232,119,46,.36) 100%);' +
      '--acc-rim:rgba(255,164,102,.6);--acc-ink:#FFFFFF;' +
      '--acc-glow:0 10px 28px -8px rgba(232,119,46,.55);' +
      '--hairline:rgba(255,255,255,.12);' +
      '--label-shadow:0 1px 3px rgba(0,0,0,.35);' +
      '--emboss:0 1px 2px rgba(0,0,0,.4);' +
      '--thumb:linear-gradient(160deg, rgba(255,255,255,.6), rgba(255,255,255,.2));' +
      '--disc:radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,.32), rgba(255,255,255,.07));' + glowVars;
  } else if (isGlass) {
    vars = '--ground:' + GROUNDS.grey + ';' +
      '--scrim:linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 62%, rgba(50,60,75,.26) 100%);' +
      '--ink:#20242B;--dim:rgba(32,36,43,.62);' +
      '--surface:linear-gradient(133deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.26) 36%, rgba(255,255,255,.14) 62%, rgba(255,255,255,.3) 100%);' +
      '--surface-strong:linear-gradient(133deg, rgba(255,255,255,.72) 0%, rgba(255,255,255,.42) 36%, rgba(255,255,255,.28) 62%, rgba(255,255,255,.46) 100%);' +
      '--gloss:linear-gradient(180deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,.14) 38%, rgba(255,255,255,0) 58%, rgba(255,255,255,.16) 100%);' +
      '--blur:blur(' + blurPx + ') saturate(150%) brightness(1.02);' +
      '--blur-heavy:blur(' + heavyPx + ') saturate(150%) brightness(1.02);' +
      '--rim:rgba(255,255,255,.95);' +
      '--elev:0 16px 40px -14px rgba(60,72,94,.45), 0 2px 6px rgba(60,72,94,.16), 0 1px 2px rgba(60,72,94,.1), inset 0 1.5px 0 #FFFFFF, inset -1px 0 0 rgba(255,255,255,.7), inset 0 -14px 30px -18px rgba(255,255,255,.75);' +
      '--elev-hi:0 26px 58px -16px rgba(60,72,94,.55), 0 4px 12px rgba(60,72,94,.2), inset 0 1.5px 0 #FFFFFF, inset -1.5px 0 0 rgba(255,255,255,.8), inset 0 -14px 30px -18px rgba(255,255,255,.85);' +
      '--inset:inset 0 2px 8px rgba(90,100,120,.3), inset 0 1px 0 rgba(90,100,120,.14);' +
      '--track:rgba(90,100,120,.2);' +
      '--accent:#F2792B;' +
      '--acc-surf:linear-gradient(133deg, rgba(242,121,43,.94) 0%, rgba(242,121,43,.74) 55%, rgba(242,121,43,.86) 100%);' +
      '--acc-rim:rgba(255,255,255,.8);--acc-ink:#FFFFFF;' +
      '--acc-glow:0 10px 26px -8px rgba(242,121,43,.6);' +
      '--hairline:rgba(70,80,100,.14);' +
      '--label-shadow:0 1px 2px rgba(150,60,0,.35);' +
      '--emboss:0 1px 0 rgba(255,255,255,.7);' +
      '--thumb:linear-gradient(160deg, #FFFFFF, rgba(255,255,255,.72));' +
      '--disc:radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,.9), rgba(255,255,255,.42));' + glowVars;
  } else {
    const c = SOFT[S.soft] || SOFT.graphite;
    const mixL = (p) => 'color-mix(in srgb, ' + c.base + ' ' + p + '%, ' + (c.lite || 'white') + ')';
    const mixD = (p) => 'color-mix(in srgb, ' + c.base + ' ' + p + '%, ' + (c.deep || '#5A5248') + ')';
    if (c.gel) {
      /* Glass over Vic's own backgrounds. Two user toggles drive the look:
         glassStyle 'frosted' (heavy blur, milkier surfaces) | 'clear' (low
         blur, see-through); inkMode 'light' (white text, dark scrims — for
         darker photos) | 'dark' (dark text, bright surfaces — for pale photos). */
      const isCustom = S.gelBg === 'custom' && S.customBgUrl;
      const ground = '#15171C url("' + (isCustom ? S.customBgUrl : bgUrl(S.gelBg)) + '") center/cover no-repeat';
      const darkBg = S.inkMode !== 'dark';
      const ink = darkBg ? '#F4F5F7' : '#23262C';
      const acc = darkBg ? '#FFD9C2' : '#8A5A2E';
      const GW = (a) => 'rgba(255,255,255,' + a + ')';
      const GS = (a) => 'rgba(55,65,80,' + a + ')';
      const frosted = S.glassStyle !== 'clear';
      const gBl = frosted ? '16px' : '4px', gBlH = frosted ? '22px' : '8px';
      const gGlow = '--glow-1:radial-gradient(circle, rgba(255,255,255,.2), rgba(255,255,255,0) 70%);--glow-2:radial-gradient(circle, rgba(160,190,255,.18), rgba(160,190,255,0) 70%);--glow-3:radial-gradient(circle, rgba(255,190,140,.14), rgba(255,190,140,0) 70%);--glow-op:1;';
      const gEdge = '';
      if (darkBg) {
        const sf = frosted ? 1 : .5;
        const gSheen = 'linear-gradient(180deg, ' + GW(.11) + ' 0%, ' + GW(.02) + ' 34%, rgba(255,255,255,0) 55%, ' + GW(.03) + ' 100%)';
        const gRim = GW(frosted ? .4 : .28);
        vars = '--ground:' + ground + ';' +
          '--scrim:linear-gradient(180deg, rgba(5,7,9,.3) 0%, rgba(5,7,9,0) 22%, rgba(5,7,9,0) 60%, rgba(5,7,9,.4) 100%);' +
          '--ink:' + ink + ';--dim:' + ink + 'A6;' +
          '--surface:linear-gradient(133deg, ' + GW(.13 * sf) + ' 0%, ' + GW(.04 * sf) + ' 32%, ' + GW(.015 * sf) + ' 58%, ' + GW(.055 * sf) + ' 100%);' +
          '--surface-strong:linear-gradient(133deg, ' + GW(.17 * sf) + ' 0%, ' + GW(.065 * sf) + ' 32%, ' + GW(.03 * sf) + ' 58%, ' + GW(.08 * sf) + ' 100%);' +
          '--gloss:' + gSheen + ';' +
          '--blur:blur(' + gBl + ') saturate(140%);--blur-heavy:blur(' + gBlH + ') saturate(140%);' +
          '--rim:' + gRim + ';' +
          '--elev:' + gEdge + '0 0 0 1px ' + GW(.12) + ', 0 16px 40px -14px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.24), inset 0 1.5px 0 ' + GW(.55) + ', inset -1px 0 0 ' + GW(.14) + ', inset 0 -14px 30px -18px ' + GW(.18) + ';' +
          '--elev-hi:' + gEdge + '0 26px 60px -16px rgba(0,0,0,.68), 0 4px 12px rgba(0,0,0,.3), inset 0 1.5px 0 ' + GW(.66) + ', inset -1.5px 0 0 ' + GW(.18) + ', inset 0 -14px 30px -18px ' + GW(.22) + ';' +
          '--inset:inset 0 3px 10px rgba(0,0,0,.38), inset 0 1px 0 rgba(0,0,0,.2);' +
          '--track:rgba(0,0,0,.28);' +
          '--accent:' + acc + ';' +
          '--acc-surf:linear-gradient(133deg, ' + GW(.36) + ' 0%, ' + GW(.17) + ' 55%, ' + GW(.26) + ' 100%);' +
          '--acc-rim:' + GW(.52) + ';--acc-ink:#FFFFFF;' +
          '--acc-glow:0 12px 30px -10px rgba(0,0,0,.55);' +
          '--hairline:' + ink + '22;' +
          '--label-shadow:0 1px 2px rgba(0,0,0,.4);' +
          '--emboss:none;' +
          '--thumb:linear-gradient(160deg, ' + GW(.68) + ', ' + GW(.3) + ');' +
          '--disc:radial-gradient(120% 120% at 30% 20%, ' + GW(.3) + ', ' + GW(.07) + ');' + gGlow;
      } else {
        const gSheenL = 'linear-gradient(180deg, ' + GW(.47) + ' 0%, ' + GW(.11) + ' 38%, rgba(255,255,255,0) 58%, ' + GW(.13) + ' 100%)';
        const gRimL = GW(frosted ? .92 : .6);
        vars = '--ground:' + ground + ';' +
          '--scrim:linear-gradient(180deg, ' + GW(.1) + ' 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 62%, ' + GS(.18) + ' 100%);' +
          '--ink:' + ink + ';--dim:' + ink + 'A6;' +
          '--surface:linear-gradient(133deg, ' + GW(.42 * (frosted ? 1 : .6)) + ' 0%, ' + GW(.17 * (frosted ? 1 : .6)) + ' 36%, ' + GW(.08 * (frosted ? 1 : .6)) + ' 62%, ' + GW(.21 * (frosted ? 1 : .6)) + ' 100%);' +
          '--surface-strong:linear-gradient(133deg, ' + GW(.58 * (frosted ? 1 : .7)) + ' 0%, ' + GW(.32 * (frosted ? 1 : .7)) + ' 36%, ' + GW(.2 * (frosted ? 1 : .7)) + ' 62%, ' + GW(.36 * (frosted ? 1 : .7)) + ' 100%);' +
          '--gloss:' + gSheenL + ';' +
          '--blur:blur(' + gBl + ') saturate(135%);--blur-heavy:blur(' + gBlH + ') saturate(135%);' +
          '--rim:' + gRimL + ';' +
          '--elev:0 0 0 1.5px ' + GS(.16) + ', 0 14px 34px -12px ' + GS(.34) + ', 0 2px 6px ' + GS(.13) + ', inset 0 1.5px 0 ' + GW(.96) + ', inset -1px 0 0 ' + GW(.56) + ', inset 0 -12px 26px -16px ' + GW(.6) + ';' +
          '--elev-hi:0 0 0 1.5px ' + GS(.18) + ', 0 24px 54px -16px ' + GS(.42) + ', 0 4px 10px ' + GS(.16) + ', inset 0 1.5px 0 ' + GW(1) + ', inset -1.5px 0 0 ' + GW(.66) + ', inset 0 -12px 26px -16px ' + GW(.7) + ';' +
          '--inset:inset 0 2px 8px ' + GS(.26) + ', inset 0 1px 0 ' + GS(.13) + ';' +
          '--track:' + GS(.16) + ';' +
          '--accent:' + acc + ';' +
          '--acc-surf:linear-gradient(133deg, rgba(255,250,243,.78) 0%, ' + GW(.36) + ' 50%, rgba(255,252,246,.55) 100%);' +
          '--acc-rim:' + GW(.96) + ';--acc-ink:' + ink + ';' +
          '--acc-glow:0 0 0 1.5px ' + GS(.16) + ', 0 16px 32px -10px rgba(224,164,110,.4), 0 3px 10px ' + GS(.15) + ';' +
          '--hairline:' + ink + '22;' +
          '--label-shadow:none;' +
          '--emboss:none;' +
          '--thumb:linear-gradient(160deg, #FFFFFF, ' + GW(.74) + ');' +
          '--disc:radial-gradient(120% 120% at 30% 20%, ' + GW(.86) + ', ' + GW(.42) + ');' + gGlow;
      }
    } else {
      vars = '--ground:' + (c.ground || ('radial-gradient(140% 105% at 30% 8%, ' + mixL(78) + ' 0%, ' + c.base + ' 52%, ' + mixD(82) + ' 100%)')) + ';--scrim:none;' +
        '--ink:' + c.ink + ';--dim:' + c.ink + 'A6;' +
        '--surface:linear-gradient(145deg, ' + mixL(60) + ' 0%, ' + c.base + ' 50%, ' + mixD(84) + ' 100%);' +
        '--surface-strong:linear-gradient(145deg, ' + mixL(54) + ' 0%, ' + c.base + ' 50%, ' + mixD(82) + ' 100%);' +
        '--gloss:radial-gradient(120% 90% at 50% -12%, rgba(255,255,255,' + (c.glossA || '.42') + '), rgba(255,255,255,0) 58%);' +
        '--blur:none;--blur-heavy:none;' +
        '--rim:rgba(255,255,255,' + (c.rimGlowA || '.26') + ');' +
        '--elev:' + (c.halo ? c.halo + ', ' : '') + '10px 10px 26px ' + c.dark + ', -10px -10px 26px ' + c.light + ', inset 0 1px 0 rgba(255,255,255,.5);' +
        '--elev-hi:' + (c.halo ? c.halo + ', ' : '') + '18px 18px 40px ' + c.dark + ', -15px -15px 34px ' + c.light + ', 0 30px 48px -20px ' + c.accent + '3D, inset 0 1px 0 rgba(255,255,255,.5);' +
        '--inset:inset 6px 6px 14px ' + c.dark + ', inset -6px -6px 14px ' + c.light + ';' +
        '--track:' + c.well + ';' +
        '--accent:' + c.accent + ';' +
        '--acc-surf:linear-gradient(145deg, color-mix(in srgb, ' + c.accent + ' 80%, white) 0%, ' + c.accent + ' 55%, color-mix(in srgb, ' + c.accent + ' 84%, ' + (c.accDeep || '#33220E') + ') 100%);' +
        '--acc-rim:rgba(255,255,255,.35);--acc-ink:' + c.accInk + ';' +
        '--acc-glow:' + (c.halo ? c.halo + ', ' : '') + '7px 7px 16px ' + c.dark + ', -7px -7px 16px ' + c.light + ', 0 10px 24px -6px ' + c.accent + '59;' +
        '--hairline:' + c.ink + '1F;' +
        '--label-shadow:0 1px 1px ' + (c.labelSh || 'rgba(60,45,25,.28)') + ';' +
        '--emboss:0 1px 0 ' + (c.emboss || 'rgba(255,255,255,.85)') + ';' +
        '--thumb:' + (c.thumb || ('linear-gradient(145deg, #FFFFFF 0%, ' + mixL(52) + ' 100%)')) + ';' +
        '--disc:linear-gradient(145deg, ' + mixL(58) + ' 0%, ' + c.base + ' 55%, ' + mixD(86) + ' 100%);--glow-op:0;' +
        '--intro-slab:' + c.base + ';' +
        '--intro-shadow:' + (c.halo ? c.halo + ', ' : '') + '22px 24px 54px ' + c.dark + ', -18px -20px 46px ' + c.light + ', 0 34px 68px -26px ' + c.accent + '4D;' +
        '--intro-bevel:inset 0 2px 3px rgba(255,255,255,' + (c.rimGlowA || '.2') + '), inset 0 -5px 14px ' + c.dark + ';';
    }
  }

  if (S.a11y && S.a11y.on) vars += '--dim:var(--ink);';
  return vars;
}

// Parse the "--a:b;--c:d;" string into a React style object.
export function parseVars(varStr) {
  const out = {};
  for (const decl of varStr.split(';')) {
    const i = decl.indexOf(':');
    if (i === -1) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// Shared thumbnail gradients (media source → colour), from the prototype.
export const THUMBS = {
  yt: 'linear-gradient(135deg, #55423A 0%, #201914 100%)',
  sp: 'linear-gradient(135deg, #2C4A38 0%, #121F17 100%)',
  au: 'linear-gradient(135deg, #35415A 0%, #161B26 100%)',
  doc: 'linear-gradient(135deg, #4E4636 0%, #1F1B12 100%)',
};
