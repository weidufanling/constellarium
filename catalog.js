function initCapabilityCatalogue({onRun, onSelectionChange = () => {}}) {
  const root = document.getElementById('live-specialists');
  const search = root.querySelector('#capability-search');
  const ringFilter = root.querySelector('#capability-ring');
  const searchCount = root.querySelector('#capability-search-count');
  const noMatches = root.querySelector('#capability-no-matches');
  const selectionList = root.querySelector('#capability-selection-list');
  const selectionEmpty = root.querySelector('#capability-selection-empty');
  const selectionStatus = root.querySelector('#capability-selection-status');
  const pickAll = root.querySelector('#capability-pick-all');
  const run = root.querySelector('#capability-run');
  const clear = root.querySelector('#capability-clear');
  const saveForm = root.querySelector('#capability-save-form');
  const nameInput = root.querySelector('#capability-name');
  const saveButton = root.querySelector('#capability-save');
  const saveStatus = root.querySelector('#capability-save-status');
  const savedList = root.querySelector('#capability-saved');

  const storageKey = 'weidu.constellarium.saved.v1';
  const maxSaved = 12;
  const nameLimit = nameInput.maxLength;
  const fold = (value) => value.normalize('NFKC').toLowerCase();
  const cards = [...root.querySelectorAll('[data-specialist]')].map((node) => {
    const id = node.dataset.specialist;
    const name = node.querySelector('h3').textContent.trim();
    const summary = node.querySelector('p:not(.eyebrow)').textContent.trim();
    const ring = node.dataset.ring;
    const pick = node.querySelector('[data-pick]');
    const check = pick.querySelector('span');
    const tryButton = node.querySelector('[data-try]');
    const text = fold([name, summary, node.dataset.search].join(' '));
    return {node, id, name, summary, ring, pick, check, tryButton, text};
  });
  const cardById = new Map(cards.map((card) => [card.id, card]));
  let selected = [];

  function cleanIds(ids) {
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => cardById.has(id)))] : [];
  }

  function makeButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'subtle';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  function renderSearch() {
    const terms = fold(search.value).trim().split(/\s+/).filter(Boolean);
    const ring = ringFilter.value;
    let matches = 0;
    for (const card of cards) {
      const match = (ring === 'all' || card.ring === ring) && terms.every((term) => card.text.includes(term));
      card.node.hidden = !match;
      if (match) matches++;
    }
    searchCount.textContent = matches === 1 ? '1 specialist' : matches + ' specialists';
    noMatches.hidden = matches !== 0;
  }

  function renderSelection() {
    const empty = selected.length === 0;
    clear.disabled = empty;
    run.disabled = empty;
    saveButton.disabled = empty;
    selectionList.hidden = empty;
    selectionEmpty.hidden = !empty;
    selectionList.replaceChildren();
    for (const card of cards) {
      const included = selected.includes(card.id);
      card.pick.setAttribute('aria-pressed', String(included));
      card.check.hidden = !included;
    }
    for (const [index, id] of selected.entries()) {
      const card = cardById.get(id);
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = card.name;
      const remove = makeButton('Remove', () => {
        setSelection(selected.filter((chosen) => chosen !== id));
        const next = selectionList.querySelectorAll('button')[Math.min(index, selected.length - 1)];
        (next || pickAll).focus();
      });
      remove.setAttribute('aria-label', 'Remove ' + card.name + ' from your constellation');
      item.append(title, remove);
      selectionList.append(item);
    }
  }

  function setSelection(ids) {
    const next = cleanIds(ids);
    if (next.length === selected.length && next.every((id, index) => id === selected[index])) return;
    selected = next;
    renderSelection();
    selectionStatus.textContent = selected.length === 1 ? '1 working specialist selected.' : selected.length + ' working specialists selected.';
    onSelectionChange(selected.slice());
  }

  function readSaved() {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return [];
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) throw new Error('Unexpected saved constellations');
    const valid = [];
    for (const item of stored.slice(0, maxSaved)) {
      if (!item || typeof item.name !== 'string' || !Array.isArray(item.ids)) throw new Error('Unexpected saved constellation');
      const name = item.name.trim();
      const ids = cleanIds(item.ids);
      if (name && name.length <= nameLimit && ids.length && !valid.some((entry) => fold(entry.name) === fold(name))) {
        valid.push({name, ids});
      }
    }
    return valid;
  }

  function renderSaved(entries) {
    savedList.replaceChildren();
    savedList.hidden = entries.length === 0;
    for (const [index, entry] of entries.entries()) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = entry.name;
      const names = document.createElement('small');
      names.textContent = entry.ids.map((id) => cardById.get(id).name).join(' · ');
      title.append(names);
      const actions = document.createElement('div');
      actions.className = 'capability-actions';
      const restore = makeButton('Restore', () => {
        setSelection(entry.ids);
        nameInput.value = entry.name;
        saveStatus.textContent = 'Restored ' + entry.name + '. Open the exercise whenever you are ready.';
      });
      restore.setAttribute('aria-label', 'Restore ' + entry.name);
      restore.dataset.restore = '';
      const remove = makeButton('Delete', () => {
        try {
          const remaining = readSaved().filter((saved) => fold(saved.name) !== fold(entry.name));
          window.localStorage.setItem(storageKey, JSON.stringify(remaining));
          renderSaved(remaining);
          saveStatus.textContent = 'Deleted ' + entry.name + ' from this browser.';
          const next = savedList.querySelectorAll('[data-restore]')[Math.min(index, remaining.length - 1)];
          (next || nameInput).focus();
        } catch {
          saveStatus.textContent = 'This browser could not delete the saved constellation.';
        }
      });
      remove.setAttribute('aria-label', 'Delete saved constellation ' + entry.name);
      remove.dataset.forget = '';
      actions.append(restore, remove);
      item.append(title, actions);
      savedList.append(item);
    }
  }

  function refreshSaved() {
    try {
      renderSaved(readSaved());
    } catch {
      renderSaved([]);
      saveStatus.textContent = 'Saved constellations are unavailable in this browser.';
    }
  }

  search.addEventListener('input', renderSearch);
  ringFilter.addEventListener('change', renderSearch);
  for (const card of cards) {
    card.pick.addEventListener('click', () => {
      setSelection(selected.includes(card.id) ? selected.filter((id) => id !== card.id) : [...selected, card.id]);
    });
    card.tryButton.addEventListener('click', () => onRun(card.id));
  }
  pickAll.addEventListener('click', () => setSelection(cards.map((card) => card.id)));
  run.addEventListener('click', () => {
    if (selected.length) onRun('combined');
  });
  clear.addEventListener('click', () => {
    setSelection([]);
    pickAll.focus();
  });
  saveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!selected.length) return;
    const name = nameInput.value.trim();
    if (!name) {
      saveStatus.textContent = 'Enter a name for this constellation.';
      nameInput.focus();
      return;
    }
    try {
      const saved = readSaved();
      if (saved.some((entry) => fold(entry.name) === fold(name))) {
        saveStatus.textContent = 'A saved constellation already has that name. Choose another name.';
        nameInput.focus();
        return;
      }
      if (saved.length >= maxSaved) {
        saveStatus.textContent = 'This browser already has 12 saved constellations. Delete one to make room.';
        return;
      }
      const next = [...saved, {name, ids: selected.slice()}];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      renderSaved(next);
      saveStatus.textContent = 'Saved ' + name + ' in this browser.';
      nameInput.value = '';
    } catch {
      saveStatus.textContent = 'This browser could not save your constellation. You can still use it in this tab.';
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) refreshSaved();
  });

  renderSearch();
  renderSelection();
  refreshSaved();

  return {
    getSelection: () => selected.slice(),
    getSpecialists: () => cards.map(({id, name, summary, ring}) => ({id, name, summary, ring})),
    setRing(id) {
      ringFilter.value = [...ringFilter.options].some((option) => option.value === id) ? id : 'all';
      renderSearch();
    },
  };
}
