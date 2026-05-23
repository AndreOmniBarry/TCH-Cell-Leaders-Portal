'use strict';

const $ = id => document.getElementById(id);
const toInitials = name => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
const COLORS = ['#5C1A2E','#1A6B45','#1A3A5C','#7A4A00','#4A1A5C','#005C4A','#5C3A00','#00365C'];
const colorFor = id => COLORS[parseInt(id.replace(/\D/g,''), 10) % COLORS.length];
let _toastTimer = null;

window.showToast = function(msg, duration = 3500) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
};

let state = { cellKey: null, cellName: null, leader: null, attendance: {}, members: [] };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = $(id);
  if (t) { t.classList.add('active'); window.scrollTo(0, 0); }
}

function todayLabel() {
  return new Date().toLocaleDateString('en-NG', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function renderList(query) {
  const listEl  = $('list-root');
  const emptyEl = $('empty-state');
  const countEl = $('list-count-label');
  if (!listEl) return;
  const q = (query || '').toLowerCase().trim();
  listEl.innerHTML = '';
  let visible = 0;

  state.members.forEach((m, i) => {
    if (q && !m.name.toLowerCase().includes(q)) return;
    visible++;
    const att = state.attendance[m.id] || 'pending';
    const icon = att === 'present' ? '✓' : att === 'absent' ? '✗' : '○';
    const chipClass = att === 'present' ? 'chip-present' : att === 'absent' ? 'chip-absent' : 'chip-pending';
    const chipLabel = att === 'present' ? 'Present' : att === 'absent' ? 'Absent' : 'Pending';
    const li = document.createElement('li');
    li.className = 'member-card anim-fade-up' + (att === 'present' ? ' present' : att === 'absent' ? ' absent' : '');
    li.style.animationDelay = (i * 0.035) + 's';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `${m.name} — ${chipLabel}. Tap to toggle`);
    li.dataset.id = m.id;
    li.innerHTML = `
      <div class="member-avatar" style="background:${colorFor(m.id)}" aria-hidden="true">${toInitials(m.name)}</div>
      <div class="member-info">
        <div class="member-name">${m.name}</div>
        <div class="member-meta">${m.role} · ${m.phone}</div>
        <div class="member-status"><span class="status-chip ${chipClass}">${chipLabel}</span></div>
      </div>
      <button class="member-toggle" aria-label="Toggle attendance for ${m.name}">${icon}</button>`;
    li.addEventListener('click', () => toggleMember(m.id));
    li.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleMember(m.id); }});
    listEl.appendChild(li);
  });

  if (emptyEl) emptyEl.classList.toggle('show', visible === 0);
  if (countEl) countEl.textContent = q ? `${visible} result${visible !== 1 ? 's' : ''}` : `All members (${state.members.length})`;
}

function toggleMember(id) {
  const cur = state.attendance[id] || 'pending';
  state.attendance[id] = cur === 'pending' ? 'present' : cur === 'present' ? 'absent' : 'present';
  updateInsights();
  renderList($('input-search')?.value);
}

function updateInsights() {
  const total   = state.members.length;
  const present = Object.values(state.attendance).filter(v => v === 'present').length;
  const absent  = Object.values(state.attendance).filter(v => v === 'absent').length;
  const marked  = present + absent;
  const pct     = total ? Math.round((marked / total) * 100) : 0;
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('count-total', total); set('count-present', present); set('count-absent', absent);
  const bar = $('progress-bar'); if (bar) bar.style.width = pct + '%';
  const aria = $('progress-bar-aria'); if (aria) aria.setAttribute('aria-valuenow', pct);
  const lbl = $('progress-label'); if (lbl) lbl.textContent = `${marked} of ${total} marked`;
  const btn = $('btn-submit'); if (btn) btn.disabled = marked < total;
}

/* ── LOGIN ── */
async function handleLogin(e) {
  e.preventDefault();
  let ok = true;
  const cellKey  = $('input-cell').value;
  const username = $('input-username').value.trim();
  const password = $('input-password').value;

  const setErr = (fid, show) => {
    const f = $(fid);
    if (f) f.classList.toggle('has-error', show);
    if (show) ok = false;
  };
  setErr('field-cell', !cellKey);
  setErr('field-username', !username);
  setErr('field-password', !password);
  if (!ok) return;

  const btn = $('btn-primary');
  btn.disabled = true; btn.classList.add('loading'); btn.textContent = ' Signing in…';

  try {
    const res  = await fetch('https://tch-cell-leaders-portal.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellKey, username, password }),
    });
    const data = await res.json();

    if (!data.success) { showToast(data.message || 'Login failed. Check your details.'); return; }

    localStorage.setItem('authToken', data.token);
    state.cellKey = cellKey; state.cellName = data.cell.cellName;
    state.leader  = data.cell.leader; state.members = data.cell.members;
    state.attendance = {};

    $('topbar-leader-name').textContent = data.cell.leader;
    $('topbar-cell-name').textContent   = data.cell.cellName + ' Cell';
    $('service-date').textContent       = todayLabel();

    updateInsights(); renderList(); showScreen('screen-attendance');
    showToast(`Welcome, ${data.cell.leader.split(' ')[1] || data.cell.leader}! 🙏`);

  } catch (err) {
    console.error(err);
    showToast('Network error. Check your connection.');
  } finally {
    btn.disabled = false; btn.classList.remove('loading'); btn.textContent = 'Sign In';
  }
}

/* ── SUBMIT ── */
async function handleSubmit() {
  const btn = $('btn-submit');
  btn.disabled = true; btn.textContent = 'Saving…';

  const present = Object.values(state.attendance).filter(v => v === 'present').length;
  const absent  = Object.values(state.attendance).filter(v => v === 'absent').length;

  const record = {
    cellKey: state.cellKey, cellName: state.cellName, leader: state.leader,
    serviceDate: new Date().toISOString().slice(0, 10),
    members: state.members.map(m => ({ ...m, status: state.attendance[m.id] || 'absent' })),
  };

  try {
    const token = localStorage.getItem('authToken');
    const res   = await fetch('https://tch-cell-leaders-portal.onrender.com/api/attendance/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(record),
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Submission failed. Try again.');
      btn.disabled = false; btn.textContent = 'Submit →'; return;
    }
    $('sum-present').textContent = present;
    $('sum-absent').textContent  = absent;
    showScreen('screen-success');

  } catch (err) {
    console.error(err);
    showToast('Network error. Could not submit.');
    btn.disabled = false; btn.textContent = 'Submit →';
  }
}

/* ── BOOT ── */
function init() {
  const loginForm = $('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  $('btn-pwd-toggle')?.addEventListener('click', () => {
    const inp = $('input-password');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    $('btn-pwd-toggle').textContent = show ? '🙈' : '👁';
  });

  $('input-cell')    ?.addEventListener('change', () => $('field-cell').classList.remove('has-error'));
  $('input-username')?.addEventListener('input',  () => $('field-username').classList.remove('has-error'));
  $('input-password')?.addEventListener('input',  () => $('field-password').classList.remove('has-error'));

  $('input-search')?.addEventListener('input', function() {
    $('btn-search-clear').style.display = this.value ? 'block' : 'none';
    renderList(this.value);
  });
  $('btn-search-clear')?.addEventListener('click', () => {
    $('input-search').value = ''; $('btn-search-clear').style.display = 'none'; renderList();
  });

  $('btn-mark-all')?.addEventListener('click', () => {
    const allPresent = state.members.every(m => state.attendance[m.id] === 'present');
    state.members.forEach(m => { state.attendance[m.id] = allPresent ? 'pending' : 'present'; });
    updateInsights(); renderList($('input-search')?.value);
    showToast(allPresent ? 'All cleared' : 'All marked present ✓');
  });

  $('btn-submit')?.addEventListener('click', handleSubmit);

  $('btn-logout')?.addEventListener('click', () => {
    if (!confirm('Log out and return to sign-in?')) return;
    localStorage.removeItem('authToken');
    state = { cellKey: null, cellName: null, leader: null, attendance: {}, members: [] };
    $('login-form').reset();
    $('btn-submit').disabled = false; $('btn-submit').textContent = 'Submit →';
    $('input-search').value = '';
    showScreen('screen-login');
  });

  $('btn-new-session')?.addEventListener('click', () => {
    state.attendance = {};
    $('btn-submit').disabled = true; $('btn-submit').textContent = 'Submit →';
    $('input-search').value = '';
    updateInsights(); renderList(); showScreen('screen-attendance');
  });

  showScreen('screen-login');
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();