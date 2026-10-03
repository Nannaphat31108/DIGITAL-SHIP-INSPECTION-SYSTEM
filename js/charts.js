/* =========================================================
   Lightweight SVG chart library (no external dependencies)
   - Charts.bars()   : horizontal bar chart
   - Charts.donut()  : donut chart with centre total
   - Charts.line()   : XY line chart with markers / reference lines
   ========================================================= */
var Charts = (function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var esc = function (s) { return U.esc(s); };

  function niceMax(v) {
    if (v <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / e;
    var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return n * e;
  }
  function ticks(min, max, count) {
    var span = max - min;
    if (span <= 0) return [min];
    var raw = span / (count || 5);
    var e = Math.pow(10, Math.floor(Math.log10(raw)));
    var m = raw / e;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
    var out = [];
    for (var t = Math.ceil(min / step - 1e-9) * step; t <= max + 1e-9; t += step) out.push(Math.round(t / step) * step);
    return out;
  }
  function trimNum(v) { return Math.abs(v) < 1e-9 ? "0" : String(Number(v.toPrecision(6))); }

  /** Horizontal bars. data: [{label, value, color}] */
  function bars(el, data, opts) {
    opts = opts || {};
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (!total && opts.emptyText) { el.innerHTML = '<div class="chart-empty">' + esc(opts.emptyText) + "</div>"; return; }
    var W = 460, rowH = 30, labelW = opts.labelW || 120, padR = 40, H = data.length * rowH + 6;
    var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1])));
    var plotW = W - labelW - padR;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.title || "Bar chart") + '">';
    data.forEach(function (d, i) {
      var y = i * rowH + 4, w = d.value / max * plotW;
      s += '<text x="' + (labelW - 8) + '" y="' + (y + 15) + '" text-anchor="end">' + esc(d.label) + "</text>";
      s += '<rect x="' + labelW + '" y="' + (y + 3) + '" width="' + plotW + '" height="18" rx="3" fill="#f1f4f8"/>';
      if (w > 0) s += '<rect x="' + labelW + '" y="' + (y + 3) + '" width="' + w.toFixed(1) + '" height="18" rx="3" fill="' + d.color + '"/>';
      s += '<text class="val" x="' + (labelW + w + 6).toFixed(1) + '" y="' + (y + 16) + '">' + d.value + "</text>";
    });
    el.innerHTML = s + "</svg>";
  }

  /** Donut chart. data: [{label, value, color}] */
  function donut(el, data, opts) {
    opts = opts || {};
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (!total) { el.innerHTML = '<div class="chart-empty">' + esc(opts.emptyText || "No data") + "</div>"; return; }
    var cx = 90, cy = 90, R = 74, r0 = 48, a0 = -Math.PI / 2;
    var s = '<svg viewBox="0 0 360 180" role="img" aria-label="' + esc(opts.title || "Donut chart") + '">';
    data.forEach(function (d) {
      if (!d.value) return;
      var frac = d.value / total, a1 = a0 + frac * Math.PI * 2;
      if (frac >= 0.9999) {
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r0) / 2) + '" fill="none" stroke="' + d.color + '" stroke-width="' + (R - r0) + '"/>';
      } else {
        var large = a1 - a0 > Math.PI ? 1 : 0;
        var p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + " " + (cy + rad * Math.sin(a)).toFixed(2); };
        s += '<path d="M ' + p(R, a0) + " A " + R + " " + R + " 0 " + large + " 1 " + p(R, a1) + " L " + p(r0, a1) +
          " A " + r0 + " " + r0 + " 0 " + large + " 0 " + p(r0, a0) + ' Z" fill="' + d.color + '" stroke="#fff" stroke-width="1.5"/>';
      }
      a0 = a1;
    });
    s += '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" style="font-size:24px;font-weight:700;fill:#0b1f3a">' + total + "</text>";
    s += '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle">' + esc(opts.centerLabel || "Total") + "</text>";
    data.forEach(function (d, i) {
      var y = 34 + i * 28;
      var pct = total ? Math.round(d.value / total * 100) : 0;
      s += '<rect x="196" y="' + (y - 9) + '" width="11" height="11" rx="2" fill="' + d.color + '"/>';
      s += '<text x="214" y="' + y + '" style="font-size:12px;fill:#3b4757">' + esc(d.label) + "</text>";
      s += '<text x="350" y="' + y + '" text-anchor="end" class="val" style="font-size:12px">' + d.value + ' <tspan style="fill:#6b7a8f;font-weight:400">(' + pct + "%)</tspan></text>";
    });
    el.innerHTML = s + "</svg>";
  }

  /**
   * XY line chart.
   * series: [{name, color, points:[{x,y}], dash, width, segments?:[{points,dash}] }]
   * opts: {xLabel, yLabel, xMin, xMax, yMin, yMax, vLines:[{x,label,color}], hLines:[{y,label,color}], markers:[{x,y,label,color}], height}
   */
  function line(el, series, opts) {
    opts = opts || {};
    var W = 600, H = opts.height || 320, m = { l: 56, r: 18, t: 16, b: 44 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var xs = [], ys = [];
    series.forEach(function (s) { s.points.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    (opts.hLines || []).forEach(function (h) { ys.push(h.y); });
    (opts.markers || []).forEach(function (mk) { ys.push(mk.y); });
    var xMin = opts.xMin != null ? opts.xMin : Math.min.apply(null, xs);
    var xMax = opts.xMax != null ? opts.xMax : Math.max.apply(null, xs);
    var yMinD = Math.min.apply(null, ys), yMaxD = Math.max.apply(null, ys);
    var yMin = opts.yMin != null ? Math.min(opts.yMin, yMinD) : yMinD;
    var yMax = opts.yMax != null ? Math.max(opts.yMax, yMaxD) : yMaxD;
    if (yMax === yMin) { yMax += 1; yMin -= 1; }
    var pad = (yMax - yMin) * 0.06; yMax += pad; if (yMin < 0 || opts.yMin == null) yMin -= pad;
    var yt = ticks(yMin, yMax, 6), xt = ticks(xMin, xMax, 6);
    yMin = Math.min(yMin, yt[0]); yMax = Math.max(yMax, yt[yt.length - 1]);
    var X = function (v) { return m.l + (v - xMin) / (xMax - xMin) * pw; };
    var Y = function (v) { return m.t + (1 - (v - yMin) / (yMax - yMin)) * ph; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.title || "Line chart") + '">';
    s += '<defs><clipPath id="clip-' + el.id + '"><rect x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs>';
    yt.forEach(function (t) {
      s += '<line class="grid-line" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/>';
      s += '<text x="' + (m.l - 7) + '" y="' + (Y(t) + 4).toFixed(1) + '" text-anchor="end">' + trimNum(t) + "</text>";
    });
    xt.forEach(function (t) {
      s += '<line class="grid-line" y1="' + m.t + '" y2="' + (H - m.b) + '" x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '"/>';
      s += '<text x="' + X(t).toFixed(1) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + trimNum(t) + "</text>";
    });
    if (yMin < 0 && yMax > 0) s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#6b7a8f" stroke-width="1"/>';
    s += '<rect x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="#cfd7e2"/>';
    s += '<text x="' + (m.l + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" style="font-weight:600;fill:#3b4757">' + esc(opts.xLabel || "") + "</text>";
    s += '<text transform="translate(14 ' + (m.t + ph / 2) + ') rotate(-90)" text-anchor="middle" style="font-weight:600;fill:#3b4757">' + esc(opts.yLabel || "") + "</text>";

    s += '<g clip-path="url(#clip-' + el.id + ')">';
    (opts.vLines || []).forEach(function (v) {
      if (v.x < xMin || v.x > xMax) return;
      s += '<line x1="' + X(v.x).toFixed(1) + '" x2="' + X(v.x).toFixed(1) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="' + (v.color || "#6b7a8f") + '" stroke-dasharray="5 4" stroke-width="1.3"/>';
    });
    (opts.hLines || []).forEach(function (h) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(h.y).toFixed(1) + '" y2="' + Y(h.y).toFixed(1) + '" stroke="' + (h.color || "#6b7a8f") + '" stroke-dasharray="6 4" stroke-width="1.4"/>';
    });
    series.forEach(function (sr) {
      var segs = sr.segments || [{ points: sr.points, dash: sr.dash }];
      segs.forEach(function (sg) {
        if (sg.points.length < 2) return;
        var d = sg.points.map(function (p, i) { return (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1); }).join(" ");
        s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.width || 2.2) + '"' + (sg.dash ? ' stroke-dasharray="' + sg.dash + '"' : "") + ' stroke-linejoin="round"/>';
      });
    });
    s += "</g>";
    (opts.vLines || []).forEach(function (v) {
      if (v.label && v.x >= xMin && v.x <= xMax) s += '<text x="' + (X(v.x) + 4).toFixed(1) + '" y="' + (m.t + 12) + '" style="fill:' + (v.color || "#6b7a8f") + ';font-weight:600">' + esc(v.label) + "</text>";
    });
    (opts.hLines || []).forEach(function (h) {
      if (h.label) s += '<text x="' + (W - m.r - 4) + '" y="' + (Y(h.y) - 5).toFixed(1) + '" text-anchor="end" style="fill:' + (h.color || "#6b7a8f") + ';font-weight:600">' + esc(h.label) + "</text>";
    });
    (opts.markers || []).forEach(function (mk) {
      if (mk.x < xMin || mk.x > xMax) return;
      s += '<circle cx="' + X(mk.x).toFixed(1) + '" cy="' + Y(mk.y).toFixed(1) + '" r="5" fill="' + (mk.color || "#2f6fde") + '" stroke="#fff" stroke-width="2"/>';
      if (mk.label) {
        var right = X(mk.x) < W - 150;
        s += '<text x="' + (X(mk.x) + (right ? 9 : -9)).toFixed(1) + '" y="' + (Y(mk.y) - 8).toFixed(1) + '" text-anchor="' + (right ? "start" : "end") + '" style="fill:#0b1f3a;font-weight:700">' + esc(mk.label) + "</text>";
      }
    });
    el.innerHTML = s + "</svg>";
  }

  return { bars: bars, donut: donut, line: line };
})();
