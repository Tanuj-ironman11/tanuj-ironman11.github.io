(() => {
  const d = document,
    root = d.documentElement,
    nav = d.querySelector("nav");
  // one svg for both themes: CSS morphs sun <-> moon from [data-theme]
  const ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><mask id="tt-m"><rect width="24" height="24" fill="#fff"/><circle class="ti-cut" cx="12" cy="12" r="7.5" fill="#000"/></mask><circle class="ti-core" cx="12" cy="12" r="9" fill="currentColor" mask="url(#tt-m)"/><path class="ti-rays" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  // theme toggle, circular reveal from the button
  const tt = d.createElement("button");
  tt.className = "tt";
  tt.setAttribute("aria-label", "Toggle theme");
  nav.appendChild(tt);
  tt.innerHTML = ICON;
  tt.onclick = (e) => {
    const r = tt.getBoundingClientRect(),
      x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const go = () => {
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
      localStorage.theme = root.dataset.theme;
    };
    if (
      !d.startViewTransition ||
      matchMedia("(prefers-reduced-motion:reduce)").matches
    )
      return go();
    root.classList.add("theming");
    // accent ring: lives in the new page, so the reveal circle carries it along its edge
    const R = Math.hypot(innerWidth, innerHeight),
      ring = d.createElement("div");
    ring.className = "bloom";
    ring.style.left = x + "px";
    ring.style.top = y + "px";
    d.body.appendChild(ring);
    const vt = d.startViewTransition(go);
    vt.finished.finally(() => {
      root.classList.remove("theming");
      ring.remove();
    });
    vt.ready.then(() => {
      const opt = { duration: 650, easing: "cubic-bezier(.6,0,.2,1)" };
      root.animate(
        {
          clipPath: [
            `circle(0 at ${x}px ${y}px)`,
            `circle(${R}px at ${x}px ${y}px)`,
          ],
        },
        { ...opt, pseudoElement: "::view-transition-new(root)" },
      );
      // ring is 1000px wide (radius 500), so scale R/500 matches the clip radius exactly
      ring.animate(
        {
          transform: [
            "translate(-50%,-50%) scale(0)",
            `translate(-50%,-50%) scale(${R / 500})`,
          ],
        },
        { ...opt, fill: "forwards" },
      );
    });
  };

  // liquid glass: the nav bends what is behind it like a thick glass pill (Chromium only)
  if (/Chrome\//.test(navigator.userAgent)) {
    root.classList.add("lg");
    const BEZEL = 20,
      THICK = 60,
      INDEX = 1.5,
      PUSH = 10,
      STEPS = 128,
      RIM = 3.5,
      SHINE = 0.55,
      LIGHT = (-135 * Math.PI) / 180;
    const lx = Math.cos(LIGHT),
      ly = Math.sin(LIGHT);
    // glass height from the rim (0) to where the flat middle starts (1)
    const surface = (x) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);
    // per step in from the rim: how far a straight-down ray lands from where it went in (Snell's law)
    const bend = (() => {
      const out = [];
      for (let i = 0; i < STEPS; i++) {
        const x = i / (STEPS - 1),
          lo = Math.max(x - 0.001, 0),
          hi = Math.min(x + 0.001, 1);
        const slope =
          (((surface(hi) - surface(lo)) / (hi - lo)) * THICK) / BEZEL;
        const inc = Math.atan(Math.abs(slope)),
          ref = Math.asin(Math.sin(inc) / INDEX);
        out.push(surface(x) * THICK * Math.tan(inc - ref));
      }
      const top = Math.max(...out);
      return out.map((v) => v / top);
    })();
    const s = d.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("style", "position:absolute;width:0;height:0");
    s.innerHTML =
      '<filter id="lg" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage id="lgi" x="0" y="0" preserveAspectRatio="none" result="m"/><feImage id="lgs" x="0" y="0" preserveAspectRatio="none" result="s"/><feDisplacementMap in="SourceGraphic" in2="m" scale="' +
      PUSH * 2 +
      '" xChannelSelector="R" yChannelSelector="G" result="d"/><feBlend in="s" in2="d" mode="normal"/></filter>';
    d.body.appendChild(s);
    const img = s.querySelector("#lgi"),
      shine = s.querySelector("#lgs");
    // red = push in x, green = push in y, 128 means no push. The shine layer is a thin
    // white rim, brightest where the edge faces the light. Both are rebuilt when the nav resizes.
    const map = () => {
      const w = nav.offsetWidth,
        h = nav.offsetHeight;
      if (!w || !h) return;
      const c = d.createElement("canvas"),
        c2 = d.createElement("canvas");
      c.width = c2.width = w;
      c.height = c2.height = h;
      const g = c.getContext("2d"),
        g2 = c2.getContext("2d");
      const im = g.createImageData(w, h),
        sp = g2.createImageData(w, h),
        r = h / 2;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          // the nav is a pill, so measure from the nearest point on its center line
          const cx = Math.min(Math.max(x + 0.5, r), w - r),
            dx = x + 0.5 - cx,
            dy = y + 0.5 - r;
          const dist = Math.hypot(dx, dy),
            edge = r - dist;
          let vx = 0,
            vy = 0,
            a = 0;
          if (edge < BEZEL && dist > 0) {
            const k =
              bend[Math.round((Math.max(edge, 0) / BEZEL) * (STEPS - 1))];
            vx = (-dx / dist) * k;
            vy = (-dy / dist) * k;
            if (edge >= 0 && edge < RIM) {
              const lit = (dx * lx + dy * ly) / dist;
              a = lit * lit * Math.pow(1 - edge / RIM, 2) * SHINE;
            }
          }
          const i = (y * w + x) * 4;
          im.data[i] = 128 + vx * 127;
          im.data[i + 1] = 128 + vy * 127;
          im.data[i + 2] = 128;
          im.data[i + 3] = 255;
          sp.data[i] = sp.data[i + 1] = sp.data[i + 2] = 255;
          sp.data[i + 3] = a * 255;
        }
      g.putImageData(im, 0, 0);
      g2.putImageData(sp, 0, 0);
      for (const [el, cv] of [
        [img, c],
        [shine, c2],
      ]) {
        el.setAttribute("width", w);
        el.setAttribute("height", h);
        el.setAttribute("href", cv.toDataURL());
      }
    };
    new ResizeObserver(map).observe(nav);
    map();
  }

  // docs: toc, scrollspy, copy buttons, sidebar filter
  const doc = d.querySelector(".doc");
  if (doc) {
    const toc = d.querySelector(".toc");
    doc.querySelectorAll("h2,h3").forEach((h) => {
      const a = d.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      if (h.tagName === "H3") a.className = "s";
      toc.appendChild(a);
    });
    const links = [...d.querySelectorAll(".toc a,.side a")];
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting)
            links.forEach((a) =>
              a.classList.toggle(
                "on",
                a.getAttribute("href") === "#" + e.target.id,
              ),
            );
        }),
      { rootMargin: "-90px 0px -70% 0px" },
    );
    doc.querySelectorAll("h2,h3").forEach((h) => io.observe(h));
    doc.querySelectorAll("pre").forEach((p) => {
      const b = d.createElement("button");
      b.textContent = "Copy";
      b.onclick = () => {
        navigator.clipboard.writeText(p.innerText.replace(/Copy$/, "").trim());
        b.textContent = "Copied";
        setTimeout(() => (b.textContent = "Copy"), 1200);
      };
      p.appendChild(b);
    });
    d.querySelector(".side input").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      d.querySelectorAll(".side a").forEach(
        (a) =>
          (a.style.display = a.textContent.toLowerCase().includes(q)
            ? ""
            : "none"),
      );
    };
  }
  // hero: screenshots crossfade, the accent follows the cover (needs assets/musik-app.png; -2, -3, -4 optional)
  const slides = d.getElementById("slides");
  if (slides) {
    let hue = null,
      cur = 0,
      timer,
      held = false;
    const dark = () => root.dataset.theme === "dark";
    const setAcc = (h) => {
      hue = h;
      root.style.setProperty(
        "--acc",
        "hsl(" + h + " " + (dark() ? "86% 58%" : "80% 46%") + ")",
      );
      try {
        sessionStorage.hue = h;
      } catch (e) {}
    };
    new MutationObserver(() => {
      if (hue != null) setAcc(hue);
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    d.addEventListener("musik:hue", (e) => {
      held = true;
      clearInterval(timer);
      setAcc(e.detail);
    });
    const hsl = (r, g, b) => {
      r /= 255;
      g /= 255;
      b /= 255;
      const M = Math.max(r, g, b),
        m = Math.min(r, g, b),
        l = (M + m) / 2,
        c = M - m;
      if (!c) return [0, 0, l];
      const s = c / (1 - Math.abs(2 * l - 1));
      let h =
        M === r
          ? ((g - b) / c) % 6
          : M === g
            ? (b - r) / c + 2
            : (r - g) / c + 4;
      return [(h * 60 + 360) % 360, s, l];
    };
    // most saturated hue in the shot; null if the canvas is blocked (file://)
    const pick = (img) => {
      try {
        const w = 64,
          h = 40,
          cv = d.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const g = cv.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h);
        const p = g.getImageData(0, 0, w, h).data,
          bin = new Array(36).fill(0);
        for (let i = 0; i < p.length; i += 4) {
          const [hu, s, l] = hsl(p[i], p[i + 1], p[i + 2]);
          if (s < 0.4 || l < 0.12 || l > 0.9) continue;
          bin[Math.floor(hu / 10) % 36] += s * (1 - Math.abs(l - 0.5) * 1.4);
        }
        const sc = bin.map(
            (v, i) => bin[(i + 35) % 36] + v * 2 + bin[(i + 1) % 36],
          ),
          best = Math.max(...sc);
        return best > 0 ? sc.indexOf(best) * 10 + 5 : null;
      } catch (e) {
        return null;
      }
    };
    Promise.allSettled(
      [...slides.querySelectorAll("img")].map((i) => i.decode()),
    ).then(() => {
      const imgs = [...slides.querySelectorAll("img")].filter((i) => {
        if (i.naturalWidth) return true;
        i.remove();
        return false;
      });
      if (!imgs.length) return;
      const hues = imgs.map((i) => {
        const p = pick(i);
        return p != null ? p : i.dataset.hue ? +i.dataset.hue : null;
      });
      const dots = d.querySelector(".dots");
      const show = (n) => {
        cur = n;
        imgs.forEach((im, i) => im.classList.toggle("on", i === n));
        [...dots.children].forEach((b, i) => b.classList.toggle("on", i === n));
        if (hues[n] != null) setAcc(hues[n]);
      };
      slides.classList.add("js");
      show(0);
      if (
        imgs.length < 2 ||
        matchMedia("(prefers-reduced-motion:reduce)").matches
      )
        return;
      imgs.forEach((_, i) => {
        const b = d.createElement("button");
        b.setAttribute("aria-label", "Show screenshot " + (i + 1));
        b.onclick = () => {
          held = false;
          show(i);
          start();
        };
        dots.appendChild(b);
      });
      const start = () => {
        clearInterval(timer);
        if (held) return;
        timer = setInterval(() => show((cur + 1) % imgs.length), 5000);
      };
      const box = slides.parentNode;
      box.onmouseenter = () => clearInterval(timer);
      box.onmouseleave = start;
      show(0);
      start();
    });
  }

  // feature card: hover a cover to recolor the mini player, click to recolor the page
  const vh = d.querySelector(".v-hue");
  if (vh) {
    const cs = [...vh.querySelectorAll("button")];
    let act = cs[0];
    const set = (h) => vh.style.setProperty("--h", h);
    cs.forEach((b) => {
      b.onpointerenter = b.onfocus = () => set(b.dataset.h);
      b.onclick = () => {
        act = b;
        cs.forEach((x) => x.classList.toggle("on", x === b));
        set(b.dataset.h);
        d.dispatchEvent(new CustomEvent("musik:hue", { detail: +b.dataset.h }));
      };
    });
    vh.onpointerleave = () => set(act.dataset.h);
  }

  // github star count and latest version in the nav/hero; stays quiet if offline or rate limited
  (async () => {
    const R = "Tanuj-ironman11/Musik",
      K = "musik.gh";
    let c = null;
    try {
      c = JSON.parse(sessionStorage.getItem(K));
    } catch (e) {}
    if (!c || Date.now() - c.t > 36e5) {
      try {
        const [a, b] = await Promise.all([
          fetch("https://api.github.com/repos/" + R),
          fetch("https://api.github.com/repos/" + R + "/releases/latest"),
        ]);
        c = {
          t: Date.now(),
          s: a.ok ? (await a.json()).stargazers_count : null,
          v: b.ok ? (await b.json()).tag_name : null,
        };
        sessionStorage.setItem(K, JSON.stringify(c));
      } catch (e) {
        return;
      }
    }
    const st = d.querySelector(".stars");
    if (st && c.s > 0) {
      st.textContent =
        c.s >= 1000 ? (c.s / 1000).toFixed(1).replace(".0", "") + "k" : c.s;
      st.hidden = false;
    }
    if (c.v)
      d.querySelectorAll("[data-ver]").forEach((e) => (e.textContent = c.v));
  })();
})();