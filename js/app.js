/* =========================================================
   App bootstrap — routing, sidebar, dashboard, data controls
   ========================================================= */
(function () {
  "use strict";
  var $ = U.$, $$ = U.$$, esc = U.esc, IC = InspectionCalc;
  var VIEWS = ["dashboard", "ship", "findings", "report", "assessment", "stability", "about"];

  /* ---------------- Routing (hash based, works from file://) ---------------- */
  function route() {
    var v = (location.hash || "#dashboard").slice(1);
    if (VIEWS.indexOf(v) < 0) v = "dashboard";
    $$(".view").forEach(function (el) { el.classList.toggle("active", el.id === "view-" + v); });
    $$("#nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-view") === v); });
    var sec = $("#view-" + v);
    $("#page-title").textContent = sec.getAttribute("data-title");
    document.title = sec.getAttribute("data-title") + " · DSIS";
    closeSidebar();
    window.scrollTo(0, 0);
    if (v === "dashboard") renderDashboard();
    if (v === "findings") { Inspection.renderTable(); Inspection.renderPickMap(); }
    if (v === "report") Report.build();
    if (v === "assessment") Assessment.prefillYears();
    if (v === "about") renderDataSummary();
  }

  function openSidebar() { $("#sidebar").classList.add("open"); $("#overlay").classList.add("open"); }
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("open"); }

  /* ---------------- Header info ---------------- */
  function renderHeader() {
    var s = Store.getShip();
    $("#vessel-chip").textContent = s ? s.name + " · IMO " + s.imo : "No vessel saved";
    $("#nav-count").textContent = Store.getFindings().length;
  }
  function tick() {
    var d = new Date();
    $("#clock").textContent = U.today() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ---------------- Dashboard ---------------- */
  function renderDashboard() {
    var findings = Store.getFindings();
    var st = IC.assessStatus(findings), c = st.counts;
    $("#dash-status").className = "status-banner s-" + st.level;
    $("#dash-status").innerHTML = '<div class="st-icon">' + (st.level === "none" ? "–" : st.level === "low" ? "✓" : "!") +
      '</div><div><div class="st-title">Preliminary Condition: ' + esc(st.title) + '</div><div class="st-desc">' + esc(st.desc) + "</div></div>";
    $("#k-total").textContent = c.total;
    $("#k-critical").textContent = c.Critical;
    $("#k-high").textContent = c.High;
    $("#k-moderate").textContent = c.Moderate;
    $("#k-low").textContent = c.Low;

    Charts.donut($("#dash-chart-sev"), IC.SEVERITIES.map(function (s) { return { label: s, value: c[s], color: U.SEV_COLOR[s] }; }),
      { centerLabel: "Findings", emptyText: "No findings recorded yet.", title: "Findings by severity" });
    var bt = IC.countByType(findings);
    Charts.bars($("#dash-chart-type"), IC.DAMAGE_TYPES.map(function (t) { return { label: t, value: bt[t], color: "#24497d" }; }),
      { labelW: 118, emptyText: "No findings recorded yet.", title: "Findings by type" });
    ShipMap.render($("#dash-map"), { uid: "dash", findings: findings, onMarker: Inspection.viewFinding });

    var s = Store.getShip();
    $("#dash-ship").innerHTML = s
      ? '<table class="kv">' +
        "<tr><th>Ship name</th><td>" + esc(s.name) + "</td></tr><tr><th>Ship ID</th><td>" + esc(s.shipId) + "</td></tr>" +
        "<tr><th>Type</th><td>" + esc(s.type) + "</td></tr><tr><th>IMO</th><td>" + esc(s.imo) + "</td></tr>" +
        "<tr><th>Year built</th><td>" + s.yearBuilt + " (" + (new Date().getFullYear() - s.yearBuilt) + " yrs)</td></tr>" +
        "<tr><th>L × B × D</th><td>" + U.fmt(s.length, 1) + " × " + U.fmt(s.beam, 1) + " × " + U.fmt(s.depth, 1) + " m</td></tr>" +
        "<tr><th>Draft</th><td>" + U.fmt(s.draft, 2) + " m</td></tr>" +
        "<tr><th>Inspection</th><td>" + esc(s.inspectionDate || "—") + (s.place ? " · " + esc(s.place) : "") + "</td></tr></table>"
      : '<div class="chart-empty">No ship particulars saved.<br><br><a class="btn btn-primary btn-sm" href="#ship">Enter ship data</a></div>';

    var as = Store.getAssessments();
    var worst = as.reduce(function (w, a) { return !w || a.score > w.score ? a : w; }, null);
    $("#tile-1").textContent = c.total + " finding(s) · " + st.title;
    $("#tile-2").textContent = as.length ? as.length + " saved · highest score " + worst.score + " (" + worst.severity + ")" : "No saved assessments";
    var si = Store.getStabInput(), sr = si ? StabilityCalc.compute(si) : null;
    $("#tile-3").textContent = sr && sr.ok ? "GM = " + U.fmt(sr.GMf, 3) + " m · " + sr.verdict.title : "Open to run the simulation";

    var recent = IC.sortFindings(findings, "newest").slice(0, 5);
    $("#dash-recent").innerHTML = recent.length ? recent.map(function (f) {
      return "<tr style='cursor:pointer' data-id='" + esc(f.id) + "'><td class='mono'><b>" + esc(f.id) + "</b></td><td class='type-tag'>" + esc(f.type) + "</td><td>" + U.sevBadge(f.severity) +
        "</td><td>" + esc(f.location) + "</td><td>" + esc(f.zone) + "</td><td>" + U.fmtDate(f.createdAt) + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">No findings yet.</td></tr>';
  }

  /* ---------------- Data management ---------------- */
  function renderDataSummary() {
    var s = Store.getShip();
    $("#data-summary").innerHTML =
      "<tr><th>LocalStorage available</th><td>" + (Store.available() ? "Yes" : "No — data cannot be saved in this browser mode") + "</td></tr>" +
      "<tr><th>Ship particulars</th><td>" + (s ? esc(s.name) : "Not saved") + "</td></tr>" +
      "<tr><th>Findings</th><td>" + Store.getFindings().length + "</td></tr>" +
      "<tr><th>Structural assessments</th><td>" + Store.getAssessments().length + "</td></tr>" +
      "<tr><th>Stability cases</th><td>" + Store.getStabCases().length + "</td></tr>";
  }

  function loadDemo() {
    var y = new Date().getFullYear();
    Store.clearAll();
    Store.saveShip({ shipId: "SHP-001", name: "MV Siam Navigator", type: "Bulk Carrier", imo: "9074729", yearBuilt: 2009,
      length: 180, beam: 30, depth: 16.5, draft: 10.5, inspector: "Student Inspector", inspectionDate: U.today(), place: "Laem Chabang, Thailand", updatedAt: Date.now() });
    var t0 = Date.now() - 6 * 3600e3;
    var demo = [
      { type: "Corrosion", severity: "High", location: "Bottom shell, Fr. 92–96, Port", sizeLength: 1200, sizeWidth: 600, description: "General corrosion with pitting on bottom plating near bilge keel.", note: "UTM readings required; possible renewal.", position: { x: 520, y: 205 } },
      { type: "Crack", severity: "Critical", location: "Side shell, Fr. 74, Stbd", sizeLength: 180, sizeWidth: 0, description: "Through-thickness crack at bracket toe of side frame.", note: "Immediate repair; NDT to confirm crack ends.", position: { x: 430, y: 145 } },
      { type: "Dent", severity: "Moderate", location: "Fwd side shell, Fr. 150, Port", sizeLength: 800, sizeWidth: 500, description: "Contact dent approx. 25 mm deep from berthing.", note: "Check internal frames for buckling.", position: { x: 780, y: 160 } },
      { type: "Coating Damage", severity: "Low", location: "Aft topside, Fr. 20", sizeLength: 2000, sizeWidth: 1000, description: "Coating breakdown and light surface rust.", note: "Touch-up at next dry-dock.", position: { x: 250, y: 150 } },
      { type: "Weld Defect", severity: "Moderate", location: "Main deck, hatch coaming No.4", sizeLength: 150, sizeWidth: 10, description: "Undercut and porosity along fillet weld of coaming bracket.", note: "Grind and re-weld.", position: { x: 640, y: 112 } },
      { type: "Coating Damage", severity: "Moderate", location: "Bow, below WL", sizeLength: 3000, sizeWidth: 1500, description: "Anti-fouling coating breakdown approx. 25% of area.", note: "Re-coat during docking.", position: { x: 885, y: 200 } },
      { type: "Corrosion", severity: "Low", location: "Accommodation front bulkhead", sizeLength: 400, sizeWidth: 300, description: "Light localized corrosion around door frame.", note: "", position: { x: 160, y: 80 } }
    ].map(function (f, i) {
      var d = IC.describePosition(f.position);
      f.id = "F-" + String(i + 1).padStart(3, "0"); f.zone = d.zone; f.vertical = d.vertical; f.pctFromAft = d.pctFromAft;
      f.createdAt = t0 + i * 20 * 60e3; return f;
    });
    Store.saveFindings(demo);
    Store.set(Store.KEYS.findingSeq, demo.length);

    var years = y - 2009;
    var as = [
      { location: "Bottom shell, Fr. 92–96, Port", zone: "midship", member: "keel", type: "Corrosion", length: 1200, width: 600, depth: null, areaPct: null, t0: 16, tm: 13.2, allowPct: 20, years: years, through: false },
      { location: "Side shell, Fr. 74, Stbd", zone: "midship", member: "side", type: "Crack", length: 180, width: null, depth: null, areaPct: null, t0: null, tm: null, allowPct: 20, years: years, through: true },
      { location: "Fwd side shell, Fr. 150, Port", zone: "forward", member: "side", type: "Dent", length: 800, width: 500, depth: 25, areaPct: null, t0: 14, tm: 13.5, allowPct: 20, years: years, through: false }
    ].map(function (inp, i) {
      var r = AssessmentCalc.compute(inp); r.id = "A" + (Date.now() + i); r.savedAt = t0 + (i + 8) * 20 * 60e3; return r;
    }).filter(function (r) { return r.ok; });
    Store.saveAssessments(as);
    Store.saveStabInput({ mode: "draft", L: 180, B: 30, D: 16.5, T: 10.5, disp: null, Cb: 0.8, Cwp: 0.88, rho: 1.025, KG: 10.2, FSC: 0.15 });
  }

  function init() {
    Inspection.init(); Report.init(); Assessment.init(); Stability.init();

    $("#menu-btn").addEventListener("click", openSidebar);
    $("#overlay").addEventListener("click", closeSidebar);
    window.addEventListener("hashchange", route);
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]") || e.target.id === "modal") U.closeModal();
      var tr = e.target.closest("#dash-recent tr[data-id]");
      if (tr) Inspection.viewFinding(tr.getAttribute("data-id"));
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") U.closeModal(); });

    Store.onChange(function () {
      renderHeader();
      if ($("#view-dashboard").classList.contains("active")) renderDashboard();
      if ($("#view-about").classList.contains("active")) renderDataSummary();
    });

    $("#data-demo").addEventListener("click", function () {
      U.confirmBox("Load demo data", "This replaces all current data with a sample vessel, findings, assessments and stability inputs. Continue?", "Load demo", function () {
        loadDemo(); location.hash = "#dashboard"; location.reload();
      });
    });
    $("#data-clear").addEventListener("click", function () {
      U.confirmBox("Clear all data", "Delete ALL saved data (ship, findings, assessments, stability cases) from this browser?", "Clear all", function () {
        Store.clearAll(); location.hash = "#dashboard"; location.reload();
      });
    });

    if (!Store.available()) U.toast("LocalStorage is not available — data will not be saved.", true);
    renderHeader(); tick(); setInterval(tick, 30000);
    route();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
