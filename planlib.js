/* ============================================================
   PLAN — geometría de polígonos, sembrado desde la grilla
   y render del plano a <canvas> para exportar (PNG / PDF).
   ============================================================ */
(function () {
  // Layout del masterplan (px sobre lienzo 1240×684) — fuente de verdad
  const LAYOUT = [
    { id: "A", x: 40,   y: 24,  w: 560,  h: 64,  cols: 11 },
    { id: "L", x: 640,  y: 24,  w: 560,  h: 64,  cols: 9  },
    { id: "B", x: 40,   y: 110, w: 110,  h: 300, cols: 2  },
    { id: "C", x: 40,   y: 428, w: 110,  h: 140, cols: 2  },
    { id: "D", x: 170,  y: 110, w: 200,  h: 150, cols: 4  },
    { id: "F", x: 170,  y: 278, w: 200,  h: 132, cols: 4  },
    { id: "E", x: 390,  y: 110, w: 180,  h: 150, cols: 3  },
    { id: "G", x: 390,  y: 278, w: 180,  h: 132, cols: 3  },
    { id: "K", x: 870,  y: 110, w: 150,  h: 150, cols: 2  },
    { id: "J", x: 870,  y: 278, w: 150,  h: 132, cols: 2  },
    { id: "M", x: 1040, y: 110, w: 160,  h: 150, cols: 2  },
    { id: "N", x: 1040, y: 278, w: 160,  h: 132, cols: 2  },
    { id: "I", x: 590,  y: 450, w: 260,  h: 118, cols: 9  },
    { id: "H", x: 40,   y: 596, w: 1160, h: 64,  cols: 16 },
  ];
  const AMENITIES = [
    { id: "PARK",   label: "Parque central", x: 590, y: 110, w: 260, h: 320, kind: "park" },
    { id: "POOL",   label: "Club · Piscina", x: 170, y: 428, w: 200, h: 140, kind: "pool" },
    { id: "SOCCER", label: "Losa deportiva", x: 870, y: 428, w: 330, h: 140, kind: "soccer" },
  ];

  const GAP = 2;

  // Construye un rectángulo (4 vértices) para cada lote a partir de la grilla
  function seedPolys(lotes) {
    const byMz = {};
    lotes.forEach(l => { (byMz[l.manzana] ||= []).push(l); });
    Object.values(byMz).forEach(a => a.sort((x, y) => x.numero - y.numero));
    const polys = [];
    LAYOUT.forEach(mz => {
      const arr = byMz[mz.id] || [];
      const cols = mz.cols;
      const rows = Math.max(1, Math.ceil(arr.length / cols));
      const cellW = (mz.w - (cols - 1) * GAP) / cols;
      const cellH = (mz.h - (rows - 1) * GAP) / rows;
      arr.forEach((l, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x = mz.x + c * (cellW + GAP);
        const y = mz.y + r * (cellH + GAP);
        polys.push({ loteId: l.id, pts: [[x, y], [x + cellW, y], [x + cellW, y + cellH], [x, y + cellH]] });
      });
    });
    return polys;
  }

  function centroid(pts) {
    let x = 0, y = 0;
    pts.forEach(p => { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }
  function bbox(pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  }
  function toPath(pts) { return pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "); }

  // ---- Curvas (Bézier cuadrática opcional por arista) ----
  // curves = { "<i>": [cx,cy] } control de la arista que sale del vértice i
  function polyPath(pts, curves) {
    if (!pts || !pts.length) return "";
    let d = "M " + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (let i = 0; i < pts.length; i++) {
      const b = pts[(i + 1) % pts.length];
      const c = curves && curves[i];
      if (c) d += " Q " + c[0].toFixed(1) + " " + c[1].toFixed(1) + " " + b[0].toFixed(1) + " " + b[1].toFixed(1);
      else d += " L " + b[0].toFixed(1) + " " + b[1].toFixed(1);
    }
    return d + " Z";
  }
  function curveMid(a, b, c) { return [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1]]; }
  function controlThrough(a, b, h) { return [2 * h[0] - (a[0] + b[0]) / 2, 2 * h[1] - (a[1] + b[1]) / 2]; }
  function edgeHandle(poly, i) {
    const a = poly.pts[i], b = poly.pts[(i + 1) % poly.pts.length];
    const c = poly.curves && poly.curves[i];
    return c ? curveMid(a, b, c) : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  function tracePath(ctx, poly) {
    const pts = poly.pts; ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length; i++) {
      const b = pts[(i + 1) % pts.length];
      const c = poly.curves && poly.curves[i];
      if (c) ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
      else ctx.lineTo(b[0], b[1]);
    }
    ctx.closePath();
  }

  // ---- Subdivisión de un polígono en una grilla de lotes ----
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function insetCell(cell, k) {
    const cx = cell.reduce((s, p) => s + p[0], 0) / cell.length;
    const cy = cell.reduce((s, p) => s + p[1], 0) / cell.length;
    return cell.map(p => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k]);
  }
  function subdivideQuad(q, cols, rows) {
    const [P0, P1, P2, P3] = q; // TL, TR, BR, BL (horario)
    const at = (u, v) => lerp(lerp(P0, P1, u), lerp(P3, P2, u), v);
    const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cell = [at(i / cols, j / rows), at((i + 1) / cols, j / rows), at((i + 1) / cols, (j + 1) / rows), at(i / cols, (j + 1) / rows)];
      cells.push(insetCell(cell, 0.05));
    }
    return cells;
  }
  function subdivideBBox(pts, cols, rows) {
    const bb = bbox(pts), g = 2;
    const cw = (bb.w - (cols - 1) * g) / cols, ch = (bb.h - (rows - 1) * g) / rows;
    // La numeración arranca en el vértice que el usuario colocó primero (pts[0]):
    // anclamos en la esquina del bounding-box más cercana a ese vértice y
    // recorremos alejándonos de ella, en vez de forzar siempre izq→der / arriba→abajo.
    const o = pts[0];
    const startRight  = Math.abs(o[0] - (bb.x + bb.w)) < Math.abs(o[0] - bb.x);
    const startBottom = Math.abs(o[1] - (bb.y + bb.h)) < Math.abs(o[1] - bb.y);
    // Eje principal de avance = el de la primera arista dibujada (pts[0]→pts[1]).
    const e = pts[1] || pts[0];
    const verticalFirst = Math.abs(e[1] - o[1]) > Math.abs(e[0] - o[0]);
    const cells = [];
    const push = (i, j) => {
      const ci = startRight ? (cols - 1 - i) : i;
      const cj = startBottom ? (rows - 1 - j) : j;
      const x = bb.x + ci * (cw + g), y = bb.y + cj * (ch + g);
      cells.push([[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]]);
    };
    if (verticalFirst) { for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) push(i, j); }
    else { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) push(i, j); }
    return cells;
  }
  function subdivide(poly, cols, rows) {
    return poly.pts.length === 4 ? subdivideQuad(poly.pts, cols, rows) : subdivideBBox(poly.pts, cols, rows);
  }
  function areaPx(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a / 2);
  }
  function pointInPoly(pt, pts) {
    const [x, y] = pt; let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      const hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  // Estimación de m² para un lote nuevo (px² → m² con escala fija de demo)
  function estimaArea(pts) { return Math.max(40, Math.round(areaPx(pts) * 0.062)); }

  function loadImg(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }

  // Reduce y comprime un data-URL de imagen para que pese poco (los SVG se dejan tal cual)
  async function downscaleDataURL(dataUrl, maxDim = 2200, quality = 0.85, mime = "image/jpeg") {
    if (/^data:image\/svg/i.test(dataUrl)) return dataUrl;
    let img;
    try { img = await loadImg(dataUrl); } catch (e) { return dataUrl; }
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return dataUrl;
    const s = Math.min(1, maxDim / Math.max(w, h));
    if (s >= 1 && dataUrl.length < 1.4e6) return dataUrl; // ya es chico
    w = Math.round(w * s); h = Math.round(h * s);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    if (mime !== "image/png") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); } // JPEG: fondo blanco; PNG: conserva transparencia
    ctx.drawImage(img, 0, 0, w, h);
    return cv.toDataURL(mime, quality);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Renderiza el plano completo a un canvas (para PNG/PDF)
  async function renderCanvas({ polys, planoImg, planoOpacity = 1, lotes, brand, scale = 2 }) {
    const W = 1240, H = 684;
    const cv = document.createElement("canvas");
    cv.width = W * scale; cv.height = H * scale;
    const ctx = cv.getContext("2d");
    ctx.scale(scale, scale);

    if (planoImg) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
      try {
        const img = await loadImg(planoImg);
        const r = Math.min(W / img.width, H / img.height);
        const iw = img.width * r, ih = img.height * r;
        ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
      } catch (e) { /* svg sin tamaño intrínseco: dejar fondo blanco */ }
    } else {
      ctx.fillStyle = "#f3ede1"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e6dcc6"; ctx.fillRect(600, 0, 40, 596);
      const amColors = { park: "#9cc47e", pool: "#a9d6f7", soccer: "#8fc06a" };
      const amText = { park: "#3f5b28", pool: "#2c6a93", soccer: "#3f6128" };
      AMENITIES.forEach(a => {
        ctx.fillStyle = amColors[a.kind]; roundRect(ctx, a.x, a.y, a.w, a.h, 8); ctx.fill();
        ctx.fillStyle = amText[a.kind]; ctx.font = "700 11px 'Hanken Grotesk',sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(a.label.toUpperCase(), a.x + a.w / 2, a.y + a.h / 2);
      });
    }

    const lmap = {}; lotes.forEach(l => lmap[l.id] = l);
    const EST = window.LIB.ESTADOS;
    polys.forEach(p => {
      if (p.general) return;
      const l = lmap[p.loteId]; if (!l) return;
      const e = EST[l.estado] || EST.disponible;
      ctx.beginPath();
      tracePath(ctx, p);
      if (l.transparente) {
        ctx.save();
        ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(55,60,72,.6)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = planoOpacity;
        ctx.fillStyle = e.fill; ctx.fill();
        ctx.restore();
        ctx.strokeStyle = e.stroke; ctx.lineWidth = 1; ctx.stroke();
      }
      const c = centroid(p.pts), bb = bbox(p.pts);
      if (bb.h > 16 && bb.w > 12) {
        ctx.font = "700 8px 'Hanken Grotesk',sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (l.transparente) {
          ctx.lineWidth = 2.4; ctx.strokeStyle = "#fff"; ctx.strokeText(String(l.codigo || l.numero), c[0], c[1]);
          ctx.fillStyle = "#2f3440";
        } else {
          ctx.fillStyle = e.text;
        }
        ctx.fillText(String(l.codigo || l.numero), c[0], c[1]);
      }
    });

    // Membrete
    const titulo = (brand && brand.nombre) || "Cotizador";
    const sub = (window.APP && window.APP.proyecto && window.APP.proyecto.etapa) || "";
    const label = titulo + (sub ? " · " + sub : "");
    ctx.font = "700 12px 'Spectral',serif";
    const tw = ctx.measureText(label).width;
    let logoImg = null;
    if (brand && brand.logo) { try { logoImg = await loadImg(brand.logo); } catch (e) { logoImg = null; } }
    const boxW = Math.min(360, (logoImg ? 34 : 12) + tw + 22);
    ctx.fillStyle = "rgba(15,23,41,.92)";
    roundRect(ctx, 16, H - 42, boxW, 28, 7); ctx.fill();
    let tx0 = 28;
    if (logoImg) {
      try { ctx.save(); roundRect(ctx, 24, H - 38, 20, 20, 5); ctx.clip(); ctx.drawImage(logoImg, 24, H - 38, 20, 20); ctx.restore(); } catch (e) { /* noop */ }
      tx0 = 50;
    }
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = "700 12px 'Spectral',serif";
    ctx.fillText(label, tx0, H - 28);
    return cv;
  }

  function downloadCanvas(cv, filename) {
    cv.toBlob(b => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, "image/png");
  }

  // Imprime (PDF) un canvas dentro de un iframe oculto
  function printCanvas(cv, titulo) {
    const url = cv.toDataURL("image/png");
    const ifr = document.createElement("iframe");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write(
      '<html><head><title>' + (titulo || "Plano") + '</title>' +
      '<style>@page{size:A4 landscape;margin:10mm}html,body{margin:0;height:100%}' +
      'img{width:100%;height:auto;display:block}</style>' +
      '</head><body><img src="' + url + '"></body></html>'
    );
    doc.close();
    const go = () => { ifr.contentWindow.focus(); ifr.contentWindow.print(); setTimeout(() => ifr.remove(), 800); };
    if (ifr.contentWindow.document.readyState === "complete") setTimeout(go, 250);
    else ifr.onload = () => setTimeout(go, 250);
  }

  window.PLAN = {
    LAYOUT, AMENITIES, seedPolys, centroid, bbox, toPath, areaPx, pointInPoly,
    dist, estimaArea, renderCanvas, downloadCanvas, printCanvas,
    polyPath, curveMid, controlThrough, edgeHandle, tracePath, subdivide, downscaleDataURL,
  };
})();
