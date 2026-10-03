/* =========================================================
   Module 3 — Preliminary Ship Design / Stability (pure functions)
   Educational simulation using form coefficients and
   standard textbook approximations. NOT approved software.
   ========================================================= */
(function (root) {
  "use strict";

  var DEG = Math.PI / 180;
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function r(v, d) { var p = Math.pow(10, d == null ? 3 : d); return Math.round(v * p) / p; }

  var GM_MIN = 0.15;        // IMO IS Code 2008, initial GM0 ≥ 0.15 m
  var AREA30_MIN = 0.055;   // IMO IS Code 2008, area under GZ 0–30° ≥ 0.055 m·rad

  function validate(p) {
    var e = {};
    if (!isNum(p.L) || p.L <= 0 || p.L > 500) e.L = "Length must be > 0 and ≤ 500 m.";
    if (!isNum(p.B) || p.B <= 0 || p.B > 80) e.B = "Beam must be > 0 and ≤ 80 m.";
    else if (isNum(p.L) && p.B >= p.L) e.B = "Beam must be smaller than Length.";
    if (!isNum(p.D) || p.D <= 0 || p.D > 50) e.D = "Depth must be > 0 and ≤ 50 m.";
    if (!isNum(p.Cb) || p.Cb < 0.35 || p.Cb > 1) e.Cb = "Cb must be between 0.35 and 1.00.";
    if (!isNum(p.Cwp) || p.Cwp < 0.5 || p.Cwp > 1) e.Cwp = "Cwp must be between 0.50 and 1.00.";
    else if (isNum(p.Cb) && !e.Cb && p.Cwp < p.Cb) e.Cwp = "Cwp must be ≥ Cb (waterplane is always fuller than the block).";
    if (!isNum(p.rho) || p.rho < 0.99 || p.rho > 1.05) e.rho = "Density must be 0.990 – 1.050 t/m³.";
    if (!isNum(p.KG) || p.KG <= 0) e.KG = "KG must be > 0 m.";
    else if (isNum(p.D) && p.KG > 2 * p.D) e.KG = "KG unrealistically high (> 2 × Depth).";
    if (!isNum(p.FSC) || p.FSC < 0 || p.FSC > 5) e.FSC = "Free surface correction must be 0 – 5 m.";

    if (p.mode === "disp") {
      if (!isNum(p.disp) || p.disp <= 0) e.disp = "Displacement must be > 0 t.";
      else if (!e.L && !e.B && !e.D && !e.Cb && !e.rho) {
        var T = p.disp / (p.rho * p.L * p.B * p.Cb);
        if (T >= p.D) e.disp = "Displacement too large: resulting draft " + r(T, 2) + " m ≥ depth " + p.D + " m (no freeboard).";
      }
    } else {
      if (!isNum(p.T) || p.T <= 0) e.T = "Draft must be > 0 m.";
      else if (isNum(p.D) && p.T >= p.D) e.T = "Draft must be less than Depth (freeboard > 0).";
    }
    return { valid: Object.keys(e).length === 0, errors: e };
  }

  /** Hydrostatic & stability values at a given draft T (kept separate so curves can be generated) */
  function hydro(L, B, T, Cb, Cwp, rho) {
    var V = L * B * T * Cb;                        // volume of displacement ∇ (m³)
    var KB = T * (5 / 6 - Cb / (3 * Cwp));         // Morrish's formula
    var IT = Cwp * Cwp * L * Math.pow(B, 3) / 12;  // transverse 2nd moment of waterplane (approx.)
    var BM = IT / V;                               // metacentric radius
    return { V: V, disp: rho * V, KB: KB, IT: IT, BM: BM, KM: KB + BM };
  }

  /** Wall-sided formula: GZ = sin φ · (GM + ½·BM·tan²φ) */
  function gzWallSided(GM, BM, phiDeg) {
    var p = phiDeg * DEG;
    return Math.sin(p) * (GM + 0.5 * BM * Math.tan(p) * Math.tan(p));
  }

  function compute(p) {
    var v = validate(p);
    if (!v.valid) return { ok: false, errors: v.errors };

    var L = p.L, B = p.B, D = p.D, Cb = p.Cb, Cwp = p.Cwp, rho = p.rho;
    var T = p.mode === "disp" ? p.disp / (rho * L * B * Cb) : p.T;
    var h = hydro(L, B, T, Cb, Cwp, rho);

    var GM = h.KM - p.KG;              // solid GM
    var GMf = GM - p.FSC;              // fluid GM (after free surface correction)
    var freeboard = D - T;
    var Awp = Cwp * L * B;
    var TPC = Awp * rho / 100;         // tonnes per cm immersion
    var phiDE = Math.atan(freeboard / (B / 2)) / DEG; // deck-edge immersion angle (box section)

    // Natural roll period (IMO weather criterion): T = 2·C·B / √GM,
    // C = 0.373 + 0.023(B/d) − 0.043(L/100)
    var Croll = 0.373 + 0.023 * (B / T) - 0.043 * (L / 100);
    var rollPeriod = GMf > 0 ? 2 * Croll * B / Math.sqrt(GMf) : null;

    // GZ curve (0–60°, step 1°)
    var curve = [];
    for (var a = 0; a <= 60; a += 1) curve.push({ phi: a, gz: gzWallSided(GMf, h.BM, a), valid: a <= phiDE });

    // Area under GZ 0–30° (trapezoidal rule, radians)
    var area30 = 0;
    for (var i = 1; i <= 30; i++) area30 += (curve[i - 1].gz + curve[i].gz) / 2 * DEG;

    // Maximum GZ within validity range of the wall-sided formula
    var lim = Math.min(60, Math.floor(phiDE)), gzMax = -Infinity, gzMaxAt = 0;
    for (var j = 0; j <= lim; j++) if (curve[j].gz > gzMax) { gzMax = curve[j].gz; gzMaxAt = j; }

    // ---- Evaluation (educational) ----
    var checks = [];
    checks.push({
      name: "Initial metacentric height GM₀ (fluid)", value: r(GMf, 3) + " m", ref: "≥ " + GM_MIN + " m (IMO IS Code 2008)",
      status: GMf < 0 ? "fail" : (GMf >= GM_MIN ? "pass" : "fail")
    });
    var areaValid = phiDE >= 30;
    checks.push({
      name: "Area under GZ curve 0°–30°", value: r(area30, 4) + " m·rad", ref: "≥ " + AREA30_MIN + " m·rad (IMO IS Code 2008)",
      status: !areaValid ? "na" : (area30 >= AREA30_MIN ? "pass" : "fail"),
      sub: areaValid ? "" : "Not evaluated — deck edge immerses at " + r(phiDE, 1) + "° (< 30°), wall-sided formula invalid beyond this."
    });
    var fbRatio = freeboard / D;
    checks.push({
      name: "Freeboard", value: r(freeboard, 2) + " m (" + r(fbRatio * 100, 1) + "% of D)", ref: "Indicative ≥ 15% of depth",
      status: fbRatio >= 0.15 ? "pass" : "warn"
    });
    var gmB = GMf / B;
    checks.push({
      name: "Stiffness ratio GM/B", value: r(gmB, 3), ref: "Indicative 0.02 – 0.15",
      status: GMf <= 0 ? "na" : (gmB > 0.15 ? "warn" : (gmB < 0.02 ? "warn" : "pass")),
      sub: gmB > 0.15 ? "Very stiff ship → short, violent rolling." : (gmB < 0.02 && GMf > 0 ? "Very tender ship → slow, large rolling." : "")
    });

    var verdict;
    if (GMf < 0) verdict = { level: "critical", title: "Unstable (negative GM)", desc: "Centre of gravity G is above metacentre M. The vessel would loll or capsize — lower KG or reduce free surface." };
    else if (GMf < GM_MIN) verdict = { level: "high", title: "Insufficient initial stability", desc: "GM is positive but below the IMO reference minimum of 0.15 m." };
    else if (checks.some(function (c) { return c.status === "fail"; })) verdict = { level: "high", title: "Criteria not fully satisfied", desc: "One or more reference criteria are not met in this simplified check." };
    else if (checks.some(function (c) { return c.status === "warn" || c.status === "na"; })) verdict = { level: "moderate", title: "Positive stability — with observations", desc: "Initial stability is adequate; see warnings for items outside indicative ranges." };
    else verdict = { level: "low", title: "Adequate preliminary stability", desc: "All simplified reference checks are satisfied." };

    return {
      ok: true, input: p,
      T: r(T, 3), V: r(h.V, 1), disp: r(h.disp, 1), freeboard: r(freeboard, 3), Awp: r(Awp, 1), TPC: r(TPC, 2),
      KB: r(h.KB, 3), IT: r(h.IT, 0), BM: r(h.BM, 3), KM: r(h.KM, 3), KG: p.KG, GM: r(GM, 3), GMf: r(GMf, 3),
      phiDE: r(phiDE, 1), rollC: r(Croll, 3), rollPeriod: rollPeriod == null ? null : r(rollPeriod, 2),
      area30: r(area30, 4), gzMax: r(gzMax, 3), gzMaxAt: gzMaxAt,
      ratios: { LB: r(L / B, 2), BT: r(B / T, 2), TD: r(T / D, 3) },
      curve: curve, checks: checks, verdict: verdict,
      raw: { BM: h.BM, GMf: GMf }
    };
  }

  /** KB, BM, KM vs draft — for the hydrostatic diagram */
  function draftSweep(p, n) {
    n = n || 40;
    var out = [];
    var T = p.T || p.D * 0.5;
    var t0 = Math.min(p.D * 0.25, T * 0.8), t1 = p.D * 0.95; // avoid very small drafts where BM → ∞
    for (var i = 0; i <= n; i++) {
      var Ti = t0 + (t1 - t0) * i / n;
      var h = hydro(p.L, p.B, Ti, p.Cb, p.Cwp, p.rho);
      out.push({ T: Ti, KB: h.KB, BM: h.BM, KM: h.KM, disp: h.disp, GM: h.KM - p.KG - p.FSC });
    }
    return out;
  }

  var api = { validate: validate, hydro: hydro, gzWallSided: gzWallSided, compute: compute, draftSweep: draftSweep, GM_MIN: GM_MIN, AREA30_MIN: AREA30_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StabilityCalc = api;
})(this);
