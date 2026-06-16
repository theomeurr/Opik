(() => {
  'use strict';

  const STORE_KEY = 'courses.v1';

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

  // --- État ---
  let state = load();

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.categories) && Array.isArray(data.items)) return data;
      }
    } catch (e) { /* ignore */ }
    return {
      categories: DEFAULT_CATEGORIES.map((name) => ({ id: uid(), name })),
      items: [],
    };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function fallbackCatId() {
    return state.categories[state.categories.length - 1]?.id || state.categories[0]?.id;
  }

  function catName(id) {
    return state.categories.find((c) => c.id === id)?.name || '—';
  }

  function norm(s) {
    return s.trim().toLowerCase();
  }

  // --- Éléments DOM ---
  const $ = (sel) => document.querySelector(sel);
  const addForm = $('#addForm');
  const addInput = $('#addInput');
  const addCategory = $('#addCategory');
  const viewListe = $('#view-liste');
  const viewHist = $('#view-historique');
  const histList = $('#historiqueList');
  const searchInput = $('#searchInput');

  // --- Actions sur les données ---
  function addItem(name, categoryId) {
    const clean = name.trim();
    if (!clean) return;
    const existing = state.items.find((it) => norm(it.name) === norm(clean));
    if (existing) {
      existing.onList = true;
      existing.checked = false;
      existing.lastUsed = Date.now();
      if (categoryId) existing.categoryId = categoryId;
    } else {
      state.items.push({
        id: uid(),
        name: clean,
        categoryId: categoryId || fallbackCatId(),
        onList: true,
        checked: false,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      });
    }
    save();
  }

  function toggleChecked(id) {
    const it = state.items.find((i) => i.id === id);
    if (!it) return;
    it.checked = !it.checked;
    save();
  }

  function removeFromList(id) {
    const it = state.items.find((i) => i.id === id);
    if (!it) return;
    it.onList = false;
    it.checked = false;
    save();
  }

  function toggleOnList(id) {
    const it = state.items.find((i) => i.id === id);
    if (!it) return;
    it.onList = !it.onList;
    if (it.onList) { it.checked = false; it.lastUsed = Date.now(); }
    save();
  }

  function clearChecked() {
    state.items.forEach((it) => { if (it.checked) { it.onList = false; it.checked = false; } });
    save();
  }

  function setItemCategory(id, categoryId) {
    const it = state.items.find((i) => i.id === id);
    if (it) { it.categoryId = categoryId; save(); }
  }

  // --- Rendu : sélecteur de catégorie de la barre d'ajout ---
  function renderCategoryOptions() {
    const prev = addCategory.value;
    addCategory.innerHTML = '';
    state.categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      addCategory.appendChild(opt);
    });
    if (state.categories.some((c) => c.id === prev)) addCategory.value = prev;
  }

  // --- Rendu : Liste active ---
  function renderListe() {
    const onList = state.items.filter((it) => it.onList);
    viewListe.innerHTML = '';

    if (onList.length === 0) {
      viewListe.innerHTML = `
        <div class="empty">
          <span class="emoji">🛒</span>
          Votre liste est vide.<br />Ajoutez un article ci-dessus.
        </div>`;
      return;
    }

    // Groupe par catégorie, dans l'ordre des catégories
    state.categories.forEach((cat) => {
      const items = onList.filter((it) => it.categoryId === cat.id);
      if (items.length === 0) return;
      // non cochés d'abord, puis cochés
      items.sort((a, b) => (a.checked - b.checked) || a.name.localeCompare(b.name, 'fr'));
      const remaining = items.filter((i) => !i.checked).length;

      const group = document.createElement('div');
      group.className = 'cat-group';
      group.innerHTML = `<div class="cat-group-title">${escapeHtml(cat.name)}
        <span class="cat-group-count">${remaining ? remaining : '✓'}</span></div>`;

      const card = document.createElement('div');
      card.className = 'card';
      items.forEach((it) => card.appendChild(itemRow(it)));
      group.appendChild(card);
      viewListe.appendChild(group);
    });

    // Articles dont la catégorie n'existe plus
    const orphans = onList.filter((it) => !state.categories.some((c) => c.id === it.categoryId));
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

    if (onList.some((i) => i.checked)) {
      const bar = document.createElement('div');
      bar.className = 'clear-bar';
      const btn = document.createElement('button');
      btn.className = 'clear-btn';
      btn.textContent = 'Retirer les articles cochés';
      btn.addEventListener('click', () => { clearChecked(); renderListe(); });
      bar.appendChild(btn);
      viewListe.appendChild(bar);
    }
  }

  function itemRow(it) {
    const row = document.createElement('div');
    row.className = 'item' + (it.checked ? ' checked' : '');
    row.innerHTML = `
      <span class="check"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4 4 10-10"/></svg></span>
      <span class="item-name">${escapeHtml(it.name)}</span>
      <button class="item-del" aria-label="Retirer">×</button>`;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.item-del')) return;
      toggleChecked(it.id);
      renderListe();
    });
    row.querySelector('.item-del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromList(it.id);
      renderListe();
    });
    return row;
  }

  // --- Rendu : Historique ---
  function renderHistorique() {
    const q = norm(searchInput.value || '');
    let items = state.items.slice();
    if (q) items = items.filter((it) => norm(it.name).includes(q));
    histList.innerHTML = '';

    if (state.items.length === 0) {
      histList.innerHTML = `
        <div class="empty">
          <span class="emoji">📝</span>
          Aucun historique pour le moment.<br />Tout ce que vous ajoutez apparaîtra ici.
        </div>`;
      return;
    }
    if (items.length === 0) {
      histList.innerHTML = `<div class="empty">Aucun résultat.</div>`;
      return;
    }

    // groupé par catégorie
    state.categories.forEach((cat) => {
      const catItems = items.filter((it) => it.categoryId === cat.id)
        .sort((a, b) => b.lastUsed - a.lastUsed);
      if (catItems.length === 0) return;

      const group = document.createElement('div');
      group.className = 'cat-group';
      group.innerHTML = `<div class="cat-group-title">${escapeHtml(cat.name)}</div>`;
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
    name.className = 'hrow-name';
    name.textContent = it.name;

    const sel = document.createElement('select');
    sel.className = 'hrow-cat';
    state.categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === it.categoryId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { setItemCategory(it.id, sel.value); renderHistorique(); });

    const btn = document.createElement('button');
    btn.className = 'hadd' + (it.onList ? ' on' : '');
    btn.textContent = it.onList ? '✓' : '+';
    btn.setAttribute('aria-label', it.onList ? 'Retirer de la liste' : 'Ajouter à la liste');
    btn.addEventListener('click', () => {
      toggleOnList(it.id);
      renderHistorique();
    });

    row.append(name, sel, btn);
    return row;
  }

  // --- Modal catégories ---
  const catModal = $('#catModal');
  const catList = $('#catList');
  const addCatForm = $('#addCatForm');
  const newCatInput = $('#newCatInput');

  function openCatModal() { renderCatList(); catModal.classList.remove('hidden'); }
  function closeCatModal() { catModal.classList.add('hidden'); }

  function renderCatList() {
    catList.innerHTML = '';
    state.categories.forEach((c, idx) => {
      const li = document.createElement('li');
      li.className = 'cat-item';

      const input = document.createElement('input');
      input.className = 'cat-name';
      input.value = c.name;
      input.addEventListener('change', () => {
        const v = input.value.trim();
        if (v) { c.name = v; save(); refreshAll(); } else { input.value = c.name; }
      });

      const up = document.createElement('button');
      up.className = 'cat-move';
      up.textContent = '↑';
      up.disabled = idx === 0;
      up.style.opacity = idx === 0 ? '.3' : '1';
      up.addEventListener('click', () => moveCat(idx, -1));

      const down = document.createElement('button');
      down.className = 'cat-move';
      down.textContent = '↓';
      down.disabled = idx === state.categories.length - 1;
      down.style.opacity = idx === state.categories.length - 1 ? '.3' : '1';
      down.addEventListener('click', () => moveCat(idx, 1));

      const del = document.createElement('button');
      del.className = 'cat-remove';
      del.textContent = '🗑';
      del.setAttribute('aria-label', 'Supprimer la catégorie');
      del.addEventListener('click', () => removeCat(c.id));

      li.append(input, up, down, del);
      catList.appendChild(li);
    });
  }

  function moveCat(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= state.categories.length) return;
    const arr = state.categories;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    save();
    refreshAll();
    renderCatList();
  }

  function removeCat(id) {
    if (state.categories.length <= 1) { alert('Gardez au moins une catégorie.'); return; }
    const target = fallbackCatId() === id
      ? state.categories.find((c) => c.id !== id).id
      : fallbackCatId();
    if (!confirm('Supprimer cette catégorie ? Ses articles iront dans « ' + catName(target) + ' ».')) return;
    state.items.forEach((it) => { if (it.categoryId === id) it.categoryId = target; });
    state.categories = state.categories.filter((c) => c.id !== id);
    save();
    refreshAll();
    renderCatList();
  }

  addCatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = newCatInput.value.trim();
    if (!v) return;
    state.categories.push({ id: uid(), name: v });
    newCatInput.value = '';
    save();
    refreshAll();
    renderCatList();
  });

  // --- Onglets ---
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      viewListe.classList.toggle('hidden', which !== 'liste');
      viewHist.classList.toggle('hidden', which !== 'historique');
      if (which === 'historique') renderHistorique();
    });
  });

  // --- Form d'ajout ---
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem(addInput.value, addCategory.value);
    addInput.value = '';
    addInput.focus();
    renderListe();
  });

  searchInput.addEventListener('input', renderHistorique);

  $('#manageCats').addEventListener('click', openCatModal);
  catModal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeCatModal));

  // --- Utilitaires ---
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function refreshAll() {
    renderCategoryOptions();
    renderListe();
    if (!viewHist.classList.contains('hidden')) renderHistorique();
  }

  // --- iOS install hint ---
  (function iosHint() {
    const hint = $('#iosHint');
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('iosHintDismissed') === '1';
    if (isIOS && !standalone && !dismissed) {
      hint.classList.remove('hidden');
    }
    $('#iosHintClose').addEventListener('click', () => {
      hint.classList.add('hidden');
      localStorage.setItem('iosHintDismissed', '1');
    });
  })();

  // --- Service worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // --- Init ---
  renderCategoryOptions();
  renderListe();
})();
