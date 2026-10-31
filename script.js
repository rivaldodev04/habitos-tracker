/* ============================================================
   Ritual · Tracker de hábitos
   Checklist diario, historial, progreso semanal/mensual y export CSV
   ============================================================ */

const STORE_KEY = 'ritual.habits.v1';
const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r = 52
const HISTORY_LIMIT_DAYS = 366;
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const EMOJIS = [
  '💧', '🏃', '📚', '🧘', '🥗', '😴', '💪', '🎯',
  '🎸', '🌿', '✍️', '🧠', '☀️', '🚭', '🦷', '🎨',
  '🧹', '💊', '📵', '🐶', '🚴', '🧴', '🍎', '🛏️'
];

const els = {
  todayLabel: document.getElementById('todayLabel'),
  ringFill: document.getElementById('ringFill'),
  percent: document.getElementById('percentLabel'),
  title: document.getElementById('progressTitle'),
  sub: document.getElementById('progressSub'),
  bestStreak: document.getElementById('bestStreak'),
  doneCount: document.getElementById('doneCount'),
  totalCount: document.getElementById('totalCount'),
  list: document.getElementById('habitList'),
  empty: document.getElementById('emptyState'),
  emptyTitle: document.querySelector('#emptyState .empty__title'),
  emptyText: document.querySelector('#emptyState .empty__text'),
  form: document.getElementById('habitForm'),
  input: document.getElementById('habitInput'),
  addBtn: document.getElementById('addBtn'),
  emojiBtn: document.getElementById('emojiBtn'),
  emojiPanel: document.getElementById('emojiPanel'),
  editBanner: document.getElementById('editBanner'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  filters: document.getElementById('filters'),
  toolbarHint: document.getElementById('toolbarHint'),
  themeToggle: document.getElementById('themeToggle'),
  rangeTabs: document.getElementById('rangeTabs'),
  rangePercent: document.getElementById('rangePercent'),
  rangeLabel: document.getElementById('rangeLabel'),
  rangeDone: document.getElementById('rangeDone'),
  perfectDays: document.getElementById('perfectDays'),
  trackedLabel: document.getElementById('trackedLabel'),
  chart: document.getElementById('chart'),
  exportBtn: document.getElementById('exportBtn'),
  toast: document.getElementById('toast'),
  canvas: document.getElementById('confetti')
};

let filter = 'all';
let range = 'week';
let selectedEmoji = '💧';
let editingId = null;
let emojiBeforeEdit = null;
let state = loadState();
let toastTimer = 0;

/* ---------- Utilidades ---------- */

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'h-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function updateDateLabel() {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
  els.todayLabel.textContent = capitalize(formatted);
}

/* ---------- Estado ---------- */

function seedHabits() {
  return [
    { id: uid(), name: 'Beber 2L de agua', emoji: '💧', streak: 0, done: false, lastDone: null },
    { id: uid(), name: 'Mover el cuerpo 20 min', emoji: '🏃', streak: 0, done: false, lastDone: null },
    { id: uid(), name: 'Leer 10 páginas', emoji: '📚', streak: 0, done: false, lastDone: null },
    { id: uid(), name: 'Meditar 5 minutos', emoji: '🧘', streak: 0, done: false, lastDone: null }
  ];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('No se pudo leer el estado guardado.', error);
  }
  return {
    theme: 'dark',
    date: dateKey(),
    celebrated: null,
    habits: seedHabits(),
    history: {},
    archive: {}
  };
}

function normalizeState(data) {
  const normalized = {
    theme: data && data.theme === 'light' ? 'light' : 'dark',
    date: (data && data.date) || dateKey(),
    celebrated: (data && data.celebrated) || null,
    habits: [],
    history: {},
    archive: {}
  };

  if (data && Array.isArray(data.habits)) {
    normalized.habits = data.habits.map((habit) => ({
      id: habit.id || uid(),
      name: String(habit.name || 'Hábito').slice(0, 60),
      emoji: habit.emoji || '✨',
      streak: Number.isFinite(habit.streak) ? Math.max(0, Math.floor(habit.streak)) : 0,
      done: Boolean(habit.done),
      lastDone: habit.lastDone || null
    }));
  }

  if (data && data.history && typeof data.history === 'object') {
    Object.entries(data.history).forEach(([key, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !value || typeof value !== 'object') return;
      const done = Array.isArray(value.done)
        ? value.done.filter((id) => typeof id === 'string')
        : [];
      const total = Number.isFinite(value.total)
        ? Math.max(0, Math.floor(value.total))
        : done.length;
      normalized.history[key] = { total, done };
    });
  }

  if (data && data.archive && typeof data.archive === 'object') {
    Object.entries(data.archive).forEach(([id, value]) => {
      if (value && typeof value === 'object') {
        normalized.archive[id] = {
          name: String(value.name || 'Hábito'),
          emoji: value.emoji || '✨'
        };
      }
    });
  }

  // Migración desde la primera versión (solo guardaba el día actual)
  const seedKey = normalized.date;
  const doneIds = normalized.habits.filter((habit) => habit.done).map((habit) => habit.id);
  if (doneIds.length) {
    const existing = normalized.history[seedKey];
    if (!existing) {
      normalized.history[seedKey] = { total: normalized.habits.length, done: doneIds };
    } else {
      existing.done = Array.from(new Set([...existing.done, ...doneIds]));
      existing.total = Math.max(existing.total, normalized.habits.length);
    }
  }

  return normalized;
}

function pruneHistory() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_LIMIT_DAYS);
  const cutoffKey = dateKey(cutoff);
  Object.keys(state.history).forEach((key) => {
    if (key < cutoffKey) delete state.history[key];
  });
}

function saveState() {
  pruneHistory();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('No se pudo guardar el estado.', error);
  }
}

function todayEntry() {
  const key = dateKey();
  if (!state.history[key]) {
    state.history[key] = { total: state.habits.length, done: [] };
  }
  return state.history[key];
}

/**
 * Si cambió el día, reinicia las rachas rotas y sincroniza el estado
 * de hoy con el historial guardado.
 */
function rolloverDay() {
  const today = dateKey();
  const yesterday = yesterdayKey();

  if (state.date !== today) {
    state.habits.forEach((habit) => {
      if (habit.lastDone && habit.lastDone !== today && habit.lastDone !== yesterday) {
        habit.streak = 0;
      }
    });
    state.date = today;
  }

  const todayDone = new Set((state.history[today] || {}).done || []);
  state.habits.forEach((habit) => {
    habit.done = todayDone.has(habit.id);
    if (habit.done) habit.lastDone = today;
  });

  saveState();
}

function ensureTodayEntry() {
  const total = state.habits.length;
  const entry = state.history[dateKey()];

  if (!entry) {
    if (total > 0) state.history[dateKey()] = { total, done: [] };
    return;
  }

  const existingIds = new Set(state.habits.map((habit) => habit.id));
  entry.done = entry.done.filter((id) => existingIds.has(id));
  entry.total = Math.max(total, entry.done.length);
  saveState();
}

/* ---------- Tema ---------- */

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const label = state.theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro';
  els.themeToggle.setAttribute('aria-label', label);
  els.themeToggle.title = label;
}

/* ---------- Lista de hábitos ---------- */

function buildHabitRow(habit, index) {
  const li = document.createElement('li');
  li.className =
    'habit' +
    (habit.done ? ' is-done' : '') +
    (habit.id === editingId ? ' is-editing' : '');
  li.dataset.id = habit.id;

  if (index >= 0) {
    li.classList.add('animate');
    li.style.animationDelay = `${index * 45}ms`;
  }

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(habit.done));
  check.setAttribute('aria-label', `Marcar "${habit.name}" como completado`);
  check.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  check.addEventListener('click', () => toggleHabit(habit.id, li));

  const emoji = document.createElement('span');
  emoji.className = 'habit__emoji';
  emoji.textContent = habit.emoji;
  emoji.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'habit__name';
  name.textContent = habit.name;

  const streak = document.createElement('span');
  streak.className = 'streak';
  streak.title = 'Días consecutivos';
  streak.innerHTML = '<span aria-hidden="true">🔥</span>';
  const streakNum = document.createElement('span');
  streakNum.className = 'streak__num';
  streakNum.textContent = habit.streak;
  streak.append(streakNum);
  streak.hidden = habit.streak === 0;

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'habit__edit';
  edit.title = 'Editar hábito';
  edit.setAttribute('aria-label', `Editar "${habit.name}"`);
  edit.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/>' +
    '<path d="M13.5 6.5l4 4"/></svg>';
  edit.addEventListener('click', () => startEdit(habit.id));

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'habit__delete';
  del.setAttribute('aria-label', `Eliminar "${habit.name}"`);
  del.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/>' +
    '<path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/></svg>';
  del.addEventListener('click', () => deleteHabit(habit.id, li));

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'habit__more';
  more.setAttribute('aria-label', `Opciones de "${habit.name}"`);
  more.setAttribute('aria-haspopup', 'menu');
  more.setAttribute('aria-expanded', 'false');
  more.innerHTML =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

  const menu = document.createElement('div');
  menu.className = 'habit-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const editItem = document.createElement('button');
  editItem.type = 'button';
  editItem.setAttribute('role', 'menuitem');
  editItem.textContent = 'Editar';
  editItem.addEventListener('click', () => {
    closeHabitMenus();
    startEdit(habit.id);
  });

  const deleteItem = document.createElement('button');
  deleteItem.type = 'button';
  deleteItem.className = 'danger';
  deleteItem.setAttribute('role', 'menuitem');
  deleteItem.textContent = 'Eliminar';
  deleteItem.addEventListener('click', () => {
    closeHabitMenus();
    deleteHabit(habit.id, li);
  });

  menu.append(editItem, deleteItem);

  more.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeHabitMenus();
    if (willOpen) {
      menu.hidden = false;
      li.classList.add('is-menu-open');
      more.setAttribute('aria-expanded', 'true');
    }
  });

  li.append(check, emoji, name, streak, edit, del, more, menu);
  return li;
}

function closeHabitMenus() {
  els.list.querySelectorAll('.habit-menu').forEach((menu) => {
    menu.hidden = true;
  });
  els.list.querySelectorAll('.habit.is-menu-open').forEach((row) => {
    row.classList.remove('is-menu-open');
    const more = row.querySelector('.habit__more');
    if (more) more.setAttribute('aria-expanded', 'false');
  });
}

function renderList(animate = false) {
  els.list.innerHTML = '';

  const visible = state.habits.filter((habit) => {
    if (filter === 'todo') return !habit.done;
    if (filter === 'done') return habit.done;
    return true;
  });

  visible.forEach((habit, index) => {
    els.list.append(buildHabitRow(habit, animate ? index : -1));
  });

  updateEmptyState(visible.length);
}

function removeRow(row) {
  row.classList.add('is-leaving');
  window.setTimeout(() => {
    row.remove();
    updateEmptyState(els.list.children.length);
  }, 240);
}

function updateRow(row, habit) {
  row.classList.toggle('is-done', habit.done);
  row.querySelector('.check').setAttribute('aria-checked', String(habit.done));
  row.querySelector('.streak__num').textContent = habit.streak;
  row.querySelector('.streak').hidden = habit.streak === 0;
}

function updateEmptyState(visibleCount) {
  if (visibleCount > 0) {
    els.empty.hidden = true;
    return;
  }

  els.empty.hidden = false;

  if (state.habits.length === 0) {
    els.emptyTitle.textContent = 'Tu lista está vacía';
    els.emptyText.textContent = 'Añade tu primer hábito con el formulario de arriba.';
  } else if (filter === 'todo') {
    els.emptyTitle.textContent = '¡Todo hecho por hoy!';
    els.emptyText.textContent = 'No te queda nada pendiente. Disfruta el resto del día.';
  } else if (filter === 'done') {
    els.emptyTitle.textContent = 'Nada completado todavía';
    els.emptyText.textContent = 'Marca un hábito y aparecerá aquí.';
  } else {
    els.emptyTitle.textContent = 'Sin hábitos';
    els.emptyText.textContent = 'Añade uno nuevo para empezar.';
  }
}

function updateStats() {
  const total = state.habits.length;
  const done = state.habits.filter((habit) => habit.done).length;
  const pending = total - done;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const best = total ? Math.max(...state.habits.map((habit) => habit.streak)) : 0;

  els.ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - percent / 100));
  els.percent.textContent = `${percent}%`;
  els.bestStreak.textContent = best;
  els.doneCount.textContent = done;
  els.totalCount.textContent = total;
  els.toolbarHint.textContent =
    pending === 0 ? 'Sin pendientes' : `${pending} pendiente${pending === 1 ? '' : 's'}`;

  let title = 'Empieza pequeño';
  let subtitle = 'Marca tu primer hábito para poner en marcha el día.';

  if (total === 0) {
    title = 'Crea tu primer hábito';
    subtitle = 'Algo pequeño que puedas repetir cada día.';
  } else if (done === total) {
    title = '¡Día completo! 🎉';
    subtitle = 'Has cumplido todos tus hábitos. Mañana seguimos.';
  } else if (done === 0) {
    title = 'Empieza pequeño';
    subtitle = 'Un paso hoy es más que ninguno. Marca tu primer hábito.';
  } else if (percent < 50) {
    title = 'Buen comienzo';
    subtitle = `Llevas ${done} de ${total}. Mantén el ritmo.`;
  } else {
    title = 'Casi lo tienes';
    subtitle =
      pending === 1
        ? 'Solo te queda un hábito. Lo tienes.'
        : `Solo te quedan ${pending} hábitos. Lo tienes.`;
  }

  els.title.textContent = title;
  els.sub.textContent = subtitle;
}

/* ---------- Progreso semanal y mensual ---------- */

function rangeDays() {
  const length = range === 'week' ? 7 : 30;
  const today = new Date();
  return Array.from({ length }, (_, index) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    day.setDate(day.getDate() - (length - 1 - index));
    return day;
  });
}

function dayStat(key) {
  const entry = state.history[key];
  if (!entry || !entry.total) return null;
  const done = Math.min(entry.done.length, entry.total);
  return {
    total: entry.total,
    done,
    percent: Math.min(100, Math.round((done / entry.total) * 100))
  };
}

function formatBarTitle(date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function renderStats() {
  const days = rangeDays();
  const today = dateKey();
  const isWeek = range === 'week';

  const data = days.map((date) => {
    const key = dateKey(date);
    return { date, key, stat: dayStat(key) };
  });

  const tracked = data.filter((item) => item.stat);
  const totalDone = tracked.reduce((sum, item) => sum + item.stat.done, 0);
  const totalPossible = tracked.reduce((sum, item) => sum + item.stat.total, 0);
  const percent = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;
  const perfect = tracked.filter((item) => item.stat.done >= item.stat.total).length;

  els.rangePercent.textContent = `${percent}%`;
  els.rangeLabel.textContent = isWeek ? 'Últimos 7 días' : 'Últimos 30 días';
  els.rangeDone.textContent = totalDone;
  els.perfectDays.textContent = perfect;
  els.trackedLabel.textContent = tracked.length
    ? `${tracked.length} ${tracked.length === 1 ? 'día registrado' : 'días registrados'}`
    : 'Sin datos todavía';

  els.chart.innerHTML = '';
  els.chart.classList.toggle('chart--month', !isWeek);

  data.forEach((item, index) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    if (item.key === today) bar.classList.add('is-today');
    if (!item.stat) bar.classList.add('is-empty');
    else if (item.stat.percent === 0) bar.classList.add('is-zero');

    const label = isWeek ? WEEKDAY_INITIALS[item.date.getDay()] : '';
    bar.title = item.stat
      ? `${formatBarTitle(item.date)} · ${item.stat.percent}% (${item.stat.done}/${item.stat.total})`
      : `${formatBarTitle(item.date)} · Sin datos`;

    const track = document.createElement('div');
    track.className = 'bar__track';

    const fill = document.createElement('div');
    fill.className = 'bar__fill';
    if (item.stat) {
      fill.style.height = `${Math.max(item.stat.percent, 4)}%`;
      fill.style.animationDelay = `${index * 18}ms`;
    }
    track.append(fill);

    const barLabel = document.createElement('span');
    barLabel.className = 'bar__label';
    if (isWeek) {
      barLabel.textContent = label;
    } else {
      const dayNumber = item.date.getDate();
      const showNumber =
        dayNumber === 1 || dayNumber % 5 === 0 || index === data.length - 1;
      barLabel.textContent = showNumber ? String(dayNumber) : '';
    }

    bar.append(track, barLabel);
    els.chart.append(bar);
  });
}

function setRange(nextRange) {
  range = nextRange;
  els.rangeTabs.querySelectorAll('button').forEach((button) => {
    const active = button.dataset.range === range;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  renderStats();
}

/* ---------- Acciones ---------- */

function toggleHabit(id, row) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  if (habit.done) {
    habit.done = false;
    habit.streak = Math.max(0, habit.streak - 1);
    habit.lastDone = yesterdayKey();
  } else {
    habit.done = true;
    habit.streak += 1;
    habit.lastDone = dateKey();
  }

  const entry = todayEntry();
  const doneSet = new Set(entry.done);
  if (habit.done) doneSet.add(habit.id);
  else doneSet.delete(habit.id);
  entry.done = Array.from(doneSet);
  entry.total = state.habits.length;

  saveState();
  updateRow(row, habit);
  updateStats();
  renderStats();
  maybeCelebrate();

  const leavesView =
    (filter === 'todo' && habit.done) || (filter === 'done' && !habit.done);
  if (leavesView) removeRow(row);
}

function deleteHabit(id, row) {
  if (editingId === id) resetComposerUI();
  row.classList.add('is-leaving');
  window.setTimeout(() => {
    const habit = state.habits.find((item) => item.id === id);
    if (habit) {
      state.archive[id] = { name: habit.name, emoji: habit.emoji };
    }

    state.habits = state.habits.filter((item) => item.id !== id);

    const entry = state.history[dateKey()];
    if (entry) {
      entry.done = entry.done.filter((item) => item !== id);
      entry.total = state.habits.length;
    }

    saveState();
    row.remove();
    updateStats();
    renderStats();
    updateEmptyState(els.list.children.length);
  }, 240);
}

function addHabit(name) {
  state.habits.push({
    id: uid(),
    name: name.slice(0, 60),
    emoji: selectedEmoji,
    streak: 0,
    done: false,
    lastDone: null
  });

  const entry = todayEntry();
  entry.total = state.habits.length;
  saveState();

  if (filter === 'done') setFilter('all');
  else renderList(true);

  updateStats();
  renderStats();
  els.input.focus();
}

function setFilter(nextFilter) {
  filter = nextFilter;
  els.filters.querySelectorAll('button').forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  renderList(true);
}

/* ---------- Edición ---------- */

function setEmojiSelection(emoji) {
  selectedEmoji = emoji;
  els.emojiBtn.textContent = emoji;
  els.emojiPanel.querySelectorAll('.emoji-option').forEach((option) => {
    const active = option.textContent === emoji;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-selected', String(active));
  });
}

function startEdit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  if (editingId !== id) {
    if (editingId) resetComposerUI();
    emojiBeforeEdit = selectedEmoji;
  }

  editingId = id;
  els.input.value = habit.name;
  setEmojiSelection(habit.emoji);
  els.addBtn.textContent = 'Guardar';
  els.editBanner.hidden = false;
  renderList(false);
  els.input.focus({ preventScroll: true });
  els.input.select();
  els.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetComposerUI() {
  editingId = null;
  els.input.value = '';
  els.addBtn.textContent = 'Añadir';
  els.editBanner.hidden = true;
  const restore = emojiBeforeEdit || EMOJIS[0];
  emojiBeforeEdit = null;
  setEmojiSelection(restore);
}

function resetComposer() {
  resetComposerUI();
  renderList(false);
}

/* ---------- Confeti ---------- */

function maybeCelebrate() {
  const total = state.habits.length;
  if (!total || !state.habits.every((habit) => habit.done)) return;

  const today = dateKey();
  if (state.celebrated === today) return;

  state.celebrated = today;
  saveState();
  burstConfetti();
}

function burstConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = els.canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const colors = ['#c6f76b', '#5eead4', '#a78bfa', '#fbbf24', '#fb7185', '#ffffff'];
  const particles = Array.from({ length: 120 }, () => ({
    x: width * (0.5 + (Math.random() - 0.5) * 0.55),
    y: height * 0.42,
    vx: (Math.random() - 0.5) * 10,
    vy: -Math.random() * 12 - 3,
    size: 4 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.32,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    life: 1
  }));

  const start = performance.now();
  let frameId = 0;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    let alive = false;

    for (const particle of particles) {
      particle.vy += 0.34;
      particle.vx *= 0.994;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;

      const fadeStart = 1700;
      particle.life = Math.max(0, 1 - Math.max(0, elapsed - fadeStart) / 1400);
      if (particle.life > 0 && particle.y < height + 50) alive = true;

      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;

      if (particle.shape === 'rect') {
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (alive) {
      frameId = window.requestAnimationFrame(frame);
    } else {
      window.cancelAnimationFrame(frameId);
      ctx.clearRect(0, 0, width, height);
    }
  }

  frameId = window.requestAnimationFrame(frame);
}

/* ---------- Exportación ---------- */

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  const rows = [['Fecha', 'Día', 'Hábitos', 'Completados', 'Porcentaje (%)', 'Hábitos completados']];
  const nameById = new Map(state.habits.map((habit) => [habit.id, habit.name]));
  Object.entries(state.archive).forEach(([id, value]) => {
    if (!nameById.has(id)) nameById.set(id, value.name);
  });

  Object.keys(state.history)
    .sort()
    .forEach((key) => {
      const entry = state.history[key];
      if (!entry || !entry.total) return;

      const done = entry.done.length;
      const percent = Math.round((done / entry.total) * 100);
      const names = entry.done.map((id) => nameById.get(id) || 'Hábito eliminado');
      const weekday = capitalize(
        new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(
          new Date(`${key}T12:00:00`)
        )
      );

      rows.push([key, weekday, entry.total, done, percent, names.join('; ')]);
    });

  if (rows.length === 1) {
    showToast('Todavía no hay datos que exportar');
    return;
  }

  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ritual-progreso-${dateKey()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast('Progreso exportado en CSV');
}

/* ---------- Aviso flotante ---------- */

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove('is-visible');
  }, 2600);
}

/* ---------- Selector de emoji ---------- */

function buildEmojiPanel() {
  EMOJIS.forEach((emoji, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-option' + (index === 0 ? ' is-active' : '');
    button.textContent = emoji;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-label', `Elegir ${emoji}`);
    button.setAttribute('aria-selected', String(index === 0));

    button.addEventListener('click', () => {
      setEmojiSelection(emoji);
      closeEmojiPanel();
      els.input.focus();
    });

    els.emojiPanel.append(button);
  });
}

function openEmojiPanel() {
  els.emojiPanel.hidden = false;
  els.emojiBtn.setAttribute('aria-expanded', 'true');
}

function closeEmojiPanel() {
  els.emojiPanel.hidden = true;
  els.emojiBtn.setAttribute('aria-expanded', 'false');
}

/* ---------- Eventos ---------- */

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = els.input.value.trim();

  if (!name) {
    els.input.classList.remove('shake');
    void els.input.offsetWidth;
    els.input.classList.add('shake');
    window.setTimeout(() => els.input.classList.remove('shake'), 420);
    els.input.focus();
    return;
  }

  if (editingId) {
    const habit = state.habits.find((item) => item.id === editingId);
    if (habit) {
      habit.name = name.slice(0, 60);
      habit.emoji = selectedEmoji;
      saveState();
      resetComposer();
      updateStats();
      renderStats();
      showToast('Hábito actualizado');
    }
    els.input.focus();
    return;
  }

  els.input.value = '';
  addHabit(name);
});

els.filters.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-filter]');
  if (button) setFilter(button.dataset.filter);
});

els.rangeTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-range]');
  if (!button || button.dataset.range === range) return;
  setRange(button.dataset.range);
});

els.exportBtn.addEventListener('click', exportCsv);

els.cancelEditBtn.addEventListener('click', () => {
  resetComposer();
  els.input.focus();
});

els.themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveState();
});

els.emojiBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (els.emojiPanel.hidden) openEmojiPanel();
  else closeEmojiPanel();
});

document.addEventListener('click', (event) => {
  if (!els.emojiPanel.hidden && !els.emojiPanel.contains(event.target)) {
    closeEmojiPanel();
  }

  const target = event.target;
  const insideMenu =
    target instanceof Element &&
    (target.closest('.habit-menu') || target.closest('.habit__more'));
  if (!insideMenu) closeHabitMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeEmojiPanel();
  closeHabitMenus();
  if (editingId) {
    resetComposer();
    els.input.focus();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  rolloverDay();
  ensureTodayEntry();
  updateDateLabel();
  renderList(false);
  updateStats();
  renderStats();
});

/* ---------- Inicio ---------- */

function init() {
  applyTheme();
  updateDateLabel();
  rolloverDay();
  ensureTodayEntry();
  buildEmojiPanel();
  renderList(true);
  updateStats();
  renderStats();
}

init();
