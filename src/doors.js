'use strict';
/* ── doors that open ────────────────────────────────────────────────────
   A door is shut until somebody comes to it.

   Everything else on the plate is still: a wall is where it was last frame
   and will be there next frame, which is why it lives in one static buffer
   the CPU never touches. A leaf is the exception — it is the one part of a
   floor plan that is supposed to move — so it is drawn per frame in the
   entity stream alongside the walker, and what stays in the plate is the arc
   it travels through. A drawing shows the sweep; the door does the swinging.

   Opening is not a trigger with a state machine behind it. Each door holds
   one number, how open it is, and eases toward whether the walker is near
   enough to be coming through. So it is already moving before you arrive and
   still settling as you leave, which is what makes it read as a door rather
   than as a sprite with two frames.

   It swings for the look and nothing else: the walk grid was opened when the
   door was cut and stays open. A leaf that could actually stop you would be
   a door you had to learn to operate, in a game about walking a route. */

const Doors = (() => {
  const NEAR = 1.0;                  // tiles of reach past the leaf's own arc
  const SPEED = 0.006;               // smaller is faster; this is about a third of a second
  const BONE = [0.93, 0.92, 0.89];

  /* the two ends of a door, and the frame it swings in */
  function frame(s){
    const F = Kinds.geo.flat(s), A = F[0], B = F[F.length - 1];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 1e-6) return null;
    return {A, B, L, ux: dx / L, uy: dy / L, nx: -dy / L, ny: dx / L};
  }

  /* How far along it should be. Distance from the middle of the opening,
     because a door is answered by somebody approaching the doorway rather
     than by somebody standing on the hinge. */
  function wanted(s, f, wx, wy){
    if (s.variant === 'open') return 1;
    const t = G.terr ? G.terr.tsz : 12;
    const arm = s.variant === 'double' ? f.L / 2 : f.L;
    const cx = (f.A[0] + f.B[0]) / 2, cy = (f.A[1] + f.B[1]) / 2;
    return Math.hypot(wx - cx, wy - cy) <= arm + NEAR * t ? 1 : 0;
  }

  /* ── the state, which is one number per door ── */
  function step(dt, wx, wy){
    if (!G.shapes) return;
    const k = 1 - Math.pow(SPEED, Math.min(dt, 0.05));
    for (const s of G.shapes){
      if (s.kind !== 'door') continue;
      const f = frame(s);
      if (!f) continue;
      const want = wanted(s, f, wx, wy);
      if (s._open === undefined) s._open = want;      // a door already stood open
      s._open += (want - s._open) * k;
      if (Math.abs(want - s._open) < 0.002) s._open = want;
    }
  }

  /* one leaf: a run of diamonds from the hinge, at whatever angle it is at */
  function leaf(a, m, cap, hx, hy, dx, dy, arm, cell, al){
    const n = Math.max(3, Math.round(arm / cell));
    for (let i = 1; i <= n; i++){
      if (m > cap - 2) return m;
      const p = (i / n) * arm;
      m = put(a, m, hx + dx * p, hy + dy * p,
              BONE[0], BONE[1], BONE[2], al, cell * 0.44, 0, 0, 0, 1);
    }
    return m;
  }

  function draw(a, m, cap){
    if (!G.shapes || !G.A || WALL) return m;
    const cell = G.A.cell;
    for (const s of G.shapes){
      if (s.kind !== 'door' || s.variant === 'open' || m > cap - 40) continue;
      const f = frame(s);
      if (!f) continue;
      const o = s._open === undefined ? 0 : s._open;
      /* wide open is nothing to draw: the leaf is flat against the wall it
         opened into and reads as part of it */
      const al = 0.92 - 0.35 * o;

      if (s.variant === 'slide'){
        /* a sliding leaf does not turn, it gets out of the way — parked one
           opening's width along the wall, and offset clear of it */
        const off = f.L * o;
        const px = f.A[0] + f.ux * off + f.nx * (s.width || cell * 2) * 0.7;
        const py = f.A[1] + f.uy * off + f.ny * (s.width || cell * 2) * 0.7;
        m = leaf(a, m, cap, px, py, f.ux, f.uy, f.L, cell, al);
        continue;
      }
      /* 0 is shut — lying along the opening — and 1 is square to it */
      const th = o * Math.PI / 2, c = Math.cos(th), n2 = Math.sin(th);
      if (s.variant === 'double'){
        const arm = f.L / 2;
        m = leaf(a, m, cap, f.A[0], f.A[1],
                 f.ux * c + f.nx * n2, f.uy * c + f.ny * n2, arm, cell, al);
        m = leaf(a, m, cap, f.B[0], f.B[1],
                 -f.ux * c + f.nx * n2, -f.uy * c + f.ny * n2, arm, cell, al);
      } else {
        m = leaf(a, m, cap, f.A[0], f.A[1],
                 f.ux * c + f.nx * n2, f.uy * c + f.ny * n2, f.L, cell, al);
      }
    }
    return m;
  }

  return {step, draw};
})();
