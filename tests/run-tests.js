/* Unit tests for the calculation logic.
   Run:  node tests/run-tests.js
   (No libraries needed — uses Node's built-in assert) */
"use strict";
var assert = require("assert");
var I = require("../js/calc-inspection.js");
var A = require("../js/calc-assessment.js");
var S = require("../js/calc-stability.js");

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { failed++; console.log("  ✗ " + name + "\n      " + e.message); }
}
function near(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= (tol || 1e-3), (msg || "") + " expected " + b + ", got " + a); }

console.log("\nModule 1 — Inspection");
test("IMO check digit: valid numbers", function () {
  assert.ok(I.isValidIMO("9074729"));  // 9*7+0*6+7*5+4*4+7*3+2*2 = 139 → 9
  assert.ok(I.isValidIMO("9176187"));
});
test("IMO check digit: invalid numbers", function () {
  assert.ok(!I.isValidIMO("9074728"));
  assert.ok(!I.isValidIMO("907472"));
  assert.ok(!I.isValidIMO("abcdefg"));
});
test("Ship validation catches draft ≥ depth and beam ≥ length", function () {
  var v = I.validateShip({ shipId: "S1", name: "X", type: "Bulk Carrier", yearBuilt: 2010, imo: "9074729", length: 100, beam: 120, depth: 8, draft: 9 }, 2026);
  assert.ok(!v.valid); assert.ok(v.errors.beam); assert.ok(v.errors.draft);
});
test("Ship validation passes a correct ship", function () {
  var v = I.validateShip({ shipId: "S1", name: "X", type: "Bulk Carrier", yearBuilt: 2010, imo: "9074729", length: 180, beam: 30, depth: 16, draft: 10 }, 2026);
  assert.ok(v.valid, JSON.stringify(v.errors));
});
test("Status from severity", function () {
  assert.strictEqual(I.assessStatus([]).level, "none");
  assert.strictEqual(I.assessStatus([{ severity: "Low" }]).level, "low");
  assert.strictEqual(I.assessStatus([{ severity: "Low" }, { severity: "Moderate" }]).level, "moderate");
  assert.strictEqual(I.assessStatus([{ severity: "High" }, { severity: "Moderate" }]).level, "high");
  assert.strictEqual(I.assessStatus([{ severity: "High" }, { severity: "Critical" }]).level, "critical");
});
test("Counts by severity/type", function () {
  var f = [{ severity: "High", type: "Crack" }, { severity: "High", type: "Dent" }, { severity: "Low", type: "Crack" }];
  var c = I.countBySeverity(f); assert.strictEqual(c.High, 2); assert.strictEqual(c.total, 3);
  assert.strictEqual(I.countByType(f).Crack, 2);
});
test("Zone from position", function () {
  assert.strictEqual(I.describePosition({ x: 510, y: 200 }).zone, "Midship (0.4L)");
  assert.strictEqual(I.describePosition({ x: 100, y: 200 }).zone, "Aft");
  assert.strictEqual(I.describePosition({ x: 900, y: 120 }).zone, "Forward");
});

console.log("\nModule 2 — Structural Damage Assessment");
test("Thickness diminution: t0=12, tm=10, allow 20%", function () {
  var t = A.thickness(12, 10, 20, 10);
  near(t.diminution, 2); near(t.diminutionPct, 16.67, 0.01); near(t.tmin, 9.6);
  near(t.marginRatio, 0.833, 0.001); near(t.rate, 0.2); near(t.remainingLife, 2.0, 0.05);
  assert.ok(/Substantial/.test(t.status));
});
test("Thickness exceeding allowable", function () {
  var t = A.thickness(10, 7.5, 20); assert.ok(/Exceeds/.test(t.status)); near(t.diminutionPct, 25);
});
test("Corrosion requires thickness data", function () {
  var res = A.compute({ location: "x", zone: "aft", member: "side", type: "Corrosion", length: 100, allowPct: 20 });
  assert.ok(!res.ok); assert.ok(res.errors.t0 && res.errors.tm);
});
test("Measured > original thickness rejected", function () {
  var res = A.compute({ location: "x", zone: "aft", member: "side", type: "Corrosion", length: 100, t0: 10, tm: 11, allowPct: 20 });
  assert.ok(!res.ok); assert.ok(res.errors.tm);
});
test("Corrosion score: secondary aft, 80% of allowable → M=60, S=60 High", function () {
  var res = A.compute({ location: "x", zone: "aft", member: "side", type: "Corrosion", length: 300, width: 200, t0: 10, tm: 8.4, allowPct: 20 });
  assert.ok(res.ok); near(res.measureScore, 60, 0.05); near(res.score, 60, 0.05); assert.strictEqual(res.severity, "High");
});
test("Corrosion primary midship factors 1.25 × 1.15", function () {
  var res = A.compute({ location: "x", zone: "midship", member: "keel", type: "Corrosion", length: 300, t0: 10, tm: 8.4, allowPct: 20 });
  near(res.score, 86.3, 0.1); assert.strictEqual(res.severity, "Critical");
});
test("Crack: 200 mm through-thickness, secondary aft → 40+25+20 = 85 Critical", function () {
  var res = A.compute({ location: "x", zone: "aft", member: "frame", type: "Crack", length: 200, through: true, allowPct: 20 });
  near(res.score, 85); assert.strictEqual(res.severity, "Critical"); assert.ok(res.furtherInspection);
});
test("Dent: depth 20 / width 500 = 4% → M = 30, tertiary → 22.5 Low", function () {
  var res = A.compute({ location: "x", zone: "forward", member: "bracket", type: "Dent", length: 600, width: 500, depth: 20, allowPct: 20 });
  near(res.dentRatio, 4); near(res.score, 22.5); assert.strictEqual(res.severity, "Low");
});
test("Coating 10% → FAIR, M=15", function () {
  var res = A.compute({ location: "x", zone: "aft", member: "side", type: "Coating Damage", length: 1000, areaPct: 10, allowPct: 20 });
  assert.strictEqual(res.coatingCondition, "FAIR"); near(res.score, 15);
});
test("Score capped at 100", function () {
  var res = A.compute({ location: "x", zone: "midship", member: "keel", type: "Crack", length: 5000, through: true, allowPct: 20 });
  assert.strictEqual(res.score, 100);
});

console.log("\nModule 3 — Stability");
var base = { mode: "draft", L: 100, B: 20, D: 10, T: 6, Cb: 0.75, Cwp: 0.85, rho: 1.025, KG: 7, FSC: 0 };
test("Volume & displacement: ∇ = L·B·T·Cb, Δ = ρ∇", function () {
  var res = S.compute(base);
  near(res.V, 9000, 0.1); near(res.disp, 9225, 0.1);
});
test("Morrish KB = T(5/6 − Cb/(3Cwp))", function () {
  var res = S.compute(base);
  near(res.KB, 6 * (5 / 6 - 0.75 / 2.55), 0.001);
});
test("BM = Cwp²·L·B³/12 / ∇ and GM = KB + BM − KG", function () {
  var res = S.compute(base);
  var BM = 0.85 * 0.85 * 100 * 8000 / 12 / 9000;
  near(res.BM, BM, 0.001);
  near(res.GM, res.KB + BM - 7, 0.002);
});
test("Box barge check: Cb=Cwp=1 → KB=T/2, BM=B²/(12T)", function () {
  var res = S.compute({ mode: "draft", L: 50, B: 10, D: 5, T: 2, Cb: 1, Cwp: 1, rho: 1.025, KG: 3, FSC: 0 });
  near(res.KB, 1); near(res.BM, 100 / 24, 0.001);
});
test("Displacement mode gives back the same draft", function () {
  var res = S.compute(Object.assign({}, base, { mode: "disp", disp: 9225 }));
  near(res.T, 6, 0.001);
});
test("TPC = ρ·Awp/100", function () {
  var res = S.compute(base); near(res.TPC, 1.025 * 0.85 * 100 * 20 / 100, 0.01);
});
test("GZ wall-sided: GZ(0)=0, small angle ≈ GM·sin φ", function () {
  near(S.gzWallSided(1, 5, 0), 0);
  near(S.gzWallSided(1, 5, 2), Math.sin(2 * Math.PI / 180) * (1 + 0.5 * 5 * Math.pow(Math.tan(2 * Math.PI / 180), 2)), 1e-9);
});
test("Free surface reduces GM", function () {
  var a = S.compute(base), b = S.compute(Object.assign({}, base, { FSC: 0.3 }));
  near(a.GMf - b.GMf, 0.3, 0.002);
});
test("Negative GM → unstable verdict", function () {
  var res = S.compute(Object.assign({}, base, { KG: 12 }));
  assert.ok(res.GMf < 0); assert.strictEqual(res.verdict.level, "critical");
});
test("Validation: draft ≥ depth, Cwp < Cb", function () {
  var v = S.validate(Object.assign({}, base, { T: 11, Cwp: 0.7 }));
  assert.ok(v.errors.T); assert.ok(v.errors.Cwp);
});
test("Deck-edge angle = atan(freeboard / (B/2))", function () {
  var res = S.compute(base); near(res.phiDE, Math.atan(4 / 10) * 180 / Math.PI, 0.05);
});

console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed ? 1 : 0);
