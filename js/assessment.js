/* =========================================================
   Module 2 — Ship Structural Damage Assessment (UI)
   ========================================================= */
var Assessment = (function () {
  "use strict";
  var $ = U.$, esc = U.esc, AC = AssessmentCalc;
  var last = null; // last successful result (enables "Save")

  function readForm() {
    return {
      location: $("#a-location").value.trim(), zone: $("#a-zone").value, member: $("#a-member").value,
      type: $("#a-type").value, through: $("#a-through").checked,
      length: U.num($("#a-length")), width: U.num($("#a-width")), depth: U.num($("#a-depth")), areaPct: U.num($("#a-areaPct")),
      t0: U.num($("#a-t0")), tm: U.num($("#a-tm")), allowPct: U.num($("#a-allowPct")), years: U.num($("#a-years"))
    };
  }
  function fillForm(inp) {
    var set = function (id, v) { $(id).value = v == null ? "" : v; };
    set("#a-location", inp.location); set("#a-zone", inp.zone); set("#a-member", inp.member); set("#a-type", inp.type);
    $("#a-through").checked = !!inp.through;
    set("#a-length", inp.length); set("#a-width", inp.width); set("#a-depth", inp.depth); set("#a-areaPct", inp.areaPct);
    set("#a-t0", inp.t0); set("#a-tm", inp.tm); set("#a-allowPct", inp.allowPct); set("#a-years", inp.years);
    onTypeChange(); onMemberChange();
  }

  /* Show which fields are required for the chosen damage type */
  function onTypeChange() {
    var t = $("#a-type").value;
    $("#a-t-req").hidden = $("#a-t-req2").hidden = t !== "Corrosion";
    $("#a-width-req").hidden = $("#a-depth-req").hidden = t !== "Dent";
    $("#a-area-req").hidden = t !== "Coating Damage";
    var th = $("#a-through");
    th.disabled = !(t === "Crack" || t === "Weld Defect");
    if (th.disabled) th.checked = false;
  }
  function onMemberChange() {
    var m = AC.memberById($("#a-member").value);
    $("#a-member-cat").textContent = m ? "Category: " + m.cat.charAt(0).toUpperCase() + m.cat.slice(1) + " (factor × " + AC.MEMBER_FACTOR[m.cat].toFixed(2) + ")" : "";
  }

  function meter(score) {
    var segs = [["#2e7d32", 25], ["#d9a406", 25], ["#e2671b", 25], ["#c62828", 25]];
    return '<div class="meter-wrap"><div class="meter-pin" style="left:' + Math.min(100, Math.max(0, score)) + '%">' + score + '</div><div class="meter">' +
      segs.map(function (s) { return '<div style="width:' + s[1] + '%;background:' + s[0] + '"></div>'; }).join("") +
      '</div><div class="meter-scale"><span>0</span><span>25 Moderate</span><span>50 High</span><span>75 Critical</span><span>100</span></div></div>';
  }

  function renderResult(res) {
    var lvl = res.severity.toLowerCase();
    var h = '<div class="status-banner s-' + lvl + '"><div class="st-icon">' + res.severity.charAt(0) + '</div><div><div class="st-title">' +
      esc(res.severity) + " — " + esc(res.status) + '</div><div class="st-desc">' + esc(res.action) + "</div></div></div>";

    h += '<div class="mt">' + meter(res.score) + "</div>";
    h += '<div class="result-big mt">' +
      '<div class="rb"><div class="rb-l">Damage Score S</div><div class="rb-v">' + res.score + " <small>/ 100</small></div></div>" +
      '<div class="rb"><div class="rb-l">Measurement M</div><div class="rb-v">' + res.measureScore + "</div></div>" +
      '<div class="rb"><div class="rb-l">Member × Zone</div><div class="rb-v">' + res.memberFactor.toFixed(2) + " × " + res.zoneFactor.toFixed(2) + "</div></div>";
    if (res.thickness) {
      var t = res.thickness, cls = t.marginRatio > 1 ? "bad" : (t.marginRatio >= 0.75 ? "warn" : "good");
      h += '<div class="rb ' + cls + '"><div class="rb-l">Thickness Reduction</div><div class="rb-v">' + U.fmt(t.diminutionPct, 2) + " <small>%</small></div></div>";
    }
    h += "</div>";

    h += '<div class="formula mt"><span class="c">Calculation</span><br>M = ' + esc(res.scoreBasis) + " = " + res.measureScore +
      "<br>S = min(100, " + res.measureScore + " × " + res.memberFactor.toFixed(2) + " × " + res.zoneFactor.toFixed(2) + ") = <b>" + res.score + "</b></div>";

    h += '<div class="grid g-2 mt" style="gap:18px"><div><h4 style="margin-bottom:6px">Assessment Data</h4><table class="kv">' +
      "<tr><th>Member</th><td>" + esc(res.member.name) + " (" + res.member.cat + ")</td></tr>" +
      "<tr><th>Zone</th><td>" + esc(AC.ZONE_LABEL[res.input.zone]) + "</td></tr>" +
      "<tr><th>Damage size</th><td>" + U.fmt(res.input.length, 0) + (res.input.width ? " × " + U.fmt(res.input.width, 0) : "") + " mm</td></tr>" +
      (res.areaM2 ? "<tr><th>Damage area</th><td>" + U.fmt(res.areaM2, 4) + " m²</td></tr>" : "") +
      res.metrics.map(function (m) { return "<tr><th>" + esc(m.k) + "</th><td>" + esc(m.v) + "</td></tr>"; }).join("");
    if (res.thickness) {
      var tt = res.thickness;
      h += "<tr><th>Diminution Δt</th><td>" + U.fmt(tt.diminution, 2) + " mm (" + U.fmt(tt.diminutionPct, 2) + "%)</td></tr>" +
        "<tr><th>Minimum allowed t_min</th><td>" + U.fmt(tt.tmin, 2) + " mm</td></tr>" +
        "<tr><th>Used margin</th><td>" + U.fmt(tt.marginRatio * 100, 1) + "% of allowable</td></tr>" +
        "<tr><th>Thickness status</th><td>" + esc(tt.status) + "</td></tr>" +
        (tt.rate != null ? "<tr><th>Corrosion rate</th><td>" + U.fmt(tt.rate, 3) + " mm/yr</td></tr>" : "") +
        (tt.remainingLife != null ? "<tr><th>Est. remaining life</th><td>" + U.fmt(tt.remainingLife, 1) + " years</td></tr>" : "");
    }
    h += "</table></div><div>";
    if (res.thickness) h += '<h4 style="margin-bottom:6px">Thickness Comparison (mm)</h4><div class="chart" id="as-th-chart"></div>';
    h += '<h4 style="margin:10px 0 6px">Further Inspection Required?</h4><div class="badge ' + (res.furtherInspection ? "b-high" : "b-low") + '">' +
      (res.furtherInspection ? "YES" : "NO") + '</div><p style="font-size:12.5px;margin-top:6px">' + esc(res.furtherReason) + "</p></div></div>";

    h += '<h4 class="mt" style="margin-bottom:6px">Recommendations</h4><ul class="rec-list">' + res.recs.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>";
    if (res.notes.length) h += '<div class="alert alert-warn mt">' + res.notes.map(esc).join("<br>") + "</div>";

    $("#as-result").innerHTML = h;
    $("#as-result-hint").textContent = "Calculated " + U.fmtDate(Date.now());
    if (res.thickness) {
      var th = res.thickness;
      Charts.bars($("#as-th-chart"), [
        { label: "Original t₀", value: th.t0, color: "#1b3a66" },
        { label: "Measured tₘ", value: th.tm, color: th.marginRatio > 1 ? "#c62828" : "#2f6fde" },
        { label: "Minimum t_min", value: th.tmin, color: "#9aa7b8" }
      ], { labelW: 105, title: "Thickness comparison" });
    }
  }

  function calculate() {
    var form = $("#as-form");
    var res = AC.compute(readForm());
    if (!res.ok) {
      U.showErrors(form, res.errors);
      last = null; $("#as-save").disabled = true;
      U.toast("Please correct the highlighted fields.", true);
      return;
    }
    U.clearErrors(form);
    last = res; $("#as-save").disabled = false;
    renderResult(res);
  }

  function renderHistory() {
    var list = Store.getAssessments();
    $("#as-count").textContent = list.length + " saved";
    var body = $("#as-history");
    if (!list.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No saved assessments.</td></tr>'; return; }
    body.innerHTML = list.slice().reverse().map(function (a) {
      return "<tr><td style='white-space:nowrap'>" + U.fmtDate(a.savedAt) + "</td><td>" + esc(a.input.location) + "</td><td>" + esc(a.input.type) +
        "</td><td class='num'><b>" + a.score + "</b></td><td>" + U.sevBadge(a.severity) + "</td><td class='actions'>" +
        "<button class='btn btn-outline btn-sm' data-act='load' data-id='" + esc(a.id) + "'>Open</button> " +
        "<button class='btn btn-danger btn-sm' data-act='del' data-id='" + esc(a.id) + "'>Delete</button></td></tr>";
    }).join("");
  }

  function init() {
    $("#a-type").innerHTML = '<option value="">— select —</option>' + AC.TYPES.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    var groups = { primary: "Primary members", secondary: "Secondary members", tertiary: "Tertiary / minor" };
    $("#a-member").innerHTML = '<option value="">— select —</option>' + Object.keys(groups).map(function (g) {
      return '<optgroup label="' + groups[g] + '">' + AC.MEMBERS.filter(function (m) { return m.cat === g; })
        .map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + "</option>"; }).join("") + "</optgroup>";
    }).join("");
    $("#a-type").addEventListener("change", onTypeChange);
    $("#a-member").addEventListener("change", onMemberChange);
    $("#as-form").addEventListener("input", function () { if (last) { last = null; $("#as-save").disabled = true; $("#as-result-hint").textContent = "Inputs changed — recalculate"; } });
    $("#as-form").addEventListener("submit", function (e) { e.preventDefault(); calculate(); });
    $("#as-clear").addEventListener("click", function () {
      $("#as-form").reset(); $("#a-allowPct").value = 20; prefillYears(); onTypeChange(); onMemberChange(); U.clearErrors($("#as-form"));
      last = null; $("#as-save").disabled = true;
      $("#as-result").innerHTML = '<div class="chart-empty">Fill in the damage data and press <b>Calculate</b>.</div>';
      $("#as-result-hint").textContent = "Not calculated";
    });
    $("#as-save").addEventListener("click", function () {
      if (!last) return;
      var list = Store.getAssessments();
      var rec = JSON.parse(JSON.stringify(last));
      rec.id = "A" + Date.now(); rec.savedAt = Date.now();
      list.push(rec);
      if (Store.saveAssessments(list)) { U.toast("Assessment saved."); renderHistory(); $("#as-save").disabled = true; }
      else U.toast("Could not save (LocalStorage unavailable).", true);
    });
    $("#as-history").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id");
      var rec = Store.getAssessments().filter(function (a) { return a.id === id; })[0];
      if (!rec) return;
      if (b.getAttribute("data-act") === "load") {
        fillForm(rec.input); U.clearErrors($("#as-form"));
        var res = AC.compute(rec.input);
        if (res.ok) { last = null; $("#as-save").disabled = true; renderResult(res); $("#as-result-hint").textContent = "Loaded record from " + U.fmtDate(rec.savedAt); }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        U.confirmBox("Delete assessment", "Delete the assessment for \"" + rec.input.location + "\"?", "Delete", function () {
          Store.saveAssessments(Store.getAssessments().filter(function (a) { return a.id !== id; }));
          renderHistory(); U.toast("Assessment deleted.");
        });
      }
    });
    prefillYears(); onTypeChange(); renderHistory();
  }

  /* Pre-fill "years in service" from ship particulars when available */
  function prefillYears() {
    var s = Store.getShip(), y = new Date().getFullYear();
    if (s && s.yearBuilt && s.yearBuilt < y) {
      $("#a-years-help").textContent = "Ship age from particulars: " + (y - s.yearBuilt) + " yrs";
      if (!$("#a-years").value) $("#a-years").value = y - s.yearBuilt;
    } else $("#a-years-help").textContent = "";
  }

  return { init: init, renderHistory: renderHistory, prefillYears: prefillYears };
})();
