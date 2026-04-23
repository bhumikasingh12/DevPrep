/* DevPrep frontend — backend-integrated build.
   All CRUD + analytics go through the FastAPI backend.
   Only the JWT lives in localStorage. Questions, streak, topic list come
   from the server. Every user action calls the API and re-syncs state.
*/

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = 'http://127.0.0.1:8000';
const TOKEN_KEY = 'devprep_token';

// ── Auth gate: redirect to login if no token ────────────────────────────────
(function requireAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = 'login.html';
  }
})();

// ── DOM references ──────────────────────────────────────────────────────────
const dom = {
  loader:           document.getElementById('loader'),
  loaderBar:        document.getElementById('loaderBar'),
  sidebar:          document.getElementById('sidebar'),
  hamburger:        document.getElementById('hamburger'),
  navItems:         Array.from(document.querySelectorAll('.nav-item')),
  pages:            Array.from(document.querySelectorAll('.page')),
  cursor:           document.getElementById('cursor'),
  cursorFollower:   document.getElementById('cursorFollower'),
  ringProgress:     document.getElementById('ringProgress'),
  ringPct:          document.getElementById('ringPct'),
  statTotal:        document.getElementById('statTotal'),
  statSolved:       document.getElementById('statSolved'),
  statUnsolved:     document.getElementById('statUnsolved'),
  statRevisit:      document.getElementById('statRevisit'),
  easyBar:          document.getElementById('easyBar'),
  mediumBar:        document.getElementById('mediumBar'),
  hardBar:          document.getElementById('hardBar'),
  easyCount:        document.getElementById('easyCount'),
  mediumCount:      document.getElementById('mediumCount'),
  hardCount:        document.getElementById('hardCount'),
  recentList:       document.getElementById('recentList'),
  questionsGrid:    document.getElementById('questionsGrid'),
  analyticsGrid:    document.getElementById('analyticsGrid'),
  weakGrid:         document.getElementById('weakGrid'),
  searchInput:      document.getElementById('searchInput'),
  filterTopic:      document.getElementById('filterTopic'),
  filterDifficulty: document.getElementById('filterDifficulty'),
  filterStatus:     document.getElementById('filterStatus'),
  qTitle:           document.getElementById('qTitle'),
  qTopic:           document.getElementById('qTopic'),
  qUrl:             document.getElementById('qUrl'),
  qTime:            document.getElementById('qTime'),
  qSpace:           document.getElementById('qSpace'),
  qTags:            document.getElementById('qTags'),
  qNotes:           document.getElementById('qNotes'),
  diffButtons:      Array.from(document.querySelectorAll('.diff-btn')),
  statusButtons:    Array.from(document.querySelectorAll('.status-btn')),
  resetForm:        document.getElementById('resetForm'),
  submitQuestion:   document.getElementById('submitQuestion'),
  toastContainer:   document.getElementById('toastContainer'),
  modalOverlay:     document.getElementById('modalOverlay'),
  modalClose:       document.getElementById('modalClose'),
  modalContent:     document.getElementById('modalContent'),
  topicSuggestions: document.getElementById('topicSuggestions'),
  particleCanvas:   document.getElementById('particleCanvas'),
  streakNum:        document.getElementById('streakNum'),

  // Profile (sidebar)
  profileBtn:          document.getElementById('profileBtn'),
  profileMenu:         document.getElementById('profileMenu'),
  profileAvatar:       document.getElementById('profileAvatar'),
  profileName:         document.getElementById('profileName'),
  profileEmail:        document.getElementById('profileEmail'),
  // Profile (page)
  profileHeroAvatar:   document.getElementById('profileHeroAvatar'),
  profileHeroName:     document.getElementById('profileHeroName'),
  profileHeroEmail:    document.getElementById('profileHeroEmail'),
  pfTotal:             document.getElementById('pfTotal'),
  pfSolved:            document.getElementById('pfSolved'),
  pfCompletion:        document.getElementById('pfCompletion'),
  pfStreak:            document.getElementById('pfStreak'),
  profileSignoutBtn:   document.getElementById('profileSignoutBtn'),
};

// ── App state (in-memory mirror of server data; no persistence) ─────────────
let questions     = [];
let analyticsData = null;   // last fetched /analytics response
let currentUser   = null;   // { id, name, email } from /auth/me
let currentEditId = null;
let particles     = [];
let canvasContext = null;
let canvasSize    = { width: 0, height: 0 };

// ── API helper ──────────────────────────────────────────────────────────────
async function api(path, { method = 'GET', body = null } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Cannot reach server. Is the backend running?');
  }

  // Unauthorized → wipe token and bounce to login
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = 'login.html';
    throw new Error('Session expired.');
  }

  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }

  if (!res.ok || (json && json.success === false)) {
    const msg = (json && json.message) || `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return json ? json.data : null;
}

// ── Utilities ───────────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function escapeHTML(value) {
  return value
    ? String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    : '';
}

function getSelectedData(buttons, key) {
  const active = buttons.find((btn) => btn.classList.contains('active'));
  return active ? active.dataset[key] : null;
}

function setActiveButton(buttons, key, value) {
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset[key] === value);
  });
}

function setBusy(buttonEl, busy, busyText) {
  if (!buttonEl) return;
  if (busy) {
    buttonEl.dataset.prevText = buttonEl.dataset.prevText || buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = busyText || buttonEl.dataset.prevText;
  } else {
    buttonEl.disabled = false;
    if (buttonEl.dataset.prevText) {
      buttonEl.innerHTML = buttonEl.dataset.prevText;
      delete buttonEl.dataset.prevText;
    }
  }
}

// ── Form helpers ────────────────────────────────────────────────────────────
function resetFormFields() {
  currentEditId = null;
  dom.qTitle.value  = '';
  dom.qTopic.value  = '';
  dom.qUrl.value    = '';
  dom.qTime.value   = '';
  dom.qSpace.value  = '';
  dom.qTags.value   = '';
  dom.qNotes.value  = '';
  setActiveButton(dom.diffButtons,   'diff',   'easy');
  setActiveButton(dom.statusButtons, 'status', 'unsolved');
  dom.submitQuestion.querySelector('.btn-text').textContent = 'Add Question';
}

function fillForm(questionId) {
  const question = questions.find((q) => q.id === questionId);
  if (!question) return;
  currentEditId        = questionId;
  dom.qTitle.value     = question.title;
  dom.qTopic.value     = question.topic;
  dom.qUrl.value       = question.leetcode_url     || '';
  dom.qTime.value      = question.time_complexity  || '';
  dom.qSpace.value     = question.space_complexity || '';
  dom.qTags.value      = (question.tags || []).join(', ');
  dom.qNotes.value     = question.notes            || '';
  setActiveButton(dom.diffButtons,   'diff',   question.difficulty);
  setActiveButton(dom.statusButtons, 'status', question.status);
  dom.submitQuestion.querySelector('.btn-text').textContent = 'Save Changes';
}

// ── Topic dropdown ──────────────────────────────────────────────────────────
function buildTopicOptions() {
  const topics = Array.from(
    new Set(questions.map((q) => q.topic).filter(Boolean))
  ).sort();
  dom.filterTopic.innerHTML = [
    '<option value="">All Topics</option>',
    ...topics.map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`),
  ].join('');
}

// ── Filtering ───────────────────────────────────────────────────────────────
function getFilteredQuestions() {
  const searchTerm = dom.searchInput.value.trim().toLowerCase();
  const topic      = dom.filterTopic.value;
  const difficulty = dom.filterDifficulty.value;
  const status     = dom.filterStatus.value;

  return questions.filter((q) => {
    const tagsStr = (q.tags || []).join(' ');
    const matchesSearch = !searchTerm || [q.title, q.topic, tagsStr].some(
      (field) => (field || '').toLowerCase().includes(searchTerm)
    );
    const matchesTopic      = !topic      || q.topic      === topic;
    const matchesDifficulty = !difficulty || q.difficulty === difficulty;
    const matchesStatus     = !status     || q.status     === status;
    return matchesSearch && matchesTopic && matchesDifficulty && matchesStatus;
  });
}

// ── Renderers — dashboard/analytics use backend analytics when available ────
function renderDashboard() {
  // Prefer backend numbers; fall back to local counts if analytics not loaded yet.
  const total    = analyticsData?.total    ?? questions.length;
  const solved   = analyticsData?.solved   ?? questions.filter((q) => q.status === 'solved').length;
  const unsolved = analyticsData?.unsolved ?? questions.filter((q) => q.status === 'unsolved').length;
  const revisit  = analyticsData?.revisit  ?? questions.filter((q) => q.status === 'revisit').length;

  const diff = analyticsData?.difficulty_breakdown || {
    easy:   { total: questions.filter((q) => q.difficulty === 'easy').length,
              solved: questions.filter((q) => q.difficulty === 'easy' && q.status === 'solved').length },
    medium: { total: questions.filter((q) => q.difficulty === 'medium').length,
              solved: questions.filter((q) => q.difficulty === 'medium' && q.status === 'solved').length },
    hard:   { total: questions.filter((q) => q.difficulty === 'hard').length,
              solved: questions.filter((q) => q.difficulty === 'hard' && q.status === 'solved').length },
  };

  const progress      = total ? Math.round((solved / total) * 100) : 0;
  const circumference = 2 * Math.PI * 80;

  dom.statTotal.textContent    = total;
  dom.statSolved.textContent   = solved;
  dom.statUnsolved.textContent = unsolved;
  dom.statRevisit.textContent  = revisit;
  dom.ringPct.textContent      = `${progress}%`;
  dom.ringProgress.style.strokeDasharray  = circumference;
  dom.ringProgress.style.strokeDashoffset = circumference - (progress / 100) * circumference;

  const pctOf = (row) => row.total ? `${Math.round((row.solved / row.total) * 100)}%` : '0%';
  dom.easyBar.style.width   = pctOf(diff.easy);
  dom.mediumBar.style.width = pctOf(diff.medium);
  dom.hardBar.style.width   = pctOf(diff.hard);

  dom.easyCount.textContent   = `${diff.easy.solved}/${diff.easy.total}`;
  dom.mediumCount.textContent = `${diff.medium.solved}/${diff.medium.total}`;
  dom.hardCount.textContent   = `${diff.hard.solved}/${diff.hard.total}`;

  if (dom.streakNum && analyticsData) {
    dom.streakNum.textContent = analyticsData.streak ?? 0;
  }
}

function renderRecentSolved() {
  const recent = analyticsData?.recent_solved || questions
    .filter((q) => q.solved_at)
    .sort((a, b) => new Date(b.solved_at) - new Date(a.solved_at))
    .slice(0, 5);

  if (!recent.length) {
    dom.recentList.innerHTML = '<div class="empty-state">No solved questions yet. Start grinding! 💪</div>';
    return;
  }

  dom.recentList.innerHTML = recent.map((q) => `
    <div class="recent-item">
      <div class="recent-item-left">
        <div class="recent-title">${escapeHTML(q.title)}</div>
        <div class="recent-topic">${escapeHTML(q.topic)} · ${escapeHTML(q.difficulty)}</div>
      </div>
      <div class="recent-date">${formatDate(q.solved_at)}</div>
    </div>
  `).join('');
}

function renderQuestions() {
  const filtered = getFilteredQuestions();

  if (!filtered.length) {
    dom.questionsGrid.innerHTML = '<div class="empty-state">No questions found for the current filters. Add a question to get started.</div>';
    return;
  }

  dom.questionsGrid.innerHTML = filtered.map((q) => {
    const statusClass = q.status === 'solved'  ? 'status-solved'
                      : q.status === 'revisit' ? 'status-revisit'
                      : 'status-unsolved';
    const notes = q.notes ? escapeHTML(q.notes).slice(0, 140) : 'No notes added yet.';
    const tags  = (q.tags || []).map((tag) => `<span class="q-tag">${escapeHTML(tag)}</span>`).join('');

    return `
      <article class="q-card ${escapeHTML(q.difficulty)}" data-id="${q.id}">
        <div class="q-card-header">
          <div>
            <h3 class="q-title">${escapeHTML(q.title)}</h3>
            <div class="q-meta">
              <span class="q-badge">${escapeHTML(q.topic)}</span>
              <span class="q-badge ${escapeHTML(q.difficulty)}-badge">${escapeHTML(q.difficulty)}</span>
            </div>
          </div>
          <span class="q-status ${statusClass}">${escapeHTML(q.status)}</span>
        </div>
        <p class="q-notes">${notes}${q.notes && q.notes.length > 140 ? '...' : ''}</p>
        <div class="q-tags">${tags}</div>
        <div class="q-card-footer">
          <div class="q-complexity">${escapeHTML(q.time_complexity || 'O(?)')}</div>
          <div class="q-actions">
            <button class="q-btn view-btn">View</button>
            <button class="q-btn solve-btn">${q.status === 'solved' ? 'Mark Unsolved' : 'Mark Solved'}</button>
            <button class="q-btn delete-btn">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  dom.questionsGrid.querySelectorAll('.q-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.view-btn').addEventListener('click',   () => openModal(id));
    card.querySelector('.solve-btn').addEventListener('click',  (e) => toggleSolved(id, e.currentTarget));
    card.querySelector('.delete-btn').addEventListener('click', (e) => deleteQuestion(id, e.currentTarget));
  });
}

function renderAnalytics() {
  const total    = analyticsData?.total    ?? questions.length;
  const solved   = analyticsData?.solved   ?? questions.filter((q) => q.status === 'solved').length;
  const unsolved = analyticsData?.unsolved ?? questions.filter((q) => q.status === 'unsolved').length;
  const revisit  = analyticsData?.revisit  ?? questions.filter((q) => q.status === 'revisit').length;
  const streak   = analyticsData?.streak   ?? 0;

  const topicsObj = analyticsData?.topics || (() => {
    const out = {};
    questions.forEach((q) => {
      if (!out[q.topic]) out[q.topic] = { total: 0, solved: 0 };
      out[q.topic].total += 1;
      if (q.status === 'solved') out[q.topic].solved += 1;
    });
    return out;
  })();

  const rows = Object.entries(topicsObj)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([topic, stats]) => {
      const pct = stats.total ? Math.round((stats.solved / stats.total) * 100) : 0;
      return `
        <div class="topic-row">
          <div class="topic-name">${escapeHTML(topic)}</div>
          <div class="topic-bar-track">
            <div class="topic-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="topic-pct">${pct}%</div>
        </div>
      `;
    }).join('');

  dom.analyticsGrid.innerHTML = `
    <div class="analytics-card">
      <h3 class="analytics-card-title">Progress Overview</h3>
      <p style="color:var(--text3);font-size:0.85rem;margin-bottom:1rem;">
        Track your completion, unsolved backlog, and revisit goals.
      </p>
      <div style="color:var(--text2); line-height:2;">
        <div><strong>Total:</strong> ${total}</div>
        <div><strong>Solved:</strong> ${solved}</div>
        <div><strong>Unsolved:</strong> ${unsolved}</div>
        <div><strong>Revisit:</strong> ${revisit}</div>
        <div><strong>Completion:</strong> ${total ? Math.round((solved / total) * 100) : 0}%</div>
        <div><strong>Current Streak:</strong> 🔥 ${streak} days</div>
      </div>
    </div>
    <div class="analytics-card">
      <h3 class="analytics-card-title">Top Topics</h3>
      ${rows || '<div class="empty-state">Add questions to see the topics you practise most.</div>'}
    </div>
  `;
}

function renderWeakTopics() {
  const weak = analyticsData?.weak_topics?.map((w) => ({
    topic: w.topic,
    solvedPct: w.solved_pct,
    data: { total: w.total, solved: w.solved, easy: w.easy, medium: w.medium, hard: w.hard },
  })) || (() => {
    const stats = {};
    questions.forEach((q) => {
      if (!stats[q.topic]) stats[q.topic] = { total: 0, solved: 0, easy: 0, medium: 0, hard: 0 };
      stats[q.topic].total  += 1;
      stats[q.topic].solved += q.status === 'solved' ? 1 : 0;
      stats[q.topic][q.difficulty] += 1;
    });
    return Object.entries(stats)
      .map(([topic, data]) => ({
        topic,
        solvedPct: data.total ? Math.round((data.solved / data.total) * 100) : 0,
        data,
      }))
      .filter((item) => item.solvedPct < 50);
  })();

  if (!weak.length) {
    dom.weakGrid.innerHTML = '<div class="empty-state">No weak topics found! You\'re killing it 💪</div>';
    return;
  }

  dom.weakGrid.innerHTML = weak.map((item) => `
    <article class="weak-card">
      <div class="weak-topic">${escapeHTML(item.topic)}</div>
      <div class="weak-pct">${item.solvedPct}<span>%</span></div>
      <div class="weak-bar-track">
        <div class="weak-bar-fill" style="width:${item.solvedPct}%"></div>
      </div>
      <div class="weak-stats">
        <span>Total ${item.data.total}</span>
        <span>Solved ${item.data.solved}</span>
        <span>Easy ${item.data.easy}</span>
        <span>Medium ${item.data.medium}</span>
        <span>Hard ${item.data.hard}</span>
      </div>
      <div class="weak-badge">Focus</div>
    </article>
  `).join('');
}

function rerenderAll() {
  renderDashboard();
  renderRecentSolved();
  renderQuestions();
  renderAnalytics();
  renderWeakTopics();
}

// ── Topic autocomplete ──────────────────────────────────────────────────────
function updateTopicSuggestions() {
  const value  = dom.qTopic.value.trim().toLowerCase();
  const topics = Array.from(new Set(questions.map((q) => q.topic))).filter(Boolean);
  const filtered = topics
    .filter((t) => t.toLowerCase().includes(value) && t.toLowerCase() !== value)
    .slice(0, 6);

  if (!value || !filtered.length) {
    dom.topicSuggestions.innerHTML = '';
    dom.topicSuggestions.classList.remove('visible');
    return;
  }

  dom.topicSuggestions.innerHTML = filtered
    .map((t) => `<button type="button" class="topic-suggestion-item">${escapeHTML(t)}</button>`)
    .join('');
  dom.topicSuggestions.classList.add('visible');

  dom.topicSuggestions.querySelectorAll('.topic-suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      dom.qTopic.value = item.textContent;
      dom.topicSuggestions.classList.remove('visible');
    });
  });
}

// ── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className    = `toast ${type}`;
  toast.textContent  = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2200);
}

// ── Modal ───────────────────────────────────────────────────────────────────
function openModal(questionId) {
  const q = questions.find((item) => item.id === questionId);
  if (!q) return;

  const statusClass = q.status === 'solved'  ? 'status-solved'
                    : q.status === 'revisit' ? 'status-revisit'
                    : 'status-unsolved';

  dom.modalContent.innerHTML = `
    <div class="modal-title">${escapeHTML(q.title)}</div>
    <div class="modal-meta">
      <span class="q-badge">${escapeHTML(q.topic)}</span>
      <span class="q-badge ${q.difficulty}-badge">${escapeHTML(q.difficulty)}</span>
      <span class="q-badge ${statusClass}">${escapeHTML(q.status)}</span>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Notes &amp; Approach</div>
      <div class="modal-section-body">${escapeHTML(q.notes) || 'No notes available.'}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Question Details</div>
      <div class="modal-section-body">
        <strong>Topic:</strong> ${escapeHTML(q.topic)}<br>
        <strong>Difficulty:</strong> ${escapeHTML(q.difficulty)}<br>
        <strong>Status:</strong> ${escapeHTML(q.status)}<br>
        <strong>Created:</strong> ${formatDate(q.created_at)}<br>
        <strong>Solved:</strong> ${formatDate(q.solved_at)}<br>
        <strong>Time Complexity:</strong> ${escapeHTML(q.time_complexity) || 'Unknown'}<br>
        <strong>Space Complexity:</strong> ${escapeHTML(q.space_complexity) || 'Unknown'}<br>
        <strong>Attempts:</strong> ${q.attempts || 0}
      </div>
    </div>
    ${q.tags && q.tags.length ? `
    <div class="modal-section">
      <div class="modal-section-title">Tags</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
        ${q.tags.map((tag) => `<span class="q-tag">${escapeHTML(tag)}</span>`).join('')}
      </div>
    </div>` : ''}
    ${q.leetcode_url ? `
    <a class="modal-link" href="${escapeHTML(q.leetcode_url)}" target="_blank" rel="noreferrer">
      🔗 Open on LeetCode
    </a>` : ''}
    <div class="modal-actions" style="margin-top:1.5rem;">
      <button class="modal-btn modal-btn-solve">${q.status === 'solved' ? 'Mark Unsolved' : 'Mark Solved'}</button>
      <button class="modal-btn modal-btn-revisit">Mark Revisit</button>
      <button class="modal-btn" id="modalEditBtn">Edit</button>
      <button class="modal-btn modal-btn-delete">Delete</button>
    </div>
  `;

  dom.modalOverlay.classList.add('open');

  dom.modalContent.querySelector('.modal-btn-solve').addEventListener('click', async (e) => {
    await toggleSolved(q.id, e.currentTarget);
    closeModal();
  });
  dom.modalContent.querySelector('.modal-btn-revisit').addEventListener('click', async (e) => {
    await updateQuestionStatus(q.id, 'revisit', e.currentTarget);
    closeModal();
  });
  dom.modalContent.querySelector('#modalEditBtn').addEventListener('click', () => {
    fillForm(q.id);
    closeModal();
    navigate('add');
  });
  dom.modalContent.querySelector('.modal-btn-delete').addEventListener('click', async (e) => {
    await deleteQuestion(q.id, e.currentTarget);
    closeModal();
  });
}

function closeModal() {
  dom.modalOverlay.classList.remove('open');
}

// ── Profile ─────────────────────────────────────────────────────────────────
function getInitials(name, email) {
  const source = (name || email || '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function renderProfile() {
  if (!currentUser) return;
  const initials = getInitials(currentUser.name, currentUser.email);

  // Sidebar
  if (dom.profileAvatar) dom.profileAvatar.textContent = initials;
  if (dom.profileName)   dom.profileName.textContent   = currentUser.name || '—';
  if (dom.profileEmail)  dom.profileEmail.textContent  = currentUser.email || '—';

  // Profile page hero
  if (dom.profileHeroAvatar) dom.profileHeroAvatar.textContent = initials;
  if (dom.profileHeroName)   dom.profileHeroName.textContent   = currentUser.name || '—';
  if (dom.profileHeroEmail)  dom.profileHeroEmail.textContent  = currentUser.email || '—';

  renderProfileStats();
}

function renderProfileStats() {
  const total    = analyticsData?.total    ?? questions.length;
  const solved   = analyticsData?.solved   ?? questions.filter((q) => q.status === 'solved').length;
  const streak   = analyticsData?.streak   ?? 0;
  const pct      = total ? Math.round((solved / total) * 100) : 0;

  if (dom.pfTotal)      dom.pfTotal.textContent      = total;
  if (dom.pfSolved)     dom.pfSolved.textContent     = solved;
  if (dom.pfCompletion) dom.pfCompletion.textContent = `${pct}%`;
  if (dom.pfStreak)     dom.pfStreak.textContent     = `🔥 ${streak}`;
}

async function loadCurrentUser() {
  try {
    currentUser = await api('/auth/me');
    renderProfile();
  } catch (err) {
    // /auth/me failure with a valid token shouldn't happen; 401 already redirects.
    console.warn('Failed to load user profile:', err.message);
  }
}

function toggleProfileMenu(force) {
  const open = typeof force === 'boolean'
    ? force
    : !dom.profileMenu.classList.contains('open');
  dom.profileMenu.classList.toggle('open', open);
  dom.profileBtn.classList.toggle('open', open);
}

function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  showToast('Signed out. See you soon! 👋', 'success');
  setTimeout(() => { window.location.href = 'login.html'; }, 400);
}


async function loadQuestions() {
  try {
    const data = await api('/questions');
    questions = data?.questions || [];
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAnalytics() {
  try {
    analyticsData = await api('/analytics');
  } catch (err) {
    // silent on analytics failure — renderers fall back to local aggregation
    analyticsData = null;
  }
}

async function refreshAll() {
  await Promise.all([loadQuestions(), loadAnalytics()]);
  buildTopicOptions();
  rerenderAll();
  renderProfileStats();
}

// ── Question actions (all via API) ──────────────────────────────────────────
async function toggleSolved(questionId, triggerBtn) {
  const q = questions.find((item) => item.id === questionId);
  if (!q) return;
  const nextStatus = q.status === 'solved' ? 'unsolved' : 'solved';
  await updateQuestionStatus(questionId, nextStatus, triggerBtn);
}

async function updateQuestionStatus(questionId, status, triggerBtn) {
  setBusy(triggerBtn, true, '…');
  try {
    await api(`/questions/${questionId}`, { method: 'PUT', body: { status } });
    await refreshAll();
    showToast(`Question marked as ${status}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setBusy(triggerBtn, false);
  }
}

async function deleteQuestion(questionId, triggerBtn) {
  setBusy(triggerBtn, true, '…');
  try {
    await api(`/questions/${questionId}`, { method: 'DELETE' });
    await refreshAll();
    showToast('Question deleted.', 'error');
  } catch (err) {
    showToast(err.message, 'error');
    setBusy(triggerBtn, false);
  }
  // on success the button's DOM is gone after refreshAll(); no need to un-busy.
}

// ── Form submission ─────────────────────────────────────────────────────────
async function submitQuestion(event) {
  event.preventDefault();

  const title            = dom.qTitle.value.trim();
  const topic            = dom.qTopic.value.trim();
  const difficulty       = getSelectedData(dom.diffButtons,   'diff')   || 'easy';
  const status           = getSelectedData(dom.statusButtons, 'status') || 'unsolved';
  const leetcode_url     = dom.qUrl.value.trim()  || null;
  const time_complexity  = dom.qTime.value.trim() || null;
  const space_complexity = dom.qSpace.value.trim()|| null;
  const notes            = dom.qNotes.value.trim();
  const tags             = dom.qTags.value.split(',').map((t) => t.trim()).filter(Boolean);

  if (!title || !topic) {
    showToast('Title and topic are required.', 'error');
    return;
  }

  const payload = {
    title, topic, difficulty, status, notes, tags,
    leetcode_url, time_complexity, space_complexity,
  };

  setBusy(dom.submitQuestion, true, '<span class="btn-text">Saving…</span>');
  try {
    if (currentEditId) {
      await api(`/questions/${currentEditId}`, { method: 'PUT', body: payload });
      showToast('Question updated.', 'success');
    } else {
      await api('/questions', { method: 'POST', body: payload });
      showToast('Question added successfully! 🎉', 'success');
    }
    resetFormFields();
    await refreshAll();
    navigate('questions');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setBusy(dom.submitQuestion, false);
  }
}

// ── Navigation ──────────────────────────────────────────────────────────────
function navigate(pageId) {
  dom.pages.forEach((page) => {
    page.classList.toggle('active', page.id === `page-${pageId}`);
  });
  dom.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  if (dom.sidebar.classList.contains('open')) {
    dom.sidebar.classList.remove('open');
    dom.hamburger.classList.remove('open');
  }

  // Close the profile menu whenever we change pages.
  toggleProfileMenu(false);

  // Re-fetch analytics on pages that show derived metrics so they always match server.
  if (pageId === 'dashboard' || pageId === 'analytics' || pageId === 'weak') {
    loadAnalytics().then(() => { rerenderAll(); renderProfileStats(); });
  } else if (pageId === 'questions') {
    renderQuestions();
  } else if (pageId === 'profile') {
    renderProfile();
  }
}

// ── Event listeners ─────────────────────────────────────────────────────────
function attachListeners() {
  dom.navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });

  dom.hamburger.addEventListener('click', () => {
    const open = dom.sidebar.classList.toggle('open');
    dom.hamburger.classList.toggle('open', open);
  });

  dom.diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveButton(dom.diffButtons, 'diff', btn.dataset.diff);
    });
  });

  dom.statusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveButton(dom.statusButtons, 'status', btn.dataset.status);
    });
  });

  dom.resetForm.addEventListener('click', (e) => {
    e.preventDefault();
    resetFormFields();
  });
  dom.submitQuestion.addEventListener('click', submitQuestion);

  dom.searchInput.addEventListener('input',        renderQuestions);
  dom.filterTopic.addEventListener('change',       renderQuestions);
  dom.filterDifficulty.addEventListener('change',  renderQuestions);
  dom.filterStatus.addEventListener('change',      renderQuestions);

  dom.qTopic.addEventListener('input', updateTopicSuggestions);
  dom.qTopic.addEventListener('focus', updateTopicSuggestions);
  dom.qTopic.addEventListener('blur',  () =>
    setTimeout(() => dom.topicSuggestions.classList.remove('visible'), 180)
  );

  dom.modalClose.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modalOverlay.classList.contains('open')) closeModal();
  });

  document.addEventListener('mousemove', (e) => {
    dom.cursor.style.left         = `${e.clientX}px`;
    dom.cursor.style.top          = `${e.clientY}px`;
    dom.cursorFollower.style.left = `${e.clientX}px`;
    dom.cursorFollower.style.top  = `${e.clientY}px`;
  });

  // Profile button toggles the dropdown menu
  if (dom.profileBtn) {
    dom.profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileMenu();
    });
  }

  // Profile dropdown actions
  if (dom.profileMenu) {
    dom.profileMenu.querySelectorAll('.profile-menu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const action = item.dataset.action;
        toggleProfileMenu(false);
        if (action === 'profile')  navigate('profile');
        if (action === 'signout')  signOut();
      });
    });
  }

  // Sign out button on the profile page
  if (dom.profileSignoutBtn) {
    dom.profileSignoutBtn.addEventListener('click', signOut);
  }

  // Click outside profile menu closes it
  document.addEventListener('click', (e) => {
    if (!dom.profileMenu || !dom.profileBtn) return;
    if (!dom.profileMenu.classList.contains('open')) return;
    if (dom.profileBtn.contains(e.target) || dom.profileMenu.contains(e.target)) return;
    toggleProfileMenu(false);
  });
}

// ── Particles (unchanged) ───────────────────────────────────────────────────
function initializeParticles() {
  const canvas = dom.particleCanvas;
  if (!canvas) return;
  canvasContext = canvas.getContext('2d');
  resizeCanvas();
  particles = Array.from({ length: 80 }, createParticle);
  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(updateParticles);
}

function resizeCanvas() {
  const canvas      = dom.particleCanvas;
  canvas.width      = window.innerWidth;
  canvas.height     = window.innerHeight;
  canvasSize.width  = canvas.width;
  canvasSize.height = canvas.height;
}

function createParticle() {
  return {
    x:      Math.random() * canvasSize.width,
    y:      Math.random() * canvasSize.height,
    vx:     (Math.random() - 0.5) * 0.35,
    vy:     (Math.random() - 0.5) * 0.35,
    radius: 1 + Math.random() * 1.8,
  };
}

function updateParticles() {
  if (!canvasContext) return;
  canvasContext.clearRect(0, 0, canvasSize.width, canvasSize.height);
  canvasContext.fillStyle = 'rgba(0,245,212,0.08)';

  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > canvasSize.width)  p.vx *= -1;
    if (p.y < 0 || p.y > canvasSize.height) p.vy *= -1;
    canvasContext.beginPath();
    canvasContext.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    canvasContext.fill();
  });

  const maxDist = 120;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        canvasContext.strokeStyle = `rgba(0,245,212,${1 - dist / maxDist})`;
        canvasContext.lineWidth   = 0.6;
        canvasContext.beginPath();
        canvasContext.moveTo(a.x, a.y);
        canvasContext.lineTo(b.x, b.y);
        canvasContext.stroke();
      }
    }
  }
  requestAnimationFrame(updateParticles);
}

// ── Loader animation (unchanged) ────────────────────────────────────────────
function playLoader() {
  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(100, progress + Math.random() * 12);
    dom.loaderBar.style.width = `${progress}%`;
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => dom.loader.classList.add('done'), 300);
    }
  }, 80);
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
async function init() {
  attachListeners();
  resetFormFields();
  initializeParticles();
  playLoader();
  await Promise.all([loadCurrentUser(), refreshAll()]);
  renderProfile(); // ensure stats re-render once both user and analytics arrived
}

document.addEventListener('DOMContentLoaded', init);
