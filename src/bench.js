'use strict';
/* ── the glyph bench ────────────────────────────────────────────────────
   A plate of its own, off the town, where a print is set at the size it
   will be placed at everywhere, and filed under the group it belongs to
   (Eden, 2026-09-07: "create a plate outside of our gameplay that lets
   me place an asset within a grid so we can set each assets default
   size"; then "give a category tabs so if we place the asset in this
   category … it moves the asset so its saved within that category (if
   there is a tree in the house group we can move it so its saved in
   trees instead of house)").

   It is the same engine on another set of shapes, the way an interior is
   (src/interior.js): the same lattice, the same builder, the same walker.
   Press G and the plate becomes a blank sheet ruled in walk tiles, with
   the builder open and a row of tabs under the banner — one a group:
   Houses, Landmarks, Buildings, Trees … — each its own sheet of shapes
   (`hq.shapes.bench.<set>`), the last one open remembered (`hq.bench.tab`).

   THE SIZES, AND SAVE. Drop a print on a sheet and size it — Shift with
   the arrows, or the Size × slider — then press Save at the end of the
   tabs: every print on the sheet has its size written as its glyph's
   default (`hq.sizes`, glyph name → multiple, in whole and half
   multiples of the glyph's own pixels), its group filed (the sheet), and
   its clearing's proportion kept (`hq.clears`, below). From then on that
   glyph is born at that size wherever it is placed, and choosing it for
   a print already placed takes it too (src/build.js sizeOf). Until Save
   the sheet is a worksheet: what stands on it is kept, but the defaults
   are as they were (Eden, 2026-09-07: "place a save which then applies
   everything within that grid space so the asset size and group
   location and clearing behind is saved"; until 309 the selected print's
   size was written as it changed). A size back at 1× is the default
   again and is not kept.

   THE CLEARING, MATCHED. A print's clearing — the demolish box under it
   (src/build.js clearUnder) — carries the print's seed, and on the
   bench it is kept to the print every frame: centred where the print
   is, and scaled as the print is scaled, so it keeps the proportion it
   had. Its proportion is the one thing about it that is the glyph's:
   select the clearing on the Clearings layer, size it, Save, and
   `hq.clears` keeps width and height as multiples of the print's, which
   clearUnder lays it at from then on. The default is the asset's own
   footprint, 1 × 1 (Eden: "match the clearing to the asset"; it had been
   half again, MATE, since 2026-08-30, and still is where the bench is
   not loaded).

   THE GROUPS. A glyph belongs to the set its sheet was sliced from
   (Glyphs.sets), and that set is the kind whose asset row offers it. On
   the bench the sheet a print stands on is the group its glyph is in:
   every frame, a print on the Trees sheet whose glyph is filed elsewhere
   is moved into trees (`hq.groups`, glyph → set; a glyph back in its own
   set is not kept) and becomes the Trees kind. So a tree that came out
   of the houses sheet is put right by standing it on the Trees sheet —
   drop it there from any group's chips, or select it where it is and
   press the Trees tab, and it is carried across, clearing and all. From
   then on every asset row reads through `Bench.of(set)` rather than the
   sheet's own list (src/build.js variantsOf; the founding's and the demo
   towns' houses too).

   THE LAWN, AND LAYING OUT A GROUP (build 308). Every sheet is grassed
   from edge to edge — a `grass` area the plate's size, laid the moment a
   sheet is opened without one, and laid FIRST, so every clearing on the
   sheet is younger than it and cuts it — so a print is seen on the
   ground it will stand on, its clearing a bare patch in the grass, and
   the clearing can be judged against the asset (Eden, 2026-09-07: "give
   a grass terrain background so we can also align the backdrop"). "Lay
   out all" at the end of the tabs lays the open group whole: the sheet
   is replaced — the lawn, then every glyph the group offers at its own
   size, each with its clearing, flowed in rows a tile apart from the
   top left and stopping at the foot of the plate with a word about how
   many did not fit ("make it so i can fill all the assets within that
   group on the grid"). Nothing is lost by a re-lay: the sizes and the
   groups are records of their own.

   THE GRID. Two rules of dots. The coarse lines, every fourth tile, at a
   dot a cell whatever the zoom; the tile lines in what room the budget
   leaves — a dot a cell close in, every second cell further out, the
   tile corners only with the whole plate on screen. Both across the
   plate and no further. */

const Bench = (() => {
  const SKEY = set => 'hq.shapes.bench.' + set, MKEY = 'hq.markers.bench';
  const ZKEY = 'hq.sizes', GKEY = 'hq.groups', TKEY = 'hq.bench.tab', CKEY = 'hq.clears';
  const BUDGET = 28000;              // dots the grid may spend of the overlay's 32 768 instances: the bench draws little else
  const r2 = v => Math.round(v * 100) / 100;
  let frame = null, cur = null, sizes = null, shown = '', shownTab = null;
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  const on = () => !!frame;
  const isPrint = s => !!(s && typeof Kinds !== 'undefined' && (Kinds.by[s.kind] || {}).glyphs);
  const half = m => Math.max(1, Math.min(4, Math.round((+m || 1) * 2) / 2));

  /* ── the sizes ─────────────────────────────────────────────────────── */
  function table(){
    if (sizes) return sizes;
    const j = Store.json(ZKEY, null);
    sizes = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    return sizes;
  }
  const sizeOf = v => half(table()[v] || 1);
  /* ── the clearings ── */
  let clears = null;
  function clearTable(){
    if (clears) return clears;
    const j = Store.json(CKEY, null);
    clears = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    return clears;
  }
  const kk = v => Math.max(0.5, Math.min(3, isFinite(+v) && +v > 0 ? +v : 1));
  function clearOf(v){
    const c = clearTable()[v];
    return Array.isArray(c) ? [kk(c[0]), kk(c[1])] : [1, 1];
  }
  /* ── save: the sheet's prints, written as the glyphs' defaults ── */
  function save(){
    if (!frame) return false;
    const t = table(), ct = clearTable();
    let n = 0;
    for (const s of G.shapes){
      if (!isPrint(s)) continue;
      const m = half(s.mult);
      if (m === 1) delete t[s.variant]; else t[s.variant] = m;
      const c = clearingOf(s);
      if (c && s.w && s.h){
        const k = [r2(kk(c.w / s.w)), r2(kk(c.h / s.h))];
        if (k[0] === 1 && k[1] === 1) delete ct[s.variant]; else ct[s.variant] = k;
      }
      if (cur && groupOf(s.variant) !== cur) file(s, cur);
      n++;
    }
    Store.save(ZKEY, t, 'the glyph sizes');
    Store.save(CKEY, ct, 'the glyph clearings');
    const k = kindFor(cur);
    note(n ? n + ' saved on ' + (k ? k.label : cur) + ' · sizes, groups and clearings' : 'nothing on this sheet to save');
    return n;
  }

  /* ── the groups ─────────────────────────────────────────────────────── */
  let groups = null, sheet = null;         // not `home`: that is the game's zoom (game.js), and it is wanted below
  function groupTable(){
    if (groups) return groups;
    const j = Store.json(GKEY, null);
    groups = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    return groups;
  }
  /* the set a glyph was sliced into; one in no set is the landmark's */
  function natural(n){
    if (!sheet){
      sheet = {};
      if (typeof Glyphs !== 'undefined') for (const [set, list] of Object.entries(Glyphs.sets || {})) for (const g of list) sheet[g] = set;
    }
    return sheet[n] || 'landmarks';
  }
  const groupOf = n => groupTable()[n] || natural(n);
  /* the glyphs a set offers, as moved */
  function of(set){
    if (typeof Glyphs === 'undefined') return [];
    const g = groupTable();
    const out = (Glyphs.of(set) || []).filter(n => !g[n] || g[n] === set);
    for (const n of Object.keys(g)) if (g[n] === set && !out.includes(n) && Glyphs.has(n)) out.push(n);
    return out;
  }
  /* the groups there are: every kind of the town that offers glyphs, in
     the palette's order — read on the bench, where the town's kinds are
     the ones mounted */
  let SETS = null;
  const kindFor = set => typeof Kinds !== 'undefined' ? Kinds.list.find(k => k.glyphs === set) : null;
  function sets(){
    if (SETS) return SETS;
    if (typeof Kinds === 'undefined' || Kinds.scope() !== 'map') return [];
    SETS = Kinds.list.filter(k => k.glyphs).map(k => ({set: k.glyphs, label: k.label || k.glyphs}));
    return SETS;
  }
  /* a print filed under a set: the record, and the print made that kind */
  function file(s, set){
    const k = kindFor(set); if (!k) return false;
    const g = groupTable();
    if (natural(s.variant) === set) delete g[s.variant]; else g[s.variant] = set;
    Store.save(GKEY, g, 'the glyph groups');
    if (s.kind !== k.id){ s.kind = k.id; if (Build.touch) Build.touch(s); }
    note(s.variant + ' is in ' + (k.label || set) + ' from now on');
    return true;
  }

  /* ── the tabs ─────────────────────────────────────────────────────────
     One a group, under the banner; the lit one is the sheet on the
     plate. Pressed with a print selected, the print goes too. */
  function tabs(){
    const box = $('#benchtabs');
    if (!box || box.childElementCount) return;
    for (const t of sets()){
      const c = document.createElement('div');
      c.className = 'chip'; c.textContent = t.label; c.dataset.set = t.set;
      c.onclick = () => tab(t.set);
      box.appendChild(c);
    }
    const sv = document.createElement('div');
    sv.className = 'chip act'; sv.textContent = 'Save'; sv.title = 'every print on this sheet: its size, its group and its clearing, as the glyph is placed from now on';
    sv.onclick = () => save();
    box.appendChild(sv);
    const f = document.createElement('div');
    f.className = 'chip act'; f.textContent = 'Lay out all'; f.title = 'the whole group on this sheet, each at its size — replaces what is here';
    f.onclick = () => fill();
    box.appendChild(f);
  }
  function lit(){
    const box = $('#benchtabs'); if (!box) return;
    tabs();
    if (cur === shownTab) return;
    shownTab = cur;
    for (const c of box.children) c.classList.toggle('sel', c.dataset.set === cur);
  }
  /* the clearing a print stands on, if it has one: the demolish that
     carries its seed (src/build.js clearUnder, `fill`) — or, for one laid
     before 309, the demolish at its centre */
  const clearingOf = s => G.shapes.find(x => x !== s && x.kind === 'demolish' && x.seed === s.seed) ||
                          G.shapes.find(x => x !== s && x.kind === 'demolish' && Math.abs(x.x - s.x) < 1e-6 && Math.abs(x.y - s.y) < 1e-6);
  /* ── the clearing kept to its print ──────────────────────────────────
     Each frame, one clearing at most is put right (a touch restamps):
     moved to where its print is, and scaled by whatever its print was
     scaled by since last frame, so sizing the print keeps the clearing's
     proportion and sizing the clearing sets a new one. */
  const memo = new Map();
  function follow(){
    for (const s of G.shapes){
      if (!isPrint(s)) continue;
      const c = clearingOf(s); if (!c) continue;
      const m = memo.get(s.id);
      let touched = false;
      if (m && (s.w !== m.sw || s.h !== m.sh) && m.sw && m.sh){
        const fx = s.w / m.sw, fy = s.h / m.sh;
        c.w *= fx; c.h *= fy;
        if (c.blob) for (const p of c.blob){ p[0] *= fx; p[1] *= fy; }
        touched = true;
      }
      /* within half a cell is centred: a touched shape is aligned to its
         own grid (build.js alignFine), a hair off the print's, and an
         exact test would touch it again every frame */
      const tol = (G.A && G.A.cell ? G.A.cell : G.terr.tsz / 4) * 0.5;
      if (Math.abs(c.x - s.x) > tol || Math.abs(c.y - s.y) > tol){ c.x = s.x; c.y = s.y; touched = true; }
      memo.set(s.id, {sw: s.w, sh: s.h, cw: c.w, ch: c.h});
      if (touched){ if (Build.touch) Build.touch(c); return; }
    }
  }
  /* ── the lawn ─────────────────────────────────────────────────────────
     Grass from edge to edge, in strips the plate's width and twelve
     tiles deep: a generator fills at most MAX_CELLS of a shape in a pass
     (src/kinds.js, 26 000), and the plate is ninety thousand cells, so
     one grass the plate's size stopped a third of the way down (seen on
     the rig, build 308). Hard-edged, so the strips abut. */
  function LAWN(){
    const ts = G.terr.tsz, deep = ts * 12, out = [];
    for (let y = 0; y < G.H; y += deep){
      const h = Math.min(deep, G.H - y);
      out.push({kind: 'grass', type: 'rect', x: G.W / 2, y: y + h / 2, w: G.W, h, feather: 0, exact: true});
    }
    return out;
  }
  const grassed = () => G.shapes.reduce((a, s) => a + (s.kind === 'grass' ? s.w * s.h : 0), 0) >= G.W * G.H * 0.9;
  /* a shape as a plain record, for `Build.lay` — never the live shape,
     caches and all (src/build.js add) */
  const plain = s => { const o = {}; for (const k in s) if (k[0] !== '_') o[k] = s[k]; o.exact = true; return o; };
  function lawn(){
    if (!frame || grassed()) return false;
    Build.lay([...LAWN(), ...G.shapes.filter(s => s.kind !== 'grass').map(plain)]);   // under everything: the oldest, so every clearing cuts it
    return true;
  }
  /* ── the group laid out whole ── */
  function fill(){
    if (!frame || !cur) return false;
    const k = kindFor(cur); if (!k) return false;
    const names = of(cur);
    if (!names.length){ note('nothing is filed in ' + (k.label || cur)); return false; }
    const cell = G.A && G.A.cell ? G.A.cell : G.terr.tsz / 4, ts = G.terr.tsz, gap = ts, margin = ts * 2;
    const snap = v => Math.ceil(v / ts) * ts;
    /* every clearing before every print: a modifier weathers only the
       shapes older than itself, so laid this way each clearing cuts the
       lawn and never a neighbouring print it reaches into — a tile of
       air is then enough between prints, whatever their clearings do */
    const clears_ = [], prints = [];
    let x = margin, y = margin, rowH = 0, laid = 0;
    for (const v of names){
      const rows = Glyphs.rows(v); if (!rows || !rows.length) continue;
      const m = sizeOf(v), w = rows[0].length * cell * m, h = rows.length * cell * m;
      if (x + w > G.W - margin && x > margin){ x = margin; y = snap(y + rowH + gap); rowH = 0; }
      if (y + h > G.H - margin) break;
      const cx = x + w / 2, cy = y + h / 2, seed = (Math.random() * 1e6) | 0, [kx, ky] = clearOf(v);
      if (!k.aesthetic)
        clears_.push({kind: 'demolish', type: 'warp', exact: true, seed, x: cx, y: cy, w: w * kx, h: h * ky,
                      fall: 0, out: 1, feather: 3, scatter: 0.7, jitter: 0.4, blob: Build.rectBlob(w * kx, h * ky)});
      prints.push({kind: k.id, type: 'rect', exact: true, seed, x: cx, y: cy, w, h, mult: m, variant: v, tone: 'stone'});
      laid++;
      x = snap(x + w + gap); rowH = Math.max(rowH, h);
    }
    memo.clear();
    Build.lay([...LAWN(), ...clears_, ...prints]);
    if (Build.select) Build.select(null);
    Build.sync();
    note(laid < names.length ? laid + ' of ' + names.length + ' laid out · the rest do not fit at their sizes'
                             : laid + ' laid out on ' + (k.label || cur));
    return laid;
  }
  function tab(set){
    if (!frame || !kindFor(set)) return false;
    if (set === cur) return true;
    const s = typeof Build !== 'undefined' && Build.selected ? Build.selected() : null;
    let carry = null;
    if (s && isPrint(s)){
      carry = {kind: kindFor(set).id, type: 'rect', x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot || 0,
               mult: s.mult || 1, variant: s.variant, tone: s.tone, seed: s.seed, exact: true};
      const c = clearingOf(s);
      if (c && Build.remove) Build.remove(c);
      if (Build.remove) Build.remove(s);
    }
    Build.commit(); Markers.commit();
    cur = set;
    try { Store.set(TKEY, set); } catch (e){}
    Build.mount('map', SKEY(set));
    memo.clear();
    lawn();
    if (carry && Build.add){
      const n = Build.add(carry);
      if (n){
        if (Build.clear) Build.clear(n);
        if (Build.select) Build.select(n);
        file(n, set);
        Build.sync();
      }
    }
    lit();
    return true;
  }

  /* ── in ─────────────────────────────────────────────────────────────
     The frame holds the half of the world that is not in storage, as a
     building's does, and the builder is opened, because the bench is
     for building on and nothing else. */
  function enter(){
    if (frame) return true;
    if (!G.terr) return false;
    if (typeof Interior !== 'undefined' && Interior.inside()){ note('the bench is outside — leave the building first'); return false; }
    if (typeof Region !== 'undefined' && Region.on()) Region.leave();
    Build.commit(); Markers.commit();
    frame = {
      scope: Kinds.scope(), skey: Build.key(), mkey: Markers.key(), blank: BLANK, building: Build.active(),
      x: G.x, y: G.y, cam: G.cam.slice(), camT: G.camT.slice(),
      sparks: G.sparks, got: G.got, total: G.total, round: G.round,
      clock: G.clock, steps: G.steps, over: G.over, msg: G.msg
    };
    Basemap.suspend(true);
    /* the lattice stands still here: the living breathing — every cell
       crossing between its two faces on its own clock — reads as a dark
       blob drifting over a dense asset, and a bench is for seeing the
       asset as drawn (Eden, 2026-09-07: "a strange artifact sitting on
       the assets like a weird moving blob"; render.js u_still) */
    if (typeof R !== 'undefined') R.still = true;
    document.body.classList.add('bench');
    Markers.mount(MKEY);
    Kinds.use('map');
    const list = sets();
    let want = null; try { want = Store.get(TKEY); } catch (e){}
    cur = list.some(t => t.set === want) ? want : (list[0] ? list[0].set : 'buildings');
    Build.mount('map', SKEY(cur));
    setBlank(true, false);
    lawn();
    G.round = 1; G.msg = ''; G.over = false;
    spawn();
    G.total = 12;
    scatterSparks();
    G.camT[2] = home();
    if (typeof Hud !== 'undefined' && Hud.fold) Hud.fold();
    Build.setOn(true);
    shownTab = null;
    banner();
    return true;
  }

  /* ── out ── */
  function leave(){
    if (!frame) return false;
    Build.commit(); Markers.commit();
    const f = frame; frame = null;
    if (typeof R !== 'undefined') R.still = false;
    document.body.classList.remove('bench');
    Markers.mount(f.mkey);
    Build.mount(f.scope, f.skey);
    Build.setOn(!!f.building);
    setBlank(f.blank, false);
    G.x = f.x; G.y = f.y;
    const w = toWorld(G.x, G.y);
    G.fx = G.tx = w[0]; G.fy = G.ty = w[1];
    G.moving = false; G.stepT = 1;
    G.cam = f.cam; G.camT = f.camT;
    G.sparks = f.sparks; G.got = f.got; G.total = f.total; G.round = f.round;
    G.clock = f.clock; G.steps = f.steps; G.over = f.over; G.msg = f.msg;
    revalidate();
    Basemap.suspend(typeof Interior !== 'undefined' && Interior.inside());
    hud(true);
    banner();
    return true;
  }
  const toggle = () => (frame ? leave() : enter());

  /* ── the banner and the tabs, and the selected print in numbers ── */
  function banner(){
    const el = $('#bench'), tb = $('#benchtabs');
    if (el) el.hidden = !frame;
    if (tb) tb.hidden = !frame;
    shown = '';
    caption();
    if (frame) lit();
  }
  function caption(){
    const el = $('#benchnote');
    if (!el || !frame) return;
    const s = typeof Build !== 'undefined' && Build.selected ? Build.selected() : null;
    let t = 'drop a print and size it · that is its size everywhere';
    if (s && isPrint(s) && typeof Glyphs !== 'undefined'){
      const rows = Glyphs.rows(s.variant) || [], m = half(s.mult);
      const cw = rows.length ? rows[0].length * m : 0, ch = rows.length * m;
      const c = clearingOf(s);
      t = s.variant + ' · ' + m + '× · ' + cw + ' × ' + ch + ' cells · ' + (+(cw / 4).toFixed(2)) + ' × ' + (+(ch / 4).toFixed(2)) + ' tiles' +
          (c && s.w && s.h ? ' · clearing ' + r2(c.w / s.w) + ' × ' + r2(c.h / s.h) : '');
    }
    if (t === shown) return;
    shown = t; el.textContent = t;
  }

  /* ── the sheet of tiles, and what is written as it is set ────────────
     The selected print's size; every print's group, which is the sheet
     it stands on. Then the two rules of dots. */
  function overlay(a, m, cap){
    if (!frame || !G.terr || WALL) return m;
    if (cur) for (const x of G.shapes) if (isPrint(x) && groupOf(x.variant) !== cur){ file(x, cur); break; }   // one a frame: `file` restamps
    follow();
    caption(); lit();
    const z = G.cam[2], ts = G.terr.tsz, cell = G.A && G.A.cell ? G.A.cell : ts / 4;
    const hw = VW / (2 * z), hh = VH / (2 * z);
    const vx0 = Math.max(0, G.cam[0] - hw), vy0 = Math.max(0, G.cam[1] - hh);
    const vx1 = Math.min(G.W, G.cam[0] + hw), vy1 = Math.min(G.H, G.cam[1] + hh);
    if (vx1 <= vx0 || vy1 <= vy0) return m;
    const c = [0.52, 0.52, 0.62];
    /* one rule of lines: every `gap` world units, a dot every `pitch` */
    const rule = (gap, pitch, al, r) => {
      for (let y = Math.floor(vy0 / gap) * gap; y <= vy1; y += gap)
        for (let x = Math.floor(vx0 / pitch) * pitch; x <= vx1; x += pitch){
          if (m > cap - 2) return;
          m = put(a, m, x, y, c[0], c[1], c[2], al, r, 0, 0, 0, 1);
        }
      for (let x = Math.floor(vx0 / gap) * gap; x <= vx1; x += gap)
        for (let y = Math.floor(vy0 / pitch) * pitch; y <= vy1; y += pitch){
          if (m > cap - 2) return;
          m = put(a, m, x, y, c[0], c[1], c[2], al, r, 0, 0, 0, 1);
        }
    };
    const dots = (gap, pitch) => ((vy1 - vy0) / gap + 1) * (vx1 - vx0) / pitch + ((vx1 - vx0) / gap + 1) * (vy1 - vy0) / pitch;
    const coarse = ts * 4;
    rule(coarse, cell, 0.6, cell * 0.62);
    let left = BUDGET - dots(coarse, cell), pitch = cell;
    while (pitch < ts && dots(ts, pitch) > left) pitch *= 2;
    if (dots(ts, pitch) <= left) rule(ts, pitch, pitch >= ts ? 0.45 : 0.32, pitch >= ts ? cell * 0.62 : cell * 0.5);
    return m;
  }

  function init(){ table(); groupTable(); clearTable(); banner(); }
  return {init, enter, leave, toggle, on, overlay, sizeOf, clearOf, of, groupOf, tab, fill, save,
          sheet: () => cur, sizes: () => Object.assign({}, table()), groups: () => Object.assign({}, groupTable())};
})();
