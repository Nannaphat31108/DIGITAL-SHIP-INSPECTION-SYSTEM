/* =========================================================
   Storage layer — all persistence goes through LocalStorage.
   Keys are namespaced with "dsis." (Digital Ship Inspection System)
   ========================================================= */
var Store = (function () {
  "use strict";
  var PREFIX = "dsis.";
  var KEYS = {
    ship: "ship",                 // ship particulars object
    findings: "findings",         // array of findings
    findingSeq: "findingSeq",     // running number for Finding IDs
    assessments: "assessments",   // array of saved structural assessments
    stabilityInput: "stabInput",  // last stability inputs
    stabilityCases: "stabCases"   // saved stability cases
  };
  var available = true;
  try { localStorage.setItem(PREFIX + "_t", "1"); localStorage.removeItem(PREFIX + "_t"); }
  catch (e) { available = false; }

  function get(key, fallback) {
    if (!available) return fallback;
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function set(key, value) {
    if (!available) return false;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function remove(key) { if (available) try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ } }
  function clearAll() { Object.keys(KEYS).forEach(function (k) { remove(KEYS[k]); }); }

  /* Change listeners so the dashboard updates whenever data changes */
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit(what) { listeners.forEach(function (fn) { fn(what); }); }

  return {
    KEYS: KEYS, available: function () { return available; },
    get: get, set: set, remove: remove, clearAll: clearAll, onChange: onChange, emit: emit,

    getShip: function () { return get(KEYS.ship, null); },
    saveShip: function (s) { var ok = set(KEYS.ship, s); emit("ship"); return ok; },

    getFindings: function () { return get(KEYS.findings, []); },
    saveFindings: function (list) { var ok = set(KEYS.findings, list); emit("findings"); return ok; },
    nextFindingId: function () {
      var n = get(KEYS.findingSeq, 0) + 1; set(KEYS.findingSeq, n);
      return "F-" + String(n).padStart(3, "0");
    },

    getAssessments: function () { return get(KEYS.assessments, []); },
    saveAssessments: function (list) { var ok = set(KEYS.assessments, list); emit("assessments"); return ok; },

    getStabInput: function () { return get(KEYS.stabilityInput, null); },
    saveStabInput: function (p) { return set(KEYS.stabilityInput, p); },
    getStabCases: function () { return get(KEYS.stabilityCases, []); },
    saveStabCases: function (list) { var ok = set(KEYS.stabilityCases, list); emit("stability"); return ok; }
  };
})();
