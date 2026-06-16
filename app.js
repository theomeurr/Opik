(() => {
  'use strict';

  const STORE_KEY = 'courses.v2';
  const OLD_KEY = 'courses.v1';

  const DEFAULT_CATEGORIES = [
    'Fruits & Légumes',
    'Boulangerie',
    'Produits laitiers',
    'Viandes & Poissons',
    'Épicerie',
    'Surgelés',
    'Boissons',
    'Hygiène & Entretien',
    'Autres',
  ];
  const PALETTE = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899',
    '#14b8a6', '#f97316', '#0ea5e9', '#84cc16', '#eab308', '#64748b',
  ];

  // ===== Utilitaires semaine =====
  function mondayOf(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date;
  }
  function weekKeyOf(monday) {
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  function mondayFromKey(key) { return new Date(key + 'T00:00:00'); }
  function thisWeekKey() { return weekKeyOf(mondayOf(new Date())); }
  function weeksDiff(aKey, bKey) {
    return Math.round((mondayFromKey(aKey) - mondayFromKey(bKey)) / (7 * 86400000));
  }
  const fmtDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  function rangeLabel(key) {
    const start = mondayFromKey(key);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${fmtDay.format(end)}`;
    return `${fmtDay.format(start)} – ${fmtDay.format(end)}`;
  }
  function relLabel(key) {
    const d = weeksDiff(key, thisWeekKey());
    if (d === 0) return 'Cette semaine';
    if (d === 1) return 'Semaine prochaine';
    if (d === -1) return 'Semaine dernière';
    if (d > 1) return `Dans ${d} semaines`;
    return `Il y a ${-d} semaines`;
  }
  function shortLabel(key) {
    const d = weeksDiff(key, thisWeekKey());
    if (d === 0) return 'Cette semaine';
    if (d === 1) return 'Sem. prochaine';
    if (d === -1) return 'Sem. dernière';
    const m = mondayFromKey(key);
    return `Sem. du ${m.getDate()}/${String(m.getMonth() + 1).padStart(2, '0')}`;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ===== Chargement / migration / normalisation =====
  let state = load();
  let orderSeq = state.items.reduce((mx, it) => Math.max(mx, it.order || 0), 0);
  function nextOrder() { return ++orderSeq; }

  function freshState() {
    const wk = thisWeekKey();
    return {
      version: 2,
      categories: DEFAULT_CATEGORIES.map((name, i) => ({ id: uid(), name, color: PALETTE[i % PALETTE.length] })),
      items: [],
      lists: { [wk]: {} },
      currentWeek: wk,
    };
  }

  function normalize(s) {
    // couleurs de catégories
    s.categories.forEach((c, i) => { if (!c.color) c.color = PALETTE[i % PALETTE.length]; });
    // ordre des articles
    s.items.forEach((it, i) => { if (typeof it.order !== 'number') it.order = i + 1; });
    // valeurs de liste -> objets { c: coché, q: quantité }
    Object.values(s.lists).forEach((L) => {
      Object.keys(L).forEach((id) => {
        const v = L[id];
        if (typeof v === 'boolean') L[id] = { c: v, q: 1 };
        else if (!v || typeof v !== 'object') L[id] = { c: false, q: 1 };
        else { v.c = !!v.c; v.q = Math.max(1, v.q || 1); }
      });
    });
    if (!s.currentWeek) s.currentWeek = thisWeekKey();
    if (!s.lists[s.currentWeek]) s.lists[s.currentWeek] = {};
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.categories) && Array.isArray(data.items) && data.lists) {
          return normalize(data);
        }
      }
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const o = JSON.parse(old);
        if (o && Array.isArray(o.categories) && Array.isArray(o.items)) {
          const wk = thisWeekKey();
          const list = {};
          const items = o.items.map((it, i) => {
            if (it.onList) list[it.id] = { c: !!it.checked, q: 1 };
            return {
              id: it.id, name: it.name, categoryId: it.categoryId, order: i + 1,
              createdAt: it.createdAt || Date.now(), lastUsed: it.lastUsed || Date.now(),
            };
          });
          return normalize({ version: 2, categories: o.categories, items, lists: { [wk]: list }, currentWeek: wk });
        }
      }
    } catch (e) { /* ignore */ }
    return freshState();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // ===== Helpers données =====
  function fallbackCatId() { return state.categories[state.categories.length - 1]?.id || state.categories[0]?.id; }
  function category(id) { return state.categories.find((c) => c.id === id); }
  function catName(id) { return category(id)?.name || '—'; }
  function catColor(id) { return category(id)?.color || '#c7c7cc'; }
  function norm(s) { return s.trim().toLowerCase(); }
  function itemById(id) { return state.items.find((i) => i.id === id); }

  function currentList() {
    if (!state.lists[state.currentWeek]) state.lists[state.currentWeek] = {};
    return state.lists[state.currentWeek];
  }
  function listCount(key) { const L = state.lists[key]; return L ? Object.keys(L).length : 0; }
  function isOnList(id) { return id in currentList(); }
  function isChecked(id) { return currentList()[id]?.c === true; }
  function qtyOf(id) { return currentList()[id]?.q || 1; }
  function weeksWithItems(excludeKey) {
    return Object.keys(state.lists)
      .filter((k) => k !== excludeKey && listCount(k) > 0)
      .sort((a, b) => mondayFromKey(b) - mondayFromKey(a));
  }

  // ===== Actions =====
  function addItem(name, categoryId) {
    const clean = name.trim();
    if (!clean) return;
    let item = state.items.find((it) => norm(it.name) === norm(clean));
    if (item) {
      item.lastUsed = Date.now();
      if (categoryId) item.categoryId = categoryId;
    } else {
      item = {
        id: uid(), name: clean, categoryId: categoryId || fallbackCatId(), order: nextOrder(),
        createdAt: Date.now(), lastUsed: Date.now(),
      };
      state.items.push(item);
    }
    const L = currentList();
    if (!(item.id in L)) L[item.id] = { c: false, q: 1 };
    else L[item.id].c = false;
    save();
  }
  function toggleChecked(id) { const v = currentList()[id]; if (v) { v.c = !v.c; save(); } }
  function setQty(id, delta) { const v = currentList()[id]; if (v) { v.q = Math.max(1, v.q + delta); save(); } }
  function removeFromList(id) { const L = currentList(); if (id in L) { delete L[id]; save(); } }
  function toggleOnList(id) {
    const L = currentList();
    if (id in L) delete L[id];
    else { L[id] = { c: false, q: 1 }; const it = itemById(id); if (it) it.lastUsed = Date.now(); }
    save();
  }
  function clearChecked() {
    const L = currentList();
    Object.keys(L).forEach((id) => { if (L[id].c) delete L[id]; });
    save();
  }
  function setItemCategory(id, categoryId) { const it = itemById(id); if (it) { it.categoryId = categoryId; save(); } }
  function copyFromWeek(srcKey) {
    const src = state.lists[srcKey];
    if (!src) return;
    const dest = currentList();
    Object.keys(src).forEach((id) => {
      if (itemById(id) && !(id in dest)) dest[id] = { c: false, q: src[id].q || 1 };
    });
    save();
  }

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);
  const addForm = $('#addForm');
  const addInput = $('#addInput');
  const addCategory = $('#addCategory');
  const viewListe = $('#view-liste');
  const viewHist = $('#view-historique');
  const viewCats = $('#view-categories');
  const histList = $('#historiqueList');
  const searchInput = $('#searchInput');
  const listeBadge = $('#listeBadge');
  const pageTitle = $('#pageTitle');

  function renderCategoryOptions() {
    const prev = addCategory.value;
    addCategory.innerHTML = '';
    state.categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      addCategory.appendChild(opt);
    });
    if (state.categories.some((c) => c.id === prev)) addCategory.value = prev;
  }

  function updateBadge() {
    const n = Object.values(currentList()).filter((v) => !v.c).length;
    if (n > 0) { listeBadge.textContent = n > 99 ? '99+' : n; listeBadge.classList.remove('hidden'); }
    else listeBadge.classList.add('hidden');
  }

  // ===== Vue Liste =====
  function renderListe() {
    const L = currentList();
    const onList = Object.keys(L).map(itemById).filter(Boolean);
    viewListe.innerHTML = '';

    if (onList.length === 0) {
      viewListe.innerHTML = `
        <div class="empty"><span class="emoji">🛒</span>
        Liste vide pour <b>${escapeHtml(relLabel(state.currentWeek).toLowerCase())}</b>.<br />
        Ajoutez un article ci-dessus.</div>`;
      appendCopyBar();
      updateBadge();
      return;
    }

    state.categories.forEach((cat) => {
      const items = onList.filter((it) => it.categoryId === cat.id);
      if (items.length === 0) return;
      items.sort((a, b) => (isChecked(a.id) - isChecked(b.id)) || ((a.order || 0) - (b.order || 0)) || a.name.localeCompare(b.name, 'fr'));
      const remaining = items.filter((i) => !isChecked(i.id)).length;

      const group = document.createElement('div');
      group.className = 'cat-group';
      group.innerHTML = `<div class="cat-group-title"><span class="cat-dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}
        <span class="cat-group-count">${remaining ? remaining : '✓'}</span></div>`;
      const card = document.createElement('div');
      card.className = 'card';
      items.forEach((it) => card.appendChild(itemRow(it)));
      group.appendChild(card);
      viewListe.appendChild(group);
    });

    const orphans = onList.filter((it) => !category(it.categoryId));
    if (orphans.length) {
      const group = document.createElement('div');
      group.className = 'cat-group';
      group.innerHTML = `<div class="cat-group-title">Autres</div>`;
      const card = document.createElement('div');
      card.className = 'card';
      orphans.forEach((it) => card.appendChild(itemRow(it)));
      group.appendChild(card);
      viewListe.appendChild(group);
    }

    if (onList.some((i) => isChecked(i.id))) {
      const bar = document.createElement('div');
      bar.className = 'clear-bar';
      const btn = document.createElement('button');
      btn.className = 'clear-btn';
      btn.textContent = 'Retirer les articles cochés';
      btn.addEventListener('click', () => { clearChecked(); renderListe(); });
      bar.appendChild(btn);
      viewListe.appendChild(bar);
    }
    appendCopyBar();
    updateBadge();
  }

  function appendCopyBar() {
    if (weeksWithItems(state.currentWeek).length === 0) return;
    const bar = document.createElement('div');
    bar.className = 'copy-bar';
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg> Copier une autre semaine`;
    btn.addEventListener('click', openCopySheet);
    bar.appendChild(btn);
    viewListe.appendChild(bar);
  }

  function itemRow(it) {
    const checked = isChecked(it.id);
    const q = qtyOf(it.id);
    const row = document.createElement('div');
    row.className = 'item' + (checked ? ' checked' : '');
    row.dataset.id = it.id;
    row.innerHTML = `
      <span class="check"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4 4 10-10"/></svg></span>
      <span class="item-name">${escapeHtml(it.name)}</span>
      <div class="qty">
        <button class="qty-btn" data-d="-1" aria-label="Diminuer"${q <= 1 ? ' disabled' : ''}>−</button>
        <span class="qty-val">${q}</span>
        <button class="qty-btn" data-d="1" aria-label="Augmenter">+</button>
      </div>
      <span class="drag-handle" aria-label="Déplacer"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M4 7h16v2H4V7Zm0 4h16v2H4v-2Zm0 4h16v2H4v-2Z"/></svg></span>
      <button class="item-del" aria-label="Retirer">×</button>`;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.item-del, .qty, .drag-handle')) return;
      if (Date.now() - lastDragEnd < 250) return;
      toggleChecked(it.id); renderListe();
    });
    row.querySelectorAll('.qty-btn').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); setQty(it.id, Number(b.dataset.d)); renderListe();
    }));
    row.querySelector('.item-del').addEventListener('click', (e) => {
      e.stopPropagation(); removeFromList(it.id); renderListe();
    });
    const handle = row.querySelector('.drag-handle');
    handle.addEventListener('pointerdown', (e) => startDrag(e, row));
    handle.addEventListener('click', (e) => e.stopPropagation());
    return row;
  }

  // ===== Glisser-déposer (Pointer Events, compatible iOS) =====
  let drag = null;        // { row, card }
  let lastDragEnd = 0;
  function startDrag(e, row) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    drag = { row, card: row.parentElement, moved: false };
    row.classList.add('dragging');
    document.addEventListener('pointermove', onDragMove, { passive: false });
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);
  }
  function dragAfter(card, y) {
    const els = [...card.querySelectorAll('.item:not(.dragging)')];
    for (const el of els) {
      const b = el.getBoundingClientRect();
      if (y < b.top + b.height / 2) return el;
    }
    return null;
  }
  function onDragMove(e) {
    if (!drag) return;
    e.preventDefault();
    drag.moved = true;
    const { card, row } = drag;
    const after = dragAfter(card, e.clientY);
    if (after == null) { if (card.lastElementChild !== row) card.appendChild(row); }
    else if (after !== row) card.insertBefore(row, after);
  }
  function endDrag() {
    if (!drag) return;
    const { card, row, moved } = drag;
    row.classList.remove('dragging');
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
    if (moved) {
      [...card.querySelectorAll('.item')].forEach((el, i) => {
        const it = itemById(el.dataset.id);
        if (it) it.order = i + 1;
      });
      save();
      lastDragEnd = Date.now();
      updateBadge();
    }
    drag = null;
  }

  // ===== Vue Historique =====
  function renderHistorique() {
    const q = norm(searchInput.value || '');
    let items = state.items.slice();
    if (q) items = items.filter((it) => norm(it.name).includes(q));
    histList.innerHTML = '';

    if (state.items.length === 0) {
      histList.innerHTML = `
        <div class="empty"><span class="emoji">📝</span>
        Aucun historique pour le moment.<br />Tout ce que vous ajoutez apparaîtra ici.</div>`;
      return;
    }
    if (items.length === 0) { histList.innerHTML = `<div class="empty">Aucun résultat.</div>`; return; }

    state.categories.forEach((cat) => {
      const catItems = items.filter((it) => it.categoryId === cat.id).sort((a, b) => b.lastUsed - a.lastUsed);
      if (catItems.length === 0) return;
      const group = document.createElement('div');
      group.className = 'cat-group';
      group.innerHTML = `<div class="cat-group-title"><span class="cat-dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}</div>`;
      const card = document.createElement('div');
      card.className = 'card';
      catItems.forEach((it) => card.appendChild(histRow(it)));
      group.appendChild(card);
      histList.appendChild(group);
    });
  }

  function histRow(it) {
    const row = document.createElement('div');
    row.className = 'hrow';
    const name = document.createElement('span');
    name.className = 'hrow-name'; name.textContent = it.name;

    const sel = document.createElement('select');
    sel.className = 'hrow-cat';
    state.categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      if (c.id === it.categoryId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { setItemCategory(it.id, sel.value); renderHistorique(); });

    const btn = document.createElement('button');
    const on = isOnList(it.id);
    btn.className = 'hadd' + (on ? ' on' : '');
    btn.textContent = on ? '✓' : '+';
    btn.setAttribute('aria-label', on ? 'Retirer de la liste' : 'Ajouter à la liste');
    btn.addEventListener('click', () => { toggleOnList(it.id); renderHistorique(); updateBadge(); });

    row.append(name, sel, btn);
    return row;
  }

  // ===== Vue Catégories =====
  const catList = $('#catList');
  const addCatForm = $('#addCatForm');
  const newCatInput = $('#newCatInput');

  function renderCatList() {
    catList.innerHTML = '';
    state.categories.forEach((c, idx) => {
      const li = document.createElement('li');
      li.className = 'cat-item';

      const dot = document.createElement('span');
      dot.className = 'cat-dot'; dot.style.background = c.color;

      const input = document.createElement('input');
      input.className = 'cat-name'; input.value = c.name;
      input.addEventListener('change', () => {
        const v = input.value.trim();
        if (v) { c.name = v; save(); refreshAll(); } else { input.value = c.name; }
      });

      const up = document.createElement('button');
      up.className = 'cat-move'; up.textContent = '↑';
      up.style.opacity = idx === 0 ? '.3' : '1';
      up.addEventListener('click', () => moveCat(idx, -1));

      const down = document.createElement('button');
      down.className = 'cat-move'; down.textContent = '↓';
      down.style.opacity = idx === state.categories.length - 1 ? '.3' : '1';
      down.addEventListener('click', () => moveCat(idx, 1));

      const del = document.createElement('button');
      del.className = 'cat-remove'; del.textContent = '🗑';
      del.setAttribute('aria-label', 'Supprimer la catégorie');
      del.addEventListener('click', () => removeCat(c.id));

      const colors = document.createElement('div');
      colors.className = 'cat-colors';
      PALETTE.forEach((col) => {
        const s = document.createElement('button');
        s.className = 'swatch' + (col === c.color ? ' sel' : '');
        s.style.background = col;
        s.setAttribute('aria-label', 'Couleur');
        s.addEventListener('click', () => { c.color = col; save(); refreshAll(); renderCatList(); });
        colors.appendChild(s);
      });

      li.append(dot, input, up, down, del, colors);
      catList.appendChild(li);
    });
  }

  function moveCat(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= state.categories.length) return;
    const arr = state.categories;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    save(); refreshAll(); renderCatList();
  }
  function removeCat(id) {
    if (state.categories.length <= 1) { alert('Gardez au moins une catégorie.'); return; }
    const target = fallbackCatId() === id ? state.categories.find((c) => c.id !== id).id : fallbackCatId();
    if (!confirm('Supprimer cette catégorie ? Ses articles iront dans « ' + catName(target) + ' ».')) return;
    state.items.forEach((it) => { if (it.categoryId === id) it.categoryId = target; });
    state.categories = state.categories.filter((c) => c.id !== id);
    save(); refreshAll(); renderCatList();
  }

  addCatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = newCatInput.value.trim();
    if (!v) return;
    state.categories.push({ id: uid(), name: v, color: PALETTE[state.categories.length % PALETTE.length] });
    newCatInput.value = '';
    save(); refreshAll(); renderCatList();
  });

  // ===== Menu Semaine =====
  const weekBtn = $('#weekBtn');
  const weekBtnLabel = $('#weekBtnLabel');
  const weekMenu = $('#weekMenu');
  const weekBackdrop = $('#weekBackdrop');
  const weekMenuList = $('#weekMenuList');

  function renderWeekButton() { weekBtnLabel.textContent = shortLabel(state.currentWeek); }

  function weekOptions() {
    const keys = new Set();
    const base = mondayOf(new Date());
    for (let i = -2; i <= 6; i++) {
      const m = new Date(base); m.setDate(m.getDate() + i * 7);
      keys.add(weekKeyOf(m));
    }
    keys.add(state.currentWeek);
    Object.keys(state.lists).forEach((k) => { if (listCount(k) > 0) keys.add(k); });
    return Array.from(keys).sort((a, b) => mondayFromKey(a) - mondayFromKey(b));
  }

  function renderWeekMenu() {
    weekMenuList.innerHTML = '';
    weekOptions().forEach((key) => {
      const btn = document.createElement('button');
      btn.className = 'week-row' + (key === state.currentWeek ? ' current' : '');
      btn.setAttribute('role', 'menuitem');
      const count = listCount(key);
      btn.innerHTML = `
        <div class="week-row-main">
          <div class="week-row-label">${escapeHtml(relLabel(key))}</div>
          <div class="week-row-range">${escapeHtml(rangeLabel(key))}</div>
        </div>
        ${count ? `<span class="week-row-count">${count}</span>` : ''}
        ${key === state.currentWeek ? '<svg class="week-row-check" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>' : ''}`;
      btn.addEventListener('click', () => selectWeek(key));
      weekMenuList.appendChild(btn);
    });
  }

  function openWeekMenu() {
    renderWeekMenu();
    weekMenu.classList.remove('hidden');
    weekBackdrop.classList.remove('hidden');
    weekBtn.classList.add('open');
  }
  function closeWeekMenu() {
    weekMenu.classList.add('hidden');
    weekBackdrop.classList.add('hidden');
    weekBtn.classList.remove('open');
  }
  function selectWeek(key) {
    state.currentWeek = key;
    if (!state.lists[key]) state.lists[key] = {};
    save();
    renderWeekButton();
    renderListe();
    closeWeekMenu();
  }

  weekBtn.addEventListener('click', () => {
    if (weekMenu.classList.contains('hidden')) openWeekMenu(); else closeWeekMenu();
  });
  weekBackdrop.addEventListener('click', closeWeekMenu);

  // ===== Feuille : copier une autre semaine =====
  const copySheet = $('#copySheet');
  const copyBackdrop = $('#copyBackdrop');
  const copyList = $('#copyList');
  const copyTargetLabel = $('#copyTargetLabel');

  function openCopySheet() {
    copyTargetLabel.textContent = relLabel(state.currentWeek).toLowerCase();
    copyList.innerHTML = '';
    const weeks = weeksWithItems(state.currentWeek);
    if (weeks.length === 0) {
      copyList.innerHTML = `<div class="sheet-empty">Aucune autre semaine avec des articles.</div>`;
    } else {
      weeks.forEach((key) => {
        const btn = document.createElement('button');
        btn.className = 'week-row';
        btn.innerHTML = `
          <div class="week-row-main">
            <div class="week-row-label">${escapeHtml(relLabel(key))}</div>
            <div class="week-row-range">${escapeHtml(rangeLabel(key))}</div>
          </div>
          <span class="week-row-count">${listCount(key)}</span>`;
        btn.addEventListener('click', () => { copyFromWeek(key); closeCopySheet(); renderListe(); });
        copyList.appendChild(btn);
      });
    }
    copySheet.classList.remove('hidden');
    copyBackdrop.classList.remove('hidden');
  }
  function closeCopySheet() {
    copySheet.classList.add('hidden');
    copyBackdrop.classList.add('hidden');
  }
  copyBackdrop.addEventListener('click', closeCopySheet);

  // ===== Navigation =====
  const TABS = ['liste', 'historique', 'categories'];
  const TITLES = { liste: 'Liste', historique: 'Historique', categories: 'Catégories' };
  const VIEWS = { liste: viewListe, historique: viewHist, categories: viewCats };
  const indicator = $('#tabIndicator');
  const tabBtns = Array.from(document.querySelectorAll('.tab-item'));
  let currentTab = 'liste';

  function switchTab(tab) {
    if (tab === currentTab) return;
    const from = TABS.indexOf(currentTab);
    const to = TABS.indexOf(tab);
    const dir = to > from ? 'from-right' : 'from-left';
    currentTab = tab;
    closeWeekMenu();
    closeCopySheet();

    indicator.style.setProperty('--i', to);
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

    pageTitle.textContent = TITLES[tab];
    addForm.classList.toggle('hidden', tab !== 'liste');
    weekBtn.classList.toggle('hidden', tab !== 'liste');

    if (tab === 'liste') renderListe();
    else if (tab === 'historique') renderHistorique();
    else if (tab === 'categories') renderCatList();

    TABS.forEach((t) => {
      const v = VIEWS[t];
      if (t === tab) {
        v.classList.remove('hidden', 'from-right', 'from-left');
        void v.offsetWidth;
        v.classList.add(dir);
      } else v.classList.add('hidden');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabBtns.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ===== Ajout =====
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem(addInput.value, addCategory.value);
    addInput.value = ''; addInput.focus();
    renderListe();
  });
  searchInput.addEventListener('input', renderHistorique);

  // ===== Divers =====
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function refreshAll() {
    renderCategoryOptions();
    if (currentTab === 'liste') renderListe(); else updateBadge();
    if (currentTab === 'historique') renderHistorique();
  }

  (function iosHint() {
    const hint = $('#iosHint');
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('iosHintDismissed') === '1';
    if (isIOS && !standalone && !dismissed) hint.classList.remove('hidden');
    $('#iosHintClose').addEventListener('click', () => {
      hint.classList.add('hidden');
      localStorage.setItem('iosHintDismissed', '1');
    });
  })();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ===== Init =====
  renderCategoryOptions();
  renderWeekButton();
  renderListe();
})();
