/* BlütenSturm — the hero petal storm.
   Raw WebGL2, no library. One procedurally built petal (a teardrop, bent
   along its length, cupped across its width) is drawn a few hundred times
   with instancing. A wind field carries the petals: a steady drift from the
   lower left, a slow vortex around the title, cheap curl-like turbulence.
   They tumble, bob, wrap around the scene, flow around the title, scatter
   from the pointer and surge when the visitor scrolls. Exactly one petal is
   pollen yellow; all others are Blütenweiß, lit by one hard key light from
   the upper left and shaded towards grey.

   Respect: nothing happens (no drawing, no console output, canvas empty)
   when prefers-reduced-motion matches, html has class motion-off, WebGL2 is
   missing or a shader fails. The loop pauses while the hero is out of view
   or the tab is hidden. html.storm-on is set only while the storm is active
   (storm.css then hides the three CSS drift petals). fx.js's bs:motion
   event stops and restarts it. Context loss and restore are handled.
   Budget: ≤ 6 ms of JavaScript per frame for 420 petals, no per-frame
   allocations (typed arrays, one buffer upload per frame). */
(function () {
  'use strict';

  var doc = document, html = doc.documentElement;
  if (typeof WebGL2RenderingContext === 'undefined' || !window.requestAnimationFrame) return;
  var canvas = doc.getElementById('storm');
  if (!canvas || !canvas.getContext || !canvas.closest) return;
  var hero = canvas.closest('.hero');
  if (!hero) return;
  var title = hero.querySelector('.hero__title');
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqCoarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;

  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function allowed() { return !reduced() && !html.classList.contains('motion-off'); }

  /* ---------- Tuning (world units: ~155 px per unit at mid depth) ---------- */
  var NMAX = 420;                      // instances allocated; 420 / 260 / 150 are used by width
  var FOV = 40 * Math.PI / 180;        // vertical field of view
  var ZNEAR = -3.2, ZFAR = -15;        // simulation depth range (camera at the origin, looking down -z)
  var FOG0 = 5, FOG1 = 15.5;           // depth fog: starts fading here, black at the far end
  var MARGIN = 1.12, PAD = 0.3;        // wrap box = frustum × MARGIN + PAD, so petals leave the view before wrapping
  var WIND_X = 0.5, WIND_Y = 0.27;     // steady drift, lower left → upper right
  var VORTEX = 0.4, VR = 2.2;          // slow vortex: peak tangential speed, and the radius it peaks at
  var TURB = 0.45, RELAX = 3;          // turbulence gain; how fast a petal's velocity follows the wind
  var EXCL = 0.7;                      // soft exclusion zone around the title
  var GUST = 1.3, GUST_R = 0.22;       // pointer gust gain, radius as a fraction of the canvas width
  var SURGE_TAU = 0.5, GUST_TAU = 0.15; // decay times (s): scroll surge ~gone after 1.5 s, gust after ~0.4 s

  /* ---------- Shaders ---------- */
  var VS = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNrm;',
    'layout(location=2) in vec3 iPos;',
    'layout(location=3) in vec4 iRot;',
    'layout(location=4) in vec3 iExt;',   // scale, shade (0..1), pollen flag
    'uniform mat4 uProj;',
    'uniform vec4 uTitle;',                // title ellipse in clip space: centre xy, semi-axes zw
    'out vec3 vNrm; out vec3 vPos; out vec2 vExt; out float vDim;',
    'vec3 rot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }',
    'void main() {',
    '  vec3 p = rot(iRot, aPos * iExt.x) + iPos;',
    '  vNrm = rot(iRot, aNrm); vPos = p; vExt = iExt.yz;',
    '  gl_Position = uProj * vec4(p, 1.0);',
    '  vec2 e = (gl_Position.xy / gl_Position.w - uTitle.xy) / uTitle.zw;',
    '  vDim = 1.0 - 0.55 * (1.0 - smoothstep(0.3, 1.0, length(e)));',   // petals behind the title fade, so it stays legible
    '}'
  ].join('\n');
  var FS = [
    '#version 300 es',
    'precision mediump float;',
    'in vec3 vNrm; in vec3 vPos; in vec2 vExt; in float vDim;',
    'uniform vec3 uLight; uniform vec2 uFog;',
    'out vec4 outColor;',
    'void main() {',
    '  vec3 n = normalize(vNrm);',
    '  vec3 v = normalize(-vPos);',
    '  float key = abs(dot(n, uLight));',                       // one hard side light; both faces light
    '  float rim = pow(1.0 - abs(dot(n, v)), 3.0);',            // soft rim towards the silhouette
    '  float lit = clamp((0.16 + 0.84 * key) * (1.0 - 0.3 * vExt.x), 0.0, 1.0);',
    '  vec3 light = mix(vec3(0.949, 0.941, 0.922), vec3(0.961, 0.765, 0.118), vExt.y);',   // #F2F0EB / #F5C31E
    '  vec3 dark  = mix(vec3(0.561, 0.549, 0.525), vec3(0.470, 0.350, 0.030), vExt.y);',   // #8F8C86 / dark pollen
    '  vec3 col = mix(dark, light, lit) + rim * 0.18;',
    '  float f = smoothstep(uFog.x, uFog.y, -vPos.z);',          // depth fog to black, alpha fade
    '  col = mix(col, vec3(0.0), f * 0.85);',
    '  float a = (1.0 - f * 0.75) * vDim;',
    '  outColor = vec4(col * a, a);',                            // premultiplied alpha
    '}'
  ].join('\n');

  /* ---------- Petal mesh: a parametric grid, smooth normals ---------- */
  function surface(u, v, out) {
    var hw = 0.375 * Math.pow(Math.sin(Math.PI * u), 0.55) * Math.pow(u, 0.4);  // teardrop half-width
    out[0] = u - 0.5;                                     // along the length
    out[1] = (v - 0.5) * 2 * hw;                          // across the width
    out[2] = 0.16 * Math.sin(Math.PI * u) + 0.42 * (v - 0.5) * (v - 0.5) * hw;  // bent along, cupped across
  }
  function buildMesh(nu, nv) {
    var verts = new Float32Array(nu * nv * 6), index = new Uint16Array((nu - 1) * (nv - 1) * 6);
    var p = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], d = [0, 0, 0], e = 0.002, i, j, k = 0;
    for (i = 0; i < nu; i++) {
      for (j = 0; j < nv; j++) {
        var u = i / (nu - 1), v = j / (nv - 1), un = Math.min(0.99, Math.max(0.01, u));
        surface(u, v, p);
        surface(un + e, v, a); surface(un - e, v, b); surface(un, v + e, c); surface(un, v - e, d);
        var tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2];
        var sx = c[0] - d[0], sy = c[1] - d[1], sz = c[2] - d[2];
        var nx = ty * sz - tz * sy, ny = tz * sx - tx * sz, nz = tx * sy - ty * sx;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        var o = (i * nv + j) * 6;
        verts[o] = p[0]; verts[o + 1] = p[1]; verts[o + 2] = p[2];
        verts[o + 3] = nx / len; verts[o + 4] = ny / len; verts[o + 5] = nz / len;
      }
    }
    for (i = 0; i < nu - 1; i++) {
      for (j = 0; j < nv - 1; j++) {
        var q = i * nv + j;
        index[k++] = q; index[k++] = q + nv; index[k++] = q + 1;
        index[k++] = q + 1; index[k++] = q + nv; index[k++] = q + nv + 1;
      }
    }
    return { verts: verts, index: index, n: index.length };
  }

  /* ---------- State ---------- */
  var mesh = null, gl = null, prog = null, uProj = null, uTitle = null, instBuf = null;
  var proj = new Float32Array(16);
  var pos = new Float32Array(NMAX * 3), vel = new Float32Array(NMAX * 3), quat = new Float32Array(NMAX * 4);
  var axis = new Float32Array(NMAX * 3), spin = new Float32Array(NMAX), scale = new Float32Array(NMAX);
  var shade = new Float32Array(NMAX), bobA = new Float32Array(NMAX), bobF = new Float32Array(NMAX);
  var phase = new Float32Array(NMAX), inst = new Float32Array(NMAX * 10), order = new Uint16Array(NMAX);
  var count = 0, width = 0, height = 0, aspect = 1, sy = Math.tan(FOV / 2), sx = sy;
  var heroTop = 0, heroLeft = 0, tcx = 0, tcy = 0.1, ta = 0.6, tb = 0.3;  // title ellipse in clip space
  var surge = 0, gust = 0, ptrx = 0, ptry = 0, pvx = 0, pvy = 0, pLastT = 0, pLastX = 0, pLastY = 0;
  var lastY = 0, lastT = 0, fade = 1;
  var enabled = false, booted = false, failed = false, lost = false, active = false, running = false;
  var heroVisible = true, tabVisible = !doc.hidden, rafId = 0, lastFrame = 0, time = 0;

  var seed = 0x2F6E2B1;
  function rnd() {   // mulberry32: deterministic, allocation-free
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randomDepth(i) {   // the pollen petal (0) stays in the near, unfogged band
    return i === 0 ? -4 - rnd() * 3 : ZNEAR + (ZFAR - ZNEAR) * rnd();
  }
  function seedPetal(i) {
    var i3 = i * 3, i4 = i * 4, z = randomDepth(i), dz = -z;
    pos[i3] = (rnd() * 2 - 1) * (sx * dz * MARGIN + PAD);
    pos[i3 + 1] = (rnd() * 2 - 1) * (sy * dz * MARGIN + PAD);
    pos[i3 + 2] = z;
    if (i === 0) { pos[i3] = -0.3 * sx * 5.5; pos[i3 + 1] = 0.45 * sy * 5.5; pos[i3 + 2] = -5.5; }   // the spark starts upper left and drifts across
    vel[i3] = WIND_X; vel[i3 + 1] = WIND_Y; vel[i3 + 2] = 0;
    var u1 = rnd(), u2 = rnd() * 6.2832, u3 = rnd() * 6.2832, a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    quat[i4] = a * Math.sin(u2); quat[i4 + 1] = a * Math.cos(u2); quat[i4 + 2] = b * Math.sin(u3); quat[i4 + 3] = b * Math.cos(u3);
    var th = rnd() * 6.2832, ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct);
    axis[i3] = st * Math.cos(th); axis[i3 + 1] = st * Math.sin(th); axis[i3 + 2] = ct;
    spin[i] = 0.5 + rnd() * 1.8;
    scale[i] = i === 0 ? 0.2 : 0.085 + rnd() * 0.11;
    shade[i] = i === 0 ? 0 : rnd();
    bobA[i] = 0.04 + rnd() * 0.1; bobF[i] = 0.6 + rnd() * 1.2; phase[i] = rnd() * 6.2832;
  }

  /* ---------- WebGL ---------- */
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) { gl.deleteShader(s); return null; }
    return s;
  }
  function setupGL() {
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) return false;
    var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) { gl.deleteProgram(p); return false; }
    prog = p;
    gl.useProgram(prog);
    uProj = gl.getUniformLocation(prog, 'uProj');
    uTitle = gl.getUniformLocation(prog, 'uTitle');
    var l = 1 / Math.sqrt(0.62 * 0.62 + 0.62 * 0.62 + 0.48 * 0.48);
    gl.uniform3f(gl.getUniformLocation(prog, 'uLight'), -0.62 * l, 0.62 * l, 0.48 * l);  // upper left, towards the camera
    gl.uniform2f(gl.getUniformLocation(prog, 'uFog'), FOG0, FOG1);
    if (!mesh) mesh = buildMesh(12, 6);
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
    instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 40, 12); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 3, gl.FLOAT, false, 40, 28); gl.vertexAttribDivisor(4, 1);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }
  function perspective(out, fovy, asp, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    for (var i = 0; i < 16; i++) out[i] = 0;
    out[0] = f / asp; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  }
  function clearCanvas() {
    if (gl && !gl.isContextLost()) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /* ---------- Layout ---------- */
  function measureTitle() {
    if (!width) return;
    var hr = hero.getBoundingClientRect();
    heroTop = hr.top + (window.pageYOffset || 0);
    heroLeft = hr.left;
    if (!title || !hr.width || !hr.height) return;
    var tr = title.getBoundingClientRect();
    tcx = ((tr.left + tr.width / 2 - hr.left) / hr.width) * 2 - 1;
    tcy = 1 - ((tr.top + tr.height / 2 - hr.top) / hr.height) * 2;
    ta = Math.max(0.05, tr.width / hr.width * 1.05);
    tb = Math.max(0.05, tr.height / hr.height * 1.3);
    if (gl && prog) gl.uniform4f(uTitle, tcx, tcy, ta, tb);
  }
  function resize() {
    var w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    width = w; height = h; aspect = w / h; sx = sy * aspect;
    var n = w >= 1080 ? 420 : w >= 760 ? 260 : 150;
    if (n !== count) { count = n; for (var i = 0; i < NMAX; i++) order[i] = i; }
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (gl && prog) {
      gl.viewport(0, 0, cw, ch);
      perspective(proj, FOV, aspect, 0.5, 40);
      gl.uniformMatrix4fv(uProj, false, proj);
    }
    measureTitle();
  }

  /* ---------- Input ---------- */
  function onScroll() {
    var y = window.pageYOffset || 0, now = performance.now(), dtm = now - lastT;
    if (lastT && dtm > 8) {
      var s = Math.min(1, Math.abs(y - lastY) / dtm * 1000 / 2200);   // ~2200 px/s = full surge
      if (s > surge) surge = s;
    }
    lastY = y; lastT = now;
    var f = height ? y / height : 0;                                  // fraction of the hero scrolled past
    var op = f <= 0.6 ? 1 : Math.max(0, 1 - (f - 0.6) / 0.4);
    if (op !== fade && (Math.abs(op - fade) > 0.01 || op === 0 || op === 1)) {
      fade = op;
      canvas.style.opacity = op === 1 ? '' : op.toFixed(2);
    }
  }
  function onPointer(e) {
    if (e.pointerType === 'touch' || !width) return;
    var nx = ((e.clientX - heroLeft) / width) * 2 - 1;
    var ny = 1 - ((e.clientY + (window.pageYOffset || 0) - heroTop) / height) * 2;
    var t = e.timeStamp || performance.now();
    if (pLastT) {
      var dx = (nx - pLastX) * 0.5, dy = (ny - pLastY) * 0.5 / aspect;   // in canvas widths
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.0005) {
        var sp = Math.min(3, dist / Math.max(4, t - pLastT) * 1000);       // widths per second
        if (sp > gust) gust = sp;
        pvx = pvx * 0.5 + dx / dist * 0.5; pvy = pvy * 0.5 + dy / dist * 0.5;
      }
    }
    pLastT = t; pLastX = nx; pLastY = ny; ptrx = nx; ptry = ny;
  }
  function onLeave() { gust = 0; pLastT = 0; }

  /* ---------- Simulation ---------- */
  function step(dt, t) {
    surge *= Math.exp(-dt / SURGE_TAU);
    gust *= Math.exp(-dt / GUST_TAU);
    var windMul = 1 + 2.6 * surge, tumbleMul = 1 + 3 * surge;
    var wx = WIND_X * windMul, wy = WIND_Y * windMul, tg = TURB * windMul, vg = VORTEX * windMul;
    var relax = 1 - Math.exp(-dt * RELAX), hdt = 0.5 * dt, zspan = ZNEAR - ZFAR;
    var gustOn = gust > 0.002, gr2 = GUST_R * GUST_R;
    for (var i = 0; i < count; i++) {
      var i3 = i * 3, i4 = i * 4;
      var x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2], dz = -z;
      // wind: drift + vortex + curl of a stream function made of three sines
      var r = Math.sqrt(x * x + y * y) + 1e-4, rn = r / VR, vt = vg * 2 * rn / (1 + rn * rn) / r;
      var p0 = 1.7 * x + 1.1 * y + 0.9 * z + 0.8 * t;
      var p1 = -1.2 * x + 1.9 * y + 0.6 * z - 0.6 * t;
      var p2 = 0.8 * x - 0.7 * y + 1.3 * z + 1.1 * t;
      var c0 = Math.cos(p0), c1 = Math.cos(p1), c2 = Math.cos(p2);
      var tx = wx - y * vt + tg * (0.242 * c0 + 0.304 * c1 - 0.084 * c2);
      var ty = wy + x * vt - tg * (0.374 * c0 - 0.192 * c1 + 0.096 * c2);
      var tz = tg * 0.12 * Math.sin(p2);
      var vx = vel[i3] + (tx - vel[i3]) * relax;
      var vy = vel[i3 + 1] + (ty - vel[i3 + 1]) * relax;
      var vz = vel[i3 + 2] + (tz - vel[i3 + 2]) * relax;
      // screen-space forces: flow around the title, scatter from the pointer
      var nx = x / (sx * dz), ny = y / (sy * dz), boost = 0;
      var ex = (nx - tcx) / ta, ey = (ny - tcy) / tb, e2 = ex * ex + ey * ey;
      if (e2 < 1) {
        var e = 1 - Math.sqrt(e2), gx = ex / ta, gy = ey / tb;
        var k = e * e * EXCL * dz * dt * (1 - 0.5 * (ZNEAR - z) / zspan) / (Math.sqrt(gx * gx + gy * gy) + 1e-4);
        vx += gx * k; vy += gy * k;
      }
      if (gustOn) {
        var px = (nx - ptrx) * 0.5, py = (ny - ptry) * 0.5 / aspect, d2 = px * px + py * py;
        if (d2 < gr2) {
          var d = Math.sqrt(d2), fo = 1 - d / GUST_R, inv = 1 / (d + 0.004);
          fo *= fo;
          var g = fo * gust * GUST * dz * dt;
          vx += (px * inv * 0.65 + pvx * 0.35) * g;
          vy += (py * inv * 0.65 + pvy * 0.35) * g;
          boost = fo * gust * 3;
        }
      }
      x += vx * dt; y += vy * dt; z += vz * dt;
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      // wrap around the box: re-enter on the opposite side at a random depth, same screen position
      if (z > ZNEAR) { z = ZNEAR; vel[i3 + 2] = -Math.abs(vz) * 0.5; } else if (z < ZFAR) { z = ZFAR; vel[i3 + 2] = Math.abs(vz) * 0.5; }
      dz = -z;
      var mg = i ? MARGIN : 1.03, pd = i ? PAD : 0.12;   // the pollen petal re-enters sooner: the spark should rarely be missing
      var hw = sx * dz * mg + pd, hh = sy * dz * mg + pd, nz;
      if (x > hw || x < -hw) {
        nz = randomDepth(i); y *= nz / z; z = nz; dz = -z;
        x = (x > hw ? -1 : 1) * (sx * dz * mg + pd);
      } else if (y > hh || y < -hh) {
        nz = randomDepth(i); x *= nz / z; z = nz; dz = -z;
        y = (y > hh ? -1 : 1) * (sy * dz * mg + pd);
      }
      pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
      // tumble: integrate the quaternion with the angular velocity, then renormalise
      var w = spin[i] * tumbleMul + boost, ox = axis[i3] * w * hdt, oy = axis[i3 + 1] * w * hdt, oz = axis[i3 + 2] * w * hdt;
      var qx = quat[i4], qy = quat[i4 + 1], qz = quat[i4 + 2], qw = quat[i4 + 3];
      var nqw = qw - (ox * qx + oy * qy + oz * qz);
      var nqx = qx + (ox * qw + oy * qz - oz * qy);
      var nqy = qy + (oy * qw + oz * qx - ox * qz);
      var nqz = qz + (oz * qw + ox * qy - oy * qx);
      var qi = 1 / Math.sqrt(nqx * nqx + nqy * nqy + nqz * nqz + nqw * nqw);
      quat[i4] = nqx * qi; quat[i4 + 1] = nqy * qi; quat[i4 + 2] = nqz * qi; quat[i4 + 3] = nqw * qi;
    }
    // back-to-front order (insertion sort: the order barely changes between frames)
    for (var m = 1; m < count; m++) {
      var id = order[m], zz = pos[id * 3 + 2], j = m - 1;
      while (j >= 0 && pos[order[j] * 3 + 2] > zz) { order[j + 1] = order[j]; j--; }
      order[j + 1] = id;
    }
    for (var q = 0; q < count; q++) {
      var n = order[q], n3 = n * 3, n4 = n * 4, o = q * 10;
      inst[o] = pos[n3]; inst[o + 1] = pos[n3 + 1] + bobA[n] * Math.sin(t * bobF[n] + phase[n]); inst[o + 2] = pos[n3 + 2];
      inst[o + 3] = quat[n4]; inst[o + 4] = quat[n4 + 1]; inst[o + 5] = quat[n4 + 2]; inst[o + 6] = quat[n4 + 3];
      inst[o + 7] = scale[n]; inst[o + 8] = shade[n]; inst[o + 9] = n === 0 ? 1 : 0;
    }
  }
  function draw() {
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, count * 10);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElementsInstanced(gl.TRIANGLES, mesh.n, gl.UNSIGNED_SHORT, 0, count);
  }
  function frame(now) {
    rafId = 0;
    if (!running) return;
    rafId = window.requestAnimationFrame(frame);
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now; time += dt;
    step(dt, time);
    draw();
  }

  /* ---------- Lifecycle ---------- */
  function boot() {
    booted = true;
    if (!setupGL()) { failed = true; return; }
    resize();
    for (var i = 0; i < NMAX; i++) seedPetal(i);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
    else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { heroVisible = entries[entries.length - 1].isIntersecting; sync(); }, { threshold: 0 }).observe(hero);
    }
    doc.addEventListener('visibilitychange', function () { tabVisible = !doc.hidden; sync(); });
    window.addEventListener('scroll', onScroll, { passive: true });
    if (!(mqCoarse && mqCoarse.matches)) {
      hero.addEventListener('pointermove', onPointer, { passive: true });
      hero.addEventListener('pointerleave', onLeave, { passive: true });
    }
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; prog = null; sync(); });
    canvas.addEventListener('webglcontextrestored', function () { lost = false; if (setupGL()) resize(); sync(); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measureTitle);
    if ('MutationObserver' in window) new MutationObserver(measureTitle).observe(html, { attributes: true, attributeFilter: ['data-lang'] });
  }
  function sync() {
    if (enabled && !booted) boot();
    var a = enabled && !failed && !lost && !!prog;
    if (a !== active) {
      active = a;
      html.classList.toggle('storm-on', a);
      if (a) resize(); else clearCanvas();
    }
    running = active && heroVisible && tabVisible;
    if (running && !rafId) { lastFrame = 0; rafId = window.requestAnimationFrame(frame); }
    if (!running && rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
  }

  window.addEventListener('bs:motion', function (e) {
    enabled = !!(e && e.detail && e.detail.on) && !reduced();
    sync();
  });
  if (mqReduce) {
    var onReduce = function () { enabled = allowed(); sync(); };
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce);
    else if (mqReduce.addListener) mqReduce.addListener(onReduce);
  }
  function start() { enabled = allowed(); sync(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
