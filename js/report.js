/* =========================================================
   Inspection Report — built from the real stored data,
   printed with window.print() (choose "Save as PDF").
   ========================================================= */
var Report = (function () {
  "use strict";
  var $ = U.$, esc = U.esc, IC = InspectionCalc;

  function kv(label, value) { return "<div><span>" + esc(label) + "</span><span>" + (value == null || value === "" ? "—" : esc(value)) + "</span></div>"; }

  function build() {
    var ship = Store.getShip();
    var findings = IC.sortFindings(Store.getFindings(), "sev-desc");
    var st = IC.assessStatus(findings), c = st.counts;
    var now = new Date();
    var ymd = U.today().replace(/-/g, "");
    var repNo = "RPT-" + (ship ? String(ship.shipId).replace(/[^A-Za-z0-9-]/g, "") : "NA") + "-" + ymd;

    var h = '<header class="rp-head"><div><h1>Ship Inspection Report</h1><div class="rp-sub">Digital Ship Inspection &amp; Engineering Analysis System</div></div>' +
      '<div class="rp-meta"><div><b>Report No.:</b> ' + esc(repNo) + "</div><div><b>Generated:</b> " + U.fmtDate(now.getTime()) + "</div>" +
      "<div><b>Inspection date:</b> " + esc(ship && ship.inspectionDate || "—") + "</div></div></header>";

    if (!ship) h += '<div class="alert alert-warn">Ship particulars have not been saved yet. Go to <b>Ship Particulars</b> to complete the report header.</div>';

    // 1. Vessel
    h += '<section class="rp-section"><h2>1. Vessel Particulars</h2><div class="rp-kv">' +
      kv("Ship ID", ship && ship.shipId) + kv("Ship name", ship && ship.name) + kv("Ship type", ship && ship.type) + kv("IMO number", ship && ship.imo) +
      kv("Year built", ship && ship.yearBuilt) + kv("Age", ship ? (now.getFullYear() - ship.yearBuilt) + " years" : "") +
      kv("Length L", ship ? U.fmt(ship.length, 2) + " m" : "") + kv("Beam B", ship ? U.fmt(ship.beam, 2) + " m" : "") +
      kv("Depth D", ship ? U.fmt(ship.depth, 2) + " m" : "") + kv("Draft T", ship ? U.fmt(ship.draft, 2) + " m" : "") +
      kv("Inspector", ship && ship.inspector) + kv("Place / Port", ship && ship.place) + "</div></section>";

    // 2. Summary
    h += '<section class="rp-section"><h2>2. Inspection Summary</h2>' +
      '<div class="status-banner s-' + st.level + '" style="margin-bottom:12px"><div class="st-icon">' + (st.level === "none" ? "–" : st.level === "low" ? "✓" : "!") +
      '</div><div><div class="st-title">Preliminary condition: ' + esc(st.title) + '</div><div class="st-desc">' + esc(st.desc) + "</div></div></div>" +
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:20px;align-items:center">' +
      '<table class="rp-table"><thead><tr><th>Severity</th><th class="num">No. of findings</th><th class="num">%</th></tr></thead><tbody>' +
      IC.SEVERITIES.map(function (s) { return "<tr><td>" + U.sevBadge(s) + "</td><td class='num'>" + c[s] + "</td><td class='num'>" + (c.total ? Math.round(c[s] / c.total * 100) : 0) + "</td></tr>"; }).join("") +
      "<tr><th>Total</th><th class='num'>" + c.total + "</th><th class='num'>" + (c.total ? 100 : 0) + "</th></tr></tbody></table>" +
      '<div class="chart" id="rp-chart-type"></div></div>' +
      '<p style="font-size:11px;color:#6b7a8f;margin-top:6px">Status rule: any Critical → Not Satisfactory; any High → Conditional; any Moderate → Satisfactory with Observations; otherwise Satisfactory.</p></section>';

    // 3. Map
    h += '<section class="rp-section"><h2>3. Damage Location Plan</h2><div id="rp-map"></div>' +
      '<div class="map-legend"><span><i style="background:#c62828"></i>Critical</span><span><i style="background:#e2671b"></i>High</span><span><i style="background:#d9a406"></i>Moderate</span><span><i style="background:#2e7d32"></i>Low</span><span>Numbers = Finding ID</span></div></section>';

    // 4. Register
    h += '<section class="rp-section"><h2>4. Findings Register</h2>';
    if (!findings.length) h += "<p>No findings recorded.</p>";
    else {
      h += '<table class="rp-table"><thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Location / Zone</th><th>Size (mm)</th><th>Description</th><th>Inspector note</th></tr></thead><tbody>' +
        findings.map(function (f) {
          return "<tr><td><b>" + esc(f.id) + "</b></td><td>" + esc(f.type) + "</td><td>" + U.sevBadge(f.severity) + "</td><td>" + esc(f.location) +
            "<br><span style='color:#6b7a8f'>" + esc(f.zone) + " · " + f.pctFromAft + "% L</span></td><td class='num'>" + Inspection.sizeText(f) + "</td><td>" + esc(f.description) +
            "</td><td>" + esc(f.note || "—") + "</td></tr>";
        }).join("") + "</tbody></table>";
    }
    h += "</section>";

    var sec = 5;
    // 5. Assessments
    if ($("#rp-inc-assess").checked) {
      var as = Store.getAssessments();
      h += '<section class="rp-section"><h2>' + (sec++) + ". Structural Damage Assessment (Module 2)</h2>";
      if (!as.length) h += "<p>No saved structural assessments.</p>";
      else h += '<table class="rp-table"><thead><tr><th>Location</th><th>Member</th><th>Type</th><th>Key measurement</th><th class="num">Score</th><th>Severity</th><th>Status</th><th>Further insp.</th></tr></thead><tbody>' +
        as.map(function (a) {
          var key = a.thickness ? "Δt " + U.fmt(a.thickness.diminutionPct, 1) + "% (t_min " + U.fmt(a.thickness.tmin, 2) + " mm)" : (a.metrics[0] ? a.metrics[0].k + ": " + a.metrics[0].v : "—");
          return "<tr><td>" + esc(a.input.location) + "</td><td>" + esc(a.member.name) + "</td><td>" + esc(a.input.type) + "</td><td>" + esc(key) +
            "</td><td class='num'><b>" + a.score + "</b></td><td>" + U.sevBadge(a.severity) + "</td><td>" + esc(a.status) + "</td><td>" + (a.furtherInspection ? "Yes" : "No") + "</td></tr>";
        }).join("") + "</tbody></table>";
      h += "</section>";
    }

    // 6. Stability
    if ($("#rp-inc-stab").checked) {
      var inp = Store.getStabInput();
      var r = inp ? StabilityCalc.compute(inp) : null;
      h += '<section class="rp-section"><h2>' + (sec++) + ". Preliminary Stability Simulation (Module 3)</h2>";
      if (!r || !r.ok) h += "<p>No valid stability simulation available.</p>";
      else {
        var p = r.input;
        h += '<div class="rp-kv">' +
          kv("L × B × D", U.fmt(p.L, 2) + " × " + U.fmt(p.B, 2) + " × " + U.fmt(p.D, 2) + " m") + kv("Draft T", U.fmt(r.T, 3) + " m") +
          kv("Cb / Cwp", U.fmt(p.Cb, 2) + " / " + U.fmt(p.Cwp, 2)) + kv("Displacement Δ", U.fmt(r.disp, 1) + " t") +
          kv("KB", U.fmt(r.KB, 3) + " m") + kv("BM", U.fmt(r.BM, 3) + " m") + kv("KM", U.fmt(r.KM, 3) + " m") + kv("KG", U.fmt(p.KG, 3) + " m") +
          kv("Free surface corr.", U.fmt(p.FSC, 3) + " m") + kv("GM (fluid)", U.fmt(r.GMf, 3) + " m") +
          kv("Area GZ 0–30°", U.fmt(r.area30, 4) + " m·rad") + kv("Roll period", r.rollPeriod == null ? "—" : U.fmt(r.rollPeriod, 1) + " s") + "</div>";
        h += '<table class="rp-table" style="margin-top:10px"><thead><tr><th>Check</th><th>Value</th><th>Reference</th><th>Result</th></tr></thead><tbody>' +
          r.checks.map(function (k) { return "<tr><td>" + esc(k.name) + "</td><td>" + esc(k.value) + "</td><td>" + esc(k.ref) + "</td><td>" + ({ pass: "Pass", fail: "Fail", warn: "Observation", na: "N/A" })[k.status] + "</td></tr>"; }).join("") +
          "</tbody></table><p style='margin-top:6px'><b>Result:</b> " + esc(r.verdict.title) + " — " + esc(r.verdict.desc) + "</p>";
      }
      h += "</section>";
    }

    h += '<div class="rp-sign"><div>Inspector<br><br>' + esc(ship && ship.inspector || "") + '</div><div>Reviewed by</div></div>';
    h += '<div class="rp-foot">This report was generated by an educational software project. The preliminary status, scores and stability results are based on simplified rules and ' +
      "formulas for learning purposes and do not constitute a classification society survey, certificate, or engineering approval. Total findings: " + c.total + ".</div>";

    $("#report-doc").innerHTML = h;
    $("#report-doc").setAttribute("data-repno", repNo);
    ShipMap.render($("#rp-map"), { uid: "rp", findings: findings });
    var bt = IC.countByType(findings);
    Charts.bars($("#rp-chart-type"), IC.DAMAGE_TYPES.map(function (t) { return { label: t, value: bt[t], color: "#24497d" }; }),
      { labelW: 115, emptyText: "No findings", title: "Findings by type" });
  }

  function init() {
    $("#rp-refresh").addEventListener("click", function () { build(); U.toast("Report refreshed."); });
    $("#rp-inc-assess").addEventListener("change", build);
    $("#rp-inc-stab").addEventListener("change", build);
    $("#rp-print").addEventListener("click", function () {
      build();
      var old = document.title;
      document.title = $("#report-doc").getAttribute("data-repno") || "Inspection-Report"; // used as the PDF file name
      window.print();
      document.title = old;
    });
  }

  return { init: init, build: build };
})();
