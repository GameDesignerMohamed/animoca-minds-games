/* RECOMP — app logic. Program reference + rest timers. No logging. */
'use strict';

/* ---------- storage (settings only) ---------- */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

const K = { settings: 'recomp.settings' };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSettings() {
  const s = store.get(K.settings, null);
  if (s && s.startDate) return s;
  const fresh = { startDate: todayISO(), day1Weekday: 1 }; // Day 1 = Monday
  store.set(K.settings, fresh);
  return fresh;
}

/* ---------- week math ---------- */

function programWeek() {
  const s = getSettings();
  const start = new Date(s.startDate + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.floor((now - start) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function blockWeek() { return ((programWeek() - 1) % PROGRAM.blockWeeks) + 1; }
function isDeloadWeek() { return blockWeek() === PROGRAM.blockWeeks; }

function todaysDayIndex() {
  const s = getSettings();
  const js = new Date().getDay(); // Sun=0
  return (js - s.day1Weekday + 7) % 7;
}

/* ---------- dom helpers ---------- */

const $ = sel => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

let toastTimer = null;
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  clearTimeout(toastTimer);
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

/* ---------- rest timer ---------- */

const rest = { timer: null, remaining: 0, total: 0 };
const RING_C = 2 * Math.PI * 19;

function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach(off => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, now + off);
      g.gain.exponentialRampToValueAtTime(0.18, now + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(now + off); o.stop(now + off + 0.25);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
  if (navigator.vibrate) navigator.vibrate([180, 90, 180, 90, 320]);
}

function paintRest() {
  $('#restClock').textContent = fmtClock(Math.max(0, rest.remaining));
  const frac = rest.total ? rest.remaining / rest.total : 0;
  $('#ringFill').style.strokeDashoffset = String(RING_C * (1 - frac));
}

function startRest(seconds, label) {
  clearInterval(rest.timer);
  rest.remaining = seconds; rest.total = seconds;
  const bar = $('#restBar');
  bar.hidden = false; bar.classList.remove('is-up');
  $('#restFor').textContent = label;
  paintRest();
  rest.timer = setInterval(() => {
    rest.remaining--;
    paintRest();
    if (rest.remaining <= 0) {
      clearInterval(rest.timer);
      bar.classList.add('is-up');
      $('#restFor').textContent = 'Back under the bar.';
      beep();
      setTimeout(stopRest, 6000);
    }
  }, 1000);
}

function stopRest() {
  clearInterval(rest.timer);
  $('#restBar').hidden = true;
}

$('#restSkip').addEventListener('click', stopRest);
$('#restAdd').addEventListener('click', () => {
  if ($('#restBar').hidden) return;
  rest.remaining += 30; rest.total = Math.max(rest.total, rest.remaining);
  $('#restBar').classList.remove('is-up');
  paintRest();
});

/* ---------- render: train ---------- */

let activeDayIdx = todaysDayIndex();
let activeTab = 'train';

function renderDayNav() {
  const nav = $('#dayNav');
  nav.innerHTML = '';
  const todayIdx = todaysDayIndex();
  PROGRAM.days.forEach((day, i) => {
    const short = { lift: day.name.replace('Upper ', 'UP '), run: 'RUN', off: 'OFF' }[day.kind] || day.name;
    nav.append(el('button', {
      class: 'daybtn'
        + (i === activeDayIdx && activeTab === 'train' ? ' is-active' : '')
        + (i === todayIdx ? ' is-today' : ''),
      type: 'button',
      'aria-label': `Day ${day.n} — ${day.name}`,
      onclick: () => { activeDayIdx = i; switchTab('train'); },
    },
      el('span', { class: 'dn' }, String(day.n)),
      el('span', { class: 'dl' }, short.toUpperCase().slice(0, 5)),
    ));
  });
}

function restChip(seconds, label) {
  return el('button', {
    class: 'rest-chip', type: 'button',
    onclick: () => startRest(seconds, label),
  }, `REST ${fmtClock(seconds)}`);
}

function accItem(item, sets, reps) {
  const sub = [item.cue, item.swap].filter(Boolean).join(' · ');
  return el('div', { class: 'accrow' },
    el('div', { class: 'acc-name' }, item.name, sub ? el('small', {}, sub) : null),
    el('span', { class: 'acc-scheme' }, reps ? `${sets}×${reps}` : sets),
  );
}

function renderTrain() {
  const view = $('#view');
  view.innerHTML = '';
  const day = PROGRAM.days[activeDayIdx];

  view.append(el('div', { class: 'session-head' },
    el('h2', { class: 'session-title' },
      el('span', { class: 'tick' }, `D${day.n} `), day.name),
    day.minutes ? el('span', { class: 'session-mins' }, `${day.minutes} MIN`) : null,
  ));

  if (day.kind !== 'lift') {
    view.append(el('div', { class: 'simple-day' },
      el('div', { class: 'simple-glyph' }, day.kind === 'run' ? '~ ~ ~' : '×'),
      el('p', { class: 'simple-note' }, day.note),
    ));
    return;
  }

  view.append(el('p', { class: 'session-sub' }, PROGRAM.frequency));
  if (day.caution) view.append(el('div', { class: 'caution' }, el('strong', {}, '⚠ '), day.caution));

  for (const block of day.blocks) {
    const card = el('div', { class: 'xcard' });

    if (block.type === 'main') {
      card.append(el('div', { class: 'xhead' },
        el('h3', { class: 'xname' }, block.name),
        el('span', { class: 'xscheme' }, `${block.sets}×${block.reps} · rest ${block.restLabel}`),
      ));
      if (block.notes) card.append(el('ul', { class: 'xnotes' }, ...block.notes.map(n => el('li', {}, n))));
      card.append(el('div', { class: 'xfoot' }, restChip(block.restSec, block.name)));

    } else if (block.type === 'superset') {
      card.append(el('span', { class: 'superset-tag' }, `SUPERSET · REST ${block.restSec} S`));
      const acc = el('div', { class: 'acc' });
      block.items.forEach(item => acc.append(accItem(item, item.sets, item.reps)));
      card.append(acc);
      card.append(el('div', { class: 'xfoot' },
        restChip(block.restSec, block.items.map(i => i.name).join(' + '))));

    } else if (block.type === 'single') {
      const acc = el('div', { class: 'acc' });
      acc.append(accItem(block, block.sets, block.reps));
      card.append(acc);
      if (block.gate) card.append(el('div', { class: 'gate-note' }, block.gate));
      if (block.restSec) card.append(el('div', { class: 'xfoot' }, restChip(block.restSec, block.name)));

    } else if (block.type === 'finisher') {
      card.append(el('div', { class: 'acc' }, accItem(block, block.detail, null)));
    }

    view.append(card);
  }
}

/* ---------- render: rules ---------- */

function renderRules() {
  const view = $('#view');
  view.innerHTML = '';
  const s = getSettings();

  view.append(el('div', { class: 'session-head' },
    el('h2', { class: 'session-title' }, el('span', { class: 'tick' }, '§ '), 'Rules'),
  ));
  view.append(el('p', { class: 'session-sub' }, `${PROGRAM.phase} · ${PROGRAM.diet}`));

  const list = el('div', { class: 'rules-list' });
  PROGRAM.rules.forEach(r => list.append(el('div', { class: 'rule' },
    el('div', {}, el('h3', {}, r.title), el('p', {}, r.body)))));
  view.append(list);

  view.append(el('p', { class: 'sect-label' }, 'Banned / Frozen'));
  PROGRAM.banned.forEach(b => view.append(el('div', { class: `ban-card ${b.status}` },
    el('div', { class: 'ban-name' }, b.name, el('small', {}, b.detail)),
    el('span', { class: 'ban-tag' }, b.status.toUpperCase()),
  )));

  view.append(el('p', { class: 'sect-label' }, 'Track'));
  PROGRAM.track.forEach(t => view.append(el('p', { class: 'track-note' }, t)));

  view.append(el('p', { class: 'sect-label' }, 'Settings'));
  const grid = el('div', { class: 'settings-grid' });

  const dateInput = el('input', { type: 'date', value: s.startDate });
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    store.set(K.settings, { ...getSettings(), startDate: dateInput.value });
    refreshHeader(); renderDayNav();
    toast(`Week ${programWeek()} of the program.`);
  });
  grid.append(el('div', { class: 'setting' },
    el('label', {}, 'Program start', el('small', {}, 'Sets the week counter and the week-6 deload')),
    dateInput));

  const daySel = el('select', {});
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((d, i) => {
    daySel.append(el('option', { value: String(i), selected: i === s.day1Weekday }, d));
  });
  daySel.addEventListener('change', () => {
    store.set(K.settings, { ...getSettings(), day1Weekday: parseInt(daySel.value, 10) });
    activeDayIdx = todaysDayIndex();
    renderDayNav();
    toast('Week anchored.');
  });
  grid.append(el('div', { class: 'setting' },
    el('label', {}, 'Day 1 falls on', el('small', {}, 'Used to highlight today’s session')),
    daySel));
  view.append(grid);
}

/* ---------- tabs + header ---------- */

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tabbar .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  renderDayNav();
  if (tab === 'train') renderTrain();
  else renderRules();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('.tabbar .tab').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

$('#weekChip').addEventListener('click', () => switchTab('rules'));

function refreshHeader() {
  $('#phaseLine').textContent = PROGRAM.phase;
  $('#weekChip').textContent = `WK ${programWeek()} · B${blockWeek()}`;
  $('#deloadBanner').hidden = !isDeloadWeek();
}

/* ---------- boot ---------- */

refreshHeader();
renderDayNav();
renderTrain();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
