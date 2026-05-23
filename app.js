/**
 * app.js — TCH Global Cell Attendance Portal
 * Vanilla ES6+. No frameworks. No fetch/API. No npm.
 * Works with index.html exactly as built — zero HTML/CSS edits.
 *
 * Storage key: attendnow_records_v1
 * Shape of one saved session record:
 * {
 *   id          : string   — "{cellKey}_{dateISO}_{timestamp}"
 *   cellKey     : string   — e.g. "powerhouse"
 *   cellName    : string   — e.g. "Power House"
 *   leader      : string   — cell leader's full name
 *   serviceDate : string   — ISO date "YYYY-MM-DD"
 *   submittedAt : string   — ISO datetime
 *   members     : [{ id, name, phone, role, status: "present"|"absent" }]
 * }
 */

'use strict';

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'attendnow_records_v1';

/** Avatar background palette — deterministic per member id */
const AVATAR_COLORS = [
  '#5C1A2E', '#1A6B45', '#1A3A5C', '#7A4A00',
  '#4A1A5C', '#005C4A', '#5C3A00', '#00365C',
  '#6B2A00', '#003D5C', '#1A4A2E', '#5C3A1A',
];

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */

/** Quick ID lookup — avoids repeated document.getElementById calls */
const $ = id => document.getElementById(id);

/** Two-letter initials from a full name */
const toInitials = name =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Deterministic avatar color based on member id string */
const colorFor = id =>
  AVATAR_COLORS[parseInt(id.replace(/\D/g, ''), 10) % AVATAR_COLORS.length];

/** ISO date string for a Date object — "YYYY-MM-DD" */
const toISODate = (d = new Date()) =>
  d.toISOString().slice(0, 10);

/** Friendly Nigerian-locale date label */
const toFriendlyDate = (d = new Date()) =>
  d.toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

/** Toast timer handle (module-scoped so it can be cleared) */
let _toastTimer = null;

/**
 * showToast — display a brief non-blocking notification.
 * Exposed on window so index.html inline hrefs can call it too.
 * @param {string} msg
 * @param {number} [duration=3000]
 */
window.showToast = function showToast(msg, duration = 3000) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
};

/* ══════════════════════════════════════════════════════════
   STORAGE — loadData / saveData
══════════════════════════════════════════════════════════ */

/**
 * loadData — reads all persisted session records from localStorage.
 * Returns an empty array if nothing is stored or JSON is corrupt.
 * @returns {Array<Object>}
 */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * saveData — serialises the full records array to localStorage.
 * Silently swallows QuotaExceededError and notifies the user.
 * @param {Array<Object>} records
 */
function saveData(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      showToast('Storage full — older records may not be saved.', 4000);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   SESSION STATE
   All mutable runtime state lives here — never on the DOM.
══════════════════════════════════════════════════════════ */

const state = {
  cellKey    : null,   // e.g. "powerhouse"
  cellName   : '',     // e.g. "Power House"
  leader     : '',     // e.g. "Bro. Ifeanyi Okafor"
  members    : [],     // array from DEMO_CELLS[cellKey].members
  attendance : {},     // { memberId: "present" | "absent" | "pending" }
};

/* ══════════════════════════════════════════════════════════
   SCREEN MANAGER
══════════════════════════════════════════════════════════ */

/**
 * showScreen — activates one screen, hides all others, scrolls to top.
 * @param {"screen-login"|"screen-attendance"|"screen-success"} id
 */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $(id);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

/* ══════════════════════════════════════════════════════════
   renderList — member attendance cards in #list-root
══════════════════════════════════════════════════════════ */

/**
 * renderList — rebuilds #list-root from state.members + state.attendance.
 * Applies optional search query filter. Shows #empty-state when zero results.
 * Updates the list count label. Never touches localStorage.
 * @param {string} [query=""]
 */
function renderList(query = '') {
  const listEl  = $('list-root');
  const emptyEl = $('empty-state');
  const countEl = $('list-count-label');
  if (!listEl) return;

  const q = query.toLowerCase().trim();
  listEl.innerHTML = '';
  let visible = 0;

  state.members.forEach((m, i) => {
    // Search filter — name match only, no storage side-effects
    if (q && !m.name.toLowerCase().includes(q)) return;
    visible++;

    const att  = state.attendance[m.id] || 'pending';
    const icon = att === 'present' ? '✓' : att === 'absent' ? '✗' : '○';

    const chipClass = att === 'present' ? 'chip-present'
                    : att === 'absent'  ? 'chip-absent'
                    : 'chip-pending';
    const chipLabel = att === 'present' ? 'Present'
                    : att === 'absent'  ? 'Absent'
                    : 'Pending';

    const cardClass = att === 'present' ? ' present'
                    : att === 'absent'  ? ' absent'
                    : '';

    const li = document.createElement('li');
    li.className = `member-card anim-fade-up${cardClass}`;
    li.style.animationDelay = `${i * 0.035}s`;
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `${m.name} — ${chipLabel}. Tap to toggle.`);
    li.dataset.id = m.id;

    li.innerHTML = `
      <div class="member-avatar"
           style="background:${colorFor(m.id)}"
           aria-hidden="true">${toInitials(m.name)}</div>
      <div class="member-info">
        <div class="member-name">${m.name}</div>
        <div class="member-meta">${m.role} · ${m.phone}</div>
        <div class="member-status">
          <span class="status-chip ${chipClass}">${chipLabel}</span>
        </div>
      </div>
      <button class="member-toggle"
              aria-label="Toggle attendance for ${m.name}">${icon}</button>`;

    // Click anywhere on the card to toggle
    li.addEventListener('click', () => toggleMember(m.id));
    // Keyboard: Space or Enter also toggles
    li.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleMember(m.id);
      }
    });

    listEl.appendChild(li);
  });

  // Empty state visibility
  if (emptyEl) emptyEl.classList.toggle('show', visible === 0);

  // Count label
  if (countEl) {
    countEl.textContent = q
      ? `${visible} result${visible !== 1 ? 's' : ''}`
      : `All members (${state.members.length})`;
  }
}

/* ══════════════════════════════════════════════════════════
   toggleMember — cycle pending → present → absent → present
══════════════════════════════════════════════════════════ */

/**
 * toggleMember — advances one member's attendance state in memory,
 * then re-renders the list and refreshes insights + progress bar.
 * Does NOT write to localStorage — that only happens on submit.
 * @param {string} memberId
 */
function toggleMember(memberId) {
  const cur = state.attendance[memberId] || 'pending';
  // pending → present → absent → present (absent is reversible, not a dead end)
  state.attendance[memberId] =
    cur === 'pending'  ? 'present' :
    cur === 'present'  ? 'absent'  :
    /* absent */         'present';

  updateInsights();
  renderList($('input-search')?.value);
}

/* ══════════════════════════════════════════════════════════
   updateInsights — #insights-panel counts + progress bar
══════════════════════════════════════════════════════════ */

/**
 * updateInsights — recalculates present / absent / pending counts
 * from state.attendance and pushes them to the DOM.
 * Also drives the bottom progress bar and enables/disables #btn-submit.
 */
function updateInsights() {
  const total   = state.members.length;
  const present = Object.values(state.attendance).filter(v => v === 'present').length;
  const absent  = Object.values(state.attendance).filter(v => v === 'absent').length;
  const marked  = present + absent;
  const pct     = total ? Math.round((marked / total) * 100) : 0;

  // Insights panel cards
  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  setText('count-total',   total);
  setText('count-present', present);
  setText('count-absent',  absent);

  // Bottom progress bar
  const bar     = $('progress-bar');
  const barAria = $('progress-bar-aria');
  const label   = $('progress-label');
  if (bar)     bar.style.width = `${pct}%`;
  if (barAria) barAria.setAttribute('aria-valuenow', pct);
  if (label)   label.textContent = `${marked} of ${total} marked`;

  // Submit button: enabled only when every member is marked
  const submitBtn = $('btn-submit');
  if (submitBtn) submitBtn.disabled = marked < total;
}

/* ══════════════════════════════════════════════════════════
   SUBMIT — persist session to localStorage
══════════════════════════════════════════════════════════ */

/**
 * submitAttendance — builds a full session record, appends it to
 * the stored records array, writes to localStorage, then shows
 * the success screen with the summary counts.
 */
function submitAttendance() {
  const submitBtn = $('btn-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
  }

  // Build member snapshot with final statuses
  const memberSnapshot = state.members.map(m => ({
    id     : m.id,
    name   : m.name,
    phone  : m.phone,
    role   : m.role,
    status : state.attendance[m.id] || 'absent',
  }));

  const present = memberSnapshot.filter(m => m.status === 'present').length;
  const absent  = memberSnapshot.filter(m => m.status === 'absent').length;
  const now     = new Date();

  /** @type {Object} session record */
  const record = {
    id          : `${state.cellKey}_${toISODate(now)}_${now.getTime()}`,
    cellKey     : state.cellKey,
    cellName    : state.cellName,
    leader      : state.leader,
    serviceDate : toISODate(now),
    submittedAt : now.toISOString(),
    members     : memberSnapshot,
  };

  // Append and persist
  const records = loadData();
  records.push(record);
  saveData(records);

  // Short artificial delay so the button state is visible
  setTimeout(() => {
    // Populate success screen summary
    const sumPresent = $('sum-present');
    const sumAbsent  = $('sum-absent');
    if (sumPresent) sumPresent.textContent = present;
    if (sumAbsent)  sumAbsent.textContent  = absent;

    showScreen('screen-success');
  }, 700);
}

/* ══════════════════════════════════════════════════════════
   LOGIN — validate form and bootstrap attendance session
══════════════════════════════════════════════════════════ */

/**
 * handleLogin — reads the three login fields, validates them,
 * looks up the cell from window.DEMO_CELLS, initialises state,
 * and transitions to the attendance screen.
 * @param {Event} e - form submit event
 */
function handleLogin(e) {
  e.preventDefault();

  const cellKey  = $('input-cell')?.value     || '';
  const username = $('input-username')?.value.trim() || '';
  const password = $('input-password')?.value || '';

  // Field-level validation — toggle has-error class on wrapper divs
  let valid = true;
  const setErr = (fieldId, hasError) => {
    const el = $(fieldId);
    if (!el) return;
    el.classList.toggle('has-error', hasError);
    if (hasError) valid = false;
  };

  setErr('field-cell',     !cellKey);
  setErr('field-username', !username);
  setErr('field-password', !password);
  if (!valid) return;

  // Loading state
  const btn = $('btn-primary');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = ' Signing in…';
  }

  // Simulate network latency (replace setTimeout with real fetch in backend phase)
  setTimeout(() => {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'Sign In';
    }

    const cell = window.DEMO_CELLS?.[cellKey];
    if (!cell) {
      showToast('Cell not found. Contact your coordinator.');
      return;
    }

    // Initialise session state
    state.cellKey    = cellKey;
    state.cellName   = cell.cellName;
    state.leader     = cell.leader;
    state.members    = cell.members;
    state.attendance = {};  // fresh — no pre-marking

    // Populate topbar
    const leaderEl = $('topbar-leader-name');
    const cellEl   = $('topbar-cell-name');
    if (leaderEl) leaderEl.textContent = cell.leader;
    if (cellEl)   cellEl.textContent   = `${cell.cellName} Cell`;

    // Set service date label
    const dateEl = $('service-date');
    if (dateEl) dateEl.textContent = toFriendlyDate();

    // Render UI and switch screen
    updateInsights();
    renderList();
    showScreen('screen-attendance');

    // Greet by first name after the comma in "Bro. / Sis. / Deacon"
    const firstName = cell.leader.split(' ')[1] || cell.leader;
    showToast(`Welcome, ${firstName}! 🙏`);
  }, 900);
}

/* ══════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════ */

function handleLogout() {
  if (!confirm('Log out and return to sign-in?')) return;

  // Reset runtime state
  state.cellKey    = null;
  state.cellName   = '';
  state.leader     = '';
  state.members    = [];
  state.attendance = {};

  // Reset form and UI
  const form = $('login-form');
  if (form) form.reset();

  const submitBtn = $('btn-submit');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit →';
  }

  const searchEl = $('input-search');
  if (searchEl) searchEl.value = '';

  const clearBtn = $('btn-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  showScreen('screen-login');
}

/* ══════════════════════════════════════════════════════════
   NEW SESSION (from success screen)
══════════════════════════════════════════════════════════ */

function handleNewSession() {
  // Keep the same cell/leader but reset attendance marks
  state.attendance = {};

  const submitBtn = $('btn-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submit →';
  }

  const searchEl = $('input-search');
  if (searchEl) searchEl.value = '';

  const clearBtn = $('btn-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  updateInsights();
  renderList();
  showScreen('screen-attendance');
}

/* ══════════════════════════════════════════════════════════
   MARK ALL toggle
══════════════════════════════════════════════════════════ */

function handleMarkAll() {
  const allPresent = state.members.every(
    m => state.attendance[m.id] === 'present'
  );

  state.members.forEach(m => {
    state.attendance[m.id] = allPresent ? 'pending' : 'present';
  });

  updateInsights();
  renderList($('input-search')?.value);
  showToast(allPresent ? 'All marks cleared' : 'All members marked present ✓');
}

/* ══════════════════════════════════════════════════════════
   PASSWORD VISIBILITY TOGGLE
══════════════════════════════════════════════════════════ */

function handlePwdToggle() {
  const inp  = $('input-password');
  const btn  = $('btn-pwd-toggle');
  if (!inp || !btn) return;
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  btn.textContent = show ? '🙈' : '👁';
}

/* ══════════════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════════════ */

function handleSearch(e) {
  const q        = e.target.value;
  const clearBtn = $('btn-search-clear');
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
  renderList(q);
}

function handleSearchClear() {
  const searchEl = $('input-search');
  const clearBtn = $('btn-search-clear');
  if (searchEl) searchEl.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  renderList();
  searchEl?.focus();
}

/* ══════════════════════════════════════════════════════════
   CLEAR FIELD ERRORS on user interaction
══════════════════════════════════════════════════════════ */

function clearFieldError(fieldWrapperId) {
  const el = $(fieldWrapperId);
  if (el) el.classList.remove('has-error');
}

/* ══════════════════════════════════════════════════════════
   init — DOMContentLoaded entry point
══════════════════════════════════════════════════════════ */

/**
 * init — bootstraps the entire app once the DOM is ready.
 * - Wires all event listeners
 * - Calls loadData() to check for any prior sessions
 *   (useful later for history/reports; not surfaced in MVP UI)
 * - Ensures the login screen is shown first
 */
function init() {
  // ── Load persisted records (available for future reporting feature)
  const _existingRecords = loadData(); // eslint-disable-line no-unused-vars
  // Future: could show a "last session" banner if _existingRecords.length

  // ── Login form submit
  const loginForm = $('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // ── #btn-primary also handles Enter key natively via form submit above
  // Explicit click handler is a safety net for cases form submit doesn't fire
  const btnPrimary = $('btn-primary');
  if (btnPrimary) btnPrimary.addEventListener('click', (e) => {
    // Only intercept if it's outside a real form submit cycle
    if (!e.submitter) handleLogin(e);
  });

  // ── Password visibility toggle
  const pwdToggle = $('btn-pwd-toggle');
  if (pwdToggle) pwdToggle.addEventListener('click', handlePwdToggle);

  // ── Clear field errors on user input
  $('input-cell')    ?.addEventListener('change', () => clearFieldError('field-cell'));
  $('input-username')?.addEventListener('input',  () => clearFieldError('field-username'));
  $('input-password')?.addEventListener('input',  () => clearFieldError('field-password'));

  // ── Search
  $('input-search')    ?.addEventListener('input', handleSearch);
  $('btn-search-clear')?.addEventListener('click', handleSearchClear);

  // ── Mark all present
  $('btn-mark-all')?.addEventListener('click', handleMarkAll);

  // ── Submit attendance
  $('btn-submit')?.addEventListener('click', submitAttendance);

  // ── Logout
  $('btn-logout')?.addEventListener('click', handleLogout);

  // ── New session (success screen → back to attendance)
  $('btn-new-session')?.addEventListener('click', handleNewSession);

  // ── Start on login screen
  showScreen('screen-login');
}

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */

// Guard: if DEMO_CELLS hasn't loaded yet (script order issue), wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already parsed (script is deferred or at bottom of body)
  init();
}
