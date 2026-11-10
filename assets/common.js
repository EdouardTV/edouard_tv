/* Fonctions partagées entre le site public et la page de gestion. */
(function () {
  "use strict";

  function pad(n) {
    var x = parseInt(n, 10);
    return isNaN(x) ? "???" : String(x).padStart(3, "0");
  }

  function fmtDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    var p = iso.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric"
    });
  }

  function safeUrl(u) {
    if (!u) return "";
    try {
      var url = new URL(u, location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (e) { return ""; }
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "text") node.textContent = v;
        else if (k === "class") node.className = v;
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function normalize(data) {
    data.site = data.site || {};
    data.lieux = Array.isArray(data.lieux) ? data.lieux : [];
    data.especes = Array.isArray(data.especes) ? data.especes : [];
    data.top10 = Array.isArray(data.top10) ? data.top10 : [];
    data.especes.forEach(function (s) {
      s.observations = Array.isArray(s.observations) ? s.observations : [];
      ["nom", "nomScientifique", "groupe", "ordre", "famille", "photo"].forEach(function (k) {
        if (typeof s[k] !== "string") s[k] = "";
      });
    });
    return data;
  }

  function lieuxById(data) {
    var m = {};
    data.lieux.forEach(function (l) { m[l.id] = l; });
    return m;
  }

  function lieuIds(sp) {
    var seen = [];
    sp.observations.forEach(function (o) {
      if (o.lieu && seen.indexOf(o.lieu) === -1) seen.push(o.lieu);
    });
    return seen;
  }

  function dates(sp) {
    return sp.observations.map(function (o) { return o.date; }).filter(Boolean).sort();
  }

  function firstDate(sp) { var d = dates(sp); return d[0] || ""; }
  function lastDate(sp) { var d = dates(sp); return d[d.length - 1] || ""; }

  function byNumero(a, b) { return (a.numero || 0) - (b.numero || 0); }

  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
  }

  function plural(n, one, many) { return n + " " + (n > 1 ? many : one); }

  window.Col = {
    pad: pad, fmtDate: fmtDate, safeUrl: safeUrl, el: el, normalize: normalize,
    lieuxById: lieuxById, lieuIds: lieuIds, firstDate: firstDate, lastDate: lastDate,
    byNumero: byNumero, slug: slug, plural: plural
  };
})();
