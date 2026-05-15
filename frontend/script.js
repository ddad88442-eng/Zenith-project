/* ============================================================
   ZENITH — Task Manager v4.0
   Full-stack edition: Node.js + Express + MongoDB backend.

   Architecture:
   ─ All data persisted via REST API (localhost:8080).
   ─ JWT token stored in localStorage for auth.
   ─ localStorage used ONLY as a session token store —
     never as the source of truth for data.
   ─ Timer: integer-only seconds, setInterval(fn, 500),
     no floats, no duplicate intervals, no memory leaks.
   ─ All animations, transitions, and UI behavior preserved.
   ============================================================ */

'use strict';
const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://zenith-project-nd2k.onrender.com";
// ── State ────────────────────────────────────────────────────
const AppState = {
  tasks:          [],
  notes:          [],
  focusSessions:  0,
  currentFilter:  'all',
  currentSection: 'home',
  user:           null,
  token:          null,
};

// ── API Helper ───────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (AppState.token) headers['Authorization'] = `Bearer ${AppState.token}`;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status });
  return data;
}

async function apiUpload(endpoint, formData) {
  const headers = {};
  if (AppState.token) headers['Authorization'] = `Bearer ${AppState.token}`;
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

// ── LocalStorage Token ───────────────────────────────────────
function loadToken() {
  AppState.token = localStorage.getItem('zenith_token') || null;
}

function saveToken(token) {
  AppState.token = token;
  if (token) localStorage.setItem('zenith_token', token);
  else       localStorage.removeItem('zenith_token');
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  loadToken();

  const savedTheme = localStorage.getItem('zenith_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (AppState.token) {
    try {
      const { data } = await apiFetch('/auth/me');
      AppState.user = _normalizeUser(data.user);
    } catch {
      saveToken(null);
      AppState.user = null;
    }
  }

  renderAuthUI();
  initTimer();
  setupEventListeners();
  setupKeyboardShortcuts();
  initDateDisplay();

  if (AppState.user) {
    await Promise.all([loadTasks(), loadNotes(), loadSessions()]);
  } else {
    renderTasks();
    renderNotes();
    updateDashboard();
  }

  updateBadge();
  updateHeroProgress();
}

function _normalizeUser(u) {
  if (!u) return null;
  const avatarUrl = u.avatar
    ? (u.avatar.startsWith('/uploads/')
       ? `${API_BASE_URL}${u.avatar}`
        : u.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=f4c76a&color=1a1a2e&size=80`;
  return { ...u, id: u._id || u.id, avatar: avatarUrl };
}

// ── Data Loaders ─────────────────────────────────────────────
async function loadTasks() {
  try {
    const { data } = await apiFetch('/tasks');
    AppState.tasks = _normalizeTasks(data.tasks || []);
    renderTasks();
    updateDashboard();
    updateTimerTaskSelect();
  } catch {
    showToast('Could not load tasks', 'error');
  }
}

async function loadNotes() {
  try {
    const { data } = await apiFetch('/notes');
    AppState.notes = data.notes || [];
    renderNotes();
  } catch {
    showToast('Could not load notes', 'error');
  }
}

async function loadSessions() {
  try {
    const { data } = await apiFetch('/sessions/stats');
    AppState.focusSessions = data.focusSessions || 0;
    renderSessionDots();
    updateDashboard();
  } catch { /* non-critical */ }
}

function _normalizeTasks(tasks) {
  return tasks.map(t => ({
    ...t,
    id:        t._id || t.id,
    completed: t.completed || t.status === 'done',
    sessions:  t.sessions || 0,
    due:       t.due || '',
  }));
}

// ── Navigation ───────────────────────────────────────────────
function navigateTo(section) {
  const valid = ['home', 'dashboard', 'tasks', 'timer', 'notes', 'auth'];
  if (!valid.includes(section)) section = 'home';

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById('section-' + section);
  if (el) el.classList.add('active');

  const navBtn = document.querySelector('[data-section="' + section + '"]');
  if (navBtn) navBtn.classList.add('active');

  AppState.currentSection = section;
  if (section === 'dashboard') updateDashboard();
}

// ── Auth ─────────────────────────────────────────────────────
function renderAuthUI() {
  const topbar = document.getElementById('global-topbar');
  if (!topbar) return;

  if (AppState.user) {
    const u = AppState.user;
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=f4c76a&color=1a1a2e&size=80`;

    topbar.innerHTML = `
      <div class="user-profile-wrap" id="user-profile-wrap">
        <button class="user-profile-btn" id="user-profile-btn">
          <img class="user-avatar" src="${u.avatar || fallback}" alt="${escHtml(u.username)}"
            onerror="this.src='${fallback}'"/>
          <span class="user-name">${escHtml(u.username)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            style="width:13px;height:13px;flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="user-dropdown" id="user-dropdown">
          <div class="dropdown-header">
            <img class="dropdown-avatar" src="${u.avatar || fallback}" onerror="this.src='${fallback}'"/>
            <div>
              <div class="dropdown-name">${escHtml(u.username)}</div>
              <div class="dropdown-email">${escHtml(u.email)}</div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="dd-account">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg> Account Info
          </button>
          <button class="dropdown-item" id="dd-edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg> Edit Profile
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="dd-logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg> Log Out
          </button>
        </div>
      </div>`;

    document.getElementById('user-profile-btn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('user-dropdown').classList.toggle('open');
    });
    document.getElementById('dd-account').addEventListener('click', () => { closeDropdown(); openAccountModal(); });
    document.getElementById('dd-edit').addEventListener('click',    () => { closeDropdown(); openEditProfileModal(); });
    document.getElementById('dd-logout').addEventListener('click',  () => { closeDropdown(); logout(); });

    renderLoggedInAuthSection();
  } else {
    topbar.innerHTML = `
      <button class="btn-ghost" id="topbar-login">Log In</button>
      <button class="btn-primary" id="topbar-signup">Sign Up</button>`;
    document.getElementById('topbar-login').addEventListener('click',  () => navigateTo('auth'));
    document.getElementById('topbar-signup').addEventListener('click', () => navigateTo('auth'));
    renderLoggedOutAuthSection();
  }
}

function renderLoggedInAuthSection() {
  const grid = document.getElementById('auth-grid-main');
  if (!grid || !AppState.user) return;
  const u = AppState.user;
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=f4c76a&color=1a1a2e`;

  grid.style.gridTemplateColumns = '1fr';
  grid.style.maxWidth = '420px';
  grid.style.margin   = '0 auto';
  grid.innerHTML = `
    <div class="auth-card" style="text-align:center;">
      <img src="${u.avatar || fallback}" onerror="this.src='${fallback}'"
        style="width:80px;height:80px;border-radius:50%;border:3px solid var(--border-accent);
               margin:0 auto 16px;display:block;object-fit:cover;"/>
      <h3 style="margin-bottom:6px;">${escHtml(u.username)}</h3>
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:24px;">${escHtml(u.email)}</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button class="btn-ghost" id="profile-edit-btn">Edit Profile</button>
        <button class="btn-danger" id="profile-logout-btn">Log Out</button>
      </div>
    </div>`;

  document.getElementById('profile-edit-btn').addEventListener('click', openEditProfileModal);
  document.getElementById('profile-logout-btn').addEventListener('click', logout);

  const forgot = document.getElementById('auth-grid-forgot');
  if (forgot) forgot.style.display = 'none';
}

function renderLoggedOutAuthSection() {
  const grid = document.getElementById('auth-grid-main');
  if (!grid) return;
  grid.style.gridTemplateColumns = '';
  grid.style.maxWidth = '';
  grid.style.margin   = '';
  wireAuthForms();
}

function wireAuthForms() {
  const section = document.getElementById('section-auth');
  if (!section) return;
  const forms = section.querySelectorAll('.auth-form');

  if (forms[0]) {
    forms[0].onsubmit = async e => {
      e.preventDefault();
      const email    = forms[0].querySelector('input[type=email]').value.trim();
      const password = forms[0].querySelector('input[type=password]').value;
      if (!email || !password) { showToast('Fill in all fields', 'error'); return; }
      const btn = forms[0].querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const { data } = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        saveToken(data.token);
        AppState.user = _normalizeUser(data.user);
        renderAuthUI();
        await Promise.all([loadTasks(), loadNotes(), loadSessions()]);
        updateBadge(); updateHeroProgress();
        showToast('Welcome back, ' + AppState.user.username + '!', 'success');
        navigateTo('home');
      } catch (err) {
        showToast(err.message || 'Login failed', 'error');
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    };
  }

  if (forms[1]) {
    forms[1].onsubmit = async e => {
      e.preventDefault();
      const username = forms[1].querySelector('input[type=text]').value.trim();
      const email    = forms[1].querySelector('input[type=email]').value.trim();
      const password = forms[1].querySelector('input[type=password]').value;
      if (!username || !email || !password) { showToast('Fill in all fields', 'error'); return; }
      const btn = forms[1].querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        const { data } = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, email, password }),
        });
        saveToken(data.token);
        AppState.user = _normalizeUser(data.user);
        renderAuthUI();
        await Promise.all([loadTasks(), loadNotes(), loadSessions()]);
        showToast('Welcome, ' + username + '!', 'success');
        navigateTo('home');
      } catch (err) {
        showToast(err.message || 'Registration failed', 'error');
        btn.disabled = false; btn.textContent = 'Register';
      }
    };
  }
}

async function logout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  saveToken(null);
  AppState.user  = null;
  AppState.tasks = [];
  AppState.notes = [];
  AppState.focusSessions = 0;
  renderAuthUI(); renderTasks(); renderNotes();
  updateDashboard(); updateBadge(); updateHeroProgress(); renderSessionDots();
  showToast('Logged out', 'info');
  navigateTo('home');
}

function closeDropdown() {
  const d = document.getElementById('user-dropdown');
  if (d) d.classList.remove('open');
}

// ── Account Modal ─────────────────────────────────────────────
let _editOriginalValues = {};

function renderUserProfile() {
  if (!AppState.user) return;
  const u = AppState.user;
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=f4c76a&color=1a1a2e&size=128`;

  const avatarEl = document.getElementById('am-avatar');
  if (avatarEl) { avatarEl.src = u.avatar || fallback; avatarEl.onerror = () => { avatarEl.src = fallback; }; }

  setEl('am-name',  u.username);
  setEl('am-email', u.email);
  setEl('am-stat-tasks', AppState.tasks.length);
  setEl('am-stat-done',  AppState.tasks.filter(t => t.completed).length);
  setEl('am-stat-notes', AppState.notes.length);

  const joinedEl = document.getElementById('am-joined');
  if (joinedEl) {
    const ts   = u.createdAt || u.joinedAt;
    const text = ts ? 'Joined ' + new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Joined recently';
    joinedEl.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>' +
      '<line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + text;
  }
}

function openAccountModal() {
  if (!AppState.user) return;
  disableEditMode(); renderUserProfile();
  openModal('account-modal-overlay');
}

function openEditProfileModal() {
  if (!AppState.user) return;
  disableEditMode(); renderUserProfile();
  openModal('account-modal-overlay');
  setTimeout(enableEditMode, 80);
}

function enableEditMode() {
  const modal    = document.getElementById('account-modal');
  const viewBody = document.getElementById('account-view-body');
  const editBody = document.getElementById('account-edit-body');
  if (!modal || !viewBody || !editBody) return;

  _editOriginalValues = { username: AppState.user.username, email: AppState.user.email };
  document.getElementById('ep-username').value    = AppState.user.username;
  document.getElementById('ep-email').value       = AppState.user.email;
  document.getElementById('ep-newpass').value     = '';
  document.getElementById('ep-confirmpass').value = '';
  clearFieldErrors(); resetPasswordStrength();

  const uploadLabel = document.getElementById('avatar-upload-label');
  if (uploadLabel) uploadLabel.style.pointerEvents = '';

  viewBody.style.display = 'none';
  editBody.style.display = '';
  void editBody.offsetWidth;
  modal.classList.add('edit-mode');
  setSaveEnabled(false);

  setTimeout(() => { const el = document.getElementById('ep-username'); if (el) el.focus(); }, 60);
}

function disableEditMode() {
  const modal    = document.getElementById('account-modal');
  const viewBody = document.getElementById('account-view-body');
  const editBody = document.getElementById('account-edit-body');
  if (!modal) return;
  if (editBody) editBody.style.display = 'none';
  if (viewBody) { viewBody.style.display = ''; void viewBody.offsetWidth; }
  modal.classList.remove('edit-mode');
  clearFieldErrors(); resetPasswordStrength();
}

function setSaveEnabled(enabled) {
  const btn = document.getElementById('account-save-btn');
  if (btn) btn.disabled = !enabled;
}

function clearFieldErrors() {
  ['err-username', 'err-email', 'err-confirmpass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  ['ep-username', 'ep-email', 'ep-newpass', 'ep-confirmpass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('field-error', 'modified');
  });
}

function setFieldError(fieldId, errId, msg) {
  const inp = document.getElementById(fieldId); if (inp) inp.classList.add('field-error');
  const err = document.getElementById(errId);   if (err) err.textContent = msg;
}

function clearFieldError(fieldId, errId) {
  const inp = document.getElementById(fieldId); if (inp) inp.classList.remove('field-error');
  const err = document.getElementById(errId);   if (err) err.textContent = '';
}

function checkEditDirty() {
  const username = (document.getElementById('ep-username') || {}).value || '';
  const email    = (document.getElementById('ep-email')    || {}).value || '';
  const newpass  = (document.getElementById('ep-newpass')  || {}).value || '';
  const dirty = username !== _editOriginalValues.username || email !== _editOriginalValues.email || newpass !== '';
  setSaveEnabled(dirty);
  const uInp = document.getElementById('ep-username');
  const eInp = document.getElementById('ep-email');
  if (uInp) uInp.classList.toggle('modified', username !== _editOriginalValues.username && !uInp.classList.contains('field-error'));
  if (eInp) eInp.classList.toggle('modified', email    !== _editOriginalValues.email    && !eInp.classList.contains('field-error'));
}

function getPasswordStrength(pass) {
  if (!pass) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pass.length >= 8)          score++;
  if (pass.length >= 12)         score++;
  if (/[A-Z]/.test(pass))        score++;
  if (/[0-9]/.test(pass))        score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  const levels = [
    { label: 'Very Weak', color: '#f87171', pct: '15%'  },
    { label: 'Weak',      color: '#fb923c', pct: '30%'  },
    { label: 'Fair',      color: '#f4c76a', pct: '55%'  },
    { label: 'Good',      color: '#6ee7b7', pct: '75%'  },
    { label: 'Strong',    color: '#4ade80', pct: '100%' },
  ];
  return { score, ...levels[Math.min(score, 4)] };
}

function resetPasswordStrength() {
  const bar  = document.getElementById('password-strength');
  const fill = document.getElementById('strength-fill');
  if (bar)  bar.style.display = 'none';
  if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
}

function updatePasswordStrength(pass) {
  const bar   = document.getElementById('password-strength');
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  if (!bar || !fill || !label) return;
  if (!pass) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const str = getPasswordStrength(pass);
  fill.style.width = str.pct; fill.style.background = str.color;
  label.textContent = str.label; label.style.color = str.color;
}

async function saveProfileChanges() {
  if (!AppState.user) return;
  clearFieldErrors();
  const username = document.getElementById('ep-username').value.trim();
  const email    = document.getElementById('ep-email').value.trim();
  const newpass  = document.getElementById('ep-newpass').value;
  const confirm  = document.getElementById('ep-confirmpass').value;

  let valid = true;
  if (!username) { setFieldError('ep-username', 'err-username', 'Username cannot be empty.'); valid = false; }
  else if (username.length < 2) { setFieldError('ep-username', 'err-username', 'At least 2 characters required.'); valid = false; }
  if (!email) { setFieldError('ep-email', 'err-email', 'Email cannot be empty.'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('ep-email', 'err-email', 'Enter a valid email address.'); valid = false; }
  if (newpass) {
    if (newpass.length < 6) { setFieldError('ep-newpass', 'err-confirmpass', 'Password must be at least 6 characters.'); valid = false; }
    else if (!confirm) { setFieldError('ep-confirmpass', 'err-confirmpass', 'Please confirm your new password.'); valid = false; }
    else if (newpass !== confirm) { setFieldError('ep-confirmpass', 'err-confirmpass', 'Passwords do not match.'); valid = false; }
  }
  if (!valid) return;

  const saveBtn   = document.getElementById('account-save-btn');
  const btnText   = saveBtn.querySelector('.save-btn-text');
  const btnLoader = saveBtn.querySelector('.save-btn-loader');
  saveBtn.disabled = true;
  if (btnText)   btnText.style.display   = 'none';
  if (btnLoader) btnLoader.style.display = 'flex';

  try {
    const fileInput = document.getElementById('avatar-file-input');
    let responseData;

    if (fileInput && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('avatar', fileInput.files[0]);
      formData.append('username', username);
      formData.append('email', email);
      if (newpass) formData.append('newPassword', newpass);
      responseData = await apiUpload('/users/profile', formData);
    } else {
      const body = { username, email };
      if (newpass) body.newPassword = newpass;
      responseData = await apiFetch('/users/profile', { method: 'PUT', body: JSON.stringify(body) });
    }

    AppState.user = _normalizeUser(responseData.data.user);
    renderUserProfile();
    disableEditMode();
    renderAuthUI();
    showToast('Profile updated successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Update failed', 'error');
    if (btnText)   btnText.style.display   = '';
    if (btnLoader) btnLoader.style.display = 'none';
    saveBtn.disabled = false;
    setSaveEnabled(true);
  }
}

function wireAccountModalEvents() {
  const closeBtn  = document.getElementById('account-modal-close');
  const viewClose = document.getElementById('account-view-close');
  const overlay   = document.getElementById('account-modal-overlay');
  const modifyBtn = document.getElementById('account-modify-btn');
  const cancelBtn = document.getElementById('account-cancel-btn');
  const saveBtn   = document.getElementById('account-save-btn');

  if (closeBtn)  closeBtn.addEventListener('click',  () => closeModal('account-modal-overlay'));
  if (viewClose) viewClose.addEventListener('click', () => closeModal('account-modal-overlay'));
  if (overlay)   overlay.addEventListener('click',   e => { if (e.target === overlay) closeModal('account-modal-overlay'); });
  if (modifyBtn) modifyBtn.addEventListener('click', enableEditMode);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { disableEditMode(); renderUserProfile(); });
  if (saveBtn)   saveBtn.addEventListener('click',   saveProfileChanges);

  ['ep-username', 'ep-email', 'ep-newpass', 'ep-confirmpass'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      checkEditDirty();
      if (id === 'ep-newpass')     updatePasswordStrength(this.value);
      if (id === 'ep-username')    clearFieldError('ep-username', 'err-username');
      if (id === 'ep-email')       clearFieldError('ep-email', 'err-email');
      if (id === 'ep-confirmpass') clearFieldError('ep-confirmpass', 'err-confirmpass');
    });
  });

  function wirePasswordToggle(toggleId, inputId) {
    const toggle = document.getElementById(toggleId);
    const input  = document.getElementById(inputId);
    if (!toggle || !input) return;
    toggle.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      toggle.querySelector('.eye-open').style.display   = isPass ? 'none' : '';
      toggle.querySelector('.eye-closed').style.display = isPass ? ''     : 'none';
    });
  }
  wirePasswordToggle('toggle-newpass',     'ep-newpass');
  wirePasswordToggle('toggle-confirmpass', 'ep-confirmpass');

  const fileInput = document.getElementById('avatar-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
      if (file.size > 2 * 1024 * 1024)    { showToast('Image must be under 2MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const avatarEl = document.getElementById('am-avatar');
        if (avatarEl) {
          avatarEl.src = ev.target.result;
          avatarEl.classList.remove('avatar-updated');
          void avatarEl.offsetWidth;
          avatarEl.classList.add('avatar-updated');
        }
        setSaveEnabled(true);
        showToast('Photo ready — save to apply', 'info');
      };
      reader.readAsDataURL(file);
    });
  }
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }
function closeAllModals() { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); }

// ── Tasks ─────────────────────────────────────────────────────
async function createTask(data) {
  if (!AppState.user) { showToast('Please log in to create tasks', 'error'); navigateTo('auth'); return null; }
  try {
    const { data: res } = await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) });
    const task = { ...res.task, id: res.task._id || res.task.id };
    AppState.tasks.unshift(task);
    afterTaskChange(); return task;
  } catch (err) {
    showToast(err.message || 'Could not create task', 'error'); return null;
  }
}

async function deleteTask(id) {
  try {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    AppState.tasks = AppState.tasks.filter(t => t.id !== id);
    afterTaskChange(); renderTasks();
  } catch (err) { showToast(err.message || 'Could not delete task', 'error'); }
}

async function toggleTask(id) {
  const task = AppState.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.status    = task.completed ? 'done' : 'todo';
  renderTasks(); afterTaskChange();
  try {
    const { data } = await apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' });
    Object.assign(task, { ...data.task, id: data.task._id || data.task.id });
    renderTasks(); afterTaskChange();
  } catch {
    task.completed = !task.completed;
    task.status    = task.completed ? 'done' : 'todo';
    renderTasks(); afterTaskChange();
    showToast('Could not update task', 'error');
  }
}

async function editTask(id, data) {
  const task = AppState.tasks.find(t => t.id === id);
  if (!task) return;
  Object.assign(task, data); task.completed = task.status === 'done';
  renderTasks(); afterTaskChange();
  try {
    const { data: res } = await apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    Object.assign(task, { ...res.task, id: res.task._id || res.task.id });
    renderTasks(); afterTaskChange();
  } catch (err) { showToast(err.message || 'Could not update task', 'error'); }
}

function afterTaskChange() {
  updateBadge(); updateDashboard(); updateHeroProgress(); updateTimerTaskSelect();
}

function renderTasks() {
  const list     = document.getElementById('tasks-list');
  const empty    = document.getElementById('tasks-empty');
  const searchEl = document.getElementById('task-search');
  const search   = searchEl ? searchEl.value.toLowerCase() : '';
  const filter   = AppState.currentFilter;
  if (!list) return;

  const filtered = AppState.tasks.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter;
    const matchSearch = !search || t.title.toLowerCase().includes(search) || (t.desc || '').toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    if (empty) empty.style.display = 'flex';
    list.querySelectorAll('.task-card').forEach(c => c.remove());
    return;
  }
  if (empty) empty.style.display = 'none';

  const existing = {};
  list.querySelectorAll('.task-card[data-id]').forEach(el => { existing[el.dataset.id] = el; });
  Object.keys(existing).forEach(id => { if (!filtered.find(t => t.id === id)) { existing[id].remove(); delete existing[id]; } });

  filtered.forEach((task, i) => {
    const el = existing[task.id] || buildTaskElement(task);
    populateTaskElement(el, task, i);
    if (!el.parentNode) list.appendChild(el);
  });
}

function buildTaskElement(task) {
  const el = document.createElement('div');
  el.className = 'task-card';
  el.setAttribute('draggable', 'true');
  el.dataset.id = task.id;
  el.addEventListener('dragstart', onDragStart);
  el.addEventListener('dragover',  onDragOver);
  el.addEventListener('drop',      onDrop);
  el.addEventListener('dragend',   onDragEnd);
  return el;
}

function populateTaskElement(el, task, i) {
  const today   = new Date().toISOString().split('T')[0];
  const overdue = task.due && task.due < today && !task.completed;
  const isToday = task.due === today;

  el.dataset.id       = task.id;
  el.dataset.priority = task.priority;
  el.className = 'task-card' + (task.completed ? ' completed' : '') + (overdue ? ' overdue' : '');
  el.style.setProperty('--stagger-i', i);

  el.innerHTML =
    `<input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} title="Mark complete"/>` +
    `<div class="task-body">` +
      `<div class="task-header">` +
        `<span class="task-title">${escHtml(task.title)}</span>` +
        `<span class="task-badge badge-status-${task.status}">${statusLabel(task.status)}</span>` +
        `<span class="task-badge badge-priority-${task.priority}">${task.priority}</span>` +
      `</div>` +
      (task.desc ? `<p class="task-desc">${escHtml(task.desc)}</p>` : '') +
      `<div class="task-meta">` +
        (task.due ? `<span class="badge-due${overdue ? ' overdue' : isToday ? ' today' : ''}">${formatDate(task.due)}</span>` : '') +
        (task.sessions > 0 ? `<span class="badge-sessions">${task.sessions} session${task.sessions > 1 ? 's' : ''}</span>` : '') +
      `</div>` +
    `</div>` +
    `<div class="task-actions">` +
      `<button class="action-btn focus-btn" title="Focus on this task">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 3h6"/></svg>` +
      `</button>` +
      `<button class="action-btn edit" title="Edit task">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>` +
      `</button>` +
      `<button class="action-btn delete" title="Delete task">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>` +
      `</button>` +
    `</div>`;

  const id = task.id;
  el.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(id));
  el.querySelector('.action-btn.edit').addEventListener('click', () => openEditTaskModal(id));
  el.querySelector('.action-btn.delete').addEventListener('click', () => {
    const t = AppState.tasks.find(x => x.id === id);
    if (t) confirmDelete('task', id, t.title);
  });
  el.querySelector('.action-btn.focus-btn').addEventListener('click', () => {
    focusOnTask(id); navigateTo('timer');
    showToast('Focusing on: ' + task.title, 'info');
  });
}

// ── Task Modal ────────────────────────────────────────────────
function openAddTaskModal() {
  if (!AppState.user) { showToast('Please log in to create tasks', 'error'); navigateTo('auth'); return; }
  document.getElementById('task-edit-id').value           = '';
  document.getElementById('task-modal-title').textContent = 'New Task';
  document.getElementById('task-title').value             = '';
  document.getElementById('task-desc').value              = '';
  document.getElementById('task-status').value            = 'todo';
  document.getElementById('task-priority').value          = 'medium';
  document.getElementById('task-due').value               = '';
  openModal('task-modal-overlay');
  setTimeout(() => document.getElementById('task-title').focus(), 100);
}

function openEditTaskModal(id) {
  const task = AppState.tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('task-edit-id').value           = id;
  document.getElementById('task-modal-title').textContent = 'Edit Task';
  document.getElementById('task-title').value             = task.title;
  document.getElementById('task-desc').value              = task.desc || '';
  document.getElementById('task-status').value            = task.status;
  document.getElementById('task-priority').value          = task.priority;
  document.getElementById('task-due').value               = task.due || '';
  openModal('task-modal-overlay');
  setTimeout(() => document.getElementById('task-title').focus(), 100);
}

async function saveTaskModal() {
  const titleEl = document.getElementById('task-title');
  const title   = titleEl.value.trim();
  if (!title) {
    titleEl.focus(); titleEl.classList.add('error-shake');
    setTimeout(() => titleEl.classList.remove('error-shake'), 500);
    return;
  }
  const data = {
    title,
    desc:     document.getElementById('task-desc').value.trim(),
    status:   document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    due:      document.getElementById('task-due').value,
  };
  const editId = document.getElementById('task-edit-id').value;
  closeModal('task-modal-overlay');
  if (editId) { await editTask(editId, data); showToast('Task updated', 'success'); }
  else        { const t = await createTask(data); if (t) { showToast('Task added', 'success'); renderTasks(); } }
}

// ── Notes ─────────────────────────────────────────────────────
async function createNote(data) {
  if (!AppState.user) { showToast('Please log in to create notes', 'error'); navigateTo('auth'); return null; }
  try {
    const { data: res } = await apiFetch('/notes', { method: 'POST', body: JSON.stringify(data) });
    AppState.notes.unshift(res.note);
    updateDashboard(); return res.note;
  } catch (err) { showToast(err.message || 'Could not create note', 'error'); return null; }
}

async function deleteNote(id) {
  try {
    await apiFetch(`/notes/${id}`, { method: 'DELETE' });
    AppState.notes = AppState.notes.filter(n => (n._id || n.id) !== id);
    renderNotes(); updateDashboard();
  } catch (err) { showToast(err.message || 'Could not delete note', 'error'); }
}

async function editNote(id, data) {
  const note = AppState.notes.find(n => (n._id || n.id) === id);
  if (!note) return;
  Object.assign(note, data);
  try {
    const { data: res } = await apiFetch(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    Object.assign(note, res.note);
  } catch (err) { showToast(err.message || 'Could not update note', 'error'); }
}

function renderNotes() {
  const grid     = document.getElementById('notes-grid');
  const empty    = document.getElementById('notes-empty');
  const searchEl = document.getElementById('note-search');
  const search   = searchEl ? searchEl.value.toLowerCase() : '';
  if (!grid) return;

  const getId = n => n._id || n.id;
  const filtered = AppState.notes.filter(n =>
    !search || (n.title || '').toLowerCase().includes(search) || (n.content || '').toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    if (empty) empty.style.display = 'flex';
    grid.querySelectorAll('.note-card').forEach(c => c.remove()); return;
  }
  if (empty) empty.style.display = 'none';

  const existing = {};
  grid.querySelectorAll('.note-card[data-id]').forEach(el => { existing[el.dataset.id] = el; });
  Object.keys(existing).forEach(id => { if (!filtered.find(n => getId(n) === id)) { existing[id].remove(); delete existing[id]; } });

  filtered.forEach((note, i) => {
    const nid = getId(note);
    let el = existing[nid];
    if (!el) { el = document.createElement('div'); el.className = 'note-card'; el.dataset.id = nid; grid.appendChild(el); }

    el.style.background  = note.bgColor || '#1e2a3a';
    el.style.color       = note.textColor || '#e2d9c9';
    el.style.borderColor = 'rgba(255,255,255,0.1)';
    el.style.setProperty('--stagger-i', i);

    el.innerHTML =
      `<div class="note-card-title">${escHtml(note.title || 'Untitled')}</div>` +
      `<div class="note-card-content">${escHtml(note.content || '')}</div>` +
      `<div class="note-card-footer">` +
        `<span class="note-card-date">${formatDateShort(note.createdAt)}</span>` +
        `<div class="note-actions">` +
          `<button class="note-action-btn edit" style="background:rgba(0,0,0,0.25);border-color:rgba(255,255,255,0.15);" title="Edit">✎</button>` +
          `<button class="note-action-btn delete" style="background:rgba(0,0,0,0.25);border-color:rgba(255,255,255,0.15);" title="Delete">✕</button>` +
        `</div>` +
      `</div>`;

    el.querySelector('.note-action-btn.edit').addEventListener('click',   () => openEditNoteModal(nid));
    el.querySelector('.note-action-btn.delete').addEventListener('click', () => {
      const n = AppState.notes.find(x => getId(x) === nid);
      if (n) confirmDelete('note', nid, n.title || 'Untitled');
    });
  });
}

function openAddNoteModal() {
  if (!AppState.user) { showToast('Please log in to create notes', 'error'); navigateTo('auth'); return; }
  document.getElementById('note-edit-id').value           = '';
  document.getElementById('note-modal-title').textContent = 'New Note';
  document.getElementById('note-title').value             = '';
  document.getElementById('note-content').value           = '';
  document.getElementById('note-bg-color').value          = '#1e2a3a';
  document.getElementById('note-text-color').value        = '#e2d9c9';
  openModal('note-modal-overlay');
  setTimeout(() => document.getElementById('note-title').focus(), 100);
}

function openEditNoteModal(id) {
  const note = AppState.notes.find(n => (n._id || n.id) === id);
  if (!note) return;
  document.getElementById('note-edit-id').value           = id;
  document.getElementById('note-modal-title').textContent = 'Edit Note';
  document.getElementById('note-title').value             = note.title || '';
  document.getElementById('note-content').value           = note.content || '';
  document.getElementById('note-bg-color').value          = note.bgColor || '#1e2a3a';
  document.getElementById('note-text-color').value        = note.textColor || '#e2d9c9';
  openModal('note-modal-overlay');
}

async function saveNoteModal() {
  const data = {
    title:     document.getElementById('note-title').value.trim() || 'Untitled',
    content:   document.getElementById('note-content').value.trim(),
    bgColor:   document.getElementById('note-bg-color').value,
    textColor: document.getElementById('note-text-color').value,
  };
  const editId = document.getElementById('note-edit-id').value;
  closeModal('note-modal-overlay');
  if (editId) { await editNote(editId, data); showToast('Note updated', 'success'); renderNotes(); }
  else        { const n = await createNote(data); if (n) { showToast('Note added', 'success'); renderNotes(); } }
}

// ── Confirm Delete ────────────────────────────────────────────
let pendingDelete = null;

function confirmDelete(type, id, name) {
  pendingDelete = { type, id };
  document.getElementById('confirm-text').textContent = `Delete "${name}"? This cannot be undone.`;
  openModal('confirm-modal-overlay');
}

function executePendingDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  pendingDelete = null;
  closeModal('confirm-modal-overlay');
  if (type === 'task') deleteTask(id).then(() => showToast('Task deleted', 'info'));
  if (type === 'note') deleteNote(id).then(() => showToast('Note deleted', 'info'));
}

// ── Dashboard ─────────────────────────────────────────────────
function updateDashboard() {
  const tasks = AppState.tasks;
  const total = tasks.length, completed = tasks.filter(t => t.completed).length;
  const remaining = total - completed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  setEl('stat-total', total); setEl('stat-completed', completed);
  setEl('stat-remaining', remaining); setEl('stat-sessions', AppState.focusSessions);
  setEl('productivity-percent', pct + '%');

  const ring = document.getElementById('productivity-ring-fill');
  if (ring) ring.style.strokeDashoffset = 314 - (314 * pct / 100);

  const highCt = tasks.filter(t => t.priority === 'high').length;
  const medCt  = tasks.filter(t => t.priority === 'medium').length;
  const lowCt  = tasks.filter(t => t.priority === 'low').length;
  setEl('count-high', highCt); setEl('count-medium', medCt); setEl('count-low', lowCt);
  setBarWidth('bar-high', total, highCt); setBarWidth('bar-medium', total, medCt); setBarWidth('bar-low', total, lowCt);

  const listEl = document.getElementById('upcoming-list');
  if (listEl) {
    const recent = tasks.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    if (recent.length === 0) { listEl.innerHTML = '<div class="empty-state-small">No tasks yet</div>'; return; }
    const today = new Date().toISOString().split('T')[0];
    listEl.innerHTML = recent.map(t => {
      const cls = t.due && t.due < today ? 'urgent' : t.due === today ? 'today' : '';
      return `<div class="upcoming-item ${cls}" onclick="navigateTo('tasks')">` +
        `<span class="upcoming-item-title">${escHtml(t.title)}</span>` +
        (t.due ? `<span class="upcoming-item-due">${formatDate(t.due)}</span>` : '') + `</div>`;
    }).join('');
  }
}

function updateHeroProgress() {
  const tasks = AppState.tasks, total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct  = total > 0 ? Math.round((done / total) * 100) : 0;
  setEl('hero-progress-value', pct + '%');
  const fill = document.getElementById('hero-progress-fill');
  if (fill) fill.style.width = pct + '%';
}

function updateBadge() {
  const badge = document.getElementById('tasks-badge');
  if (!badge) return;
  const active = AppState.tasks.filter(t => !t.completed).length;
  badge.textContent = active; badge.style.display = active > 0 ? '' : 'none';
}

// ── Timer ─────────────────────────────────────────────────────
const Timer = {
  mode: 'focus', running: false, startedAt: null,
  offsetSecs: 0, totalSecs: 25 * 60, _intervalId: null,
};

function timerRemaining() {
  if (!Timer.running || Timer.startedAt === null) return Math.max(0, Timer.totalSecs - Timer.offsetSecs);
  return Math.max(0, Timer.totalSecs - Timer.offsetSecs - Math.floor((Date.now() - Timer.startedAt) / 1000));
}

function _clearTimerInterval() {
  if (Timer._intervalId !== null) { clearInterval(Timer._intervalId); Timer._intervalId = null; }
}

function initTimer() {
  const dur = parseInt((document.getElementById('focus-duration') || {}).value) || 25;
  Timer.totalSecs = dur * 60; Timer.offsetSecs = 0;
  Timer.running = false; Timer.startedAt = null;
  _clearTimerInterval(); renderTimerDisplay(); updateTimerRing();
  updateTimerTaskSelect(); renderSessionDots();
}

function startTimer() {
  if (Timer.running) return;
  if (timerRemaining() <= 0) { resetTimer(); return; }
  Timer.running = true; Timer.startedAt = Date.now();
  setEl('timer-status', Timer.mode === 'focus' ? 'Focusing…' : 'On break…');
  document.getElementById('timer-start').textContent = 'Pause';
  _clearTimerInterval();
  Timer._intervalId = setInterval(_timerTick, 500);
  _timerTick();
}

function _timerTick() {
  const remaining = timerRemaining();
  renderTimerDisplay(remaining); updateTimerRing(remaining);
  if (remaining <= 0) { _clearTimerInterval(); Timer.running = false; completeSession(); }
}

function pauseTimer() {
  if (!Timer.running) return;
  Timer.offsetSecs = Timer.totalSecs - timerRemaining();
  Timer.running = false; Timer.startedAt = null;
  _clearTimerInterval();
  setEl('timer-status', 'Paused');
  document.getElementById('timer-start').textContent = 'Resume';
}

function resetTimer() {
  _clearTimerInterval();
  Timer.running = false; Timer.startedAt = null; Timer.offsetSecs = 0;
  const durKey = Timer.mode === 'focus' ? 'focus-duration' : 'break-duration';
  const dur    = parseInt((document.getElementById(durKey) || {}).value) || (Timer.mode === 'focus' ? 25 : 5);
  Timer.totalSecs = dur * 60;
  renderTimerDisplay(); updateTimerRing();
  setEl('timer-status', 'Ready');
  document.getElementById('timer-start').textContent = 'Start';
}

async function completeSession() {
  if (Timer.mode === 'focus') {
    AppState.focusSessions++;
    renderSessionDots(); updateDashboard();

    const sel   = document.getElementById('focus-task-select');
    const selId = sel ? sel.value : '';
    const durEl = document.getElementById('focus-duration');
    const durationMinutes = parseInt((durEl || {}).value) || 25;

    if (AppState.user) {
      apiFetch('/sessions', {
        method: 'POST',
        body: JSON.stringify({ taskId: selId || undefined, durationMinutes, mode: 'focus' }),
      }).catch(() => {});
    }

    if (selId) {
      const task = AppState.tasks.find(t => t.id === selId);
      if (task) {
        task.sessions = (task.sessions || 0) + 1;
        apiFetch(`/tasks/${selId}`, { method: 'PUT', body: JSON.stringify({ sessions: task.sessions }) }).catch(() => {});
        renderTasks();
      }
    }

    showToast('Focus session complete! Time for a break.', 'success');
    switchTimerMode('break');
  } else {
    showToast('Break over. Ready to focus!', 'info');
    switchTimerMode('focus');
  }
}

function switchTimerMode(mode) {
  _clearTimerInterval();
  Timer.mode = mode; Timer.running = false; Timer.startedAt = null; Timer.offsetSecs = 0;
  document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const durKey = mode === 'focus' ? 'focus-duration' : 'break-duration';
  const dur    = parseInt((document.getElementById(durKey) || {}).value) || (mode === 'focus' ? 25 : 5);
  Timer.totalSecs = dur * 60;
  const ring = document.getElementById('timer-ring');
  if (ring) ring.classList.toggle('break-mode', mode === 'break');
  renderTimerDisplay(); updateTimerRing();
  setEl('timer-status', 'Ready');
  document.getElementById('timer-start').textContent = 'Start';
}

function renderTimerDisplay(remaining) {
  const secs = Math.floor(remaining !== undefined ? remaining : timerRemaining());
  setEl('timer-display', String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0'));
}

function updateTimerRing(remaining) {
  const ring = document.getElementById('timer-ring'); if (!ring) return;
  const secs = Math.floor(remaining !== undefined ? remaining : timerRemaining());
  ring.style.strokeDashoffset = 817 * (1 - (Timer.totalSecs > 0 ? secs / Timer.totalSecs : 1));
}

function updateTimerTaskSelect() {
  const sel = document.getElementById('focus-task-select'); if (!sel) return;
  const current = sel.value;
  const active  = AppState.tasks.filter(t => !t.completed);
  sel.innerHTML = '<option value="">— No task linked —</option>' +
    active.map(t => `<option value="${t.id}"${t.id === current ? ' selected' : ''}>${escHtml(t.title)}</option>`).join('');
}

function focusOnTask(id) { const sel = document.getElementById('focus-task-select'); if (sel) sel.value = id; }

function renderSessionDots() {
  const container = document.getElementById('sessions-dots'); if (!container) return;
  const count = Math.min(AppState.focusSessions, 8);
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div'); dot.className = 'session-dot'; container.appendChild(dot);
  }
}

// ── Drag and Drop ─────────────────────────────────────────────
let dragSrcId = null;

function onDragStart(e)  { dragSrcId = this.dataset.id; this.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; }
function onDragOver(e)   { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; this.classList.add('drag-over'); }
function onDragEnd()     { this.style.opacity = ''; document.querySelectorAll('.task-card').forEach(el => el.classList.remove('drag-over')); }
function onDrop(e) {
  e.preventDefault(); this.classList.remove('drag-over');
  const dropId = this.dataset.id;
  if (!dragSrcId || dragSrcId === dropId) return;
  const srcIdx  = AppState.tasks.findIndex(t => t.id === dragSrcId);
  const dropIdx = AppState.tasks.findIndex(t => t.id === dropId);
  if (srcIdx < 0 || dropIdx < 0) return;
  const [moved] = AppState.tasks.splice(srcIdx, 1);
  AppState.tasks.splice(dropIdx, 0, moved);
  renderTasks();
  if (AppState.user) {
    apiFetch('/tasks/reorder', { method: 'PATCH', body: JSON.stringify({ orderedIds: AppState.tasks.map(t => t.id) }) }).catch(() => {});
  }
}

// ── Keyboard Shortcuts ────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); return; }
    if (e.key === 'Escape') {
      const palette = document.getElementById('command-palette-overlay');
      if (palette && palette.classList.contains('open')) closeCommandPalette();
      else { closeAllModals(); closeDropdown(); }
      return;
    }
    if (inInput) return;
    const key = e.key.toLowerCase();
    if      (key === 't') { navigateTo('tasks'); showToast('→ Tasks', 'info'); }
    else if (key === 'n') { navigateTo('notes'); showToast('→ Notes', 'info'); }
    else if (key === 'f') { navigateTo('timer'); showToast('→ Focus Timer', 'info'); }
    else if (key === '?') { openModal('shortcuts-modal-overlay'); }
  });
}

// ── Command Palette ───────────────────────────────────────────
const COMMANDS = [
  { label: 'Go to Tasks',       icon: '☑',  tags: 'tasks navigate',     action: () => navigateTo('tasks') },
  { label: 'Go to Notes',       icon: '📝', tags: 'notes navigate',     action: () => navigateTo('notes') },
  { label: 'Go to Focus Timer', icon: '⏱',  tags: 'timer focus',        action: () => navigateTo('timer') },
  { label: 'Go to Dashboard',   icon: '📊', tags: 'dashboard stats',    action: () => navigateTo('dashboard') },
  { label: 'Add New Task',      icon: '✚',  tags: 'add task create',    action: () => { navigateTo('tasks'); setTimeout(openAddTaskModal, 150); } },
  { label: 'Add New Note',      icon: '✦',  tags: 'add note create',    action: () => { navigateTo('notes'); setTimeout(openAddNoteModal, 150); } },
  { label: 'Start Timer',       icon: '▶',  tags: 'start timer',        action: () => { navigateTo('timer'); setTimeout(startTimer, 150); } },
  { label: 'Reset Timer',       icon: '↺',  tags: 'reset timer',        action: resetTimer },
  { label: 'Toggle Theme',      icon: '◑',  tags: 'theme dark light',   action: toggleTheme },
  { label: 'Open Shortcuts',    icon: '?',  tags: 'shortcuts keyboard', action: () => openModal('shortcuts-modal-overlay') },
];
let cpActiveIdx = 0;

function toggleCommandPalette() {
  const overlay = document.getElementById('command-palette-overlay'); if (!overlay) return;
  overlay.classList.contains('open') ? closeCommandPalette() : openCommandPalette();
}
function openCommandPalette() {
  const overlay = document.getElementById('command-palette-overlay'); if (!overlay) return;
  overlay.classList.add('open');
  const input = document.getElementById('cp-input'); if (input) { input.value = ''; input.focus(); }
  cpActiveIdx = 0; renderCommandItems('');
}
function closeCommandPalette() { const o = document.getElementById('command-palette-overlay'); if (o) o.classList.remove('open'); }

function renderCommandItems(query) {
  const list = document.getElementById('cp-list'); if (!list) return;
  const q        = query.toLowerCase().trim();
  const filtered = COMMANDS.filter(c => !q || c.label.toLowerCase().includes(q) || c.tags.includes(q));
  if (filtered.length === 0) { list.innerHTML = '<div class="cp-empty">No commands found</div>'; return; }
  if (cpActiveIdx >= filtered.length) cpActiveIdx = 0;
  list.innerHTML = filtered.map((c, i) =>
    `<button class="cp-item${i === cpActiveIdx ? ' active' : ''}" data-index="${i}">` +
    `<span class="cp-icon">${c.icon}</span><span class="cp-label">${highlightMatch(c.label, q)}</span></button>`
  ).join('');
  list.querySelectorAll('.cp-item').forEach((btn, i) => {
    btn.addEventListener('click', () => { filtered[i].action(); closeCommandPalette(); });
    btn.addEventListener('mouseover', () => {
      cpActiveIdx = i;
      list.querySelectorAll('.cp-item').forEach((b, j) => b.classList.toggle('active', j === i));
    });
  });
}

function highlightMatch(label, q) {
  if (!q) return escHtml(label);
  const idx = label.toLowerCase().indexOf(q);
  if (idx < 0) return escHtml(label);
  return escHtml(label.slice(0, idx)) + '<mark>' + escHtml(label.slice(idx, idx + q.length)) + '</mark>' + escHtml(label.slice(idx + q.length));
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container'); if (!container) return;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span class="toast-msg">${escHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('exit'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement, current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next); localStorage.setItem('zenith_theme', next);
  showToast(next.charAt(0).toUpperCase() + next.slice(1) + ' mode', 'info');
}

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.section)));
  document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.go)));

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const openTask = document.getElementById('open-add-task');
  const homeTask = document.getElementById('home-add-task');
  if (openTask) openTask.addEventListener('click', openAddTaskModal);
  if (homeTask) homeTask.addEventListener('click', openAddTaskModal);

  bindClose('task-modal-overlay', 'task-modal-close');
  const taskCancel = document.getElementById('task-cancel');
  const taskSave   = document.getElementById('task-save');
  const taskTitle  = document.getElementById('task-title');
  if (taskCancel) taskCancel.addEventListener('click', () => closeModal('task-modal-overlay'));
  if (taskSave)   taskSave.addEventListener('click', saveTaskModal);
  if (taskTitle)  taskTitle.addEventListener('keydown', e => { if (e.key === 'Enter') saveTaskModal(); });

  const openNote = document.getElementById('open-add-note');
  if (openNote) openNote.addEventListener('click', openAddNoteModal);
  bindClose('note-modal-overlay', 'note-modal-close');
  const noteCancel = document.getElementById('note-cancel');
  const noteSave   = document.getElementById('note-save');
  if (noteCancel) noteCancel.addEventListener('click', () => closeModal('note-modal-overlay'));
  if (noteSave)   noteSave.addEventListener('click', saveNoteModal);

  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => { const inp = document.getElementById(btn.dataset.target); if (inp) inp.value = btn.dataset.color; });
  });

  bindClose('confirm-modal-overlay', 'confirm-modal-close');
  const confirmOk     = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');
  if (confirmOk)     confirmOk.addEventListener('click', executePendingDelete);
  if (confirmCancel) confirmCancel.addEventListener('click', () => { pendingDelete = null; closeModal('confirm-modal-overlay'); });

  bindClose('shortcuts-modal-overlay', 'shortcuts-modal-close');
  wireAccountModalEvents();
  bindClose('command-palette-overlay', null);

  const cpInput = document.getElementById('cp-input');
  if (cpInput) {
    cpInput.addEventListener('input', function() { cpActiveIdx = 0; renderCommandItems(this.value); });
    cpInput.addEventListener('keydown', e => {
      const list  = document.getElementById('cp-list');
      const items = list ? list.querySelectorAll('.cp-item') : [];
      if (e.key === 'ArrowDown') { e.preventDefault(); cpActiveIdx = Math.min(cpActiveIdx + 1, items.length - 1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); cpActiveIdx = Math.max(cpActiveIdx - 1, 0); }
      if (e.key === 'Enter')     { e.preventDefault(); if (items[cpActiveIdx]) items[cpActiveIdx].click(); }
      items.forEach((b, j) => b.classList.toggle('active', j === cpActiveIdx));
    });
  }

  const timerStart = document.getElementById('timer-start');
  const timerReset = document.getElementById('timer-reset');
  const timerSkip  = document.getElementById('timer-skip');
  if (timerStart) timerStart.addEventListener('click', () => { if (Timer.running) pauseTimer(); else startTimer(); });
  if (timerReset) timerReset.addEventListener('click', resetTimer);
  if (timerSkip)  timerSkip.addEventListener('click',  () => switchTimerMode(Timer.mode === 'focus' ? 'break' : 'focus'));

  document.querySelectorAll('.timer-mode-btn').forEach(btn => btn.addEventListener('click', () => switchTimerMode(btn.dataset.mode)));
  const focDur = document.getElementById('focus-duration');
  const brkDur = document.getElementById('break-duration');
  if (focDur) focDur.addEventListener('change', () => { if (!Timer.running && Timer.mode === 'focus') resetTimer(); });
  if (brkDur) brkDur.addEventListener('change', () => { if (!Timer.running && Timer.mode === 'break') resetTimer(); });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  const taskSearch = document.getElementById('task-search');
  const noteSearch = document.getElementById('note-search');
  if (taskSearch) taskSearch.addEventListener('input', renderTasks);
  if (noteSearch) noteSearch.addEventListener('input', renderNotes);

  const forgotLink  = document.getElementById('forgot-password-link');
  const backToLogin = document.getElementById('back-to-login');
  if (forgotLink) forgotLink.addEventListener('click', e => {
    e.preventDefault();
    const main = document.getElementById('auth-grid-main'), forgot = document.getElementById('auth-grid-forgot');
    if (main) main.style.display = 'none'; if (forgot) forgot.style.display = '';
  });
  if (backToLogin) backToLogin.addEventListener('click', e => {
    e.preventDefault();
    const main = document.getElementById('auth-grid-main'), forgot = document.getElementById('auth-grid-forgot');
    if (main) main.style.display = ''; if (forgot) forgot.style.display = 'none';
  });

  document.addEventListener('click', e => {
    const wrap = document.getElementById('user-profile-wrap');
    if (wrap && !wrap.contains(e.target)) closeDropdown();
  });
}

function bindClose(overlayId, closeBtnId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.addEventListener('click', e => { if (e.target.id === overlayId) closeModal(overlayId); });
  if (closeBtnId) { const btn = document.getElementById(closeBtnId); if (btn) btn.addEventListener('click', () => closeModal(overlayId)); }
}

// ── Date Display ──────────────────────────────────────────────
function initDateDisplay() {
  const el = document.getElementById('header-date'); if (!el) return;
  function update() {
    const n = new Date();
    el.innerHTML = n.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
      '<br>' + n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  update(); setInterval(update, 30000);
}

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setEl(id, val)           { const el = document.getElementById(id); if (el) el.textContent = val; }
function setBarWidth(id, tot, ct) { const el = document.getElementById(id); if (el) el.style.width = tot > 0 ? ((ct / tot) * 100) + '%' : '0%'; }
function statusLabel(s)           { return { todo: 'To Do', inprogress: 'In Progress', done: 'Done' }[s] || s; }
function formatDate(d)            { if (!d) return ''; const p = d.split('-'); return parseInt(p[1]) + '/' + parseInt(p[2]) + '/' + p[0]; }
function formatDateShort(ts)      { if (!ts) return ''; return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
