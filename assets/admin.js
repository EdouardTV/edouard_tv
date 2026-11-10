/* Page de gestion : lit et écrit data/collection.json et les photos via l'API GitHub. */
(function () {
  "use strict";
  var C = window.Col, el = C.el;
  var $ = function (s) { return document.querySelector(s); };
  var LS = "collection-admin-v1";
  var DATA_PATH = "data/collection.json";

  var cfg = {}, data = null, sha = null, dirty = false, saving = false;
  var editingId = null, pickLieuId = null, miniMap = null, miniLayer = null;

  /* ---------- Stockage local (jeton) ---------- */
  function readCfg() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function writeCfg(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) { /* stockage indisponible */ } }
  function clearCfg() { try { localStorage.removeItem(LS); } catch (e) { /* rien */ } }

  /* ---------- Outils ---------- */
  function toast(msg, isErr) {
    var t = el("div", { class: "toast" + (isErr ? " err" : ""), role: "status", text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 7000 : 4000);
  }

  function b64encodeBytes(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64encodeUtf8(str) { return b64encodeBytes(new TextEncoder().encode(str)); }
  function b64decodeUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = function () { rej(new Error("Lecture de la photo impossible.")); };
      r.readAsDataURL(blob);
    });
  }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function rawUrl(path) {
    return "https://raw.githubusercontent.com/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) + "/" + encodeURIComponent(cfg.branch) + "/" + encPath(path);
  }

  /* ---------- API GitHub ---------- */
  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      "Authorization": "Bearer " + cfg.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + path, { method: opts.method || "GET", headers: headers, body: opts.body, cache: "no-store" })
      .then(function (r) {
        if (r.ok) return r.status === 204 ? null : r.json();
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || ("Erreur " + r.status)); e.status = r.status; throw e;
        });
      });
  }
  function repoPath(p) { return "/repos/" + encodeURIComponent(cfg.owner) + "/" + encodeURIComponent(cfg.repo) + "/contents/" + encPath(p); }

  function explain(e) {
    if (e.status === 401) return "GitHub refuse le jeton : il est faux ou a expiré. Crée un nouveau jeton (guide, étape 5).";
    if (e.status === 403) return "Le jeton n'a pas le droit d'écrire dans ce dépôt. Vérifie qu'il donne l'accès « Contents : Read and write » à ce dépôt.";
    if (e.status === 404) return "Dépôt ou fichier introuvable. Vérifie le nom d'utilisateur, le nom du dépôt et la branche.";
    if (e.status === 409 || e.status === 422) return "Le fichier a été modifié ailleurs depuis l'ouverture de cette page. Télécharge une sauvegarde (Réglages), puis recharge la page.";
    if (!e.status) return "Pas de connexion à GitHub. Vérifie ta connexion internet puis réessaie.";
    return "GitHub a répondu : " + e.message;
  }

  function load() {
    return gh(repoPath(DATA_PATH) + "?ref=" + encodeURIComponent(cfg.branch)).then(function (res) {
      sha = res.sha;
      data = C.normalize(JSON.parse(b64decodeUtf8(res.content)));
    });
  }

  function validate() {
    var seen = {}, dup = [];
    data.especes.forEach(function (s) {
      if (!Number.isInteger(s.numero) || s.numero < 1) dup.push("numéro manquant pour « " + (s.nom || "sans nom") + " »");
      else if (seen[s.numero]) dup.push("#" + C.pad(s.numero) + " est utilisé deux fois");
      seen[s.numero] = true;
      if (!s.nom.trim()) dup.push("l'espèce #" + C.pad(s.numero) + " n'a pas de nom");
    });
    return dup;
  }

  function save(message) {
    if (saving) return Promise.resolve();
    var problems = validate();
    if (problems.length) { toast("Enregistrement bloqué : " + problems.join(", ") + ".", true); return Promise.resolve(); }
    saving = true; setState("Enregistrement en cours…");
    $("#save-btn").disabled = true;
    data.site.maj = today();
    var body = JSON.stringify({
      message: message || "Mise à jour de la collection",
      content: b64encodeUtf8(JSON.stringify(data, null, 2) + "\n"),
      sha: sha, branch: cfg.branch
    });
    return gh(repoPath(DATA_PATH), { method: "PUT", body: body }).then(function (res) {
      sha = res.content.sha; saving = false; setDirty(false);
      toast("Enregistré. Le site public se met à jour d'ici une à deux minutes.");
    }).catch(function (e) {
      saving = false; setDirty(true); toast(explain(e), true);
    });
  }

  /* ---------- État ---------- */
  function setState(t) { $("#save-state").textContent = t; }
  function setDirty(v) {
    dirty = v;
    $("#save-btn").disabled = !v || saving;
    setState(v ? "Modifications non enregistrées." : "Tout est enregistré.");
  }
  function changed() { setDirty(true); }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Connexion ---------- */
  function guessRepo() {
    var h = location.hostname, m = /^([^.]+)\.github\.io$/i.exec(h);
    if (!m) return {};
    var seg = location.pathname.split("/").filter(Boolean);
    var repo = seg.length && !/\.html$/i.test(seg[0]) ? seg[0] : h;
    return { owner: m[1], repo: repo };
  }

  function initLogin() {
    var saved = readCfg(), g = guessRepo();
    $("#l-owner").value = saved.owner || g.owner || "";
    $("#l-repo").value = saved.repo || g.repo || "";
    $("#l-branch").value = saved.branch || "main";
    $("#l-token").value = saved.token || "";
    $("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      cfg = {
        owner: $("#l-owner").value.trim(), repo: $("#l-repo").value.trim(),
        branch: $("#l-branch").value.trim() || "main", token: $("#l-token").value.trim()
      };
      connect($("#l-remember").checked);
    });
    if (saved.token && saved.owner && saved.repo) { cfg = saved; connect(true); }
  }

  function connect(remember) {
    var st = $("#login-status");
    st.className = "full status"; st.textContent = "Connexion à GitHub…";
    load().then(function () {
      if (remember) writeCfg(cfg); else clearCfg();
      $("#login-view").hidden = true; $("#app-view").hidden = false;
      renderAll(); setDirty(false);
    }).catch(function (e) {
      st.className = "full status err"; st.textContent = explain(e);
      $("#login-view").hidden = false; $("#app-view").hidden = true;
    });
  }

  /* ---------- Onglets ---------- */
  function initTabs() {
    document.querySelectorAll(".adm-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".adm-tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
        if (b.dataset.tab === "lieux") setTimeout(initMiniMap, 0);
        if (b.dataset.tab === "top") renderTop();
      });
    });
  }

  function renderAll() {
    renderDatalists(); renderList(); renderEditor(); renderTop(); renderLieux(); renderSite();
  }

  function renderDatalists() {
    ["groupe", "ordre", "famille"].forEach(function (k) {
      var dl = $("#dl-" + k); dl.textContent = "";
      data.especes.map(function (s) { return s[k]; })
        .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
        .sort(function (a, b) { return a.localeCompare(b, "fr"); })
        .forEach(function (v) { dl.appendChild(el("option", { value: v })); });
    });
  }

  /* ---------- Liste des espèces ---------- */
  function thumb(sp) {
    if (sp.photo) return el("span", { class: "sp-thumb" }, [el("img", { src: rawUrl(sp.photo), alt: "", loading: "lazy" })]);
    return el("span", { class: "sp-thumb", text: C.pad(sp.numero) });
  }

  function renderList() {
    var q = $("#sp-q").value.trim().toLowerCase();
    var ul = $("#sp-list"); ul.textContent = "";
    data.especes.slice().sort(C.byNumero).filter(function (s) {
      return !q || (C.pad(s.numero) + " " + s.nom + " " + s.nomScientifique).toLowerCase().indexOf(q) !== -1;
    }).forEach(function (s) {
      ul.appendChild(el("li", null, [
        el("button", {
          type: "button", class: "sp-row", "aria-current": s.id === editingId ? "true" : "false",
          onclick: function () { editingId = s.id; renderList(); renderEditor(); $("#sp-editor").scrollIntoView({ behavior: "smooth", block: "start" }); }
        }, [
          thumb(s),
          el("span", null, [el("b", { text: "#" + C.pad(s.numero) + " " + (s.nom || "Sans nom") }), el("br"), el("small", { text: C.plural(s.observations.length, "observation", "observations") })]),
          el("small", { text: "Modifier" })
        ])
      ]));
    });
  }

  function findSp(id) { return data.especes.filter(function (s) { return s.id === id; })[0]; }

  /* ---------- Fiche d'édition ---------- */
  function input(label, value, oninput, attrs) {
    var a = Object.assign({}, attrs || {});
    var full = a.full; delete a.full;
    var inp = el("input", a);
    inp.value = value == null ? "" : value;
    inp.addEventListener("input", function () { oninput(inp.value, inp); });
    return el("label", { class: "field" + (full ? " full" : "") }, [el("span", { text: label }), inp]);
  }

  function lieuSelect(value, onchange) {
    var s = el("select");
    s.appendChild(el("option", { value: "", text: "Lieu non renseigné" }));
    data.lieux.forEach(function (l) { s.appendChild(el("option", { value: l.id, text: l.nom + (l.pays ? " (" + l.pays + ")" : "") })); });
    s.value = value || "";
    s.addEventListener("change", function () { onchange(s.value); });
    return s;
  }

  function renderEditor() {
    var box = $("#sp-editor"); box.textContent = "";
    var sp = editingId && findSp(editingId);
    if (!sp) return;

    var title = el("h2", { text: "#" + C.pad(sp.numero) + " " + (sp.nom || "Nouvelle espèce") });
    function retitle() { title.textContent = "#" + C.pad(sp.numero) + " " + (sp.nom || "Nouvelle espèce"); renderList(); }

    var numWarn = el("p", { class: "status", text: "" });
    function checkNum() {
      var clash = data.especes.filter(function (s) { return s !== sp && s.numero === sp.numero; })[0];
      numWarn.className = clash ? "status warn" : "status";
      numWarn.textContent = clash ? "Ce numéro est déjà pris par « " + clash.nom + " ». Change l'un des deux, ou utilise « Décaler les numéros » dans Réglages." : "";
    }

    var fields = el("div", { class: "fields" }, [
      input("Numéro", sp.numero, function (v) { sp.numero = parseInt(v, 10); changed(); retitle(); checkNum(); }, { type: "number", min: "1", inputmode: "numeric" }),
      input("Nom", sp.nom, function (v) { sp.nom = v; changed(); retitle(); }),
      input("Nom scientifique", sp.nomScientifique, function (v) { sp.nomScientifique = v; changed(); }, { full: true, autocapitalize: "off" }),
      input("Groupe (ex. Oiseaux)", sp.groupe, function (v) { sp.groupe = v; changed(); }, { list: "dl-groupe" }),
      input("Ordre", sp.ordre, function (v) { sp.ordre = v; changed(); }, { list: "dl-ordre" }),
      input("Famille", sp.famille, function (v) { sp.famille = v; changed(); }, { list: "dl-famille" })
    ]);

    /* Photo */
    var prev = el("div", { class: "photo-prev" });
    function showPrev() {
      prev.textContent = "";
      if (sp.photo) prev.appendChild(el("img", { src: rawUrl(sp.photo), alt: "Photo actuelle" }));
      else prev.appendChild(el("span", { text: "Pas encore de photo" }));
    }
    showPrev();
    var photoStatus = el("p", { class: "status", role: "status" });
    var file = el("input", { type: "file", accept: "image/*", tabindex: "-1", "aria-hidden": "true", style: "position:absolute;left:-9999px" });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0]; if (!f) return;
      uploadPhoto(sp, f, photoStatus).then(function () { showPrev(); renderList(); file.value = ""; });
    });
    var removeBtn = el("button", {
      type: "button", class: "btn btn-ghost btn-small", text: "Retirer la photo",
      onclick: function () {
        if (!sp.photo || !confirm("Retirer la photo de cette espèce ?")) return;
        var old = sp.photo; sp.photo = ""; showPrev(); renderList();
        save("Photo retirée : " + sp.nom).then(function () { deleteFile(old); });
      }
    });
    var photo = el("div", { class: "photo-box" }, [prev, el("div", null, [
      file,
      el("button", { type: "button", class: "btn btn-small", text: sp.photo ? "Changer la photo" : "Ajouter une photo", onclick: function () { file.click(); } }),
      " ", removeBtn,
      el("p", { class: "help", text: "La photo est réduite automatiquement avant l'envoi, puis enregistrée tout de suite." }),
      photoStatus
    ])]);

    /* Observations */
    var obsBox = el("div");
    function renderObs() {
      obsBox.textContent = "";
      sp.observations.forEach(function (o, i) {
        var date = el("input", { type: "date", value: o.date || "" }); date.value = o.date || "";
        date.addEventListener("input", function () { o.date = date.value; changed(); });
        var vid = el("input", { type: "url", inputmode: "url", placeholder: "Lien de la vidéo", value: o.video || "" }); vid.value = o.video || "";
        vid.addEventListener("input", function () { o.video = vid.value.trim(); changed(); });
        obsBox.appendChild(el("div", { class: "obs-row" }, [
          el("label", { class: "field" }, [el("span", { text: "Date" }), date]),
          el("label", { class: "field" }, [el("span", { text: "Lieu" }), lieuSelect(o.lieu, function (v) { o.lieu = v; changed(); })]),
          el("label", { class: "field" }, [el("span", { text: "Vidéo" }), vid]),
          el("button", {
            type: "button", class: "btn btn-danger btn-small", text: "Supprimer",
            onclick: function () {
              if (!confirm("Supprimer cette observation ?")) return;
              sp.observations.splice(i, 1); changed(); renderObs();
            }
          })
        ]));
      });
      if (!sp.observations.length) obsBox.appendChild(el("p", { class: "help", text: "Aucune observation. Ajoute au moins la première rencontre." }));
    }
    renderObs();

    var addObs = el("button", {
      type: "button", class: "btn btn-ghost btn-small", text: "Ajouter une observation",
      onclick: function () {
        var last = sp.observations[sp.observations.length - 1];
        sp.observations.push({ date: today(), lieu: last ? last.lieu : "", video: "" });
        changed(); renderObs();
      }
    });

    var del = el("button", {
      type: "button", class: "btn btn-danger btn-small", text: "Supprimer l'espèce",
      onclick: function () {
        if (!confirm("Supprimer définitivement « " + sp.nom + " » de la collection ? Pense à enregistrer ensuite.")) return;
        data.especes = data.especes.filter(function (s) { return s !== sp; });
        data.top10 = data.top10.filter(function (id) { return id !== sp.id; });
        editingId = null; changed(); renderAll();
      }
    });

    box.appendChild(el("div", { class: "panel" }, [
      title, fields, numWarn,
      el("h3", { text: "Photo" }), photo,
      el("h3", { text: "Observations" }), obsBox,
      el("div", { class: "row-actions" }, [addObs]),
      el("div", { class: "row-actions" }, [
        el("button", { type: "button", class: "btn", text: "Enregistrer", onclick: function () { save("Mise à jour : " + sp.nom); } }),
        el("button", { type: "button", class: "btn btn-ghost", text: "Fermer la fiche", onclick: function () { editingId = null; renderEditor(); renderList(); } }),
        del
      ])
    ]));
    checkNum();
  }

  function addSpecies() {
    var max = data.especes.reduce(function (m, s) { return Math.max(m, s.numero || 0); }, 0);
    var sp = {
      id: "e" + Date.now().toString(36), numero: max + 1, nom: "", nomScientifique: "",
      groupe: "", ordre: "", famille: "", photo: "",
      observations: [{ date: today(), lieu: data.lieux.length ? data.lieux[0].id : "", video: "" }]
    };
    data.especes.push(sp); editingId = sp.id; changed();
    renderList(); renderEditor();
    $("#sp-editor").scrollIntoView({ behavior: "smooth", block: "start" });
    var first = $("#sp-editor input:not([type=number])"); if (first) first.focus();
  }

  /* ---------- Photos ---------- */
  function resizeImage(file, max, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("Conversion de la photo impossible.")); }, "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Ce format de photo n'est pas lisible par le navigateur. Essaie une photo en JPEG.")); };
      img.src = url;
    });
  }

  function uploadPhoto(sp, file, status) {
    status.className = "status"; status.textContent = "Préparation de la photo…";
    var path = "photos/" + C.pad(sp.numero) + "-" + C.slug(sp.nom) + "-" + Date.now().toString(36) + ".jpg";
    var old = sp.photo;
    return resizeImage(file, 1600, 0.82).then(blobToBase64).then(function (b64) {
      status.textContent = "Envoi de la photo…";
      return gh(repoPath(path), { method: "PUT", body: JSON.stringify({ message: "Photo : " + (sp.nom || "espèce"), content: b64, branch: cfg.branch }) });
    }).then(function () {
      sp.photo = path;
      status.textContent = "Photo envoyée, enregistrement de la fiche…";
      return save("Photo ajoutée : " + (sp.nom || "espèce"));
    }).then(function () {
      if (!dirty) {
        status.className = "status ok"; status.textContent = "Photo en ligne. Elle apparaîtra sur le site d'ici une à deux minutes.";
        if (old && old !== sp.photo) deleteFile(old);
      } else {
        status.className = "status err"; status.textContent = "La photo est envoyée mais la fiche n'est pas enregistrée. Appuie sur Enregistrer.";
      }
    }).catch(function (e) {
      status.className = "status err"; status.textContent = e.status ? explain(e) : e.message;
    });
  }

  function deleteFile(path) {
    return gh(repoPath(path) + "?ref=" + encodeURIComponent(cfg.branch)).then(function (f) {
      return gh(repoPath(path), { method: "DELETE", body: JSON.stringify({ message: "Ancienne photo supprimée", sha: f.sha, branch: cfg.branch }) });
    }).catch(function () { /* fichier déjà absent : sans conséquence */ });
  }

  /* ---------- Top 10 ---------- */
  function renderTop() {
    var box = $("#top-slots"); box.textContent = "";
    var sorted = data.especes.slice().sort(C.byNumero);
    for (var i = 0; i < 10; i++) {
      (function (i) {
        var s = el("select", { "aria-label": "Place " + (i + 1) });
        s.appendChild(el("option", { value: "", text: "(vide)" }));
        sorted.forEach(function (sp) { s.appendChild(el("option", { value: sp.id, text: "#" + C.pad(sp.numero) + " " + sp.nom })); });
        s.value = data.top10[i] || "";
        s.addEventListener("change", function () {
          var arr = []; for (var k = 0; k < 10; k++) arr[k] = data.top10[k] || "";
          arr[i] = s.value;
          data.top10 = arr.filter(Boolean);
          changed(); renderTop();
        });
        box.appendChild(el("div", { class: "top-slot" }, [el("b", { text: String(i + 1) }), el("label", { class: "field" }, [s])]));
      })(i);
    }
    var dups = data.top10.filter(function (v, i, a) { return a.indexOf(v) !== i; });
    $("#top-warn").className = dups.length ? "status warn" : "status";
    $("#top-warn").textContent = dups.length ? "Une même espèce apparaît plusieurs fois dans le top 10." : "";
  }

  /* ---------- Lieux ---------- */
  function usage(id) {
    return data.especes.reduce(function (n, s) { return n + s.observations.filter(function (o) { return o.lieu === id; }).length; }, 0);
  }

  function renderLieux() {
    var box = $("#lieux-list"); box.textContent = "";
    data.lieux.forEach(function (l) {
      var n = usage(l.id);
      var lat = el("input", { type: "number", step: "0.01", inputmode: "decimal" }); lat.value = l.lat == null ? "" : l.lat;
      var lon = el("input", { type: "number", step: "0.01", inputmode: "decimal" }); lon.value = l.lon == null ? "" : l.lon;
      lat.addEventListener("input", function () { l.lat = lat.value === "" ? null : parseFloat(lat.value); changed(); drawMini(); });
      lon.addEventListener("input", function () { l.lon = lon.value === "" ? null : parseFloat(lon.value); changed(); drawMini(); });
      var nom = el("input"); nom.value = l.nom || "";
      nom.addEventListener("input", function () { l.nom = nom.value; changed(); drawMini(); });
      var pays = el("input"); pays.value = l.pays || "";
      pays.addEventListener("input", function () { l.pays = pays.value; changed(); });
      box.appendChild(el("div", { class: "lieu-row" + (pickLieuId === l.id ? " picking" : "") }, [
        el("div", { class: "lieu-grid" }, [
          el("label", { class: "field full" }, [el("span", { text: "Nom" }), nom]),
          el("label", { class: "field full" }, [el("span", { text: "Pays" }), pays]),
          el("label", { class: "field" }, [el("span", { text: "Latitude" }), lat]),
          el("label", { class: "field" }, [el("span", { text: "Longitude" }), lon])
        ]),
        el("p", { class: "help", text: C.plural(n, "observation", "observations") + " dans ce lieu." }),
        el("div", { class: "row-actions", style: "margin-top:4px" }, [
          el("button", {
            type: "button", class: "btn btn-ghost btn-small", text: pickLieuId === l.id ? "Touche la carte…" : "Placer sur la carte",
            onclick: function () { pickLieuId = pickLieuId === l.id ? null : l.id; renderLieux(); $("#mini-map").scrollIntoView({ behavior: "smooth", block: "center" }); }
          }),
          el("button", {
            type: "button", class: "btn btn-danger btn-small", text: "Supprimer", disabled: n > 0 ? true : null,
            title: n > 0 ? "Impossible : des observations utilisent ce lieu." : null,
            onclick: function () {
              if (!confirm("Supprimer le lieu « " + l.nom + " » ?")) return;
              data.lieux = data.lieux.filter(function (x) { return x !== l; }); changed(); renderLieux(); drawMini();
            }
          })
        ])
      ]));
    });
  }

  function addLieu() {
    var l = { id: "lieu-" + Date.now().toString(36), nom: "Nouveau lieu", pays: "", lat: null, lon: null };
    data.lieux.push(l); pickLieuId = l.id; changed(); renderLieux(); drawMini();
  }

  function initMiniMap() {
    if (!window.L) return;
    if (miniMap) { miniMap.invalidateSize(); drawMini(); return; }
    miniMap = L.map("mini-map");
    miniMap.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "&copy; contributeurs OpenStreetMap" }).addTo(miniMap);
    miniLayer = L.layerGroup().addTo(miniMap);
    miniMap.on("click", function (e) {
      if (!pickLieuId) { toast("Choisis d'abord un lieu avec « Placer sur la carte »."); return; }
      var l = data.lieux.filter(function (x) { return x.id === pickLieuId; })[0];
      if (!l) return;
      l.lat = Math.round(e.latlng.lat * 100) / 100; l.lon = Math.round(e.latlng.lng * 100) / 100;
      pickLieuId = null; changed(); renderLieux(); drawMini();
    });
    drawMini(true);
  }

  function drawMini(fit) {
    if (!miniMap) return;
    miniLayer.clearLayers();
    var pts = [];
    data.lieux.forEach(function (l) {
      if (typeof l.lat !== "number" || typeof l.lon !== "number" || isNaN(l.lat) || isNaN(l.lon)) return;
      pts.push([l.lat, l.lon]);
      L.circleMarker([l.lat, l.lon], { radius: 9, color: "#2A1E05", weight: 2, fillColor: "#D2A23F", fillOpacity: 0.9 })
        .bindTooltip(l.nom).addTo(miniLayer);
    });
    if (fit) {
      if (pts.length > 1) miniMap.fitBounds(pts, { padding: [30, 30] });
      else if (pts.length === 1) miniMap.setView(pts[0], 9);
      else miniMap.setView([0, 0], 2);
    }
  }

  /* ---------- Réglages ---------- */
  function renderSite() {
    document.querySelectorAll("[data-site]").forEach(function (inp) {
      var k = inp.dataset.site;
      inp.value = data.site[k] || "";
      inp.oninput = function () { data.site[k] = inp.value.trim() === "" ? "" : inp.value; changed(); };
    });
  }

  function shiftNumbers() {
    var from = parseInt($("#shift-from").value, 10), by = parseInt($("#shift-by").value, 10);
    var st = $("#shift-status");
    if (!from || from < 1) { st.className = "status err"; st.textContent = "Indique le numéro à partir duquel décaler."; return; }
    var targets = data.especes.filter(function (s) { return s.numero >= from; });
    if (!targets.length) { st.className = "status err"; st.textContent = "Aucune espèce n'a un numéro supérieur ou égal à " + from + "."; return; }
    if (by < 0 && data.especes.some(function (s) { return s.numero === from - 1; })) {
      st.className = "status err"; st.textContent = "Le numéro " + (from - 1) + " est déjà pris : impossible de reculer sans créer un doublon."; return;
    }
    if (!confirm("Décaler " + C.plural(targets.length, "espèce", "espèces") + " de " + (by > 0 ? "+1" : "-1") + " ?")) return;
    targets.forEach(function (s) { s.numero += by; });
    changed(); renderList(); renderEditor(); renderTop();
    st.className = "status ok"; st.textContent = C.plural(targets.length, "espèce décalée", "espèces décalées") + ". Pense à enregistrer.";
  }

  function backup() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "collection-sauvegarde-" + today() + ".json" });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- Démarrage ---------- */
  initTabs();
  $("#save-btn").addEventListener("click", function () { save(); });
  $("#add-sp").addEventListener("click", addSpecies);
  $("#sp-q").addEventListener("input", renderList);
  $("#add-lieu").addEventListener("click", addLieu);
  $("#shift-btn").addEventListener("click", shiftNumbers);
  $("#backup-btn").addEventListener("click", backup);
  $("#logout-btn").addEventListener("click", function () {
    if (dirty && !confirm("Des modifications ne sont pas enregistrées. Se déconnecter quand même ?")) return;
    clearCfg(); dirty = false; location.reload();
  });
  initLogin();
})();
