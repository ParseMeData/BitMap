'use strict';
/* ── the compass ────────────────────────────────────────────────────────
   Top-left: a star rose with a long north spike, a burst behind it, a
   larger burst behind that, and a ring round the whole. The three drawn
   layers follow the map — the traced underlay's own rotation, which is
   the one number in this game that says which way north is — and turn
   with it exactly as the picture is turned (the Turn arrows, shift-drag),
   so the spike points where north is on the plate. The ring stays still.
   On the region north is up and it reads 0. It is never turned by hand:
   since 2026-08-28 there is no drag and no double-click, and `hq.compass`
   keeps only the tune and where it was put.

   Four sheets (`assets/compass/`, Eden, 2026-09-05), each cut on its own
   (`tools/compass.py`) through the SAME SCREEN THE LETTERING GOES THROUGH
   (`Title.stencil` → `Title.screen`) and drawn by the call the town's
   name makes (`Title.emit`), each in an ink of its own with the titles'
   sheen down it — so the compass is made of what the plate is made of,
   at the plate's pitch and on the plate's grain, and never a picture laid
   on it. The heading turns each drawing before it is screened, never the
   cells after; see *the rose, cut in the title's own layer* below for
   why that is the whole difference, and *four cuts, four inks* for how
   the layers sit on one another. Until build 258 it was one sheet, one
   cut, one ink. */

const Compass = (() => {
  const KEY = 'hq.compass';                    // {tune}
  const BOX = 200;                             // the element, CSS px (index.html agrees)
  let el = null, rose = null, shadow = null;
  let shown = -1, last = null, raf = 0, faces = {}, painted = null;
  /* the pitch: about three CSS pixels a diamond, which is the plate's own
     cell at the zoom the town is read at; each cut is read at as many
     cells as fit its width at that pitch, and painted at 2× for the
     screen */
  const SCALE = 2;
  /* the rose's box: the sheets' own proportion (224 × 318), 143 tall */
  const SIZE = {rose: [101, 143]};
  const BONE = [0.93, 0.92, 0.89], FLARE = [1, 0.373, 0.635], DIM = [0.353, 0.353, 0.4];
  /* the ink runs bone at the top to a grey at the foot — bone mixed a
     little toward dim, subtle, not a shadow; flare toward dim while it
     is turned by hand */
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const GREY = 0.42;
  /* ── the tune ──────────────────────────────────────────────────────────
     How the compass is read and drawn, in the Tune panel under the plate's
     own rows: the pitch, the diamond's weight (which is the gap), and the
     lattice's scatter and size variance. Kept with the heading. */
  const TUNE = {
    /* the rose on the plate, in the title's own numbers — `size` is the
       title's Size (how many cells the drawing is read at, the pitch
       being the plate's own cell and never moving), and `dither`,
       `tone`, `weight` and `shade` are the four the lettering already
       has, at the lettering's defaults, so a compass at rest is cut the
       way a name at rest is cut (Eden, 2026-08-30) */
    size:    {lo: 16,  hi: 120, dflt: 40,  step: 100, label: 'Size',   fmt: v => Math.round(v) + ' cells'},
    weight:  {lo: 0.5, hi: 2.0, dflt: 1,   label: 'Weight', fmt: v => v.toFixed(2) + '\u00d7'},
    tone:    {lo: 0,   hi: 1,   dflt: 0,   label: 'Tone',   fmt: v => v ? v.toFixed(2) : 'even'},
    shade:   {lo: 0,   hi: 0.7, dflt: 0.25, label: 'Sheen', fmt: v => v.toFixed(2)},
    bri:     {lo: -0.4, hi: 0.4, dflt: -0.12, label: 'Ink', fmt: v => (v > 0 ? '+' : '') + Math.round(v * 100)},
    /* the chrome canvas's own read: kept because the shadow is drawn at
       it, and the chrome is what a future off-plate compass would use */
    pitch:   {lo: 1.5, hi: 4,   dflt: 2.2, step: 10, label: 'Detail', fmt: v => v.toFixed(1) + ' px'}
  };
  let tune = {};
  const tuned = k => { const v = isFinite(tune[k]) ? +tune[k] : TUNE[k].dflt; return Math.min(TUNE[k].hi, Math.max(TUNE[k].lo, v)); };
  /* the rows the panel shows of those: `bri` is the chrome canvas's own
     read and does nothing on the plate, so it is not offered */
  const SHARED = ['size', 'weight', 'tone', 'shade', 'pitch'];
  const url = k => COMPASS_ART[k].replace(/^url\("(.*)"\)$/, '$1');

  /* ── the layers, and the inks ──────────────────────────────────────────
     Four sheets in drawing order, bottom first. Each has an ink of its
     own — named, and the game's own colours: the chrome's bone, the
     sparks' gold, the flare, the trace's aqua, the dim, and three off the
     terrain — and its own Bright (0 hides it) and Screen, kept per layer
     in `hq.compass`, so any one can be brought up until it reads (Eden,
     2026-09-05: "each layer its own ink … allow for tuning of each layer
     to make sure each layer's visible"). The defaults are the tune Eden
     settled on the first Barwidgee that day, asked for as the default
     when a fresh profile came up on the plain one ("save the settings we
     had … as the refresh brought back the very original version"): each
     layer's `<key>0` here is what `ltuned` answers when the profile has
     nothing saved for it (build 265; before that only the top layer's
     fill was set, and the middle burst was gold). */
  const INKS = {bone: [0.93, 0.92, 0.89], gold: [0.95, 0.76, 0.31], flare: [1, 0.373, 0.635], aqua: [0.47, 0.88, 0.85],
                dim: [0.353, 0.353, 0.4], grass: [0.50, 0.70, 0.36], water: [0.56, 0.84, 0.93], sand: [0.84, 0.72, 0.48]};
  const INK_LABEL = {bone: 'Bone', gold: 'Gold', flare: 'Flare', aqua: 'Aqua', dim: 'Dim', grass: 'Grass', water: 'Water', sand: 'Sand'};
  const LAYERS = [
    {k: 'bottom', label: 'Bottom layer', turns: true,  ink: 'dim',
     dither0: 0.5, fill0: 0.6, scatter0: 0.55, jitter0: 0.7},
    {k: 'middle', label: 'Middle layer', turns: true,  ink: 'dim',
     lit0: 0.7, dither0: 0, weight0: 1.1, fine0: 0.75, fill0: 0.6, scatter0: 0.1, jitter0: 0.6},
    {k: 'top',    label: 'Top layer',    turns: true,  ink: 'bone',
     lit0: 1.5, dither0: 0.35, weight0: 1.2, scale0: 1.2, fine0: 0.55, fill0: 1},
    {k: 'ring',   label: 'Ring',         turns: false, ink: 'aqua', shift: true,
     lit0: 1.5, weight0: 0.85, tone0: 1, fill0: 0.25, scatter0: 0.25, dx0: -1, dy0: 1}];
  /* per layer: Bright (0 hides it), Screen, Weight (on the shared one —
     smaller diamonds read as a finer line), Fine (ink thinner than this
     is not cut at all: the sides of the ring's line, the top layer's
     faint body), and for the ring alone a nudge in whole cells either
     way, to sit it on the rose (Eden, 2026-09-05: "slightly change
     thickness of circle pixels … move the circle left right up or down
     to align better … the top layer's detail visible"). */
  const LTUNE = {
    lit:     {lo: 0,   hi: 1.5, dflt: 1, label: 'Bright',  fmt: v => v ? Math.round(v * 100) + '%' : 'off'},
    dither:  {lo: 0,   hi: 1,   dflt: 1, label: 'Screen',  fmt: v => v ? v.toFixed(2) : 'flat cut'},
    tone:    {lo: 0,   hi: 1,   dflt: 0, label: 'Tone',    fmt: v => v ? v.toFixed(2) : 'even'},
    weight:  {lo: 0.4, hi: 1.6, dflt: 1, label: 'Weight',  fmt: v => v.toFixed(2) + '\u00d7'},
    /* Scale is on the shared Size: a layer read at more or fewer cells
       than the rest, about the same centre — the spike a little larger
       than the bursts it stands on (Eden, 2026-09-05) */
    scale:   {lo: 0.5, hi: 2,   dflt: 1, label: 'Scale',   fmt: v => v.toFixed(2) + '\u00d7'},
    /* Sheen, on the shared one: the fade down a layer's ink, bone at its
       top to grey at its foot, the way a name's runs down the word — and
       it runs down the layer's INK, not its box, since build 263, so it
       reads on the spike as it reads on the title (Eden, 2026-09-05:
       "the same gradient effect that matches the existing town title") */
    shade:   {lo: 0,   hi: 2,   dflt: 1, label: 'Sheen',   fmt: v => v.toFixed(2) + '\u00d7'},
    fine:    {lo: 0,   hi: 0.9, dflt: 0, label: 'Fine',    fmt: v => v ? v.toFixed(2) : 'as read'},
    /* Fill paints the layer's whole silhouette in the ground's own colour
       under its ink, so what is beneath it — the layers below, the
       terrain the compass stands on — is put out, and its lines and
       textures are its inside (Eden, 2026-09-05: "the top layer's inside
       not transparent, still keeping matching background colour, as it's
       internal background detail"). On by default for the top layer,
       clear for the rest. */
    fill:    {lo: 0,   hi: 1,   dflt: 0, label: 'Fill',    fmt: v => v ? Math.round(v * 100) + '%' : 'clear'},
    /* and two textures the terrain kinds have (src/kinds.js): a share of
       the cells thrown away, and a shake on where each one sits */
    scatter: {lo: 0,   hi: 0.9, dflt: 0, label: 'Scatter', fmt: v => v ? Math.round(v * 100) + '%' : 'none'},
    jitter:  {lo: 0,   hi: 1,   dflt: 0, label: 'Jitter',  fmt: v => v ? v.toFixed(2) : 'still'},
    dx:      {lo: -10, hi: 10,  dflt: 0, step: 100, label: 'Left \u2013 right', shift: true, fmt: v => v ? (v > 0 ? '+' : '') + Math.round(v) + ' cells' : 'centred'},
    dy:      {lo: -10, hi: 10,  dflt: 0, step: 100, label: 'Up \u2013 down',    shift: true, fmt: v => v ? (v > 0 ? '+' : '') + Math.round(v) + ' cells' : 'centred'}};
  /* a grain: a pattern of the lattice a layer's ink is put through, on
     the face's own grid — which is the plate's, so it stays square as
     the map turns under it */
  const GRAINS = {plain: 'Plain', checker: 'Checker', lines: 'Lines', diagonal: 'Diagonal'};
  /* the screen's recipe, for a drawing rather than a letter: the type's
     recipe stretches what it reads between its 4th and 96th percentile,
     which is right for a word — every stroke comes up to full ink — and
     wrong for a thin ring, whose half-covered side cells come up to full
     ink with the rest and make a two-cell line of a one-cell one. Read
     as covered, the ring is as fine as it was drawn, and Fine trims it
     from there. */
  const RECIPE = {lo: 0, hi: 0.999};
  let layers = {};                             // {bottom: {ink, lit, dither}, …}
  const layerDef = (k, key) => { const l = LAYERS.find(x => x.k === k); return l && isFinite(l[key + '0']) ? l[key + '0'] : LTUNE[key].dflt; };
  const ltuned = (k, key) => {
    const v = layers[k] && isFinite(layers[k][key]) ? +layers[k][key] : layerDef(k, key);
    return Math.min(LTUNE[key].hi, Math.max(LTUNE[key].lo, v));
  };
  const grainOf = k => (layers[k] && GRAINS[layers[k].grain]) ? layers[k].grain : 'plain';
  const inkOf = k => (layers[k] && INKS[layers[k].ink]) ? layers[k].ink : ((LAYERS.find(l => l.k === k) || {}).ink || 'bone');
  const setLayer = (k, key, v) => { layers[k] = layers[k] || {}; layers[k][key] = v; };

  function load(){
    try {
      const v = JSON.parse(Store.get(KEY) || 'null');
      if (v && typeof v === 'object'){
        /* a tune saved BEFORE 2026-08-30 is a tune for the other read —
           `scatter` and `szv` were the lattice's, and `weight` was on a
           0.4–1.4 scale against a different diamond. Its numbers mean
           nothing to the title's screen, and carried over they show up
           as a rose drawn far too thin. So an old shape is dropped
           whole and the new defaults stand; `at` is kept, because where
           you put it is still where you put it. */
        const old = v.tune && (('szv' in v.tune) || ('scatter' in v.tune));
        if (v.tune && typeof v.tune === 'object' && !old) tune = Object.assign({}, v.tune);
        if (v.layers && typeof v.layers === 'object')
          for (const l of LAYERS) if (v.layers[l.k] && typeof v.layers[l.k] === 'object') layers[l.k] = Object.assign({}, v.layers[l.k]);
        if (Array.isArray(v.at) && isFinite(v.at[0]) && isFinite(v.at[1])) at = [+v.at[0], +v.at[1]];
      }
    } catch (e){}
  }
  function store(){
    try { Store.set(KEY, JSON.stringify({tune, layers, at})); } catch (e){}
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  /* the map's heading, in degrees clockwise from up, or 0 with no map */
  function mapDeg(){
    if (typeof Basemap === 'undefined' || !Basemap.rot) return 0;
    return Basemap.rot() * 180 / Math.PI;
  }
  /* on the region north is up by definition, whatever the map says */
  const heading = () => (typeof Region !== 'undefined' && Region.on() ? 0 : mapDeg());

  function build(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'compass';
    el.title = 'north, as the map is turned';
    rose = document.createElement('canvas');
    rose.className = 'rose';
    rose.width = SIZE.rose[0] * SCALE; rose.height = SIZE.rose[1] * SCALE;
    rose.style.width = SIZE.rose[0] + 'px'; rose.style.height = SIZE.rose[1] + 'px';
    rose.style.left = ((BOX - SIZE.rose[0]) / 2) + 'px'; rose.style.top = ((BOX - SIZE.rose[1]) / 2) + 'px';
    /* a shadow under the rose: an oval of the ground's own diamonds,
       dithered to nothing at its rim, so the compass reads over whatever
       the plate has under it (Eden, 2026-08-28) — the title's mat, in chrome */
    shadow = document.createElement('canvas');
    shadow.className = 'shadow';
    shadow.width = BOX * SCALE; shadow.height = BOX * SCALE;
    shadow.style.cssText = 'position:absolute;left:0;top:0;width:' + BOX + 'px;height:' + BOX + 'px;pointer-events:none';
    el.append(shadow, rose);
    document.body.append(el);
    read();
    return el;
  }
  /* every cut through the tone pass once — bone ink, no edges, the tone
     flat — kept as cells, and painted whenever the ink changes */
  function read(){
    if (typeof Title === 'undefined' || !Title.picture) return;
    const pitch = tuned('pitch');
    const all = ['rose'].map(k =>
      Title.picture(url(k), Math.round(SIZE[k][0] / pitch),
                    {ink: 0, edge: 0, con: 1, bri: tuned('bri')})
        .then(f => { faces[k] = f; }));
    Promise.all(all).then(() => { painted = null; paint(); }).catch(() => {});
  }
  const GROUND = [0.106, 0.106, 0.129];
  const roll = (u, v, s) => (typeof Kinds !== 'undefined' && Kinds.hash ? Kinds.hash(u, v, s) : 0.5);
  function paintShadow(){
    if (!shadow || typeof Title === 'undefined' || !Title.paint) return;
    const pitch = tuned('pitch'), N = Math.max(8, Math.round(BOX / pitch));
    const c = (N - 1) / 2, rx = N * 0.40, ry = N * 0.40, f0 = 0.25, S = 2;
    const cells = [];
    for (let j = 0; j < N; j += S) for (let i = 0; i < N; i += S){
      const r = Math.hypot((i - c) / rx, (j - c) / ry);
      if (r >= 1) continue;
      let e = 1;
      if (r > f0){ const t = (1 - r) / (1 - f0); e = t * t * (3 - 2 * t); }
      if (roll(i, j, 7) > e + 0.12) continue;
      cells.push({x: i, y: j, al: 0.85 * e * (0.55 + 0.45 * roll(i, j, 3)), rgb: GROUND, sz: S * 1.05});
    }
    Title.paint(shadow, {cols: N, rows: N, cells}, {weight: tuned('weight'), shade: 0, tint: GROUND, tint2: GROUND});
  }
  function paint(){
    const ink = BONE;
    paintShadow();
    const stamp = ink + '|' + tuned('weight');
    if (painted === stamp) return;
    painted = stamp;
    for (const k in faces){
      const cv = rose;
      if (cv && faces[k]) Title.paint(cv, faces[k], {weight: tuned('weight'), shade: 0, tint: ink, tint2: mix(ink, DIM, GREY)});
    }
  }

  /* ── the block in the Tune panel ───────────────────────────────────────
     Appended under the plate's rows whenever the panel is up and the
     block is not there (the panel may rebuild its body), so the compass
     is tuned where the plate is. Pitch, scatter and size variance read
     the cuts again; weight only paints. */
  function block(){
    const body = document.querySelector('#tune #tbody');
    if (!body || body.querySelector('#ctune')) return;
    const el = document.createElement('div');
    el.id = 'ctune';
    el.innerHTML = '<div class="plabel">Compass</div>';
    const slider = (label, get, set, r, after) => {
      const row = document.createElement('div');
      row.className = 'prow';
      row.innerHTML = '<label>' + label + '</label><input type="range" min="' + Math.round(r.lo * 100) +
        '" max="' + Math.round(r.hi * 100) + '" step="' + (r.step || 5) + '"><span class="pv"></span>';
      const inp = row.querySelector('input'), out = row.querySelector('.pv');
      const sync = () => { inp.value = Math.round(get() * 100); out.textContent = r.fmt(get()); };
      sync();
      inp.addEventListener('input', () => { set(+inp.value / 100); sync(); if (after) after(); });
      inp.addEventListener('change', store);
      return row;
    };
    /* the rose on the plate needs no poking: `overlay` reads its own keys
       every frame and asks for a new cut when one of these moves. Weight
       and Detail are the chrome canvas's as well, which does not. */
    for (const k of SHARED)
      el.append(slider(TUNE[k].label, () => tuned(k), v => { tune[k] = v; }, TUNE[k],
                       k === 'weight' ? () => { painted = null; paint(); } : k === 'pitch' ? read : null));
    /* then each layer: its ink as a row of chips in that ink, and its two
       sliders. A selected chip goes bone with the ground's text, as every
       chip does, so its own colour comes off it while it is chosen. */
    for (const l of LAYERS){
      const h = document.createElement('div');
      h.className = 'plabel';
      h.textContent = l.label + (l.turns ? ' \u00b7 turns with the map' : ' \u00b7 stays still');
      el.append(h);
      const chipRow = (opts, sel, pick, colour) => {
        const chips = document.createElement('div');
        chips.className = 'chips';
        chips.style.gridTemplateColumns = 'repeat(4,1fr)';
        const tint = (c, id, on) => { c.classList.toggle('sel', on); c.style.color = on || !colour ? '' : colour(id); };
        for (const id in opts){
          const c = document.createElement('div');
          c.className = 'chip'; c.textContent = opts[id]; c.dataset.id = id;
          tint(c, id, sel() === id);
          c.addEventListener('click', () => { pick(id); for (const o of chips.children) tint(o, o.dataset.id, o === c); store(); });
          chips.append(c);
        }
        return chips;
      };
      el.append(chipRow(INK_LABEL, () => inkOf(l.k), id => setLayer(l.k, 'ink', id),
                        id => 'rgb(' + INKS[id].map(v => Math.round(v * 255)).join(',') + ')'));
      el.append(chipRow(GRAINS, () => grainOf(l.k), id => setLayer(l.k, 'grain', id), null));
      for (const key in LTUNE){
        if (LTUNE[key].shift && !l.shift) continue;      // the nudge is the ring's alone
        el.append(slider(LTUNE[key].label, () => ltuned(l.k, key), v => setLayer(l.k, key, v), LTUNE[key], null));
      }
    }
    body.append(el);
  }

  /* the rose turns as one, with the map */
  function lay(deg){
    if (deg === last) return;
    last = deg;
    rose.style.transform = 'rotate(' + deg.toFixed(2) + 'deg)';
    paint();
  }

  /* shown by the same rule as the chrome: not on the wallpaper, not under a
     page, not while the map bar is up in the same lane */
  function visible(){
    const b = document.body.classList;
    return !(b.contains('wall') || b.contains('bag') || b.contains('journal') ||
             b.contains('locus') || b.contains('missions') || b.contains('towns'));
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible() && !ON_PLATE ? 1 : 0;
    if (v !== shown){ shown = v; el.hidden = !v; }
    if (v) lay(heading());
    const tp = document.getElementById('tune');
    if (tp && !tp.hidden) block();
  }

  /* ── on the plate ──────────────────────────────────────────────────────
     Since 2026-08-28 the compass is drawn ON THE PLATE, like the town's
     name: the rose's cells go into the entity stream at the plate's
     top-left corner, over a mat of the ground's diamonds — so it is part
     of the map, at the map's pitch, and the chrome canvas above is kept
     only for the tune panel's reading. */
  const ON_PLATE = true;
  const AT = 6;                      // tiles in from the plate's top-left corner, both ways, until moved
  /* where it stands, moved by hand and kept: `at` in hq.compass, world
     units; nothing when it has never been moved */
  let at = null, drag = null;
  const where = () => (at ? at : [G.terr.tsz * AT, G.terr.tsz * AT]);
  /* ── the rose, cut in the title's own layer ────────────────────────────
     Until 2026-08-30 this was `Title.picture` — the PHOTOGRAPHIC read,
     through `Lattice.analyse`/`compose`: a dense field with a cell for
     every cell, no gaps anywhere — with a checkerboard laid over it by
     hand (build 222) to fake a screen, and the cells then TURNED to the
     heading one by one. It read wrong twice over, and Eden named both:

       *the angle is off* — a cell turned by `cos/sin` lands BETWEEN the
       plate's own cells. At 0° or 90° that is invisible; at anything
       else the whole rose sits off the grain and smears, because every
       other diamond on the plate is on the lattice and this one is not.

       *the diamonds are not spaced out with halftone gaps* — a checker
       drops every second cell on a fixed parity, which is a texture,
       not a screen. The title beside it is cut by the Bayer threshold
       in `Title.screen`, where a cell is dropped because the INK there
       is thin: the gaps open in the pale places and close in the dark
       ones, and that is what reads as halftone.

     So: `Title.stencil` is the lettering's own screen with a picture fed
     to it instead of a word, and the heading is turned into the PICTURE
     before it is screened — the box grown to the rotated diagonal so no
     spike is clipped — which leaves every diamond square on a lattice
     cell at every heading. It is then drawn by `Title.emit`, the call
     the town's name makes in `palace.js`: same origin, same pitch, same
     sheen, same diamond, same instance cap. One layer, one material. */
  /* ── four cuts, four inks ──────────────────────────────────────────────
     Since build 259 the rose is four sheets (assets/compass/, Eden,
     2026-09-05), each cut through that screen on its own and drawn in
     its own ink, bottom to top: the large burst, the small burst over
     it, the hatched spike cross, and a ring round the whole. The three
     drawn layers turn with the map; the ring stays still (Eden: "ring
     stays still"), so it is cut at 0° whatever the heading — a circle
     turned is the same circle, and cutting it once means its diamonds
     never shuffle as the map is dragged.

     Every sheet is the same size and in register, so at one Size and one
     heading the three turning cuts land on one grid, cell for cell, and
     a layer's cells are dropped where a layer above it has ink: the
     bursts do not show through the spike, nor the large burst through
     the small, and each ink stays its own colour rather than the two
     mixing in the gaps. The ring is cut in a box of its own (0° is a
     different diagonal) and is drawn last over everything, unmasked. */
  const facePlates = {}, faceKeys = {}, asking = {};
  const foots = {}, footKeys = {}, askingFoot = {};
  /* what a cut depends on — the heading (0 for the ring) and the two
     numbers that shape it. `overlay` compares this every frame and asks
     for a new one when it moves, so a slider or a turn of the map needs
     no callback. */
  const colsOf = l => Math.round(tuned('size') * ltuned(l.k, 'scale'));
  const layerKey = (l, deg) => (l.turns ? deg : 0) + '|' + colsOf(l) + '|' +
                               ltuned(l.k, 'dither').toFixed(2) + '|' + ltuned(l.k, 'fine').toFixed(2);
  const footKey = (l, deg) => (l.turns ? deg : 0) + '|' + colsOf(l);
  function wantPlates(deg){
    for (const l of LAYERS){
      const d = l.turns ? deg : 0, size = colsOf(l);
      const k = layerKey(l, deg);
      if (faceKeys[l.k] !== k && asking[l.k] !== k){
        asking[l.k] = k;
        Title.stencil(url(l.k), size, {deg: d, dither: ltuned(l.k, 'dither'), cut: ltuned(l.k, 'fine'), recipe: RECIPE})
          .then(f => { if (asking[l.k] === k){ facePlates[l.k] = f; faceKeys[l.k] = k; asking[l.k] = null; } })
          .catch(() => { if (asking[l.k] === k) asking[l.k] = null; });
      }
      /* and the footprint: the same drawing flat-cut with no floor,
         which is its whole silhouette — what a Fill paints in the
         ground's colour, and what the layers beneath a filled layer give
         way to, whatever its own ink is doing */
      const fk = footKey(l, deg);
      if (footKeys[l.k] !== fk && askingFoot[l.k] !== fk){
        askingFoot[l.k] = fk;
        Title.stencil(url(l.k), size, {deg: d, dither: 0, cut: 0, recipe: RECIPE})
          .then(f => { if (askingFoot[l.k] === fk){ foots[l.k] = f; footKeys[l.k] = fk; askingFoot[l.k] = null; } })
          .catch(() => { if (askingFoot[l.k] === fk) askingFoot[l.k] = null; });
      }
    }
  }
  /* whether a cell of a face stands under a grain and a scatter */
  const keep = (c, grain, scatter, seed) => {
    if (grain === 'checker' && ((c.x + c.y) & 1)) return false;
    if (grain === 'lines' && (c.y & 1)) return false;
    if (grain === 'diagonal' && (((c.x - c.y) % 3) + 3) % 3) return false;
    return !(scatter > 0 && roll(c.x, c.y, seed) < scatter);
  };
  /* the faces as they are drawn — masked, grained, inked, in order, each
     with its fill — rebuilt only when a cut or a layer's tune changes,
     never per frame */
  let comp = [], compKey = '';
  function composed(){
    const key = LAYERS.map(l => faceKeys[l.k] + '|' + footKeys[l.k] + '|' + inkOf(l.k) + '|' + ltuned(l.k, 'lit') + '|' +
                                grainOf(l.k) + '|' + ltuned(l.k, 'scatter') + '|' + ltuned(l.k, 'fill')).join('\n');
    if (compKey === key) return comp;
    /* a cell's place, in cells from the one centre every cut is drawn
       about — so faces on different grids (a layer scaled, or cut at
       another heading) can still mask one another, to the nearest cell.
       Until build 261 the mask was by grid index and only between faces
       on one grid; Scale made that the wrong question. */
    const at = (f, c) => Math.round(c.x - (f.cols - 1) / 2) + ',' + Math.round(c.y - (f.rows - 1) / 2);
    /* what stands above each turning layer, as a set of places. A
       filled layer's whole silhouette is in the set, not only what it
       draws. */
    const masks = {};
    let above = null;
    for (let i = LAYERS.length - 1; i >= 0; i--){
      const l = LAYERS[i];
      if (!l.turns) continue;
      masks[l.k] = above;
      const f = facePlates[l.k];
      if (!f || !f.cells.length || ltuned(l.k, 'lit') <= 0) continue;
      const set = new Set(above || []);
      for (const c of f.cells) set.add(at(f, c));
      const ft = foots[l.k];
      if (ltuned(l.k, 'fill') > 0 && ft) for (const c of ft.cells) set.add(at(ft, c));
      above = set;
    }
    const list = [];
    LAYERS.forEach((l, i) => {
      const f = facePlates[l.k], lit = ltuned(l.k, 'lit');
      if (!f || !f.cells.length || lit <= 0) return;
      const mask = masks[l.k];
      const grain = grainOf(l.k), scatter = ltuned(l.k, 'scatter'), seed = 331 + i * 97;
      let cells = f.cells;
      if (mask && mask.size) cells = cells.filter(c => !mask.has(at(f, c)));
      if (grain !== 'plain' || scatter > 0) cells = cells.filter(c => keep(c, grain, scatter, seed));
      /* Bright past 1 lifts the ink itself toward white, since the alpha
         has nowhere further to go */
      const ink = INKS[inkOf(l.k)] || BONE, k = Math.max(1, lit);
      const fill = ltuned(l.k, 'fill'), ft = foots[l.k];
      let foot = null;
      if (fill > 0 && ft && ft.cells.length){
        let fc = ft.cells;
        if (mask && mask.size) fc = fc.filter(c => !mask.has(at(ft, c)));
        foot = {cols: ft.cols, rows: ft.rows, cells: fc};
      }
      /* the face trimmed to its ink's rows, so the sheen `Title.emit`
         runs down a face spans the drawing and not the box it was cut
         in — a word's face is its line box, and this is the same thing
         for a drawing. `top` is where the ink starts in the box, for
         placing it; `rows0` the box, for centring it. */
      let y0 = Infinity, y1 = -Infinity;
      for (const c of cells){ if (c.y < y0) y0 = c.y; if (c.y > y1) y1 = c.y; }
      const trimmed = cells.map(c => Object.assign({}, c, {y: c.y - y0}));
      list.push({k: l.k, i, shift: !!l.shift, f: {cols: f.cols, rows: y1 - y0 + 1, cells: trimmed}, top: y0, rows0: f.rows,
                 col: ink.map(v => Math.min(1, v * k)), al: Math.min(1, lit), foot, fill});
    });
    comp = list; compKey = key;
    return comp;
  }
  /* the largest cut standing, for the hit box of a drag */
  function hitFace(){
    let b = null;
    for (const l of LAYERS){ const f = facePlates[l.k]; if (f && (!b || f.cols > b.cols)) b = f; }
    return b;
  }
  function overlay(a, m, cap){
    if (!ON_PLATE || !G.terr || !G.A) return m;
    if (typeof Title === 'undefined' || !Title.stencil || !Title.emit) return m;
    if (typeof Interior !== 'undefined' && Interior.inside()) return m;
    /* not while a plate is being founded: the compass is part of the town,
       and there is no town until Generate (Eden, 2026-08-29) */
    if (typeof Found !== 'undefined' && Found.state && Found.state()) return m;
    /* a whole degree is finer than the plate can show at this size, and it
       keeps a shift-drag of the map from cutting a rose a frame */
    const deg = Math.round(((heading() % 360) + 360) % 360);
    wantPlates(deg);
    const list = composed();
    if (!list.length) return m;
    /* the title's own placement: a face's ink is (cols − 1) × (rows − 1)
       cells across from centre to centre, and the pitch is the plate's;
       every cut is centred on the one point, which is what keeps the
       ring round the rose whatever box each was cut in */
    const px = G.A.cell, [cx, cy] = where();
    /* all or nothing against the cap, as a name is: half a compass is
       worse than none, and the cap is shared with the whole town */
    let need = 0;
    for (const e of list) need += Title.cost(e.f) + (e.foot ? e.foot.cells.length : 0);
    if (m + need > cap) return m;
    /* Weight, Tone, Jitter and the ring's nudge are read here rather
       than composed in: they change nothing about which cells stand,
       only how big, how bright and where, so a slider on them costs no
       cut */
    for (const e of list){
      const ox = e.shift ? Math.round(ltuned(e.k, 'dx')) * px : 0, oy = e.shift ? Math.round(ltuned(e.k, 'dy')) * px : 0;
      const w = tuned('weight') * ltuned(e.k, 'weight');
      /* the fill first: the silhouette in the ground's own colour, a
         fifth heavier than the ink so the diamonds close, flat and with
         no sheen — what stood under the layer is put out, and its ink
         goes down on plate */
      if (e.foot){
        const fw = e.foot.cols - 1, fh = e.foot.rows - 1;
        m = Title.emit(a, m, e.foot, cx - fw * px / 2 + ox, cy - fh * px / 2 + oy, px, GROUND, e.fill, cap, 0, 0,
                       {weight: w * 1.2, tone: 0, shade: 0});
      }
      const iw = e.f.cols - 1, ih = e.rows0 - 1;
      const t = {weight: w, tone: Math.min(1, tuned('tone') + ltuned(e.k, 'tone')),
                 shade: Math.min(0.7, tuned('shade') * ltuned(e.k, 'shade'))};
      m = Title.emit(a, m, e.f, cx - iw * px / 2 + ox, cy - ih * px / 2 + e.top * px + oy, px, e.col, e.al, cap,
                     ltuned(e.k, 'jitter') * 0.5, 771 + e.i * 53, t);
    }
    return m;
  }

  /* ── moved by hand ────────────────────────────────────────────────────
     Take the rose on the plate and put it where you like; it stays there
     (Eden, 2026-08-29). The same rule as the title's drag: not paused,
     not inside, not while a picture is pinned; capture-phase on the
     window, and only a press that lands on the rose is taken, so nothing
     under it loses a click. */
  const toWorld = ev => { const b = canvas.getBoundingClientRect(), k = VW / (b.width || 1);
    return [((ev.clientX - b.left) * k - VW / 2) / G.cam[2] + G.cam[0], ((ev.clientY - b.top) * k - VH / 2) / G.cam[2] + G.cam[1]]; };
  function may(){
    if (!ON_PLATE || !G.terr || !hitFace() || G.paused || WALL) return false;
    if (typeof Interior !== 'undefined' && Interior.inside()) return false;
    if (typeof Basemap !== 'undefined' && Basemap.placing && Basemap.placing()) return false;
    if (typeof Found !== 'undefined' && Found.state && Found.state()) return false;
    return true;
  }
  function wireDrag(){
    addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target !== canvas || !may()) return;
      const p = toWorld(e), [cx, cy] = where(), half = hitFace().cols * G.A.cell / 2;
      if (Math.abs(p[0] - cx) > half || Math.abs(p[1] - cy) > half) return;
      drag = {ox: p[0] - cx, oy: p[1] - cy};
      e.stopPropagation(); e.preventDefault();
    }, true);
    addEventListener('pointermove', e => {
      if (!drag) return;
      const p = toWorld(e);
      at = [p[0] - drag.ox, p[1] - drag.oy];
      e.stopPropagation();
    }, true);
    const up = e => { if (!drag) return; drag = null; store(); e.stopPropagation(); };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
  }

  function init(){
    if (typeof COMPASS_ART === 'undefined') return;
    load(); build();
    if (ON_PLATE && el) el.style.display = 'none';
    wireDrag();
    if (!raf) tick();
  }
  return {init, heading, overlay, at: () => where().slice(), dragging: () => !!drag};
})();
