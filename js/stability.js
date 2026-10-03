/* =========================================================
   Module 3 — Preliminary Ship Design / Stability Simulation (UI)
   Recalculates live on every input change.
   ========================================================= */
var Stability = (function () {
  "use strict";
  var $ = U.$, $$ = U.$$, esc = U.esc, SC = StabilityCalc;
  var DEFAULTS = { mode: "draft", L: 120, B: 20, D: 13, T: 7, disp: 12398.4, Cb: 0.72, Cwp: 0.82, rho: 1.025, KG: 7.5, FSC: 0.1 };
  var FIELDS = ["L", "B", "D", "T", "disp", "Cb", "Cwp", "KG", "FSC"];
  var mode = "draft";
  var last = null;

  function readForm() {
    var p = { mode: mode, rho: Number($("#st-rho").value) };
    FIELDS.forEach(function (k) { p[k] = U.num($("#st-" + k)); });
    return p;
  }
  function fillForm(p) {
    FIELDS.forEach(function (k) { $("#st-" + k).value = p[k] == null ? "" : p[k]; });
    $("#st-rho").value = Number(p.rho).toFixed(3);
    setMode(p.mode || "draft");
  }
  function setMode(m) {
    mode = m;
    $$("#st-mode button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === m); });
    $("#st-T-wrap").hidden = m !== "draft";
    $("#st-disp-wrap").hidden = m !== "disp";
  }

  function update() {
    var form = $("#st-form");
    var p = readForm();
    var res = SC.compute(p);
    if (!res.ok) {
      $$(".field[data-field]", form).forEach(function (f) {
        var k = f.getAttribute("data-field"), e = res.errors[k];
        f.classList.toggle("invalid", !!e); $(".err", f).textContent = e || "";
      });
      $("#st-verdict").className = "status-banner s-none";
      $("#st-verdict").innerHTML = '<div class="st-icon">!</div><div><div class="st-title">Input error</div><div class="st-desc">Correct the highlighted inputs to update the results.</div></div>';
      last = null;
      return;
    }
    $$(".field.invalid", form).forEach(function (f) { f.classList.remove("invalid"); });
    last = res;
    Store.saveStabInput(p);
    // keep the "other" mode field in sync so switching mode is seamless
    if (mode === "draft") $("#st-disp").value = res.disp; else $("#st-T").value = res.T;
    renderValues(res); renderChecks(res); renderSection(res); renderGZ(res); renderHydro(p, res);
  }

  function rb(label, val, unit, cls) {
    return '<div class="rb ' + (cls || "") + '"><div class="rb-l">' + label + '</div><div class="rb-v">' + val + (unit ? " <small>" + unit + "</small>" : "") + "</div></div>";
  }

  function renderValues(r) {
    var v = r.verdict;
    $("#st-verdict").className = "status-banner s-" + v.level;
    $("#st-verdict").innerHTML = '<div class="st-icon">' + (v.level === "low" ? "✓" : "!") + '</div><div><div class="st-title">' + esc(v.title) + '</div><div class="st-desc">' + esc(v.desc) + "</div></div>";
    var gmCls = r.GMf < 0 ? "bad" : (r.GMf < SC.GM_MIN ? "warn" : "good");
    var h = '<div class="result-big">' +
      rb(mode === "draft" ? "Displacement Δ" : "Draft T (calc.)", mode === "draft" ? U.fmt(r.disp, 1) : U.fmt(r.T, 3), mode === "draft" ? "t" : "m") +
      rb("Volume ∇", U.fmt(r.V, 1), "m³") + rb("Freeboard", U.fmt(r.freeboard, 2), "m") + rb("GM (fluid)", U.fmt(r.GMf, 3), "m", gmCls) + "</div>";
    h += '<div class="grid g-2 mt" style="gap:0 24px"><table class="kv">' +
      "<tr><th>Draft T</th><td>" + U.fmt(r.T, 3) + " m</td></tr>" +
      "<tr><th>Displacement Δ</th><td>" + U.fmt(r.disp, 1) + " t</td></tr>" +
      "<tr><th>Waterplane area A<sub>WP</sub></th><td>" + U.fmt(r.Awp, 1) + " m²</td></tr>" +
      "<tr><th>TPC</th><td>" + U.fmt(r.TPC, 2) + " t/cm</td></tr>" +
      "<tr><th>KB</th><td>" + U.fmt(r.KB, 3) + " m</td></tr>" +
      "<tr><th>I<sub>T</sub></th><td>" + U.fmt(r.IT, 0) + " m⁴</td></tr>" +
      "<tr><th>BM</th><td>" + U.fmt(r.BM, 3) + " m</td></tr>" +
      "<tr><th>KM</th><td>" + U.fmt(r.KM, 3) + " m</td></tr>" +
      '</table><table class="kv">' +
      "<tr><th>KG</th><td>" + U.fmt(r.KG, 3) + " m</td></tr>" +
      "<tr><th>GM (solid)</th><td>" + U.fmt(r.GM, 3) + " m</td></tr>" +
      "<tr><th>GM (fluid) = GM − FSC</th><td>" + U.fmt(r.GMf, 3) + " m</td></tr>" +
      "<tr><th>Deck-edge immersion</th><td>" + U.fmt(r.phiDE, 1) + "°</td></tr>" +
      "<tr><th>Max GZ (valid range)</th><td>" + U.fmt(r.gzMax, 3) + " m @ " + r.gzMaxAt + "°</td></tr>" +
      "<tr><th>Roll period T<sub>r</sub></th><td>" + (r.rollPeriod == null ? "— (GM ≤ 0)" : U.fmt(r.rollPeriod, 1) + " s") + "</td></tr>" +
      "<tr><th>L/B · B/T</th><td>" + U.fmt(r.ratios.LB, 2) + " · " + U.fmt(r.ratios.BT, 2) + "</td></tr>" +
      "<tr><th>T/D</th><td>" + U.fmt(r.ratios.TD, 3) + "</td></tr>" +
      "</table></div>";
    $("#st-values").innerHTML = h;
  }

  function renderChecks(r) {
    var icon = { pass: "✓", fail: "✕", warn: "!", na: "–" };
    $("#st-checks").innerHTML = '<ul class="check-list">' + r.checks.map(function (c) {
      return '<li><span class="ci ' + c.status + '">' + icon[c.status] + '</span><div class="cl-main"><div>' + esc(c.name) +
        '</div><div class="cl-sub">Reference: ' + esc(c.ref) + (c.sub ? " — " + esc(c.sub) : "") + '</div></div><div class="cl-val">' + esc(c.value) + "</div></li>";
    }).join("") + "</ul>";
  }

  /* ---- Midship section diagram with heel ---- */
  function renderSection(r) {
    var p = r.input, B = p.B, D = p.D, T = r.T, phi = Number($("#st-heel").value);
    $("#st-heel-out").textContent = phi + "°";
    var W = 440, H = 340, cx = 220, wy = 175;
    var R = Math.sqrt(Math.pow(B / 2, 2) + Math.pow(Math.max(T, D - T, r.KM - T, p.KG - T) + 0.5, 2));
    var s = 150 / R;
    var a = phi * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    // local (x: + starboard, y: + up from keel) → screen, rotated about (0, T)
    function P(x, y) {
      var dx = x, dy = y - T;
      var xr = dx * ca + dy * sa, yr = -dx * sa + dy * ca;
      return { x: cx + s * xr, y: wy - s * yr };
    }
    // hull section: box with bilge radius
    var rb = Math.min(B, D) * 0.15, pts = [];
    pts.push([-B / 2, D]);
    for (var i = 0; i <= 8; i++) { var t1 = Math.PI + i / 8 * Math.PI / 2; pts.push([-B / 2 + rb + rb * Math.cos(t1), rb + rb * Math.sin(t1)]); }
    for (var j = 0; j <= 8; j++) { var t2 = 1.5 * Math.PI + j / 8 * Math.PI / 2; pts.push([B / 2 - rb + rb * Math.cos(t2), rb + rb * Math.sin(t2)]); }
    pts.push([B / 2, D]);
    var hull = pts.map(function (q, k) { var pp = P(q[0], q[1]); return (k ? "L" : "M") + pp.x.toFixed(1) + " " + pp.y.toFixed(1); }).join(" ") + " Z";

    var K = P(0, 0), G = P(0, p.KG), M = P(0, r.KM), B0 = P(0, r.KB), CLtop = P(0, Math.max(D, r.KM) + 1);
    var gz = SC.gzWallSided(r.raw.GMf, r.raw.BM, phi);
    var Bh = { x: G.x + gz * s, y: B0.y };   // heeled centre of buoyancy, horizontal distance GZ from G
    var Z = { x: Bh.x, y: G.y };

    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Midship section heel diagram">';
    svg += '<defs><marker id="arr-up" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#2f6fde"/></marker>' +
      '<marker id="arr-dn" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#c62828"/></marker></defs>';
    svg += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f6f9fd"/>';
    svg += '<path d="' + hull + '" fill="#dfe7f2" stroke="#1b3a66" stroke-width="2"/>';
    svg += '<rect x="0" y="' + wy + '" width="' + W + '" height="' + (H - wy) + '" fill="#4d88ec" opacity="0.22"/>';
    svg += '<line x1="0" x2="' + W + '" y1="' + wy + '" y2="' + wy + '" stroke="#2f6fde" stroke-width="1.5"/>';
    svg += '<text x="8" y="' + (wy - 5) + '" style="font-size:11px;fill:#2f6fde;font-weight:600">WL</text>';
    svg += '<line x1="' + K.x.toFixed(1) + '" y1="' + K.y.toFixed(1) + '" x2="' + CLtop.x.toFixed(1) + '" y2="' + CLtop.y.toFixed(1) + '" stroke="#6b7a8f" stroke-dasharray="5 4"/>';
    svg += '<text x="' + (CLtop.x + 4).toFixed(1) + '" y="' + (CLtop.y).toFixed(1) + '" style="font-size:10px;fill:#6b7a8f">CL</text>';
    // forces
    svg += '<line x1="' + G.x.toFixed(1) + '" y1="' + G.y.toFixed(1) + '" x2="' + G.x.toFixed(1) + '" y2="' + (G.y + 48).toFixed(1) + '" stroke="#c62828" stroke-width="2" marker-end="url(#arr-dn)"/>';
    svg += '<line x1="' + Bh.x.toFixed(1) + '" y1="' + Bh.y.toFixed(1) + '" x2="' + Bh.x.toFixed(1) + '" y2="' + (Math.min(Bh.y, G.y) - 40).toFixed(1) + '" stroke="#2f6fde" stroke-width="2" marker-end="url(#arr-up)"/>';
    if (phi > 0 && Math.abs(gz * s) > 0.5) {
      svg += '<line x1="' + G.x.toFixed(1) + '" y1="' + G.y.toFixed(1) + '" x2="' + Z.x.toFixed(1) + '" y2="' + Z.y.toFixed(1) + '" stroke="#0b1f3a" stroke-width="2.5"/>';
      svg += '<text x="' + ((G.x + Z.x) / 2).toFixed(1) + '" y="' + (G.y - 7).toFixed(1) + '" text-anchor="middle" style="font-size:11px;font-weight:700;fill:#0b1f3a">GZ</text>';
      svg += '<circle cx="' + Z.x.toFixed(1) + '" cy="' + Z.y.toFixed(1) + '" r="3" fill="#0b1f3a"/><text x="' + (Z.x + 6).toFixed(1) + '" y="' + (Z.y + 4).toFixed(1) + '" style="font-size:11px;font-weight:700;fill:#0b1f3a">Z</text>';
    }
    function pt(q, label, color, dx) {
      return '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="4.5" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>' +
        '<text x="' + (q.x + (dx || -10)).toFixed(1) + '" y="' + (q.y + 4).toFixed(1) + '" text-anchor="' + ((dx || -10) < 0 ? "end" : "start") + '" style="font-size:12px;font-weight:700;fill:' + color + '">' + label + "</text>";
    }
    svg += pt(K, "K", "#1b3a66") + pt(B0, phi > 0 ? "B₀" : "B", "#9aa7b8") + pt(M, "M", "#e2671b") + pt(G, "G", "#c62828");
    if (phi > 0) svg += pt(Bh, "B₁", "#2f6fde", 9);
    // readout
    svg += '<rect x="' + (W - 158) + '" y="10" width="148" height="78" rx="6" fill="#fff" stroke="#cfd7e2"/>';
    var lines = ["φ = " + phi + "°", "GZ = " + gz.toFixed(3) + " m", "GM = " + r.GMf.toFixed(3) + " m", "Righting moment = " + U.fmt(r.disp * gz, 0) + " t·m"];
    lines.forEach(function (l, k) { svg += '<text x="' + (W - 150) + '" y="' + (28 + k * 17) + '" style="font-size:11px;fill:#0b1f3a;' + (k === 1 ? "font-weight:700" : "") + '">' + l + "</text>"; });
    if (phi > r.phiDE) svg += '<text x="10" y="' + (H - 10) + '" style="font-size:11px;fill:#c62828;font-weight:600">Deck edge immersed (φ > ' + r.phiDE + '°) — wall-sided result indicative only</text>';
    svg += "</svg>";
    $("#st-section").innerHTML = svg;
  }

  function renderGZ(r) {
    var phiDE = r.phiDE, end = Math.min(60, Math.ceil(phiDE) + 15);
    var valid = r.curve.filter(function (c) { return c.phi <= phiDE; }).map(function (c) { return { x: c.phi, y: c.gz }; });
    var beyond = r.curve.filter(function (c) { return c.phi >= Math.floor(phiDE) && c.phi <= end; }).map(function (c) { return { x: c.phi, y: c.gz }; });
    // include exact deck-edge point to join the two segments
    var gzDE = SC.gzWallSided(r.raw.GMf, r.raw.BM, phiDE);
    valid.push({ x: phiDE, y: gzDE }); beyond[0] = { x: phiDE, y: gzDE };
    var heel = Number($("#st-heel").value);
    Charts.line($("#st-gz"), [
      { name: "GZ", color: "#2f6fde", points: valid },
      { name: "GZ beyond deck edge", color: "#9aa7b8", points: beyond, dash: "6 5" },
      { name: "GM tangent", color: "#e2671b", points: [{ x: 0, y: 0 }, { x: 57.3, y: r.GMf }], dash: "4 4", width: 1.5 }
    ], {
      xLabel: "Heel angle φ (deg)", yLabel: "GZ (m)", xMin: 0, xMax: end, yMin: 0, title: "GZ curve",
      vLines: [{ x: phiDE, label: "Deck edge " + phiDE + "°", color: "#6b7a8f" }, { x: 30, label: "", color: "#cfd7e2" }],
      markers: heel <= end ? [{ x: heel, y: SC.gzWallSided(r.raw.GMf, r.raw.BM, heel), label: "φ=" + heel + "°", color: "#0b1f3a" }] : []
    });
  }

  function renderHydro(p, r) {
    var sw = SC.draftSweep(Object.assign({}, p, { T: r.T }), 40);
    var map = function (k) { return sw.map(function (q) { return { x: q.T, y: q[k] }; }); };
    Charts.line($("#st-hydro"), [
      { name: "KM", color: "#0b1f3a", points: map("KM") },
      { name: "KB", color: "#2f6fde", points: map("KB") },
      { name: "GM", color: "#2e7d32", points: map("GM") }
    ], {
      xLabel: "Draft T (m)", yLabel: "Height above keel (m)", title: "KB KM GM vs draft",
      hLines: [{ y: p.KG, label: "KG = " + p.KG + " m", color: "#c62828" }],
      vLines: [{ x: r.T, label: "T = " + U.fmt(r.T, 2), color: "#2f6fde" }],
      markers: [{ x: r.T, y: r.KM, label: "KM " + U.fmt(r.KM, 2), color: "#0b1f3a" }, { x: r.T, y: r.GMf, label: "GM " + U.fmt(r.GMf, 2), color: "#2e7d32" }]
    });
  }

  /* ---- Saved cases ---- */
  function renderCases() {
    var list = Store.getStabCases(), body = $("#st-cases");
    if (!list.length) { body.innerHTML = '<tr><td colspan="10" class="empty">No saved cases. Press “Save Case” to store the current design for comparison.</td></tr>'; return; }
    var lv = { low: "b-low", moderate: "b-moderate", high: "b-high", critical: "b-critical" };
    body.innerHTML = list.slice().reverse().map(function (c) {
      return "<tr><td style='white-space:nowrap'>" + U.fmtDate(c.savedAt) + "</td><td class='num'>" + U.fmt(c.input.L, 1) + "</td><td class='num'>" + U.fmt(c.input.B, 1) +
        "</td><td class='num'>" + U.fmt(c.T, 2) + "</td><td class='num'>" + U.fmt(c.input.Cb, 2) + "</td><td class='num'>" + U.fmt(c.disp, 0) +
        "</td><td class='num'>" + U.fmt(c.input.KG, 2) + "</td><td class='num'><b>" + U.fmt(c.GMf, 3) + "</b></td><td><span class='badge " + lv[c.verdict.level] + "'>" + esc(c.verdict.title) +
        "</span></td><td class='actions'><button class='btn btn-outline btn-sm' data-act='load' data-id='" + esc(c.id) + "'>Load</button> " +
        "<button class='btn btn-danger btn-sm' data-act='del' data-id='" + esc(c.id) + "'>Delete</button></td></tr>";
    }).join("");
  }

  function init() {
    fillForm(Store.getStabInput() || DEFAULTS);
    $("#st-form").addEventListener("input", update);
    $("#st-form").addEventListener("submit", function (e) { e.preventDefault(); });
    $("#st-heel").addEventListener("input", function () { if (last) { renderSection(last); renderGZ(last); } });
    $$("#st-mode button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); update(); }); });
    $("#st-defaults").addEventListener("click", function () { fillForm(DEFAULTS); update(); U.toast("Default inputs restored."); });
    $("#st-from-ship").addEventListener("click", function () {
      var s = Store.getShip();
      if (!s) { U.toast("No saved ship particulars. Fill in Ship Particulars first.", true); return; }
      $("#st-L").value = s.length; $("#st-B").value = s.beam; $("#st-D").value = s.depth; $("#st-T").value = s.draft;
      setMode("draft"); update(); U.toast("L, B, D, T copied from " + s.name + ".");
    });
    $("#st-save").addEventListener("click", function () {
      if (!last) { U.toast("Correct the inputs before saving.", true); return; }
      var list = Store.getStabCases();
      list.push({ id: "C" + Date.now(), savedAt: Date.now(), input: last.input, T: last.T, disp: last.disp, V: last.V, KB: last.KB, BM: last.BM, KM: last.KM,
        GM: last.GM, GMf: last.GMf, phiDE: last.phiDE, area30: last.area30, rollPeriod: last.rollPeriod, TPC: last.TPC, freeboard: last.freeboard, verdict: last.verdict, checks: last.checks });
      if (Store.saveStabCases(list)) { renderCases(); U.toast("Design case saved."); }
    });
    $("#st-cases").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id");
      var c = Store.getStabCases().filter(function (x) { return x.id === id; })[0]; if (!c) return;
      if (b.getAttribute("data-act") === "load") { fillForm(c.input); update(); window.scrollTo({ top: 0, behavior: "smooth" }); U.toast("Case loaded."); }
      else U.confirmBox("Delete case", "Delete the saved case from " + U.fmtDate(c.savedAt) + "?", "Delete", function () {
        Store.saveStabCases(Store.getStabCases().filter(function (x) { return x.id !== id; })); renderCases(); U.toast("Case deleted.");
      });
    });
    update(); renderCases();
  }

  /* Re-render charts when the view becomes visible (SVG uses viewBox so this is cheap) */
  function refresh() { update(); renderCases(); }

  return { init: init, refresh: refresh, latest: function () { return last; } };
})();
