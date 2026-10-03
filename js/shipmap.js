/* =========================================================
   Ship profile SVG — used to pick damage positions and to show
   all findings as numbered, severity-coloured markers.
   Coordinates are stored in SVG units (viewBox 0 0 1000 280).
   ========================================================= */
var ShipMap = (function () {
  "use strict";
  var M = InspectionCalc.MAP; // { xAP:60, xFP:960, deckY:105, waterY:175, keelY:230 }
  var HULL = "M 60 105 L 930 105 L 965 90 L 936 220 Q 931 230 915 230 L 130 230 Q 82 230 68 200 L 60 165 Z";

  function markerNo(id) { var m = /(\d+)$/.exec(String(id)); return m ? String(Number(m[1])) : "?"; }

  /**
   * render(el, { findings, pick, onPick, uid })
   *   pick   : {x,y} currently selected point (optional)
   *   onPick : function({x,y}) — enables click-to-pick mode
   */
  function render(el, o) {
    o = o || {};
    var uid = o.uid || el.id || "map";
    var x30 = M.xAP + 0.3 * (M.xFP - M.xAP), x70 = M.xAP + 0.7 * (M.xFP - M.xAP);
    var s = '<svg class="ship-map' + (o.onPick ? " pickable" : "") + '" viewBox="0 0 1000 280" role="img" aria-label="Ship profile with damage locations">';
    s += '<defs><clipPath id="hc-' + uid + '"><path d="' + HULL + '"/></clipPath></defs>';
    // sea
    s += '<rect x="0" y="' + M.waterY + '" width="1000" height="' + (280 - M.waterY - 28) + '" fill="#dbe8f7" opacity="0.55"/>';
    // superstructure, funnel, mast
    s += '<rect class="super" x="88" y="45" width="132" height="60"/>';
    s += '<rect class="super" x="104" y="25" width="100" height="20"/>';
    for (var w = 0; w < 6; w++) s += '<rect x="' + (112 + w * 15) + '" y="30" width="9" height="7" fill="#24497d"/>';
    s += '<path class="super" d="M 150 45 L 156 8 L 186 8 L 182 45 Z" style="fill:#c9d6e8"/>';
    s += '<rect x="156" y="8" width="30" height="7" fill="#1b3a66"/>';
    s += '<line x1="900" y1="105" x2="900" y2="55" stroke="#1b3a66" stroke-width="2"/>';
    // hull with darker underwater part
    s += '<path class="hull" d="' + HULL + '"/>';
    s += '<rect class="hull-below" x="0" y="' + M.waterY + '" width="1000" height="80" clip-path="url(#hc-' + uid + ')"/>';
    s += '<path d="' + HULL + '" fill="none" stroke="#1b3a66" stroke-width="2"/>';
    // hatch covers
    for (var h = 0; h < 6; h++) s += '<rect x="' + (300 + h * 98) + '" y="97" width="76" height="8" fill="#9fb2cf" stroke="#1b3a66" stroke-width="1"/>';
    // reference lines
    s += '<line class="wl" x1="30" x2="985" y1="' + M.waterY + '" y2="' + M.waterY + '"/>';
    s += '<text class="dim-label" x="988" y="' + (M.waterY - 4) + '" text-anchor="end">WL</text>';
    [x30, x70].forEach(function (x) { s += '<line class="zone-line" x1="' + x + '" x2="' + x + '" y1="20" y2="245"/>'; });
    s += '<line x1="' + M.xAP + '" x2="' + M.xAP + '" y1="236" y2="248" stroke="#6b7a8f"/><text class="dim-label" x="' + M.xAP + '" y="260" text-anchor="middle">AP</text>';
    s += '<line x1="' + M.xFP + '" x2="' + M.xFP + '" y1="236" y2="248" stroke="#6b7a8f"/><text class="dim-label" x="' + M.xFP + '" y="260" text-anchor="middle">FP</text>';
    s += '<text class="zone-label" x="' + ((M.xAP + x30) / 2) + '" y="272" text-anchor="middle">AFT</text>';
    s += '<text class="zone-label" x="' + ((x30 + x70) / 2) + '" y="272" text-anchor="middle">MIDSHIP 0.4L</text>';
    s += '<text class="zone-label" x="' + ((x70 + M.xFP) / 2) + '" y="272" text-anchor="middle">FORWARD</text>';

    // markers (critical drawn last = on top)
    var list = (o.findings || []).slice().sort(function (a, b) {
      return InspectionCalc.SEVERITY_RANK[a.severity] - InspectionCalc.SEVERITY_RANK[b.severity];
    });
    list.forEach(function (f) {
      if (!f.position) return;
      s += '<g class="marker" data-id="' + U.esc(f.id) + '"><title>' + U.esc(f.id + " · " + f.type + " · " + f.severity + " · " + f.location) + "</title>";
      s += '<circle cx="' + f.position.x + '" cy="' + f.position.y + '" r="11" fill="' + U.SEV_COLOR[f.severity] + '"/>';
      s += '<text x="' + f.position.x + '" y="' + (f.position.y + 3.5) + '">' + markerNo(f.id) + "</text></g>";
    });
    if (o.pick) {
      var p = o.pick;
      s += '<line class="pick-cross" x1="' + (p.x - 22) + '" x2="' + (p.x + 22) + '" y1="' + p.y + '" y2="' + p.y + '"/>';
      s += '<line class="pick-cross" x1="' + p.x + '" x2="' + p.x + '" y1="' + (p.y - 22) + '" y2="' + (p.y + 22) + '"/>';
      s += '<circle class="pick-marker" cx="' + p.x + '" cy="' + p.y + '" r="14"/>';
    }
    s += "</svg>";
    el.innerHTML = s;

    var svg = el.querySelector("svg");
    if (o.onPick) {
      svg.addEventListener("click", function (ev) {
        var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        var ctm = svg.getScreenCTM(); if (!ctm) return;
        var loc = pt.matrixTransform(ctm.inverse());
        var hull = svg.querySelector("path.hull");
        var inside = true;
        if (hull && hull.isPointInFill) {
          var hp = svg.createSVGPoint(); hp.x = loc.x; hp.y = loc.y;
          inside = hull.isPointInFill(hp) || (loc.x >= 88 && loc.x <= 220 && loc.y >= 8 && loc.y <= 105);
        }
        if (!inside) { U.toast("Please click inside the ship outline.", true); return; }
        o.onPick({ x: Math.round(loc.x), y: Math.round(loc.y) });
      });
    }
    if (o.onMarker) {
      U.$$(".marker", svg).forEach(function (g) {
        g.style.cursor = "pointer";
        g.addEventListener("click", function (ev) { ev.stopPropagation(); o.onMarker(g.getAttribute("data-id")); });
      });
    }
  }

  return { render: render, markerNo: markerNo };
})();
