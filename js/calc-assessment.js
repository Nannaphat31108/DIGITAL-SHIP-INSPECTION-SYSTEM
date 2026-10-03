/* =========================================================
   Module 2 — Structural Damage Assessment (pure functions)
   Educational, rule-based preliminary assessment.
   NOT a class/surveyor approval method.
   ========================================================= */
(function (root) {
  "use strict";

  var TYPES = ["Corrosion", "Crack", "Dent", "Coating Damage", "Weld Defect"];

  /* Structural members and their importance category.
     Primary   = contributes to hull girder / watertight integrity
     Secondary = local stiffening / shell between primary members
     Tertiary  = minor / non-load-carrying details */
  var MEMBERS = [
    { id: "keel", name: "Keel / Bottom Plating", cat: "primary" },
    { id: "deck", name: "Strength Deck Plating", cat: "primary" },
    { id: "sheer", name: "Sheer Strake", cat: "primary" },
    { id: "bulkhead", name: "Watertight Bulkhead", cat: "primary" },
    { id: "girder", name: "Longitudinal Girder", cat: "primary" },
    { id: "side", name: "Side Shell Plating", cat: "secondary" },
    { id: "frame", name: "Transverse Frame", cat: "secondary" },
    { id: "long", name: "Longitudinal Stiffener", cat: "secondary" },
    { id: "hatch", name: "Hatch Coaming", cat: "secondary" },
    { id: "bracket", name: "Bracket / Knee", cat: "tertiary" },
    { id: "nonstr", name: "Non-structural (rails, casings)", cat: "tertiary" }
  ];

  var MEMBER_FACTOR = { primary: 1.25, secondary: 1.0, tertiary: 0.75 };
  var ZONE_FACTOR = { midship: 1.15, aft: 1.0, forward: 1.0 };
  var ZONE_LABEL = { aft: "Aft (0 – 0.3L)", midship: "Midship 0.4L (0.3 – 0.7L)", forward: "Forward (0.7 – 1.0L)" };

  // Severity bands on the 0–100 score
  var BANDS = [
    { min: 75, sev: "Critical" },
    { min: 50, sev: "High" },
    { min: 25, sev: "Moderate" },
    { min: 0, sev: "Low" }
  ];

  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function r(v, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(v * p) / p; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function memberById(id) { for (var i = 0; i < MEMBERS.length; i++) if (MEMBERS[i].id === id) return MEMBERS[i]; return null; }

  /** Input validation. Optional numeric fields may be null. */
  function validate(inp) {
    var e = {};
    if (!inp.location || !String(inp.location).trim()) e.location = "Location is required.";
    if (!ZONE_FACTOR.hasOwnProperty(inp.zone)) e.zone = "Select a hull zone.";
    if (!memberById(inp.member)) e.member = "Select the structural member.";
    if (TYPES.indexOf(inp.type) < 0) e.type = "Select a damage type.";

    if (!isNum(inp.length)) e.length = "Damage length is required.";
    else if (inp.length <= 0 || inp.length > 50000) e.length = "Must be > 0 and ≤ 50,000 mm.";
    if (inp.width != null && (!isNum(inp.width) || inp.width < 0 || inp.width > 50000)) e.width = "Must be 0 – 50,000 mm.";
    if (inp.depth != null && (!isNum(inp.depth) || inp.depth < 0 || inp.depth > 1000)) e.depth = "Must be 0 – 1,000 mm.";

    var hasT0 = inp.t0 != null, hasTm = inp.tm != null;
    if (hasT0 && (!isNum(inp.t0) || inp.t0 <= 0 || inp.t0 > 100)) e.t0 = "Must be > 0 and ≤ 100 mm.";
    if (hasTm && (!isNum(inp.tm) || inp.tm < 0 || inp.tm > 100)) e.tm = "Must be 0 – 100 mm.";
    if (hasT0 !== hasTm) {
      if (!hasT0) e.t0 = "Enter original thickness together with measured thickness.";
      else e.tm = "Enter measured thickness together with original thickness.";
    }
    if (hasT0 && hasTm && !e.t0 && !e.tm && inp.tm > inp.t0) e.tm = "Measured thickness cannot exceed original thickness.";

    if (!isNum(inp.allowPct) || inp.allowPct <= 0 || inp.allowPct >= 100) e.allowPct = "Must be between 0 and 100 %.";
    if (inp.years != null && (!isNum(inp.years) || inp.years <= 0 || inp.years > 100)) e.years = "Must be > 0 and ≤ 100 years.";

    // Type-specific required data
    if (inp.type === "Corrosion" && !(hasT0 && hasTm)) {
      e.t0 = e.t0 || "Required for corrosion assessment.";
      e.tm = e.tm || "Required for corrosion assessment.";
    }
    if (inp.type === "Dent") {
      if (inp.depth == null || inp.depth <= 0) e.depth = "Dent depth (> 0) is required for dent assessment.";
      if (inp.width == null || inp.width <= 0) e.width = "Dent width (> 0) is required for dent assessment.";
    }
    if (inp.type === "Coating Damage") {
      if (!isNum(inp.areaPct) || inp.areaPct <= 0 || inp.areaPct > 100) e.areaPct = "Breakdown area % (0 – 100) is required for coating damage.";
    } else if (inp.areaPct != null && (!isNum(inp.areaPct) || inp.areaPct < 0 || inp.areaPct > 100)) {
      e.areaPct = "Must be 0 – 100 %.";
    }
    return { valid: Object.keys(e).length === 0, errors: e };
  }

  /**
   * Thickness diminution:
   *   diminution (mm)     = t0 − tm
   *   diminution (%)      = (t0 − tm) / t0 × 100
   *   t_min               = t0 × (1 − allowable% / 100)
   *   used margin ratio   = diminution% / allowable%
   *   corrosion rate      = (t0 − tm) / years        (mm/year)
   *   remaining life      = (tm − t_min) / rate      (years)
   * Status (IACS-style): ratio < 0.75 → within allowable,
   *   0.75 – 1.0 → substantial corrosion, > 1.0 → exceeds allowable (renewal)
   */
  function thickness(t0, tm, allowPct, years) {
    var dim = t0 - tm;
    var pct = dim / t0 * 100;
    var tmin = t0 * (1 - allowPct / 100);
    var ratio = pct / allowPct;
    var res = {
      t0: t0, tm: tm, diminution: r(dim, 2), diminutionPct: r(pct, 2), remainingPct: r(100 - pct, 2),
      tmin: r(tmin, 2), marginRatio: r(ratio, 3), rate: null, remainingLife: null
    };
    if (ratio > 1) res.status = "Exceeds allowable diminution";
    else if (ratio >= 0.75) res.status = "Substantial corrosion (≥ 75% of allowable)";
    else res.status = "Within allowable diminution";
    if (isNum(years) && years > 0) {
      res.rate = r(dim / years, 3);
      if (dim > 0 && tm > tmin) res.remainingLife = r((tm - tmin) / (dim / years), 1);
      else if (tm <= tmin) res.remainingLife = 0;
    }
    return res;
  }

  /**
   * Measurement score M (0–100) for each damage type — educational heuristic:
   *   Corrosion : M = 75 × (diminution% / allowable%)
   *   Crack     : M = 40 + length/8 (+20 if through-thickness)
   *   Dent      : M = 7.5 × (depth / width × 100)
   *   Coating   : M = 1.5 × breakdown area %
   *   Weld      : M = 30 + length/10 (+25 if through-thickness)
   * If thickness data exist for a non-corrosion type, M = max(M, corrosion score).
   * Final score S = min(100, M × member factor × zone factor)
   */
  function compute(inp) {
    var v = validate(inp);
    if (!v.valid) return { ok: false, errors: v.errors };

    var member = memberById(inp.member);
    var fm = MEMBER_FACTOR[member.cat];
    var fz = ZONE_FACTOR[inp.zone];
    var out = { ok: true, input: inp, member: member, memberFactor: fm, zoneFactor: fz, metrics: [], recs: [], notes: [] };

    var width = isNum(inp.width) ? inp.width : 0;
    out.areaMm2 = r(inp.length * width, 0);
    out.areaM2 = r(inp.length * width / 1e6, 4);

    var th = null, thScore = null;
    if (isNum(inp.t0) && isNum(inp.tm)) {
      th = thickness(inp.t0, inp.tm, inp.allowPct, inp.years);
      thScore = 75 * th.marginRatio;
      out.thickness = th;
    }

    var M = 0, basis = "";
    switch (inp.type) {
      case "Corrosion":
        M = thScore; basis = "75 × (" + th.diminutionPct + "% ÷ " + inp.allowPct + "%)";
        out.metrics.push({ k: "Thickness diminution", v: th.diminutionPct + " %" });
        break;
      case "Crack":
        M = 40 + inp.length / 8 + (inp.through ? 20 : 0);
        basis = "40 + " + inp.length + "/8" + (inp.through ? " + 20 (through-thickness)" : "");
        out.metrics.push({ k: "Crack length", v: inp.length + " mm" });
        break;
      case "Dent":
        var ratio = inp.depth / inp.width * 100;
        out.dentRatio = r(ratio, 2);
        M = 7.5 * ratio; basis = "7.5 × (" + inp.depth + "/" + inp.width + " × 100 = " + r(ratio, 2) + "%)";
        out.metrics.push({ k: "Dent depth / width", v: r(ratio, 2) + " %" });
        break;
      case "Coating Damage":
        M = 1.5 * inp.areaPct; basis = "1.5 × " + inp.areaPct + "% breakdown";
        out.coatingCondition = inp.areaPct < 3 ? "GOOD" : (inp.areaPct < 20 ? "FAIR" : "POOR");
        out.metrics.push({ k: "Coating condition", v: out.coatingCondition + " (" + inp.areaPct + "% breakdown)" });
        break;
      case "Weld Defect":
        M = 30 + inp.length / 10 + (inp.through ? 25 : 0);
        basis = "30 + " + inp.length + "/10" + (inp.through ? " + 25 (through-thickness)" : "");
        out.metrics.push({ k: "Defect length", v: inp.length + " mm" });
        break;
    }
    if (inp.type !== "Corrosion" && thScore != null && thScore > M) {
      out.notes.push("Thickness loss governs the measurement score (" + r(thScore, 1) + " > " + r(M, 1) + ").");
      M = thScore; basis = "75 × (" + th.diminutionPct + "% ÷ " + inp.allowPct + "%) [thickness governs]";
    }
    M = clamp(M, 0, 100);
    var S = clamp(M * fm * fz, 0, 100);
    out.measureScore = r(M, 1);
    out.scoreBasis = basis;
    out.score = r(S, 1);

    var sev = "Low";
    for (var i = 0; i < BANDS.length; i++) if (out.score >= BANDS[i].min) { sev = BANDS[i].sev; break; }
    out.severity = sev;

    var STATUS = {
      Critical: { status: "Not Acceptable", action: "Immediate repair; vessel condition to be reviewed by attending surveyor/engineer." },
      High: { status: "Repair Required", action: "Plan permanent repair at the earliest opportunity (before next voyage if possible)." },
      Moderate: { status: "Monitor", action: "Record, monitor, and re-inspect at the next survey; consider repair." },
      Low: { status: "Acceptable", action: "Record for trend monitoring. No immediate action." }
    };
    out.status = STATUS[sev].status;
    out.action = STATUS[sev].action;

    // ---- Recommendations (rule-based) ----
    var recs = out.recs;
    if (th) {
      if (th.marginRatio > 1) recs.push("Measured thickness " + th.tm + " mm is below t_min " + th.tmin + " mm → plate/section renewal recommended.");
      else if (th.marginRatio >= 0.75) recs.push("Substantial corrosion → close-up survey and additional thickness measurements (UTM) at next annual survey.");
      if (th.remainingLife != null && th.remainingLife > 0 && th.remainingLife < 5) recs.push("Estimated remaining life ≈ " + th.remainingLife + " years at current corrosion rate → plan renewal.");
    }
    if (inp.type === "Crack") {
      recs.push("Carry out NDT (MPI / Dye-penetrant) to confirm crack ends and full extent.");
      if (inp.through) recs.push("Through-thickness crack → check watertight integrity of adjacent compartments.");
      recs.push("Crack-arrest holes are a temporary measure only; permanent repair by gouging & re-welding or insert plate.");
    }
    if (inp.type === "Dent") {
      recs.push("Inspect for cracks at stiffener/frame connections around the dent.");
      if (out.dentRatio >= 5) recs.push("Dent depth/width ≥ 5% → fairing or cropping & renewal should be considered.");
    }
    if (inp.type === "Coating Damage") {
      recs.push("Surface preparation and re-coating of the affected area; check for underlying pitting.");
      if (out.coatingCondition === "POOR") recs.push("Coating condition POOR → more frequent internal examinations / thickness measurements.");
    }
    if (inp.type === "Weld Defect") {
      recs.push("Examine weld by UT or RT to determine defect depth and extent.");
      recs.push("Grind out and re-weld using an approved procedure (WPS) with qualified welder.");
    }
    if (member.cat === "primary" && inp.zone === "midship" && (sev === "Critical" || sev === "High"))
      recs.push("Primary member within 0.4L amidships → evaluate impact on longitudinal (hull girder) strength.");
    if (!th && inp.type !== "Coating Damage")
      out.notes.push("No thickness data provided — thickness measurement is recommended to complete the assessment.");

    // Further inspection decision
    out.furtherInspection = (sev !== "Low") || (!th && inp.type !== "Coating Damage");
    out.furtherReason = sev !== "Low"
      ? "Severity is " + sev + " — further inspection by a qualified surveyor is recommended."
      : (out.furtherInspection ? "Data incomplete — obtain thickness measurements." : "Not required at this stage (continue routine monitoring).");
    if (recs.length === 0) recs.push("No specific action beyond routine monitoring.");
    return out;
  }

  var api = {
    TYPES: TYPES, MEMBERS: MEMBERS, MEMBER_FACTOR: MEMBER_FACTOR, ZONE_FACTOR: ZONE_FACTOR, ZONE_LABEL: ZONE_LABEL, BANDS: BANDS,
    memberById: memberById, validate: validate, thickness: thickness, compute: compute
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AssessmentCalc = api;
})(this);
