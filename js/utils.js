/* =========================================================
   Small shared helpers (DOM, formatting, validation display)
   ========================================================= */
var U = (function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** Escape user text before inserting into innerHTML (prevents broken markup / XSS) */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** Read a number input: returns null when blank, NaN when not a number */
  function num(el) {
    var s = String(el.value).trim();
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function fmt(v, d) {
    if (v == null || !isFinite(v)) return "—";
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function today() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  var SEV_COLOR = { Critical: "#c62828", High: "#e2671b", Moderate: "#d9a406", Low: "#2e7d32" };
  function sevBadge(sev) { return '<span class="badge b-' + esc(String(sev).toLowerCase()) + '">' + esc(sev) + "</span>"; }

  /** Show / clear field errors. Fields are wrapped in .field with data-field="key" */
  function showErrors(form, errors) {
    $$(".field[data-field]", form).forEach(function (f) {
      var key = f.getAttribute("data-field");
      var errEl = $(".err", f);
      if (errors && errors[key]) {
        f.classList.add("invalid");
        if (errEl) errEl.textContent = errors[key];
      } else {
        f.classList.remove("invalid");
        if (errEl) errEl.textContent = "";
      }
    });
    var first = $(".field.invalid input, .field.invalid select, .field.invalid textarea", form);
    if (first) first.focus({ preventScroll: false });
  }
  function clearErrors(form) { showErrors(form, {}); }

  function toast(msg, isErr) {
    var host = $("#toast-host");
    var t = document.createElement("div");
    t.className = "toast" + (isErr ? " err" : "");
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  /* Modal */
  function openModal(title, bodyHtml, footHtml) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHtml;
    $("#modal-foot").innerHTML = footHtml || '<button class="btn btn-outline" data-close>Close</button>';
    $("#modal").classList.add("open");
  }
  function closeModal() { $("#modal").classList.remove("open"); }

  /** Confirmation dialog using the modal; calls onYes when confirmed */
  function confirmBox(title, message, yesLabel, onYes) {
    openModal(title, "<p>" + esc(message) + "</p>",
      '<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-danger" id="confirm-yes">' + esc(yesLabel || "Delete") + "</button>");
    $("#confirm-yes").onclick = function () { closeModal(); onYes(); };
  }

  return { $: $, $$: $$, esc: esc, num: num, fmt: fmt, fmtDate: fmtDate, today: today, SEV_COLOR: SEV_COLOR, sevBadge: sevBadge,
    showErrors: showErrors, clearErrors: clearErrors, toast: toast, openModal: openModal, closeModal: closeModal, confirmBox: confirmBox };
})();
