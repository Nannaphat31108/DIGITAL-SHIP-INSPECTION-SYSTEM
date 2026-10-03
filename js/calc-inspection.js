/* =========================================================
   Module 1 — Inspection logic (pure functions, no DOM)
   - Ship particulars validation (incl. IMO check digit)
   - Finding validation
   - Summary counts and preliminary status from severity
   ========================================================= */
(function (root) {
  "use strict";

  var SEVERITIES = ["Critical", "High", "Moderate", "Low"];
  var SEVERITY_RANK = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
  var DAMAGE_TYPES = ["Corrosion", "Crack", "Dent", "Coating Damage", "Weld Defect"];
  var SHIP_TYPES = [
    "Bulk Carrier", "Oil Tanker", "Chemical Tanker", "Container Ship", "General Cargo",
    "Ro-Ro / Ferry", "Passenger Ship", "Tug / Workboat", "Fishing Vessel", "Other"
  ];

  function isNum(v) { return typeof v === "number" && isFinite(v); }

  /**
   * IMO number check digit:
   * digits d1..d6 are multiplied by 7,6,5,4,3,2; the last digit of the sum must equal d7.
   * Example: IMO 9074729 → 9×7+0×6+7×5+4×4+7×3+2×2 = 139 → check digit 9 ✓
   */
  function isValidIMO(imo) {
    var s = String(imo == null ? "" : imo).trim().replace(/^IMO\s*/i, "");
    if (!/^\d{7}$/.test(s)) return false;
    var sum = 0;
    for (var i = 0; i < 6; i++) sum += Number(s[i]) * (7 - i);
    return sum % 10 === Number(s[6]);
  }

  /** Validate ship particulars. Returns { valid, errors: {field: message} } */
  function validateShip(s, currentYear) {
    var e = {};
    var year = currentYear || new Date().getFullYear();
    if (!s.shipId || !String(s.shipId).trim()) e.shipId = "Ship ID is required.";
    else if (String(s.shipId).trim().length > 20) e.shipId = "Max 20 characters.";
    if (!s.name || !String(s.name).trim()) e.name = "Ship name is required.";
    if (!s.type || SHIP_TYPES.indexOf(s.type) < 0) e.type = "Select a ship type.";

    if (!isNum(s.yearBuilt)) e.yearBuilt = "Year built is required.";
    else if (s.yearBuilt % 1 !== 0 || s.yearBuilt < 1900 || s.yearBuilt > year)
      e.yearBuilt = "Must be a whole year between 1900 and " + year + ".";

    if (!s.imo || !String(s.imo).trim()) e.imo = "IMO number is required.";
    else if (!/^\d{7}$/.test(String(s.imo).trim())) e.imo = "IMO number must be exactly 7 digits.";
    else if (!isValidIMO(s.imo)) e.imo = "Invalid IMO check digit (see help).";

    if (!isNum(s.length)) e.length = "Required.";
    else if (s.length <= 0 || s.length > 500) e.length = "Must be > 0 and ≤ 500 m.";

    if (!isNum(s.beam)) e.beam = "Required.";
    else if (s.beam <= 0 || s.beam > 80) e.beam = "Must be > 0 and ≤ 80 m.";
    else if (isNum(s.length) && s.beam >= s.length) e.beam = "Beam must be smaller than Length.";

    if (!isNum(s.depth)) e.depth = "Required.";
    else if (s.depth <= 0 || s.depth > 50) e.depth = "Must be > 0 and ≤ 50 m.";

    if (!isNum(s.draft)) e.draft = "Required.";
    else if (s.draft <= 0) e.draft = "Must be > 0 m.";
    else if (isNum(s.depth) && s.draft >= s.depth) e.draft = "Draft must be less than Depth (freeboard > 0).";

    if (s.inspectionDate && !/^\d{4}-\d{2}-\d{2}$/.test(s.inspectionDate)) e.inspectionDate = "Invalid date.";
    return { valid: Object.keys(e).length === 0, errors: e };
  }

  /** Validate a finding. Returns { valid, errors } */
  function validateFinding(f) {
    var e = {};
    if (DAMAGE_TYPES.indexOf(f.type) < 0) e.type = "Select a damage type.";
    if (SEVERITIES.indexOf(f.severity) < 0) e.severity = "Select a severity.";
    if (!f.location || !String(f.location).trim()) e.location = "Location is required.";
    if (!isNum(f.sizeLength)) e.sizeLength = "Length is required.";
    else if (f.sizeLength <= 0 || f.sizeLength > 100000) e.sizeLength = "Must be > 0 and ≤ 100,000 mm.";
    if (f.sizeWidth != null && (!isNum(f.sizeWidth) || f.sizeWidth < 0 || f.sizeWidth > 100000))
      e.sizeWidth = "Must be between 0 and 100,000 mm.";
    if (!f.description || String(f.description).trim().length < 5) e.description = "Description is required (min 5 characters).";
    if (!f.position || !isNum(f.position.x) || !isNum(f.position.y)) e.position = "Click on the ship drawing to mark the position.";
    return { valid: Object.keys(e).length === 0, errors: e };
  }

  function countBySeverity(findings) {
    var c = { Critical: 0, High: 0, Moderate: 0, Low: 0, total: 0 };
    (findings || []).forEach(function (f) {
      if (c.hasOwnProperty(f.severity)) { c[f.severity]++; c.total++; }
    });
    return c;
  }

  function countByType(findings) {
    var c = {};
    DAMAGE_TYPES.forEach(function (t) { c[t] = 0; });
    (findings || []).forEach(function (f) { if (c.hasOwnProperty(f.type)) c[f.type]++; });
    return c;
  }

  /**
   * Preliminary condition status — rule based on the highest severity present:
   *   any Critical  → "Not Satisfactory"   (immediate action)
   *   any High      → "Conditional"         (repair required)
   *   any Moderate  → "Satisfactory with Observations"
   *   only Low      → "Satisfactory"
   *   none          → "No Findings Recorded"
   */
  function assessStatus(findings) {
    var c = countBySeverity(findings);
    if (c.total === 0) return { level: "none", title: "No Findings Recorded", desc: "Add findings to obtain a preliminary condition status.", counts: c };
    if (c.Critical > 0) return { level: "critical", title: "Not Satisfactory — Immediate Action", desc: c.Critical + " critical finding(s). Repair before continued operation; refer to attending surveyor.", counts: c };
    if (c.High > 0) return { level: "high", title: "Conditional — Repair Required", desc: c.High + " high-severity finding(s). Plan repairs at the earliest opportunity.", counts: c };
    if (c.Moderate > 0) return { level: "moderate", title: "Satisfactory with Observations", desc: c.Moderate + " moderate finding(s). Monitor and re-inspect at next survey.", counts: c };
    return { level: "low", title: "Satisfactory", desc: "Only low-severity findings recorded. Record and monitor.", counts: c };
  }

  /** Ship profile drawing geometry (SVG units) — shared by UI & zone classification */
  var MAP = { xAP: 60, xFP: 960, deckY: 105, waterY: 175, keelY: 230 };

  /** Describe a picked point on the profile: % length from aft, zone, vertical region */
  function describePosition(pos) {
    var pct = (pos.x - MAP.xAP) / (MAP.xFP - MAP.xAP) * 100;
    pct = Math.max(0, Math.min(100, pct));
    var zone = pct < 30 ? "Aft" : (pct <= 70 ? "Midship (0.4L)" : "Forward");
    var vert = pos.y < MAP.deckY ? "Superstructure / Deck" : (pos.y <= MAP.waterY ? "Topside (above WL)" : "Underwater hull (below WL)");
    return { pctFromAft: Math.round(pct * 10) / 10, zone: zone, vertical: vert };
  }

  /** Sorting helper used by the findings table */
  function sortFindings(list, mode) {
    var arr = list.slice();
    var byDate = function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); };
    switch (mode) {
      case "oldest": arr.sort(byDate); break;
      case "sev-desc": arr.sort(function (a, b) { return (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b.createdAt - a.createdAt); }); break;
      case "sev-asc": arr.sort(function (a, b) { return (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (b.createdAt - a.createdAt); }); break;
      case "id": arr.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); }); break;
      case "type": arr.sort(function (a, b) { return a.type.localeCompare(b.type) || (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]); }); break;
      default: arr.sort(function (a, b) { return byDate(b, a); }); // newest
    }
    return arr;
  }

  function filterFindings(list, q, type, sev) {
    var query = String(q || "").trim().toLowerCase();
    return list.filter(function (f) {
      if (type && f.type !== type) return false;
      if (sev && f.severity !== sev) return false;
      if (!query) return true;
      var hay = [f.id, f.type, f.severity, f.location, f.description, f.note, f.zone].join(" ").toLowerCase();
      return hay.indexOf(query) >= 0;
    });
  }

  var api = {
    SEVERITIES: SEVERITIES, SEVERITY_RANK: SEVERITY_RANK, DAMAGE_TYPES: DAMAGE_TYPES, SHIP_TYPES: SHIP_TYPES, MAP: MAP,
    isValidIMO: isValidIMO, validateShip: validateShip, validateFinding: validateFinding,
    countBySeverity: countBySeverity, countByType: countByType, assessStatus: assessStatus,
    describePosition: describePosition, sortFindings: sortFindings, filterFindings: filterFindings
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.InspectionCalc = api;
})(this);
