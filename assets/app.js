/* Site public : lit data/collection.json et affiche la collection, la carte et le top 10. */
(function () {
  "use strict";
  var C = window.Col, el = C.el;
  var $ = function (s) { return document.querySelector(s); };

  var data, lieux, especes, map = null, currentView = "collection", openId = null;

  function photoNode(sp, cls, sizes) {
    if (sp.photo) {
      return el("img", { class: cls, src: sp.photo, alt: sp.nom, loading: "lazy", decoding: "async", sizes: sizes || null });
    }
    return el("div", { class: cls + " ph", "aria-hidden": "true" }, [
      el("span", { class: "ph-txt", text: "Photo à venir" })
    ]);
  }

  function tag(sp, extra) {
    return el("span", { class: "tag" + (extra ? " " + extra : "") }, [
      el("span", { class: "tag-hole", "aria-hidden": "true" }),
      el("span", { class: "tag-num", text: "#" + C.pad(sp.numero) })
    ]);
  }

  function placeText(sp) {
    var names = C.lieuIds(sp).map(function (id) { return lieux[id] ? lieux[id].nom : ""; }).filter(Boolean);
    return names.join(", ");
  }

  function seenText(sp) {
    var n = sp.observations.length;
    return n <= 1 ? "Vu 1 fois" : "Vu " + n + " fois";
  }

  /* ---------- En-tête ---------- */
  function renderHeader() {
    var s = data.site;
    if (s.titre) { $("#site-title").textContent = s.titre; document.title = s.titre; }
    $("#site-sub").textContent = s.sousTitre || "";
    var soc = $("#socials");
    soc.textContent = "";
    [["TikTok", s.tiktok], ["YouTube", s.youtube], ["Instagram", s.instagram]].forEach(function (p) {
      var u = C.safeUrl(p[1]);
      if (u) soc.appendChild(el("a", { href: u, target: "_blank", rel: "noopener", text: p[0] }));
    });
    $("#maj").textContent = s.maj ? "Collection mise à jour le " + C.fmtDate(s.maj) + "." : "";
  }

  function renderLatest() {
    var box = $("#latest");
    box.textContent = "";
    if (!especes.length) return;
    var sp = especes.reduce(function (a, b) { return (b.numero || 0) > (a.numero || 0) ? b : a; });
    var nObs = especes.reduce(function (t, s) { return t + s.observations.length; }, 0);
    var nLieux = data.lieux.filter(function (l) {
      return especes.some(function (s) { return C.lieuIds(s).indexOf(l.id) !== -1; });
    }).length;
    var first = C.firstDate(sp);
    box.appendChild(el("button", { type: "button", class: "latest-card", onclick: function () { go("#n" + C.pad(sp.numero)); } }, [
      el("div", { class: "latest-photo" }, [photoNode(sp, "latest-img"), tag(sp, "tag-lg")]),
      el("div", { class: "latest-text" }, [
        el("p", { class: "latest-kicker", text: "Dernière entrée" }),
        el("p", { class: "latest-name", text: sp.nom }),
        sp.nomScientifique ? el("p", { class: "sci", text: sp.nomScientifique }) : null,
        el("p", { class: "latest-meta", text: [placeText(sp), C.fmtDate(first)].filter(Boolean).join(", le ") })
      ])
    ]));
    box.appendChild(el("p", { class: "tally" }, [
      el("strong", { text: C.plural(especes.length, "espèce", "espèces") }),
      " dans la collection, " + C.plural(nObs, "observation", "observations") + " dans " + C.plural(nLieux, "lieu", "lieux") + "."
    ]));
  }

  /* ---------- Collection ---------- */
  var F = { q: "", groupe: "", ordre: "", famille: "", lieu: "", pays: "", tri: "num" };

  function uniq(values) {
    return values.filter(function (v, i, a) { return v && a.indexOf(v) === i; })
      .sort(function (a, b) { return a.localeCompare(b, "fr"); });
  }

  function fillSelect(id, label, opts) {
    var s = $(id), cur = s.value;
    s.textContent = "";
    s.appendChild(el("option", { value: "", text: label }));
    opts.forEach(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      s.appendChild(el("option", { value: v, text: t }));
    });
    s.value = cur;
  }

  function setupFilters() {
    fillSelect("#f-groupe", "Tous les groupes", uniq(especes.map(function (s) { return s.groupe; })));
    fillSelect("#f-ordre", "Tous les ordres", uniq(especes.map(function (s) { return s.ordre; })));
    fillSelect("#f-famille", "Toutes les familles", uniq(especes.map(function (s) { return s.famille; })));
    var used = data.lieux.filter(function (l) { return especes.some(function (s) { return C.lieuIds(s).indexOf(l.id) !== -1; }); });
    fillSelect("#f-lieu", "Tous les lieux", used.map(function (l) { return [l.id, l.nom]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], "fr"); }));
    fillSelect("#f-pays", "Tous les pays", uniq(used.map(function (l) { return l.pays; })));

    var bind = function (id, key, ev) {
      $(id).addEventListener(ev || "change", function (e) { F[key] = e.target.value; renderGrid(); });
    };
    bind("#f-q", "q", "input"); bind("#f-groupe", "groupe"); bind("#f-ordre", "ordre");
    bind("#f-famille", "famille"); bind("#f-lieu", "lieu"); bind("#f-pays", "pays"); bind("#f-tri", "tri");
    $("#f-reset").addEventListener("click", resetFilters);
    if (window.matchMedia && window.matchMedia("(min-width: 760px)").matches) $("#more").open = true;
  }

  function resetFilters() {
    Object.keys(F).forEach(function (k) { F[k] = k === "tri" ? "num" : ""; });
    ["q", "groupe", "ordre", "famille", "lieu", "pays"].forEach(function (k) { $("#f-" + k).value = ""; });
    $("#f-tri").value = "num";
    renderGrid();
  }

  function fold(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  function filtered() {
    var q = fold(F.q.trim());
    var list = especes.filter(function (s) {
      if (q && fold(s.nom + " " + s.nomScientifique + " " + C.pad(s.numero)).indexOf(q) === -1) return false;
      if (F.groupe && s.groupe !== F.groupe) return false;
      if (F.ordre && s.ordre !== F.ordre) return false;
      if (F.famille && s.famille !== F.famille) return false;
      var ids = C.lieuIds(s);
      if (F.lieu && ids.indexOf(F.lieu) === -1) return false;
      if (F.pays && !ids.some(function (id) { return lieux[id] && lieux[id].pays === F.pays; })) return false;
      return true;
    });
    var sorters = {
      "num": C.byNumero,
      "num-desc": function (a, b) { return C.byNumero(b, a); },
      "nom": function (a, b) { return a.nom.localeCompare(b.nom, "fr"); },
      "vus": function (a, b) { return b.observations.length - a.observations.length || C.byNumero(a, b); },
      "recent": function (a, b) { return C.lastDate(b).localeCompare(C.lastDate(a)) || C.byNumero(b, a); }
    };
    return list.slice().sort(sorters[F.tri] || C.byNumero);
  }

  function card(sp) {
    return el("li", null, [
      el("button", { type: "button", class: "card", onclick: function () { go("#n" + C.pad(sp.numero)); } }, [
        el("div", { class: "card-photo" }, [photoNode(sp, "card-img", "(min-width: 900px) 220px, 46vw"), tag(sp)]),
        el("div", { class: "card-body" }, [
          el("h3", { class: "card-name", text: sp.nom }),
          el("p", { class: "card-meta", text: placeText(sp) || "Lieu non renseigné" }),
          el("p", { class: "card-seen", text: seenText(sp) })
        ])
      ])
    ]);
  }

  function renderGrid() {
    var list = filtered(), grid = $("#grid");
    grid.textContent = "";
    var active = F.q || F.groupe || F.ordre || F.famille || F.lieu || F.pays;
    var nSel = ["groupe", "ordre", "famille", "lieu", "pays"].filter(function (k) { return F[k]; }).length;
    $("#more-sum").textContent = nSel ? "Filtres et tri (" + nSel + " actif" + (nSel > 1 ? "s" : "") + ")" : "Filtres et tri";
    $("#f-reset").hidden = !active;
    $("#result-count").textContent = active
      ? list.length + " sur " + C.plural(especes.length, "espèce", "espèces")
      : C.plural(especes.length, "espèce", "espèces");
    if (!list.length) {
      grid.appendChild(el("li", { class: "empty" }, [
        el("p", { text: "Aucune espèce ne correspond à ces filtres." }),
        el("button", { type: "button", class: "btn", text: "Effacer les filtres", onclick: resetFilters })
      ]));
      return;
    }
    list.forEach(function (sp) { grid.appendChild(card(sp)); });
  }

  /* ---------- Fiche espèce ---------- */
  function openDetail(sp) {
    var d = $("#detail");
    openId = sp.id;
    d.textContent = "";
    var sorted = especes.slice().sort(C.byNumero);
    var i = sorted.indexOf(sp);
    var prev = sorted[i - 1], next = sorted[i + 1];

    var obs = sp.observations.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var tax = [["Groupe", sp.groupe], ["Ordre", sp.ordre], ["Famille", sp.famille]].filter(function (r) { return r[1]; });

    d.appendChild(el("div", { class: "d-inner" }, [
      el("div", { class: "d-top" }, [
        el("button", { type: "button", class: "d-close", "aria-label": "Fermer la fiche", onclick: closeDetail }, ["Fermer"])
      ]),
      el("div", { class: "d-photo" }, [photoNode(sp, "d-img"), tag(sp, "tag-lg")]),
      el("div", { class: "d-body" }, [
        el("h2", { id: "d-name", class: "d-name", text: sp.nom }),
        sp.nomScientifique ? el("p", { class: "sci", text: sp.nomScientifique }) : null,
        tax.length ? el("dl", { class: "d-tax" }, tax.reduce(function (acc, r) {
          return acc.concat([el("dt", { text: r[0] }), el("dd", { text: r[1] })]);
        }, [])) : null,
        el("h3", { class: "d-h", text: sp.observations.length > 1 ? "Mes " + sp.observations.length + " observations" : "Mon observation" }),
        el("ul", { class: "d-obs" }, obs.map(function (o) {
          var l = lieux[o.lieu], u = C.safeUrl(o.video);
          return el("li", null, [
            el("span", { class: "d-date", text: C.fmtDate(o.date) || "Date non renseignée" }),
            el("span", { class: "d-place", text: l ? l.nom + (l.pays ? ", " + l.pays : "") : "Lieu non renseigné" }),
            u ? el("a", { href: u, target: "_blank", rel: "noopener", class: "d-video", text: "Voir la vidéo" }) : null
          ]);
        }))
      ]),
      el("div", { class: "d-nav" }, [
        prev ? el("a", { href: "#n" + C.pad(prev.numero), class: "btn btn-ghost", text: "#" + C.pad(prev.numero) + " précédente" }) : el("span"),
        next ? el("a", { href: "#n" + C.pad(next.numero), class: "btn btn-ghost", text: "#" + C.pad(next.numero) + " suivante" }) : el("span")
      ])
    ]));
    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    }
    d.scrollTop = 0;
  }

  function closeDetail() {
    var d = $("#detail");
    openId = null;
    if (d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
    if (/^#n\d+/.test(location.hash)) history.replaceState(null, "", "#" + currentView);
  }

  /* ---------- Carte ---------- */
  function speciesAt(lieuId) {
    return especes.filter(function (s) { return C.lieuIds(s).indexOf(lieuId) !== -1; }).sort(C.byNumero);
  }

  function renderZones() {
    var ul = $("#zones");
    ul.textContent = "";
    data.lieux.forEach(function (l) {
      var list = speciesAt(l.id);
      if (!list.length) return;
      ul.appendChild(el("li", { class: "zone" }, [
        el("h3", { class: "zone-name" }, [l.nom, el("span", { class: "zone-country", text: l.pays ? " " + l.pays : "" })]),
        el("p", { class: "zone-count", text: C.plural(list.length, "espèce", "espèces") }),
        el("ul", { class: "chips" }, list.map(function (s) {
          return el("li", null, [el("a", { href: "#n" + C.pad(s.numero), text: "#" + C.pad(s.numero) + " " + s.nom })]);
        }))
      ]));
    });
  }

  function initMap() {
    if (map || !window.L) { if (map) map.invalidateSize(); return; }
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17, attribution: "&copy; contributeurs OpenStreetMap"
    }).addTo(map);
    var pts = [];
    data.lieux.forEach(function (l) {
      var list = speciesAt(l.id);
      if (!list.length || typeof l.lat !== "number" || typeof l.lon !== "number") return;
      pts.push([l.lat, l.lon]);
      var m = L.circleMarker([l.lat, l.lon], {
        radius: 9 + Math.sqrt(list.length) * 3, color: "#2A1E05", weight: 2, fillColor: "#D2A23F", fillOpacity: 0.9
      }).addTo(map);
      var pop = el("div", { class: "pop" }, [
        el("p", { class: "pop-title", text: l.nom }),
        el("p", { class: "pop-count", text: C.plural(list.length, "espèce", "espèces") }),
        el("ul", null, list.map(function (s) {
          return el("li", null, [el("a", { href: "#n" + C.pad(s.numero), text: "#" + C.pad(s.numero) + " " + s.nom })]);
        }))
      ]);
      m.bindPopup(pop, { maxHeight: 260 });
      m.bindTooltip(l.nom + ", " + C.plural(list.length, "espèce", "espèces"));
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
    else if (pts.length === 1) map.setView(pts[0], 10);
    else map.setView([0, 0], 2);
  }

  /* ---------- Top 10 ---------- */
  function renderTop() {
    var ol = $("#top");
    ol.textContent = "";
    var byId = {};
    especes.forEach(function (s) { byId[s.id] = s; });
    var list = data.top10.map(function (id) { return byId[id]; }).filter(Boolean).slice(0, 10);
    if (!list.length) { ol.appendChild(el("li", { class: "empty" }, [el("p", { text: "Le top 10 arrive bientôt." })])); return; }
    list.forEach(function (sp, i) {
      ol.appendChild(el("li", null, [
        el("button", { type: "button", class: "top-item", onclick: function () { go("#n" + C.pad(sp.numero)); } }, [
          el("span", { class: "top-rank", text: String(i + 1) }),
          el("div", { class: "top-photo" }, [photoNode(sp, "top-img")]),
          el("div", { class: "top-text" }, [
            el("span", { class: "top-name", text: sp.nom }),
            el("span", { class: "top-meta", text: "#" + C.pad(sp.numero) + (placeText(sp) ? ", " + placeText(sp) : "") })
          ])
        ])
      ]));
    });
  }

  /* ---------- Navigation ---------- */
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

  function showView(v) {
    currentView = v;
    ["collection", "carte", "top10"].forEach(function (k) { $("#view-" + k).hidden = k !== v; });
    document.querySelectorAll(".tabs a").forEach(function (a) {
      if (a.dataset.view === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (v === "carte") setTimeout(initMap, 0);
  }

  function route() {
    var h = location.hash.replace("#", "");
    var m = /^n(\d+)$/.exec(h);
    if (m) {
      var n = parseInt(m[1], 10);
      var sp = especes.filter(function (s) { return s.numero === n; })[0];
      if (sp) { showView(currentView); openDetail(sp); return; }
      h = "collection";
    }
    if (openId) closeDetail();
    showView(["collection", "carte", "top10"].indexOf(h) !== -1 ? h : "collection");
  }

  /* ---------- Démarrage ---------- */
  function start() {
    var d = $("#detail");
    d.addEventListener("close", function () {
      openId = null;
      if (/^#n\d+/.test(location.hash)) history.replaceState(null, "", "#" + currentView);
    });
    d.addEventListener("click", function (e) { if (e.target === d) closeDetail(); });

    fetch("data/collection.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (json) {
        data = C.normalize(json);
        lieux = C.lieuxById(data);
        especes = data.especes;
        renderHeader(); renderLatest(); setupFilters(); renderGrid(); renderZones(); renderTop();
        window.addEventListener("hashchange", route);
        route();
      })
      .catch(function () { $("#load-error").hidden = false; $("#view-collection").hidden = true; });
  }

  start();
})();
