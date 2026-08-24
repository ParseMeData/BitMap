'use strict';
/* ── doors that open ────────────────────────────────────────────────────
   A door is shut until somebody comes to it.

   Everything else on the plate is still: a wall is where it was last frame
   and will be there next frame, which is why it lives in one static buffer
   the CPU never touches. A leaf is the exception — it is the one part of a
   floor plan that is supposed to move — so it is drawn per frame in the
   entity stream alongside the walker, and what stays in the plate is only
   the threshold and the two jambs — the parts that are built. No arc is
   drawn (see the end of door() in src/kinds.js): a plan puts the sweep in
   because a plan cannot move, and a quarter-circle standing under a leaf
   that does move is a diagram of a door laid over a door.

   Opening is not a trigger with a state machine behind it. Each door holds
   one number, how open it is, and eases toward whether the walker is close
   enough to be going through — close, not merely nearby: it should give as
   you reach it, the way a door does, rather than anticipating you from
   across the room.

   And it swings AWAY. Which side it opens to is decided at the moment it
   starts to move, from where the walker is standing and which way they are
   heading, so the leaf goes ahead of them and never through them. The same
   door opens the other way when it is met from the other side, which is what
   a door does and what a drawn arc can never show.

   It swings for the look and nothing else: the walk grid was opened when the
   door was cut and stays open. A leaf that could actually stop you would be
   a door you had to learn to operate, in a game about walking a route. */

const Doors = (() => {
  const NEAR = 1.2;                  // tiles from the threshold: how close opens it
  /* ── and how far shuts it ───────────────────────────────────────────────
     Not the same distance. Opening and closing at one radius means a door
     that flutters while you stand at the edge of it, and one that starts
     shutting the moment you are past the jamb — into the back of somebody
     who has not finished walking through. So it opens at the threshold and
     stays open until you are clear of the arc the leaf actually swept, plus
     a few cells, and then waits a second longer in case you turn round. */
  const CLEAR = 3;                   // lattice cells past the end of the swing
  const HOLD = 1.0;                  // seconds of grace once you are clear
  const SPEED = 0.006;               // smaller is faster; this is about a third of a second
  const BONE = [0.93, 0.92, 0.89];

  /* the two ends of a door, and the frame it swings in */
  function frame(s){
    const F = Kinds.geo.flat(s), A = F[0], B = F[F.length - 1];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 1e-6) return null;
    return {A, B, L, ux: dx / L, uy: dy / L, nx: -dy / L, ny: dx / L};
  }

  /* distance from the opening ITSELF, not from its middle — a doorway is a
     stretch of wall, and standing at either end of it is standing in it */
  function reach(f, wx, wy){
    const vx = f.B[0] - f.A[0], vy = f.B[1] - f.A[1];
    const wx0 = wx - f.A[0], wy0 = wy - f.A[1];
    const L2 = vx * vx + vy * vy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, (wx0 * vx + wy0 * vy) / L2)) : 0;
    return Math.hypot(wx0 - vx * t, wy0 - vy * t);
  }
  function wanted(s, f, wx, wy, dt){
    if (s.variant === 'open') return 1;
    const t = G.terr ? G.terr.tsz : 12;
    const cell = G.A ? G.A.cell : t / 4;
    const d = reach(f, wx, wy);
    const arm = s.variant === 'double' ? f.L / 2 : f.L;
    /* Shut, it asks only whether you have reached it. Open, it asks whether
       you have finished with it — which is a different and larger question,
       and the reason the two are not one number. */
    if (!(s._open > 0.02)){
      s._hold = HOLD;
      return d <= NEAR * t ? 1 : 0;
    }
    const clear = d > arm + CLEAR * cell;
    if (!clear){ s._hold = HOLD; return 1; }
    s._hold = Math.max(0, (s._hold === undefined ? HOLD : s._hold) - dt);
    return s._hold > 0 ? 1 : 0;
  }

  /* Which way it goes: away from the walker, and if they are already standing
     in the doorway, the way they are heading. Decided once, as it starts to
     move, and held while it is open — a leaf that flipped sides underneath
     somebody halfway through would be a door swinging through them. */
  function side(s, f, wx, wy){
    const t = G.terr ? G.terr.tsz : 12;
    const cx = (f.A[0] + f.B[0]) / 2, cy = (f.A[1] + f.B[1]) / 2;
    const across = (wx - cx) * f.nx + (wy - cy) * f.ny;
    if (Math.abs(across) > 0.35 * t) return across > 0 ? -1 : 1;
    const face = G.face ? G.face[0] * f.nx + G.face[1] * f.ny : 0;
    if (Math.abs(face) > 1e-6) return face > 0 ? 1 : -1;
    return across > 0 ? -1 : 1;
  }

  /* ── the state, which is one number per door ── */
  function step(dt, wx, wy){
    if (!G.shapes) return;
    const k = 1 - Math.pow(SPEED, Math.min(dt, 0.05));
    for (const s of G.shapes){
      if (s.kind !== 'door') continue;
      const f = frame(s);
      if (!f) continue;
      const want = wanted(s, f, wx, wy, dt);
      if (s._open === undefined) s._open = want;      // a door already stood open
      if (want && s._open < 0.02) s._side = side(s, f, wx, wy);
      if (!s._side) s._side = 1;
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
      const sd = s._side || 1;
      const al = 0.88;

      if (s.variant === 'slide'){
        /* a sliding leaf does not turn, it gets out of the way — parked one
           opening's width along the wall, and offset clear of it */
        const off = f.L * o;
        const px = f.A[0] + f.ux * off + f.nx * (s.width || cell * 2) * 0.7;
        const py = f.A[1] + f.uy * off + f.ny * (s.width || cell * 2) * 0.7;
        m = leaf(a, m, cap, px, py, f.ux, f.uy, f.L, cell, al);
        continue;
      }
      /* 0 is shut — lying along the opening — and 1 is square to it, on the
         side the walker is not */
      const th = o * Math.PI / 2, c = Math.cos(th), n2 = Math.sin(th) * sd;
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
