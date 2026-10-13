/* ==========================================================================
   Blüten Sturm — the hero in three dimensions.

   The B from the brand deck is three petals that share one root. Here they
   are three real extruded bodies: on load they fly in and grow together into
   the letter, at rest they breathe and follow the cursor, and as the visitor
   scrolls the letter blooms apart again — the stem, the bloom and the storm
   go their separate ways and a wind of lime petals carries on into the page.

   Everything here is decorative. The copy, the buttons and the static SVG
   fallback live in the markup; this module only paints behind them.
   ========================================================================== */

import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOREST = 0x0F2A1D;
const LIME = 0xD3F543;

/* The exact monogram paths (height 1000, y down). */
const PATHS = [
  'M0 0H223.8C206.3 351.2 173.5 703.2 14.0 1000.0L0 1000Z',
  'M255.6 0H416.7A232.5 232.5 0 0 1 416.7 465L428 463C253.9 614.0 254.2 860.0 42.0 990.0C178.4 694.2 234.2 352.0 255.6 0.0Z',
  'M428 463L465.8 465A267.5 267.5 0 0 1 465.8 1000H32C264.1 898.0 268.9 632.9 449 497Q447 472 428 463Z'
];
const B_W = 733.3, B_H = 1000, DEPTH = 150;

/* Where each petal comes from before it becomes part of the letter, and
   where it goes when the scroll blows the letter apart. Units are in B
   heights; rotations in radians. */
const SCATTER = [
  { pos: [-1.1, -0.5, 0.6], rot: [0.5, -1.2, 0.6] },   // stem: from the lower left
  { pos: [0.7, 0.9, 0.9], rot: [-0.7, 0.9, -0.5] },   // bloom: from the upper right
  { pos: [1.0, -0.8, 0.5], rot: [0.9, 0.6, 0.8] }     // storm: from the lower right
];
const BLOOM = [
  { pos: [-0.55, -0.1, 0.25], rot: [0.1, -0.55, 0.25] },
  { pos: [0.35, 0.45, 0.35], rot: [-0.3, 0.5, -0.15] },
  { pos: [0.6, -0.35, 0.15], rot: [0.35, 0.35, 0.3] }
];

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function petalShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.42, -0.3, 0.42, 0.25, 0, 0.5);
  s.bezierCurveTo(-0.42, 0.25, -0.42, -0.3, 0, -0.5);
  return s;
}

export function mountHero(stage, { reduced = false, external = false, assembled = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  /* A faint environment only for the glossy lime petals; the letter itself is
     a matte sculpture lit by the lamps below, like the brand renders. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 3.4);

  /* lights: a lime-white key from the top left, a cool fill, a lime rim */
  const key = new THREE.DirectionalLight(0xFFFBEA, 2.6);
  key.position.set(-2.5, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xDDEFB0, 0.7);
  fill.position.set(3, -1, 2.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(LIME, 1.4);
  rim.position.set(1.5, 2, -3);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xF2F8DF, 0x0A1D14, 0.9));

  /* ---- the letter ------------------------------------------------------ */
  const forestMat = new THREE.MeshStandardMaterial({ color: 0x123A28, roughness: 0.62, metalness: 0.0 });
  const loader = new SVGLoader();
  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B_W} ${B_H}">${PATHS.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const parsed = loader.parse(svgText);
  const letter = new THREE.Group();
  const petals = [];
  parsed.paths.forEach((path, i) => {
    const shapes = SVGLoader.createShapes(path);
    const geos = shapes.map((shape) => new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH, bevelEnabled: true, bevelThickness: 16, bevelSize: 12, bevelOffset: 0, bevelSegments: 6, curveSegments: 28
    }));
    const pivot = new THREE.Group();
    geos.forEach((g) => {
      g.translate(-B_W / 2, -B_H / 2, -DEPTH / 2);
      g.scale(1 / B_H, 1 / B_H, 1 / B_H);
      /* y down → y up as a rotation, not a mirror: a negative scale would
         invert the triangle winding and cull every front face. */
      g.rotateX(Math.PI);
      const mesh = new THREE.Mesh(g, forestMat);
      pivot.add(mesh);
    });
    letter.add(pivot);
    petals.push(pivot);
  });
  scene.add(letter);

  /* ---- the wind: instanced petals ------------------------------------- */
  const petalGeo = new THREE.ExtrudeGeometry(petalShape(), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
  petalGeo.center();
  const limeMat = new THREE.MeshPhysicalMaterial({ color: 0xC4E83A, emissive: 0x6F9010, emissiveIntensity: 0.4, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, envMap: envTex, envMapIntensity: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x123A28, roughness: 0.65 });
  const N_LIME = 56, N_DARK = 14;
  const wind = [];
  const makeField = (count, mat) => {
    const m = new THREE.InstancedMesh(petalGeo, mat, count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) {
      wind.push({
        mesh: m, idx: i,
        x: (Math.random() - 0.5) * 4.2, y: (Math.random() - 0.5) * 2.8, z: -1.2 + Math.random() * 2.2,
        vx: 0.12 + Math.random() * 0.22, vy: 0.05 + Math.random() * 0.12,
        rx: Math.random() * 6.28, ry: Math.random() * 6.28, rz: Math.random() * 6.28,
        sx: (Math.random() - 0.5) * 1.6, sy: (Math.random() - 0.5) * 1.6,
        s: 0.05 + Math.random() * 0.075, ph: Math.random() * 6.28
      });
    }
    scene.add(m);
    return m;
  };
  const fieldLime = makeField(N_LIME, limeMat);
  const fieldDark = makeField(N_DARK, darkMat);
  const dummy = new THREE.Object3D();

  /* ---- layout ----------------------------------------------------------- */
  let W = 1, H = 1, narrow = false;
  let letterScale = 1, letterX = 0.9, letterY = 0;
  const copyEl = (stage.closest('[data-hero]') || document).querySelector('.hero__copy');
  function layout() {
    W = stage.clientWidth || window.innerWidth;
    H = stage.clientHeight || window.innerHeight;
    /* cap the backing store at about three million pixels */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(3e6 / Math.max(1, W * H))));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const vw = vh * camera.aspect;
    const pxToWorld = vh / H;
    narrow = W < 720;
    if (W / H < 0.9) {
      /* Portrait (phones, upright tablets): there is no room beside the
         copy, so the letter grows up from the bottom edge underneath it,
         cropped by the screen like the phone layout in the brand deck. */
      let copyBottom = H * 0.6;
      if (copyEl) {
        /* the layout box, not the painted one: the copy may be mid-entrance or
           already stepping back on the runway, and both move it by transform */
        copyBottom = copyEl.offsetTop + copyEl.offsetHeight - stage.offsetTop;
      }
      const room = Math.max(H - copyBottom - 28, H * 0.16) * pxToWorld;   // free height below the copy
      letterScale = Math.min(room * 1.45, vw * 0.78 / 0.733, vh * 0.62);
      const top = vh / 2 - (copyBottom + 28) * pxToWorld;
      letterY = top - letterScale / 2;
      letterX = vw / 2 - (0.733 * letterScale) / 2 - vw * 0.05;
    } else if (W < 1100) {
      letterScale = vh * 0.82;
      letterX = vw * 0.3;
      letterY = -vh * 0.06;
    } else {
      /* top edge of the letter sits just under the header, like the deck */
      letterScale = vh * 0.9;
      letterX = vw * 0.24;
      letterY = -vh * 0.09;
    }
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  if (copyEl) ro.observe(copyEl);   // a language switch changes the copy height

  /* ---- interaction ------------------------------------------------------ */
  let tx = 0, ty = 0, mx = 0, my = 0;
  const onPointer = (e) => {
    tx = (e.clientX / window.innerWidth - 0.5);
    ty = (e.clientY / window.innerHeight - 0.5);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let scrollP = 0;
  const hero = stage.closest('[data-hero]') || stage.parentElement;
  /* On the home page the runway drives the bloom through setProgress();
     anywhere else the letter follows the page scroll on its own. */
  const onScroll = () => {
    if (external) return;
    const h = Math.max(hero.offsetHeight, 1);
    scrollP = clamp((window.scrollY || 0) / (h * 0.85), 0, 1);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* only paint while the hero is on screen */
  let visible = true, hidden = document.hidden;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 });
  io.observe(stage);
  const onVis = () => { hidden = document.hidden; if (!hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  /* ---- animation -------------------------------------------------------- */
  const t0 = performance.now();
  let raf = 0, last = t0;
  const ASSEMBLE_MS = (reduced || assembled) ? 1 : 1700, STAGGER_MS = (reduced || assembled) ? 0 : 160;

  function frame(now) {
    raf = 0;
    if (!visible || hidden || paused) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    mx += (tx - mx) * 0.045;
    my += (ty - my) * 0.045;
    const p = easeInOut(external ? clamp(scrollP / 0.55, 0, 1) : scrollP);

    /* the letter as a whole */
    /* on the runway the letter recedes as it opens, leaving the stage to
       the eighteen petals */
    letter.scale.setScalar(letterScale * (external ? 1 - 0.38 * p : 1));
    const lx = external ? lerp(letterX, letterX * 0.55, p) : letterX + p * 0.35 * letterScale;
    letter.position.set(lx, letterY + Math.sin(t * 0.7) * 0.012 * letterScale + p * 0.18 * letterScale, 0);
    letter.rotation.set(
      -my * 0.16 + Math.sin(t * 0.42) * 0.025 + p * 0.18,
      mx * 0.32 + Math.sin(t * 0.31) * 0.05 - 0.14 + p * 0.55,
      Math.sin(t * 0.26) * 0.012 - p * 0.08
    );

    /* the three petals: assemble on load, bloom apart on scroll */
    petals.forEach((pivot, i) => {
      const a = easeOutQuint(clamp((now - t0 - i * STAGGER_MS) / ASSEMBLE_MS, 0, 1));
      const sc = SCATTER[i], bl = BLOOM[i];
      const px = lerp(sc.pos[0], 0, a) + bl.pos[0] * p;
      const py = lerp(sc.pos[1], 0, a) + bl.pos[1] * p;
      const pz = lerp(sc.pos[2], 0, a) + bl.pos[2] * p;
      pivot.position.set(px, py, pz);
      pivot.rotation.set(
        lerp(sc.rot[0], 0, a) + bl.rot[0] * p + Math.sin(t * 0.9 + i) * 0.01 * p,
        lerp(sc.rot[1], 0, a) + bl.rot[1] * p,
        lerp(sc.rot[2], 0, a) + bl.rot[2] * p
      );
    });
    forestMat.opacity = 1;

    /* the wind */
    const gust = 1 + p * 2.2;
    for (const w of wind) {
      w.x += w.vx * dt * gust;
      w.y += (w.vy + Math.sin(t * 0.8 + w.ph) * 0.08) * dt * gust;
      w.rx += w.sx * dt; w.ry += w.sy * dt; w.rz += 0.3 * dt;
      if (w.x > 2.6) { w.x = -2.6; w.y = (Math.random() - 0.5) * 2.8; }
      if (w.y > 1.7) { w.y = -1.7; }
      dummy.position.set(w.x + mx * 0.08 * w.z, w.y - my * 0.05 * w.z - p * 0.4, w.z);
      dummy.rotation.set(w.rx, w.ry, w.rz);
      dummy.scale.setScalar(w.s * (narrow ? 0.8 : 1));
      dummy.updateMatrix();
      w.mesh.setMatrixAt(w.idx, dummy.matrix);
    }
    fieldLime.instanceMatrix.needsUpdate = true;
    fieldDark.instanceMatrix.needsUpdate = true;

    camera.position.x = mx * 0.12;
    camera.position.y = -my * 0.08;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  let paused = false;
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  kick();

  return {
    /* 0..1 along the home page runway */
    setProgress(v) { external = true; scrollP = clamp(v, 0, 1); kick(); },
    /* nothing to paint behind a modal */
    pause() { paused = true; },
    resume() { if (paused) { paused = false; kick(); } },
    /* where the letter's centre sits on screen, in stage pixels */
    anchor() {
      /* before the first frame the camera's world matrix is still identity */
      camera.updateMatrixWorld();
      const v = new THREE.Vector3(letterX, letterY, 0).project(camera);
      return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      petals.forEach((pv) => pv.children.forEach((m) => m.geometry.dispose()));
      petalGeo.dispose(); forestMat.dispose(); limeMat.dispose(); darkMat.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
}
