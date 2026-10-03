/* =========================================================
   Module 1 — Digital Ship Inspection System (UI)
   Ship particulars form, findings form, ship map picking,
   findings register (search / filter / sort / view / delete)
   ========================================================= */
var Inspection = (function () {
  "use strict";
  var $ = U.$, $$ = U.$$, esc = U.esc, IC = InspectionCalc;
  var pick = null; // currently selected {x,y} on the profile

  /* ---------------- Ship particulars ---------------- */
  var SHIP_FIELDS = ["shipId", "name", "type", "imo", "yearBuilt", "length", "beam", "depth", "draft", "inspector", "inspectionDate", "place"];
  var NUMERIC = { yearBuilt: 1, length: 1, beam: 1, depth: 1, draft: 1 };

  function readShipForm() {
    var s = {};
    SHIP_FIELDS.forEach(function (k) {
      var el = $("#s-" + k);
      s[k] = NUMERIC[k] ? U.num(el) : el.value.trim();
    });
    return s;
  }
  function fillShipForm(s) {
    SHIP_FIELDS.forEach(function (k) { $("#s-" + k).value = s && s[k] != null ? s[k] : ""; });
    updateShipDerived();
  }

  function updateShipDerived() {
    var s = readShipForm();
    var y = new Date().getFullYear();
    $("#s-age").value = (s.yearBuilt && s.yearBuilt >= 1900 && s.yearBuilt <= y) ? (y - s.yearBuilt) : "";
    var ok = function (v) { return typeof v === "number" && v > 0; };
    var rows = [
      ["L / B", ok(s.length) && ok(s.beam) ? U.fmt(s.length / s.beam, 2) : "—"],
      ["B / T", ok(s.beam) && ok(s.draft) ? U.fmt(s.beam / s.draft, 2) : "—"],
      ["T / D", ok(s.draft) && ok(s.depth) ? U.fmt(s.draft / s.depth, 3) : "—"],
      ["Freeboard D − T", ok(s.depth) && ok(s.draft) ? U.fmt(s.depth - s.draft, 2) + " m" : "—"],
      ["L × B (plan area)", ok(s.length) && ok(s.beam) ? U.fmt(s.length * s.beam, 1) + " m²" : "—"],
      ["IMO check digit", s.imo ? (IC.isValidIMO(s.imo) ? "✔ Valid" : "✖ Invalid") : "—"]
    ];
    $("#ship-ratios").innerHTML = rows.map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>"; }).join("");
  }

  function initShipForm() {
    $("#s-type").innerHTML = '<option value="">— select —</option>' + IC.SHIP_TYPES.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    var form = $("#ship-form");
    fillShipForm(Store.getShip());
    form.addEventListener("input", updateShipDerived);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = readShipForm();
      var v = IC.validateShip(s);
      U.showErrors(form, v.errors);
      if (!v.valid) { U.toast("Please correct the highlighted fields.", true); return; }
      s.updatedAt = Date.now();
      if (Store.saveShip(s)) U.toast("Ship data saved.");
      else U.toast("Could not save (LocalStorage unavailable).", true);
    });
    $("#ship-reset").addEventListener("click", function () { fillShipForm(Store.getShip()); U.clearErrors(form); });
  }

  /* ---------------- Findings form & map ---------------- */
  function renderPickMap() {
    ShipMap.render($("#pick-map"), {
      uid: "pick", findings: Store.getFindings(), pick: pick,
      onPick: function (p) {
        pick = p;
        var d = IC.describePosition(p);
        $("#pick-info").innerHTML = "<b>Selected:</b> " + esc(d.zone) + " · " + esc(d.vertical) + " · " + d.pctFromAft + "% L from AP";
        $('[data-field="position"]').classList.remove("invalid");
        var loc = $("#f-location");
        if (!loc.value.trim() || loc.dataset.auto === "1") { loc.value = d.zone + ", " + d.vertical; loc.dataset.auto = "1"; }
        renderPickMap();
      },
      onMarker: viewFinding
    });
  }

  function selectedSeverity() { var r = $('#f-severity input:checked'); return r ? r.value : ""; }
  function syncSevPicker() { $$("#f-severity label").forEach(function (l) { l.classList.toggle("on", $("input", l).checked); }); }

  function clearFindingForm() {
    var form = $("#finding-form");
    form.reset(); $("#f-location").dataset.auto = "";
    syncSevPicker(); U.clearErrors(form);
    pick = null;
    $("#pick-info").textContent = "No position selected — click inside the hull.";
    renderPickMap();
  }

  function initFindings() {
    var typeOpts = IC.DAMAGE_TYPES.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    $("#f-type").innerHTML = '<option value="">— select —</option>' + typeOpts;
    $("#t-type").innerHTML = '<option value="">All types</option>' + typeOpts;
    $("#f-severity").addEventListener("change", syncSevPicker);
    $("#f-location").addEventListener("input", function () { this.dataset.auto = ""; });

    var form = $("#finding-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = {
        type: $("#f-type").value, severity: selectedSeverity(), location: $("#f-location").value.trim(),
        sizeLength: U.num($("#f-sizeLength")), sizeWidth: U.num($("#f-sizeWidth")),
        description: $("#f-description").value.trim(), note: $("#f-note").value.trim(), position: pick
      };
      var v = IC.validateFinding(f);
      var posField = $('[data-field="position"]');
      posField.style.display = v.errors.position ? "" : "none";
      U.showErrors(form, v.errors);
      if (!v.valid) { U.toast(v.errors.position && Object.keys(v.errors).length === 1 ? v.errors.position : "Please correct the highlighted fields.", true); return; }
      var d = IC.describePosition(pick);
      f.id = Store.nextFindingId();
      f.zone = d.zone; f.vertical = d.vertical; f.pctFromAft = d.pctFromAft;
      f.createdAt = Date.now();
      var list = Store.getFindings(); list.push(f);
      if (!Store.saveFindings(list)) { U.toast("Could not save (LocalStorage unavailable).", true); return; }
      U.toast("Finding " + f.id + " added.");
      clearFindingForm();
      renderTable();
    });
    $("#finding-clear").addEventListener("click", clearFindingForm);
    ["#t-search", "#t-type", "#t-sev", "#t-sort"].forEach(function (s) { $(s).addEventListener("input", renderTable); });

    $("#findings-body").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id");
      if (b.getAttribute("data-act") === "view") viewFinding(id);
      else deleteFinding(id);
    });
    renderPickMap();
    renderTable();
  }

  function sizeText(f) { return U.fmt(f.sizeLength, 0) + (f.sizeWidth ? " × " + U.fmt(f.sizeWidth, 0) : ""); }

  function renderTable() {
    var all = Store.getFindings();
    var rows = IC.sortFindings(IC.filterFindings(all, $("#t-search").value, $("#t-type").value, $("#t-sev").value), $("#t-sort").value);
    var body = $("#findings-body");
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9" class="empty">' + (all.length ? "No findings match the current search / filter." : "No findings recorded yet. Select a position on the ship drawing and add a finding.") + "</td></tr>";
    } else {
      body.innerHTML = rows.map(function (f) {
        return "<tr><td class='mono'><b>" + esc(f.id) + "</b></td><td class='type-tag'>" + esc(f.type) + "</td><td>" + U.sevBadge(f.severity) +
          "</td><td>" + esc(f.location) + "</td><td>" + esc(f.zone) + "</td><td class='num'>" + sizeText(f) +
          "</td><td class='desc-cell' title='" + esc(f.description) + "'>" + esc(f.description) + "</td><td style='white-space:nowrap'>" + U.fmtDate(f.createdAt) +
          "</td><td class='actions'><button class='btn btn-outline btn-sm' data-act='view' data-id='" + esc(f.id) + "'>View</button> " +
          "<button class='btn btn-danger btn-sm' data-act='del' data-id='" + esc(f.id) + "'>Delete</button></td></tr>";
      }).join("");
    }
    $("#findings-foot").textContent = "Showing " + rows.length + " of " + all.length + " finding(s)";
    var st = IC.assessStatus(all);
    $("#findings-status").textContent = "Status: " + st.title;
  }

  function viewFinding(id) {
    var f = Store.getFindings().filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    var body = '<div id="modal-map" style="margin-bottom:14px"></div><dl class="detail-grid">' +
      "<dt>Finding ID</dt><dd class='mono'><b>" + esc(f.id) + "</b></dd>" +
      "<dt>Damage Type</dt><dd>" + esc(f.type) + "</dd>" +
      "<dt>Severity</dt><dd>" + U.sevBadge(f.severity) + "</dd>" +
      "<dt>Location</dt><dd>" + esc(f.location) + "</dd>" +
      "<dt>Hull Zone</dt><dd>" + esc(f.zone) + " · " + esc(f.vertical) + " · " + f.pctFromAft + "% L from AP</dd>" +
      "<dt>Size</dt><dd>" + sizeText(f) + " mm</dd>" +
      "<dt>Description</dt><dd>" + esc(f.description) + "</dd>" +
      "<dt>Inspector Note</dt><dd>" + (f.note ? esc(f.note) : "<span style='color:#9aa7b8'>—</span>") + "</dd>" +
      "<dt>Recorded</dt><dd>" + U.fmtDate(f.createdAt) + "</dd></dl>";
    U.openModal("Finding " + f.id, body,
      '<button class="btn btn-danger" id="m-del">Delete</button><button class="btn btn-outline" data-close>Close</button>');
    ShipMap.render($("#modal-map"), { uid: "modal", findings: [f] });
    $("#m-del").onclick = function () { U.closeModal(); deleteFinding(f.id); };
  }

  function deleteFinding(id) {
    U.confirmBox("Delete finding", "Delete finding " + id + "? This cannot be undone.", "Delete", function () {
      Store.saveFindings(Store.getFindings().filter(function (f) { return f.id !== id; }));
      U.toast("Finding " + id + " deleted.");
      renderTable(); renderPickMap();
    });
  }

  function refresh() { fillShipForm(Store.getShip()); renderTable(); renderPickMap(); }

  function init() { initShipForm(); initFindings(); }

  return { init: init, refresh: refresh, renderTable: renderTable, renderPickMap: renderPickMap, viewFinding: viewFinding, sizeText: sizeText };
})();
