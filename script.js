/* DevPrep JavaScript App
   Controls navigation, question storage, filters, modals,
   analytics, toast notifications, cursor, loader, and particles.
*/

const STORAGE_KEY = 'devprep_questions_v1';
const STREAK_KEY  = 'devprep_streak_v1';

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
};

// ── App state ────────────────────────────────────────────────────────────────
let questions      = [];
let currentEditId  = null;
let particles      = [];
let canvasContext   = null;
let canvasSize     = { width: 0, height: 0 };

// ── Persistence ──────────────────────────────────────────────────────────────
function loadQuestions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to load questions', error);
    return [];
  }
}

function saveQuestions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}

// ── Streak helpers ────────────────────────────────────────────────────────────
/**
 * Loads streak data from localStorage.
 * Returns { count, lastDate } where lastDate is a YYYY-MM-DD string or null.
 */
function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { count: 0, lastDate: null };
  } catch {
    return { count: 0, lastDate: null };
  }
}

function saveStreak(data) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

/** Returns today's date as a YYYY-MM-DD string (local time). */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Recalculates the streak from scratch by looking at which calendar days
 * have at least one solved question. This is the most robust approach —
 * it survives page refreshes, time zone quirks, and manual edits.
 */
function recalcStreak() {
  // Collect all unique days that have a solved question
  const solvedDays = new Set(
    questions
      .filter((q) => q.solved_at)
      .map((q) => q.solved_at.slice(0, 10)) // "YYYY-MM-DD"
  );

  if (solvedDays.size === 0) return 0;

  // Walk backwards from today counting consecutive days
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (solvedDays.has(key)) {
      streak += 1;
    } else {
      // Allow a one-day gap only for the very first check (today might not have
      // a solve yet, but yesterday onwards must be unbroken).
      if (i === 0) continue;
      break;
    }
  }

  return streak;
}

function updateStreakDisplay() {
  const streak = recalcStreak();
  if (dom.streakNum) dom.streakNum.textContent = streak;
}

// ── Utilities ────────────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function escapeHTML(value) {
  return value
    ? value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    : '';
}

/** Returns the `data-[key]` value of the active button in a group, or null. */
function getSelectedData(buttons, key) {
  const active = buttons.find((btn) => btn.classList.contains('active'));
  return active ? active.dataset[key] : null;
}

/** Sets exactly one button active based on its `data-[key]` value. */
function setActiveButton(buttons, key, value) {
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset[key] === value);
  });
}

// ── Form helpers ─────────────────────────────────────────────────────────────
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

  currentEditId         = questionId;
  dom.qTitle.value      = question.title;
  dom.qTopic.value      = question.topic;
  dom.qUrl.value        = question.leetcode_url      || '';
  dom.qTime.value       = question.time_complexity   || '';
  dom.qSpace.value      = question.space_complexity  || '';
  dom.qTags.value       = question.tags.join(', ');
  dom.qNotes.value      = question.notes             || '';
  setActiveButton(dom.diffButtons,   'diff',   question.difficulty);
  setActiveButton(dom.statusButtons, 'status', question.status);
  dom.submitQuestion.querySelector('.btn-text').textContent = 'Save Changes';
}

// ── Topic filter dropdown ─────────────────────────────────────────────────────
function buildTopicOptions() {
  const topics = Array.from(
    new Set(questions.map((q) => q.topic).filter(Boolean))
  ).sort();
  dom.filterTopic.innerHTML = [
    '<option value="">All Topics</option>',
    ...topics.map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`),
  ].join('');
}

// ── Filtering ────────────────────────────────────────────────────────────────
function getFilteredQuestions() {
  const searchTerm = dom.searchInput.value.trim().toLowerCase();
  const topic      = dom.filterTopic.value;
  const difficulty = dom.filterDifficulty.value;
  const status     = dom.filterStatus.value;

  return questions.filter((q) => {
    const matchesSearch = !searchTerm || [q.title, q.topic, q.tags.join(' ')].some(
      (field) => field.toLowerCase().includes(searchTerm)
    );
    const matchesTopic      = !topic      || q.topic      === topic;
    const matchesDifficulty = !difficulty || q.difficulty === difficulty;
    const matchesStatus     = !status     || q.status     === status;
    return matchesSearch && matchesTopic && matchesDifficulty && matchesStatus;
  });
}

// ── Renderers ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const total    = questions.length;
  const solved   = questions.filter((q) => q.status === 'solved').length;
  const unsolved = questions.filter((q) => q.status === 'unsolved').length;
  const revisit  = questions.filter((q) => q.status === 'revisit').length;

  const byDiff = {
    easy:   questions.filter((q) => q.difficulty === 'easy'),
    medium: questions.filter((q) => q.difficulty === 'medium'),
    hard:   questions.filter((q) => q.difficulty === 'hard'),
  };

  const solvedByDiff = {
    easy:   byDiff.easy.filter((q)   => q.status === 'solved').length,
    medium: byDiff.medium.filter((q) => q.status === 'solved').length,
    hard:   byDiff.hard.filter((q)   => q.status === 'solved').length,
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

  dom.easyBar.style.width   = byDiff.easy.length   ? `${Math.round((solvedByDiff.easy   / byDiff.easy.length)   * 100)}%` : '0%';
  dom.mediumBar.style.width = byDiff.medium.length ? `${Math.round((solvedByDiff.medium / byDiff.medium.length) * 100)}%` : '0%';
  dom.hardBar.style.width   = byDiff.hard.length   ? `${Math.round((solvedByDiff.hard   / byDiff.hard.length)   * 100)}%` : '0%';

  dom.easyCount.textContent   = `${solvedByDiff.easy}/${byDiff.easy.length}`;
  dom.mediumCount.textContent = `${solvedByDiff.medium}/${byDiff.medium.length}`;
  dom.hardCount.textContent   = `${solvedByDiff.hard}/${byDiff.hard.length}`;

  updateStreakDisplay();
}

function renderRecentSolved() {
  const recent = questions
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
    const tags  = q.tags.map((tag) => `<span class="q-tag">${escapeHTML(tag)}</span>`).join('');

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

  // Attach card-level listeners after rendering
  dom.questionsGrid.querySelectorAll('.q-card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.view-btn').addEventListener('click',   () => openModal(id));
    card.querySelector('.solve-btn').addEventListener('click',  () => toggleSolved(id));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteQuestion(id));
  });
}

function renderAnalytics() {
  const total    = questions.length;
  const solved   = questions.filter((q) => q.status === 'solved').length;
  const unsolved = questions.filter((q) => q.status === 'unsolved').length;
  const revisit  = questions.filter((q) => q.status === 'revisit').length;

  // Build per-topic stats
  const topicStats = {};
  questions.forEach((q) => {
    if (!topicStats[q.topic]) topicStats[q.topic] = { total: 0, solved: 0 };
    topicStats[q.topic].total  += 1;
    if (q.status === 'solved') topicStats[q.topic].solved += 1;
  });

  const rows = Object.entries(topicStats)
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
        <div><strong>Current Streak:</strong> 🔥 ${recalcStreak()} days</div>
      </div>
    </div>
    <div class="analytics-card">
      <h3 class="analytics-card-title">Top Topics</h3>
      ${rows || '<div class="empty-state">Add questions to see the topics you practise most.</div>'}
    </div>
  `;
}

function renderWeakTopics() {
  const stats = {};
  questions.forEach((q) => {
    if (!stats[q.topic]) stats[q.topic] = { total: 0, solved: 0, easy: 0, medium: 0, hard: 0 };
    stats[q.topic].total  += 1;
    stats[q.topic].solved += q.status === 'solved' ? 1 : 0;
    stats[q.topic][q.difficulty] += 1;
  });

  const weak = Object.entries(stats)
    .map(([topic, data]) => ({
      topic,
      solvedPct: data.total ? Math.round((data.solved / data.total) * 100) : 0,
      data,
    }))
    .filter((item) => item.solvedPct < 50)
    .sort((a, b) => a.solvedPct - b.solvedPct);

  if (!weak.length) {
    dom.weakGrid.innerHTML = '<div class="empty-state">No weak topics found! You\'re killing it 💪</div>';
    return;
  }

  dom.weakGrid.innerHTML = weak.map((item) => `
    <article class="weak-card">
      <div class="weak-topic-name">${escapeHTML(item.topic)}</div>
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

// ── Topic autocomplete ────────────────────────────────────────────────────────
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

// ── Toast notifications ───────────────────────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────────────────────
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

  dom.modalContent.querySelector('.modal-btn-solve').addEventListener('click', () => {
    toggleSolved(q.id);
    closeModal();
  });
  dom.modalContent.querySelector('.modal-btn-revisit').addEventListener('click', () => {
    updateQuestionStatus(q.id, 'revisit');
    closeModal();
  });
  dom.modalContent.querySelector('#modalEditBtn').addEventListener('click', () => {
    fillForm(q.id);
    closeModal();
    navigate('add');
  });
  dom.modalContent.querySelector('.modal-btn-delete').addEventListener('click', () => {
    deleteQuestion(q.id);
    closeModal();
  });
}

function closeModal() {
  dom.modalOverlay.classList.remove('open');
}

// ── Question actions ──────────────────────────────────────────────────────────
function toggleSolved(questionId) {
  const q = questions.find((item) => item.id === questionId);
  if (!q) return;
  const nextStatus = q.status === 'solved' ? 'unsolved' : 'solved';
  updateQuestionStatus(questionId, nextStatus);
}

function updateQuestionStatus(questionId, status) {
  const q = questions.find((item) => item.id === questionId);
  if (!q) return;
  q.status    = status;
  q.solved_at = status === 'solved' ? q.solved_at || new Date().toISOString() : null;
  saveQuestions();
  rerenderAll();
  showToast(`Question marked as ${status}.`, 'success');
}

function deleteQuestion(questionId) {
  questions = questions.filter((q) => q.id !== questionId);
  saveQuestions();
  rerenderAll();
  buildTopicOptions();
  showToast('Question deleted.', 'error');
}

// ── Form submission ───────────────────────────────────────────────────────────
function submitQuestion(event) {
  event.preventDefault();

  const title           = dom.qTitle.value.trim();
  const topic           = dom.qTopic.value.trim();
  const difficulty      = getSelectedData(dom.diffButtons,   'diff')   || 'easy';
  const status          = getSelectedData(dom.statusButtons, 'status') || 'unsolved';
  const leetcode_url    = dom.qUrl.value.trim();
  const time_complexity = dom.qTime.value.trim();
  const space_complexity= dom.qSpace.value.trim();
  const notes           = dom.qNotes.value.trim();
  const tags            = dom.qTags.value.split(',').map((t) => t.trim()).filter(Boolean);

  if (!title || !topic) {
    showToast('Title and topic are required.', 'error');
    return;
  }

  if (currentEditId) {
    // ── Edit existing question ──────────────────────────────────────────────
    const existing = questions.find((q) => q.id === currentEditId);
    if (!existing) return;
    existing.title           = title;
    existing.topic           = topic;
    existing.difficulty      = difficulty;
    existing.status          = status;
    existing.leetcode_url    = leetcode_url;
    existing.time_complexity = time_complexity;
    existing.space_complexity= space_complexity;
    existing.notes           = notes;
    existing.tags            = tags;
    // Preserve original solved_at if already set; clear it if un-solved
    existing.solved_at = status === 'solved'
      ? existing.solved_at || new Date().toISOString()
      : null;

    saveQuestions();
    showToast('Question updated.', 'success');
  } else {
    // ── Add new question ────────────────────────────────────────────────────
    const newQuestion = {
      id:             `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      topic,
      difficulty,
      status,
      notes,
      tags,
      leetcode_url,
      time_complexity,
      space_complexity,
      created_at: new Date().toISOString(),
      solved_at:  status === 'solved' ? new Date().toISOString() : null,
      attempts:   0,
    };
    questions.unshift(newQuestion);
    saveQuestions();
    showToast('Question added successfully! 🎉', 'success');
  }

  resetFormFields();
  rerenderAll();
  buildTopicOptions();
  navigate('questions');
}

// ── Navigation ────────────────────────────────────────────────────────────────
/**
 * FIX: HTML page element IDs are "page-dashboard", "page-questions", etc.
 * The nav items use data-page="dashboard", "questions", etc.
 * So we must compare page.id === `page-${pageId}`.
 */
function navigate(pageId) {
  dom.pages.forEach((page) => {
    page.classList.toggle('active', page.id === `page-${pageId}`);
  });
  dom.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  // Close mobile sidebar when navigating
  if (dom.sidebar.classList.contains('open')) {
    dom.sidebar.classList.remove('open');
    dom.hamburger.classList.remove('open');
  }

  // Render the appropriate page
  if (pageId === 'dashboard') { renderDashboard(); renderRecentSolved(); }
  if (pageId === 'questions') renderQuestions();
  if (pageId === 'analytics') renderAnalytics();
  if (pageId === 'weak')      renderWeakTopics();
}

// ── Event listeners ───────────────────────────────────────────────────────────
function attachListeners() {
  // Sidebar navigation
  dom.navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });

  // Hamburger (mobile)
  dom.hamburger.addEventListener('click', () => {
    const open = dom.sidebar.classList.toggle('open');
    dom.hamburger.classList.toggle('open', open);
  });

  // Difficulty toggle buttons — FIX: these had no click listeners
  dom.diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveButton(dom.diffButtons, 'diff', btn.dataset.diff);
    });
  });

  // Status toggle buttons — FIX: these had no click listeners
  dom.statusButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveButton(dom.statusButtons, 'status', btn.dataset.status);
    });
  });

  // Form
  dom.resetForm.addEventListener('click', (e) => {
    e.preventDefault();
    resetFormFields();
  });
  dom.submitQuestion.addEventListener('click', submitQuestion);

  // Filters
  dom.searchInput.addEventListener('input',  renderQuestions);
  dom.filterTopic.addEventListener('change', renderQuestions);
  dom.filterDifficulty.addEventListener('change', renderQuestions);
  dom.filterStatus.addEventListener('change',     renderQuestions);

  // Topic autocomplete
  dom.qTopic.addEventListener('input', updateTopicSuggestions);
  dom.qTopic.addEventListener('focus', updateTopicSuggestions);
  dom.qTopic.addEventListener('blur',  () =>
    setTimeout(() => dom.topicSuggestions.classList.remove('visible'), 180)
  );

  // Modal
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modalOverlay.classList.contains('open')) closeModal();
  });

  // Custom cursor
  document.addEventListener('mousemove', (e) => {
    dom.cursor.style.left         = `${e.clientX}px`;
    dom.cursor.style.top          = `${e.clientY}px`;
    dom.cursorFollower.style.left = `${e.clientX}px`;
    dom.cursorFollower.style.top  = `${e.clientY}px`;
  });
}

// ── Particles ─────────────────────────────────────────────────────────────────
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
  const canvas       = dom.particleCanvas;
  canvas.width       = window.innerWidth;
  canvas.height      = window.innerHeight;
  canvasSize.width   = canvas.width;
  canvasSize.height  = canvas.height;
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

  // Draw connecting lines between nearby particles
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

// ── Loader animation ──────────────────────────────────────────────────────────
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

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  questions = loadQuestions();
  attachListeners();
  resetFormFields();
  buildTopicOptions();
  rerenderAll();
  initializeParticles();
  playLoader();
}

document.addEventListener('DOMContentLoaded', init);