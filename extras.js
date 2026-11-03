/* Iconec website build · extras on top of motion.js
   data-carousel > [data-track] + [data-prev] + [data-next]   step one card per press, 300ms ease-out; touch keeps native swipe + snap
   data-dive="1.18"          image scales from that value to 1 as its section scrolls through (scroll-linked, transform only)
   data-scrub-fade="0.3"     fades and lifts in once its section is that far through the viewport (scroll-linked, opacity + transform)
   data-ink                  words light up one after another as the paragraph scrolls past (opacity only)
   form[data-validate]       email check on submit: error fades in 200ms ease-out, success replaces the form
   data-zoom-scene > .zoom-stage > .zoom-layer (+ [data-zoom-target], [data-zoom-fade], .z1, .z2)
                             desktop only: the stage pins, scroll slides the target to centre and scales it to fill the screen
                             (ease-in-out over the scroll), then two lines take turns; html.zoom-on switches the CSS on
   data-drift="0.05"         element drifts against the scroll at that rate (columns moving at different speeds)
   All of it is skipped under the system's reduced-motion setting (everything shows in its final state). */
(function () {
  var reduce = window.iconecReduce ? window.iconecReduce() : false;
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    /* carousels */
    document.querySelectorAll('[data-carousel]').forEach(function (root) {
      var track = root.querySelector('[data-track]');
      var prev = root.querySelector('[data-prev]'), next = root.querySelector('[data-next]');
      if (!track || !prev || !next) return;
      var raf = 0;
      function stepSize() {
        var c = track.children[0];
        if (!c) return 0;
        var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return c.getBoundingClientRect().width + gap;
      }
      function update() {
        var max = track.scrollWidth - track.clientWidth - 2;
        prev.setAttribute('aria-disabled', track.scrollLeft <= 2 ? 'true' : 'false');
        next.setAttribute('aria-disabled', track.scrollLeft >= max ? 'true' : 'false');
      }
      function go(dir) {
        var max = track.scrollWidth - track.clientWidth;
        var from = track.scrollLeft, to = Math.max(0, Math.min(max, from + dir * stepSize()));
        if (to === from) return;
        cancelAnimationFrame(raf);
        if (reduce) { track.scrollLeft = to; update(); return; }
        var t0 = performance.now(), dur = 300;
        track.classList.add('gliding');
        (function f(t) {
          var p = Math.min(1, (t - t0) / dur);
          track.scrollLeft = from + (to - from) * easeOut(p);
          if (p < 1) raf = requestAnimationFrame(f);
          else { track.classList.remove('gliding'); update(); }
        })(t0);
      }
      prev.addEventListener('click', function () { go(-1); });
      next.addEventListener('click', function () { go(1); });
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    });

    /* word-by-word ink: split once, keep the sentence readable for assistive tech */
    var inks = [].slice.call(document.querySelectorAll('[data-ink]')).map(function (el) {
      var text = el.textContent.replace(/\s+/g, ' ').trim();
      el.setAttribute('aria-label', text);
      el.textContent = '';
      var spans = text.split(' ').map(function (w, i, a) {
        var s = document.createElement('span');
        s.className = 'ink-w';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = w + (i < a.length - 1 ? ' ' : '');
        el.appendChild(s);
        return s;
      });
      return { el: el, spans: spans, last: [] };
    });

    var dives = [].slice.call(document.querySelectorAll('[data-dive]')).map(function (el) {
      return { el: el, from: parseFloat(el.getAttribute('data-dive')) || 1.18, box: el.closest('section') || el.parentElement };
    });
    var fades = [].slice.call(document.querySelectorAll('[data-scrub-fade]')).map(function (el) {
      return { el: el, at: parseFloat(el.getAttribute('data-scrub-fade')) || 0.3, box: el.closest('section') || el.parentElement };
    });

    /* move-and-zoom scenes: the stage pins while the layer slides its target to the centre and scales it to fill */
    var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var mqZoom = window.matchMedia ? window.matchMedia('(min-width: 861px)') : { matches: true };
    var scenes = [].slice.call(document.querySelectorAll('[data-zoom-scene]')).map(function (sc) {
      return { sc: sc, stage: sc.querySelector('.zoom-stage'), layer: sc.querySelector('.zoom-layer'), target: sc.querySelector('[data-zoom-target]'),
               fades: [].slice.call(sc.querySelectorAll('[data-zoom-fade]')), l1: sc.querySelector('.z1'), l2: sc.querySelector('.z2'), geo: null };
    }).filter(function (z) { return z.stage && z.layer && z.target; });
    function zoomActive() { return !reduce && mqZoom.matches && scenes.length > 0; }
    function measureZoom() {
      scenes.forEach(function (z) {
        z.layer.style.transform = '';
        var lr = z.layer.getBoundingClientRect(), tr = z.target.getBoundingClientRect(), sr = z.stage.getBoundingClientRect();
        z.geo = {
          cx: tr.left - lr.left + tr.width / 2, cy: tr.top - lr.top + tr.height / 2,
          tx: (sr.left + sr.width / 2) - (tr.left + tr.width / 2), ty: (sr.top + sr.height / 2) - (tr.top + tr.height / 2),
          s: Math.max(sr.width / tr.width, sr.height / tr.height) * 1.04
        };
        z.layer.style.transformOrigin = z.geo.cx.toFixed(1) + 'px ' + z.geo.cy.toFixed(1) + 'px';
      });
    }
    function setZoomMode() {
      var on = zoomActive();
      document.documentElement.classList.toggle('zoom-on', on);
      scenes.forEach(function (z) {
        if (!on) { z.layer.style.transform = ''; z.layer.style.transformOrigin = ''; z.fades.forEach(function (f) { f.style.opacity = ''; }); }
      });
      if (on) measureZoom();
    }
    setZoomMode();
    if (mqZoom.addEventListener) mqZoom.addEventListener('change', function () { setZoomMode(); tick(); });
    window.addEventListener('resize', function () { if (zoomActive()) measureZoom(); });
    window.addEventListener('load', function () { if (zoomActive()) { measureZoom(); tick(); } });
    var bell = function (p, a, b, edge) { return Math.min(clamp((p - a) / edge), 1 - clamp((p - b) / edge)); };

    /* augen.pro-style focus pulls: rows that brighten as they reach the reading line, a giant word that sharpens,
       a hero that recedes as the next sheet slides over it, and a pill nav that takes the theme of the section under it */
    var brightens = [].slice.call(document.querySelectorAll('[data-brighten] > *'));
    var focusScrubs = [].slice.call(document.querySelectorAll('[data-focus-scrub]')).map(function (el) {
      return { el: el, max: parseFloat(el.getAttribute('data-focus-scrub')) || 12, box: el.closest('section') || el.parentElement };
    });
    var recedes = [].slice.call(document.querySelectorAll('[data-recede]'));
    var pill = document.querySelector('[data-pill]');
    var darkSecs = [].slice.call(document.querySelectorAll('[data-theme="dark"]'));

    /* columns that drift against the scroll at their own speed (shopify.design-style masonry) */
    var drifts = [].slice.call(document.querySelectorAll('[data-drift]')).map(function (el) {
      return { el: el, f: parseFloat(el.getAttribute('data-drift')) || 0.05 };
    });

    if (reduce) {
      inks.forEach(function (k) { k.spans.forEach(function (s) { s.style.opacity = '1'; }); });
      fades.forEach(function (f) { f.el.style.opacity = '1'; });
      /* the pill nav still follows the section theme (a colour change, not motion) */
      if (pill) {
        var themeOnly = function () { var py = pill.getBoundingClientRect().top + 18, d = false; darkSecs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= py && r.bottom >= py) d = true; }); pill.classList.toggle('on-dark', d); };
        window.addEventListener('scroll', themeOnly, { passive: true }); themeOnly();
      }
      return formsOnly();
    }

    var queued = false;
    function frame() {
      queued = false;
      var vh = window.innerHeight;
      /* read every rect first, then write */
      var dr = dives.map(function (d) { return d.box.getBoundingClientRect(); });
      var fr = fades.map(function (f) { return f.box.getBoundingClientRect(); });
      var ir = inks.map(function (k) { return k.el.getBoundingClientRect(); });
      var zr = zoomActive() ? scenes.map(function (z) { return z.sc.getBoundingClientRect(); }) : [];
      var xr = drifts.map(function (d) { return d.el.parentElement.getBoundingClientRect(); });
      zr.forEach(function (r, i) {
        var z = scenes[i], g = z.geo;
        if (!g || r.bottom < -vh || r.top > vh * 2) return;
        var p = clamp(-r.top / Math.max(1, r.height - vh));
        var e = easeInOut(clamp((p - 0.06) / 0.62));
        var s = 1 + (g.s - 1) * e;
        z.layer.style.transform = 'translate3d(' + (g.tx * e).toFixed(1) + 'px,' + (g.ty * e).toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')';
        var f = (1 - clamp(p / 0.14)).toFixed(3);
        z.fades.forEach(function (el) { el.style.opacity = f; });
        if (z.l1) { var o1 = bell(p, 0.42, 0.62, 0.08); z.l1.style.opacity = o1.toFixed(3); z.l1.style.transform = 'translate3d(0,' + ((1 - o1) * 14).toFixed(1) + 'px,0)'; }
        if (z.l2) { var o2 = clamp((p - 0.7) / 0.08); z.l2.style.opacity = o2.toFixed(3); z.l2.style.transform = 'translate3d(0,' + ((1 - o2) * 14).toFixed(1) + 'px,0)'; }
      });
      var br = brightens.map(function (el) { return el.getBoundingClientRect(); });
      var fsr = focusScrubs.map(function (f) { return f.box.getBoundingClientRect(); });
      /* a receding element is usually sticky, so measure the sheet sliding over it, not the element itself */
      var rr = recedes.map(function (el) { var n = el.nextElementSibling; return { top: n ? n.getBoundingClientRect().top : el.getBoundingClientRect().bottom, height: el.offsetHeight }; });
      var onDark = false;
      if (pill) { var py = pill.getBoundingClientRect().top + 18; darkSecs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= py && r.bottom >= py) onDark = true; }); }
      brightens.forEach(function (el, i) {
        var r = br[i];
        el.style.opacity = (0.28 + 0.72 * clamp((vh * 0.82 - r.top) / (vh * 0.22))).toFixed(3);
      });
      focusScrubs.forEach(function (f, i) {
        var r = fsr[i];
        if (r.bottom < -100 || r.top > vh + 100) return;
        var p = clamp((vh - r.top) / (vh * 0.9));
        f.el.style.filter = p >= 1 ? '' : 'blur(' + ((1 - p) * f.max).toFixed(1) + 'px)';
        f.el.style.opacity = (0.3 + 0.7 * p).toFixed(3);
      });
      recedes.forEach(function (el, i) {
        var r = rr[i];
        var p = clamp((vh - r.top) / vh); /* how much of the screen the next sheet now covers */
        el.style.opacity = (1 - 0.65 * p).toFixed(3);
        el.style.transform = 'scale(' + (1 - 0.05 * p).toFixed(4) + ')';
      });
      if (pill) pill.classList.toggle('on-dark', onDark);
      drifts.forEach(function (d, i) {
        var r = xr[i];
        if (r.bottom < -200 || r.top > vh + 200) return;
        var c = r.top + r.height / 2 - vh / 2;
        d.el.style.transform = 'translate3d(0,' + (-c * d.f).toFixed(1) + 'px,0)';
      });
      dives.forEach(function (d, i) {
        var r = dr[i];
        if (r.bottom < -100 || r.top > vh + 100) return;
        /* scroll-linked, so the scroll itself is the timing: map progress straight through the section's pass */
        var p = clamp((vh - r.top) / (vh + r.height * 0.4));
        var s = d.from - (d.from - 1) * p;
        d.el.style.transform = 'translate3d(0,0,0) scale(' + s.toFixed(4) + ')';
      });
      fades.forEach(function (f, i) {
        var r = fr[i];
        var p = clamp((vh - r.top) / (vh + r.height));
        var o = easeOut(clamp((p - f.at) / 0.16));
        f.el.style.opacity = o.toFixed(3);
        f.el.style.transform = 'translate3d(0,' + ((1 - o) * 18).toFixed(1) + 'px,0)';
      });
      inks.forEach(function (k, i) {
        var r = ir[i];
        if (r.bottom < -50 || r.top > vh + 50) return;
        var q = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.35));
        var lit = q * k.spans.length;
        var blur = k.el.getAttribute('data-ink') === 'blur';
        k.spans.forEach(function (s, j) {
          var v = clamp(lit - j);
          var o = (0.22 + 0.78 * v).toFixed(2);
          if (k.last[j] !== o) { s.style.opacity = o; if (blur) s.style.filter = v >= 1 ? '' : 'blur(' + ((1 - v) * 6).toFixed(1) + 'px)'; k.last[j] = o; }
        });
      });
    }
    function tick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    frame();
    formsOnly();
  });

  function formsOnly() {
    document.querySelectorAll('form[data-validate]').forEach(function (f) {
      var input = f.querySelector('input[type="email"]');
      var done = f.parentElement.querySelector('[data-done]');
      if (!input) return;
      input.addEventListener('input', function () {
        if (f.classList.contains('invalid') && input.checkValidity()) { f.classList.remove('invalid'); input.setAttribute('aria-invalid', 'false'); }
      });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = input.value.trim() !== '' && input.checkValidity();
        f.classList.toggle('invalid', !ok);
        input.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok) { input.focus(); return; }
        f.hidden = true;
        if (done) { done.hidden = false; done.focus(); }
      });
    });
  }
})();
