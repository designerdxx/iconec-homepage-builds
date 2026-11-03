/* Iconec · 3D knot ring (three.js r128)
   [data-ring3d] wraps a fallback <img>; when WebGL works the photo is swapped for a live, transparent canvas.
   Scroll drives the ring: as its section passes through the window it turns about 1.6 times and tips from
   a top view to a face view, while [data-ring-parallax] layers drift at their own speed (parallax).
   Motion follows the 12 principles: the ring eases toward its scroll target every frame (follow-through and
   slow-in/slow-out instead of a hard lock to the scrollbar), only transform changes on the page, and under
   reduced motion it renders once, still, at a three-quarter angle. Renders only while on screen. */
(function () {
  var host = document.querySelector('[data-ring3d]');
  if (!host || !window.THREE) return;
  var T = window.THREE;
  var reduce = window.iconecReduce ? window.iconecReduce() : false;

  var canvas = document.createElement('canvas');
  var renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  if (!renderer.getContext()) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.4);
  camera.lookAt(0, 0.08, 0);

  /* studio reflections: a dark room with soft-box panels, baked into a prefiltered environment map */
  (function () {
    var env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(20, 20, 20), new T.MeshBasicMaterial({ color: 0x26251f, side: T.BackSide })));
    function panel(w, h, x, y, z, k, tint) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(tint || 0xffffff).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(12, 4, 0, 8, 2, 4);            // top strip
    panel(4, 9, -8, 1, 3, 3);            // key, left
    panel(5, 5, 4, 2, 8, 1.6, 0xfff4e4); // soft front fill
    panel(2, 7, 8, 0, -2, 2.4, 0xfff1dc);// warm rim, right
    panel(6, 2, 0, -7, 5, 1.2);          // floor bounce
    panel(1.2, 1.2, 3, 3, 8, 8);         // small hot spot for sparkle
    panel(1, 4, -4, -2, -8, 2.2);
    panel(0.6, 0.6, -3, 4, 7, 10);       // extra pin lights for diamond fire
    panel(0.5, 0.5, 5, -1, 6, 10);
    panel(0.5, 0.5, -6, -3, 4, 8);
    panel(14, 0.25, 0, 2, -9, 4);        // a long line light for crisp metal edges
    var pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  })();

  var gold = new T.MeshStandardMaterial({ color: new T.Color(1.0, 0.74, 0.36), metalness: 1, roughness: 0.16 });
  var stone = new T.MeshStandardMaterial({ color: 0xf6f8fc, metalness: 1, roughness: 0.0, flatShading: true, envMapIntensity: 2.6 });

  var ring = new T.Group();
  var R = 1, r = 0.058, TW = 3; // band radius, strand offset, twists around the band

  /* two strands twisting around each other: the "knot" band */
  function strand(phase) {
    class Path extends T.Curve {
      getPoint(u, out) {
        var t = u * Math.PI * 2, a = TW * t + phase, rad = R + r * Math.cos(a);
        return (out || new T.Vector3()).set(Math.cos(t) * rad, Math.sin(t) * rad, r * Math.sin(a));
      }
    }
    return new T.Mesh(new T.TubeGeometry(new Path(), 420, 0.074, 24, true), gold);
  }
  ring.add(strand(0), strand(Math.PI));

  /* pavé along the outer face of one strand, leaving the crown clear for the centre stone */
  var small = new T.OctahedronGeometry(0.04, 0);
  var pave = [];
  for (var i = 0; i < 46; i++) {
    var t = (i / 46) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(t - Math.PI / 2), Math.cos(t - Math.PI / 2))) < 0.42) continue;
    var a = TW * t, rad = R + r * Math.cos(a) + 0.07;
    pave.push([Math.cos(t) * rad, Math.sin(t) * rad, r * Math.sin(a), t]);
  }
  var inst = new T.InstancedMesh(small, stone, pave.length), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  pave.forEach(function (p, k) {
    e.set(0, 0, p[3] - Math.PI / 2); q.setFromEuler(e);
    m4.compose(new T.Vector3(p[0], p[1], p[2]), q, new T.Vector3(1, 0.55, 1));
    inst.setMatrixAt(k, m4);
  });
  ring.add(inst);

  /* centre stone: a round brilliant in a gold halo with tiny stones, sitting on the crown */
  var brill = new T.LatheGeometry([
    new T.Vector2(0.0001, -0.19), new T.Vector2(0.2, -0.012), new T.Vector2(0.205, 0.0),
    new T.Vector2(0.205, 0.012), new T.Vector2(0.15, 0.075), new T.Vector2(0.105, 0.105), new T.Vector2(0.0001, 0.105)
  ], 16);
  var gem = new T.Mesh(brill, stone);
  var head = new T.Group();
  head.add(gem);
  var halo = new T.Mesh(new T.TorusGeometry(0.235, 0.028, 12, 48), gold);
  halo.rotation.x = Math.PI / 2; halo.position.y = -0.005; head.add(halo);
  for (var h = 0; h < 18; h++) {
    var ang = (h / 18) * Math.PI * 2, s = new T.Mesh(small, stone);
    s.scale.setScalar(0.8); s.position.set(Math.cos(ang) * 0.235, 0.03, Math.sin(ang) * 0.235); head.add(s);
  }
  [0, 1, 2, 3].forEach(function (k) { // four prongs
    var ang = Math.PI / 4 + k * Math.PI / 2, pr = new T.Mesh(new T.CylinderGeometry(0.014, 0.02, 0.2, 8), gold);
    pr.position.set(Math.cos(ang) * 0.19, -0.03, Math.sin(ang) * 0.19); pr.rotation.z = Math.cos(ang) * 0.25; pr.rotation.x = -Math.sin(ang) * 0.25; head.add(pr);
  });
  var basket = new T.Mesh(new T.CylinderGeometry(0.12, 0.05, 0.16, 16, 1, true), gold);
  basket.position.y = -0.13; head.add(basket);
  head.scale.setScalar(1.4);
  head.position.set(0, R + 0.28, 0);
  ring.add(head);

  var pivot = new T.Group();
  pivot.add(ring);
  ring.position.y = -0.12;
  scene.add(pivot);

  /* swap the photo for the canvas */
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  host.classList.add('is-3d');

  var box = host.closest('section') || host.parentElement;
  var layers = [].slice.call(document.querySelectorAll('[data-ring-parallax]')).map(function (el) { return { el: el, f: parseFloat(el.getAttribute('data-ring-parallax')) || 0 }; });

  function size() {
    var w = host.clientWidth, hgt = host.clientHeight;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt; camera.updateProjectionMatrix();
  }
  size();

  /* pose from scroll progress p (0 = section entering at the bottom, 1 = leaving at the top) */
  function target(p) {
    return { ry: 0.35 + (p - 0.5) * Math.PI * 2.4, rx: 0.6 - p * 0.75, rz: -0.12 + p * 0.18, y: (0.5 - p) * 0.3 };
  }
  function progress() {
    var b = box.getBoundingClientRect(), vh = window.innerHeight;
    return Math.max(0, Math.min(1, (vh - b.top) / (vh + b.height)));
  }
  function apply(s) {
    pivot.rotation.set(s.rx, s.ry, s.rz);
    pivot.position.y = s.y;
  }

  if (reduce) {
    apply({ ry: 0.55, rx: 0.4, rz: -0.05, y: 0 });
    renderer.render(scene, camera);
    window.addEventListener('resize', function () { size(); renderer.render(scene, camera); });
    return;
  }

  var cur = target(progress()), visible = false, raf = 0;
  apply(cur);
  function tick() {
    raf = 0;
    if (!visible) return;
    var p = progress(), tg = target(p), k = 0.09; // ease toward the scroll target: settles in ~400ms
    for (var key in tg) cur[key] += (tg[key] - cur[key]) * k;
    apply(cur);
    layers.forEach(function (l) { l.el.style.setProperty('--py', ((p - 0.5) * l.f).toFixed(1) + 'px'); });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf) raf = requestAnimationFrame(tick); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }, { rootMargin: '120px 0px' }).observe(box);
  } else { visible = true; start(); }
  window.addEventListener('resize', function () { size(); start(); });
  renderer.render(scene, camera);
})();
