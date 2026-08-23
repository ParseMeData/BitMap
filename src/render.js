'use strict';
/* ── GL renderer ────────────────────────────────────────────────────────
   Every diamond is one instance of a single quad, shaded as a signed
   distance field — so a diamond stays crisp at any zoom and costs no
   texture, no sprite cache, no per-glyph bake.

   The lattice buffer is STATIC. Its breathing (glyph re-rolls, jitter
   drift, size swell) is computed in the vertex shader from a per-cell
   seed, so the CPU touches nothing between frames. Only the handful of
   entity instances are re-uploaded each frame. Three draw calls total. */

const STRIDE_F = 17;                 // floats per instance
const STRIDE_B = STRIDE_F * 4;

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_quad;
layout(location=1) in vec2 a_pos;    // world position
layout(location=2) in vec4 a_col;
layout(location=3) in vec4 a_v0;     // alpha, signed size (sign picks glyph), jitter xy
layout(location=4) in vec4 a_v1;     // the cell's other face
layout(location=5) in vec3 a_meta;   // seed phase, breath rate, mode

uniform vec2  u_res;
uniform vec3  u_cam;    // centre xy, zoom
uniform float u_time;
uniform float u_burst;  // 0..1 recrystallisation sweep
uniform float u_unit;   // world size of one lattice cell
uniform vec2  u_atlas;  // marker atlas, in glyph cells

out vec2  v_uv;
out vec2  v_auv;
out vec4  v_col;
out float v_glyph;

float ease(float t){ return t * t * (3.0 - 2.0 * t); }

void main(){
  float mode  = a_meta.z;
  vec4  s     = a_v0;
  float glyph = a_v0.y < 0.0 ? 1.0 : 0.0;
  vec2  pos   = a_pos;

  if (mode < 0.5){
    /* living lattice: each cell crosses between its two faces on its own
       clock, so the map is never twice the same and never in lockstep */
    float t   = u_time * a_meta.y + a_meta.x * 7.13;
    float f   = ease(fract(t));
    bool  flip = mod(floor(t), 2.0) >= 1.0;
    vec4  A   = flip ? a_v1 : a_v0;
    vec4  B   = flip ? a_v0 : a_v1;
    s     = mix(A, B, f);
    s.y   = mix(abs(A.y), abs(B.y), f);
    glyph = (f < 0.5 ? A.y : B.y) < 0.0 ? 1.0 : 0.0;

    float ph = a_meta.x * 6.2831;
    pos += vec2(sin(u_time * 1.6 + ph), cos(u_time * 1.3 + ph * 1.4)) * u_unit * 0.09;

    if (u_burst > 0.0){
      /* the whole plate blows apart and settles back into itself,
         staggered by seed so it reads as a wave, not a switch */
      float b = clamp(u_burst * 1.75 - a_meta.x * 0.75, 0.0, 1.0);
      float k = sin(3.14159265 * b);
      pos  += vec2(cos(ph * 5.7), sin(ph * 9.1)) * k * u_unit * 9.0;
      s.x  *= 1.0 - 0.5 * k;
      s.y  *= 1.0 + 0.7 * k;
    }
  }

  pos += s.zw;
  float hs = max(s.y * u_unit * 0.75, 0.0) * u_cam.z;
  if (mode > 0.5) hs = abs(s.y) * u_cam.z;      // entities carry a world radius
  vec2 scr = (pos - u_cam.xy) * u_cam.z + u_res * 0.5 + a_quad * hs;

  v_uv    = a_quad;
  v_col   = vec4(a_col.rgb, a_col.a * s.x);
  /* mode 3 is a marker: a quad cut from the glyph atlas, its cell index
     riding in the seed slot, which no marker needs for anything else */
  if (mode > 2.5){
    v_glyph = 3.0;
    vec2 ij = vec2(mod(a_meta.x, u_atlas.x), floor(a_meta.x / u_atlas.x));
    v_auv   = (ij + (a_quad * 0.5 + 0.5)) / u_atlas;
  } else {
    v_glyph = mode > 1.5 ? 2.0 : glyph;
    v_auv   = vec2(0.0);
  }
  gl_Position = vec4(scr.x / u_res.x * 2.0 - 1.0, 1.0 - scr.y / u_res.y * 2.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec2 v_auv;
in vec4 v_col;
in float v_glyph;
uniform sampler2D u_tex;
uniform float u_glow;   // opacity of every halo, from the tune panel
out vec4 outColor;

void main(){
  float d  = abs(v_uv.x) + abs(v_uv.y);
  float aa = fwidth(d) * 0.9 + 0.0025;
  float a;
  if (v_glyph < 0.5)      a = 1.0 - smoothstep(1.0 - aa, 1.0, d);                  // ◆
  else if (v_glyph < 1.5) a = 1.0 - smoothstep(0.16, 0.16 + aa, abs(d - 0.80));    // ◇
  else if (v_glyph < 2.5) a = pow(max(0.0, 1.0 - d), 2.4) * u_glow;                // halo
  else                    a = texture(u_tex, v_auv).a;                             // marker
  a *= v_col.a;
  if (a < 0.004) discard;
  outColor = vec4(v_col.rgb * a, a);   // premultiplied
}`;

function compile(gl, type, src, tag){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(tag + ' shader: ' + (gl.getShaderInfoLog(s) || '(no log)'));
  return s;
}

class Renderer {
  constructor(canvas){
    const gl = this.gl = canvas.getContext('webgl2', {
      /* alpha so the tracing underlay can show through when it is on;
         with it off the plate still clears fully opaque */
      alpha: true, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance', desynchronized: true
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.canvas = canvas;

    /* a plate that lives on the desktop for days will meet a context loss
       eventually — driver reset, GPU process restart, resume. Take the
       offer to restore rather than dying black. */
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.init(); this.lost = false; if (this.onrestored) this.onrestored();
    });
    this.init();
  }

  init(){
    const gl = this.gl, canvas = this.canvas;
    const p = this.prog = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS, 'vertex'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS, 'fragment'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('link: ' + (gl.getProgramInfoLog(p) || '(no log)'));
    gl.useProgram(p);
    this.u = {};
    for (const n of ['u_res', 'u_cam', 'u_time', 'u_burst', 'u_unit', 'u_atlas', 'u_tex', 'u_glow'])
      this.u[n] = gl.getUniformLocation(p, n);
    gl.uniform1i(this.u.u_tex, 0);
    gl.uniform2f(this.u.u_atlas, 1, 1);
    this.tex = null;
    if (this.atlas) this.setAtlas(this.atlas.canvas, this.atlas.cols, this.atlas.rows);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, canvas.width, canvas.height);

    this.batches = {};      // every buffer and VAO died with the old context
  }

  /* the marker glyph sheet, drawn once into a canvas and kept so it can be
     put back if the context is lost */
  setAtlas(canvas, cols, rows){
    const gl = this.gl;
    this.atlas = {canvas, cols, rows};
    if (!this.tex) this.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.u_atlas, cols, rows);
  }

  /* a batch is one instance buffer + its VAO */
  batch(name, data, usage){
    const gl = this.gl;
    let b = this.batches[name];
    if (!b){
      b = this.batches[name] = {vao: gl.createVertexArray(), buf: gl.createBuffer(), n: 0, cap: 0};
      gl.bindVertexArray(b.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
      const at = [[1, 2, 0], [2, 4, 8], [3, 4, 24], [4, 4, 40], [5, 3, 56]];
      for (const [loc, size, off] of at){
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE_B, off);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.bindVertexArray(null);
    }
    if (data && !data.length){
      b.n = 0;                 // an empty plate draws nothing; GL is not asked
    } else if (data){
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
      const n = (data.length / STRIDE_F) | 0;
      if (data.length > b.cap){
        gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
        b.cap = data.length;
      } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      b.n = n;
    }
    return b;
  }

  /* upload only the first `count` instances of a scratch array */
  stream(name, data, count){
    const gl = this.gl, b = this.batch(name, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    const need = count * STRIDE_F;
    if (need > b.cap){
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      b.cap = data.length;
    }
    if (count) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, need);
    b.n = count;
    return b;
  }

  resize(dpr){
    const c = this.canvas;
    const w = Math.max(1, Math.round(c.clientWidth * dpr));
    const h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h){
      c.width = w; c.height = h;
      this.gl.viewport(0, 0, w, h);
    }
    return [w, h];
  }

  begin(w, h, time){
    this.frames = (this.frames || 0) + 1;   // draw counter, for measuring the cap
    const gl = this.gl;
    gl.useProgram(this.prog);
    if (this.tex){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); }
    gl.uniform2f(this.u.u_res, w, h);
    gl.uniform1f(this.u.u_time, time);
    gl.uniform1f(this.u.u_glow, this.glow === undefined ? 1 : this.glow);
    gl.clearColor(0.031, 0.031, 0.043, this.clearA === undefined ? 1 : this.clearA);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  draw(name, cam, unit, burst){
    const b = this.batches[name];
    if (!b || !b.n) return;
    const gl = this.gl;
    gl.uniform3f(this.u.u_cam, cam[0], cam[1], cam[2]);
    gl.uniform1f(this.u.u_unit, unit);
    gl.uniform1f(this.u.u_burst, burst || 0);
    gl.bindVertexArray(b.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, b.n);
  }
}

/* helper used by the game to fill instance slots without allocating */
function put(a, i, x, y, r, g, bl, al, size, glyph, jx, jy, mode, atlas){
  const o = i * STRIDE_F;
  a[o] = x;      a[o + 1] = y;
  a[o + 2] = r;  a[o + 3] = g;  a[o + 4] = bl; a[o + 5] = 1;
  a[o + 6] = al; a[o + 7] = glyph ? -size : size; a[o + 8] = jx || 0; a[o + 9] = jy || 0;
  a[o + 10] = al; a[o + 11] = size; a[o + 12] = 0; a[o + 13] = 0;
  a[o + 14] = atlas || 0;   // marker: which cell of the glyph sheet
  a[o + 15] = 0; a[o + 16] = mode;
  return i + 1;
}
