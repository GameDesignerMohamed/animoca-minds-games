/* RECOMP — app logic. Vanilla JS, localStorage, offline-first. */
'use strict';

/* ---------- storage ---------- */

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
  del(key) { try { localStorage.removeItem(key); } catch {} },
};

const K = {
  settings: 'recomp.settings',
  logs: 'recomp.logs',
  loads: 'recomp.loads',          // accessory last-used loads, keyed by exercise key
  draft: id => `recomp.draft.${id}`,
};

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

function getLogs() { return store.get(K.logs, []); }

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

/* Monday-anchored key of the current program week, for "done" markers. */
function currentWeekDates() {
  const s = getSettings();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const offset = (now.getDay() - s.day1Weekday + 7) % 7;
  const first = new Date(now); first.setDate(now.getDate() - offset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(first); d.setDate(first.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

/* ---------- draft (in-progress session) ---------- */

function getDraft(dayId) {
  return store.get(K.draft(dayId), { kg: {}, sets: {}, dots: {} });
}
function setDraft(dayId, draft) { store.set(K.draft(dayId), draft); }

/* ---------- progression ---------- */

function lastEntryFor(liftKey) {
  const logs = getLogs();
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].lifts && logs[i].lifts[liftKey]) return { ...logs[i].lifts[liftKey], date: logs[i].date };
  }
  return null;
}

function evalPass(block, entry) {
  if (!entry || !entry.sets) return false;
  const logged = entry.sets.filter(Boolean);
  if (logged.length < block.sets) return false;
  return logged.every(s => s.reps >= block.reps && s.rpe <= 8);
}

function targetFor(block) {
  const last = lastEntryFor(block.key);
  if (!last || !last.kg) return null;
  return last.pass
    ? { kg: +(last.kg + block.inc).toFixed(1), up: true, inc: block.inc }
    : { kg: last.kg, up: false };
}

/* ---------- dom helpers ---------- */

const $ = sel => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
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

function doneDayIdsThisWeek() {
  const dates = new Set(currentWeekDates());
  const done = new Set();
  for (const log of getLogs()) if (dates.has(log.date)) done.add(log.dayId);
  return done;
}

function renderDayNav() {
  const nav = $('#dayNav');
  nav.innerHTML = '';
  const todayIdx = todaysDayIndex();
  const done = doneDayIdsThisWeek();
  PROGRAM.days.forEach((day, i) => {
    const short = { lift: day.name.replace('Upper ', 'UP '), run: 'RUN', off: 'OFF' }[day.kind] || day.name;
    nav.append(el('button', {
      class: 'daybtn'
        + (i === activeDayIdx && activeTab === 'train' ? ' is-active' : '')
        + (i === todayIdx ? ' is-today' : '')
        + (done.has(day.id) ? ' is-done' : ''),
      type: 'button',
      'aria-label': `Day ${day.n} — ${day.name}`,
      onclick: () => { activeDayIdx = i; switchTab('train'); },
    },
      el('span', { class: 'dn' }, String(day.n)),
      el('span', { class: 'dl' }, short.toUpperCase().slice(0, 5)),
    ));
  });
}

function renderMainLift(day, block, draft) {
  const card = el('div', { class: 'xcard' });
  const target = targetFor(block);

  card.append(el('div', { class: 'xhead' },
    el('h3', { class: 'xname' }, block.name),
    el('span', { class: 'xscheme' }, `${block.sets}×${block.reps} · rest ${block.restLabel}`),
  ));
  if (block.notes) {
    card.append(el('ul', { class: 'xnotes' }, ...block.notes.map(n => el('li', {}, n))));
  }
  if (target) {
    card.append(el('div', { style: 'padding: 0 14px;' },
      el('span', { class: 'target-note' },
        target.up ? `TARGET ${target.kg} KG (+${target.inc})` : `REPEAT ${target.kg} KG — earn all 25 first`),
    ));
  }

  // weight input
  if (!(block.key in draft.kg) && target) draft.kg[block.key] = target.kg;
  const kgInput = el('input', {
    class: 'kg-input', type: 'number', inputmode: 'decimal', step: '2.5', min: '0',
    value: draft.kg[block.key] ?? '', placeholder: '—',
    'aria-label': `${block.name} working weight in kilograms`,
  });
  kgInput.addEventListener('change', () => {
    draft.kg[block.key] = parseFloat(kgInput.value) || 0;
    setDraft(day.id, draft);
  });
  card.append(el('div', { class: 'loadrow' },
    el('label', { for: '' }, 'Load'), kgInput, el('span', { class: 'kg-unit' }, 'KG'),
  ));

  // set rows
  const grid = el('div', { class: 'setgrid' });
  if (!draft.sets[block.key]) draft.sets[block.key] = new Array(block.sets).fill(null);
  const sets = draft.sets[block.key];

  const flag = el('span', { class: 'progress-flag wait' }, '');
  const updateFlag = () => {
    const logged = sets.filter(Boolean);
    if (logged.length < block.sets) {
      flag.className = 'progress-flag wait';
      flag.textContent = `${logged.length}/${block.sets} sets`;
      return;
    }
    const pass = logged.every(s => s.reps >= block.reps && s.rpe <= 8);
    flag.className = 'progress-flag ' + (pass ? 'pass' : 'wait');
    flag.textContent = pass ? `ALL ${block.sets * block.reps} — +${block.inc} KG NEXT` : 'REPEAT LOAD NEXT';
  };

  sets.forEach((_, i) => {
    const row = el('div', { class: 'setrow' + (sets[i] ? ' is-logged' : '') });
    const val = el('span', { class: 'rep-val' + (sets[i] ? '' : ' is-empty') },
      sets[i] ? String(sets[i].reps) : 'tap');

    const commit = (reps, rpe) => {
      sets[i] = { reps, rpe };
      setDraft(day.id, draft);
      row.classList.add('is-logged');
      val.classList.remove('is-empty');
      val.textContent = String(reps);
      updateFlag();
    };

    const minus = el('button', { class: 'step-btn', type: 'button', 'aria-label': `set ${i + 1}: one rep less` }, '−');
    const plus = el('button', { class: 'step-btn', type: 'button', 'aria-label': `set ${i + 1}: log or add rep` }, '+');

    const rpeSel = el('select', { class: 'rpe-select', 'aria-label': `set ${i + 1} RPE` });
    ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'].forEach(v => {
      rpeSel.append(el('option', { value: v, selected: v === String(sets[i]?.rpe ?? 8) }, `RPE ${v}`));
    });
    const tintRpe = () => rpeSel.classList.toggle('is-hot', parseFloat(rpeSel.value) > 8);
    tintRpe();
    rpeSel.addEventListener('change', () => {
      tintRpe();
      if (sets[i]) commit(sets[i].reps, parseFloat(rpeSel.value));
    });

    plus.addEventListener('click', () => {
      const cur = sets[i] ? sets[i].reps + 1 : block.reps; // first tap logs the full target
      commit(Math.min(cur, 12), parseFloat(rpeSel.value));
    });
    minus.addEventListener('click', () => {
      if (!sets[i]) { commit(block.reps - 1, parseFloat(rpeSel.value)); return; }
      const cur = sets[i].reps - 1;
      if (cur <= 0) {
        sets[i] = null;
        setDraft(day.id, draft);
        row.classList.remove('is-logged');
        val.classList.add('is-empty');
        val.textContent = 'tap';
        updateFlag();
      } else commit(cur, parseFloat(rpeSel.value));
    });

    row.append(
      el('span', { class: 'set-n' }, `S${i + 1}`),
      el('div', { class: 'rep-stepper' }, minus, val, plus),
      rpeSel,
    );
    grid.append(row);
  });
  card.append(grid);
  updateFlag();

  card.append(el('div', { class: 'xfoot' },
    el('button', {
      class: 'rest-chip', type: 'button',
      onclick: () => startRest(block.restSec, block.name),
    }, `REST ${fmtClock(block.restSec)}`),
    flag,
  ));
  return card;
}

function renderAccessoryItem(day, item, sets, draft, loads) {
  const dotWrap = el('div', { class: 'setdots' });
  const doneCount = () => draft.dots[item.key] || 0;
  for (let i = 0; i < sets; i++) {
    const dot = el('button', {
      class: 'dot' + (i < doneCount() ? ' is-on' : ''), type: 'button',
      'aria-label': `${item.name} set ${i + 1}`,
    }, String(i + 1));
    dot.addEventListener('click', () => {
      draft.dots[item.key] = (i < doneCount()) ? i : i + 1;
      setDraft(day.id, draft);
      [...dotWrap.children].forEach((d, j) => d.classList.toggle('is-on', j < doneCount()));
    });
    dotWrap.append(dot);
  }

  const loadInput = el('input', {
    class: 'acc-load', type: 'text', inputmode: 'decimal',
    placeholder: 'kg', value: loads[item.key] ?? '',
    'aria-label': `${item.name} load`,
  });
  loadInput.addEventListener('change', () => {
    loads[item.key] = loadInput.value.trim();
    store.set(K.loads, loads);
  });

  const sub = [item.cue, item.swap].filter(Boolean).join(' · ');
  return el('div', { class: 'accrow' },
    el('div', { class: 'acc-name' }, item.name, sub ? el('small', {}, sub) : null),
    el('span', { class: 'acc-scheme' }, `${sets}×${item.reps}`),
    el('div', { class: 'acc-ctrl' }, dotWrap, loadInput),
  );
}

function renderTrain() {
  const view = $('#view');
  view.innerHTML = '';
  const day = PROGRAM.days[activeDayIdx];
  const draft = getDraft(day.id);
  const loads = store.get(K.loads, {});
  const logs = getLogs();
  const doneToday = logs.some(l => l.date === todayISO() && l.dayId === day.id);

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
    if (block.type === 'main') {
      view.append(renderMainLift(day, block, draft));
      continue;
    }
    const card = el('div', { class: 'xcard' });
    if (block.type === 'superset') {
      card.append(el('span', { class: 'superset-tag' }, `SUPERSET · REST ${block.restSec} S`));
      const acc = el('div', { class: 'acc' });
      block.items.forEach(item => acc.append(renderAccessoryItem(day, item, item.sets, draft, loads)));
      card.append(acc);
      card.append(el('div', { class: 'xfoot' },
        el('button', { class: 'rest-chip', type: 'button', onclick: () => startRest(block.restSec, block.items.map(i => i.name).join(' + ')) },
          `REST ${fmtClock(block.restSec)}`),
        el('span', {}, ''),
      ));
    } else if (block.type === 'single') {
      const acc = el('div', { class: 'acc' });
      acc.append(renderAccessoryItem(day, block, block.sets, draft, loads));
      card.append(acc);
      if (block.gate) card.append(el('div', { class: 'gate-note', style: 'margin-bottom:12px;' }, block.gate));
      if (block.restSec) card.append(el('div', { class: 'xfoot' },
        el('button', { class: 'rest-chip', type: 'button', onclick: () => startRest(block.restSec, block.name) },
          `REST ${fmtClock(block.restSec)}`),
        el('span', {}, ''),
      ));
    } else if (block.type === 'finisher') {
      const on = (draft.dots[block.key] || 0) > 0;
      const btn = el('button', { class: 'dot' + (on ? ' is-on' : ''), type: 'button', 'aria-label': block.name }, '✓');
      btn.addEventListener('click', () => {
        draft.dots[block.key] = draft.dots[block.key] ? 0 : 1;
        setDraft(day.id, draft);
        btn.classList.toggle('is-on');
      });
      card.append(el('div', { class: 'acc' },
        el('div', { class: 'accrow' },
          el('div', { class: 'acc-name' }, block.name),
          el('span', { class: 'acc-scheme' }, block.detail),
          el('div', { class: 'acc-ctrl' }, btn),
        )));
    }
    view.append(card);
  }

  const finish = el('button', {
    class: 'finish-btn' + (doneToday ? ' is-done' : ''),
    type: 'button',
  }, doneToday ? '✓ LOGGED TODAY' : 'FINISH SESSION');
  finish.addEventListener('click', () => finishSession(day, draft));
  view.append(finish);
}

function finishSession(day, draft) {
  const lifts = {};
  let anything = false;
  for (const block of day.blocks) {
    if (block.type !== 'main') continue;
    const sets = (draft.sets[block.key] || []).filter(Boolean);
    if (!sets.length) continue;
    anything = true;
    const entry = { kg: draft.kg[block.key] || 0, sets: draft.sets[block.key] };
    entry.pass = evalPass(block, entry);
    lifts[block.key] = entry;
  }
  if (!anything && !Object.keys(draft.dots).length) {
    toast('Nothing logged yet.');
    return;
  }
  const logs = getLogs();
  logs.push({ date: todayISO(), dayId: day.id, week: programWeek(), lifts, dots: draft.dots });
  store.set(K.logs, logs);
  store.del(K.draft(day.id));

  const passed = Object.entries(lifts).filter(([, e]) => e.pass);
  toast(passed.length
    ? `Logged. ${passed.map(([k]) => MAIN_LIFTS.find(m => m.key === k)?.name).join(' + ')} moving up.`
    : 'Session logged.');
  renderDayNav();
  renderTrain();
}

/* ---------- render: log ---------- */

function renderLog() {
  const view = $('#view');
  view.innerHTML = '';
  view.append(el('div', { class: 'session-head' },
    el('h2', { class: 'session-title' }, el('span', { class: 'tick' }, '↗ '), 'The log'),
  ));
  view.append(el('p', { class: 'session-sub' }, 'The log is the evidence, whatever the mirror says.'));

  const logs = getLogs();
  for (const lift of MAIN_LIFTS) {
    const section = el('section', { class: 'log-section' });
    section.append(el('h3', { class: 'log-lift-name' }, lift.name));

    const entries = [];
    for (const log of logs) if (log.lifts && log.lifts[lift.key]) entries.push({ date: log.date, ...log.lifts[lift.key] });

    const last = entries[entries.length - 1];
    if (last) {
      section.append(el('p', { class: 'log-next' },
        last.pass ? `NEXT: ${+(last.kg + lift.inc).toFixed(1)} KG (+${lift.inc})` : `NEXT: repeat ${last.kg} kg`));
    }

    if (!entries.length) {
      section.append(el('p', { class: 'log-empty' }, 'No sessions yet. First entry sets the baseline.'));
    } else {
      const table = el('table', { class: 'log-table' });
      entries.slice(-10).reverse().forEach(e => {
        const reps = (e.sets || []).filter(Boolean).map(s => s.reps).join('·');
        table.append(el('tr', {},
          el('td', { class: 'log-date' }, e.date.slice(5).replace('-', '/')),
          el('td', { class: 'log-kg' }, `${e.kg} KG`),
          el('td', { class: 'log-reps' }, reps),
          el('td', { class: 'log-verdict ' + (e.pass ? 'pass' : 'fail') }, e.pass ? '▲' : '—'),
        ));
      });
      section.append(table);
    }
    view.append(section);
  }

  view.append(el('p', { class: 'sect-label' }, 'Body'));
  PROGRAM.track.forEach(t => view.append(el('p', { class: 'track-note' }, t)));
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

  const wipe = el('button', { class: 'danger-btn', type: 'button' }, 'Erase all logged data');
  wipe.addEventListener('click', () => {
    if (!confirm('Erase every logged session and load? This cannot be undone.')) return;
    Object.keys(localStorage).filter(k => k.startsWith('recomp.')).forEach(k => store.del(k));
    getSettings();
    refreshHeader(); renderDayNav();
    toast('Wiped. Clean slate.');
  });
  view.append(wipe);
}

/* ---------- tabs + header ---------- */

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tabbar .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  renderDayNav();
  if (tab === 'train') renderTrain();
  else if (tab === 'log') renderLog();
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
