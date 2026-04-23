/* DevPrep JavaScript App
   This script controls navigation, question storage, filters, modals,
   analytics, toast notifications, custom cursor behavior, loader animation,
   and a lightweight particle background.
*/

const STORAGE_KEY = 'devprep_questions_v1';

const dom = {
  loader: document.getElementById('loader'),
  loaderBar: document.getElementById('loaderBar'),
  sidebar: document.getElementById('sidebar'),
  hamburger: document.getElementById('hamburger'),
  navItems: Array.from(document.querySelectorAll('.nav-item')),
  pages: Array.from(document.querySelectorAll('.page')),
  cursor: document.getElementById('cursor'),
  cursorFollower: document.getElementById('cursorFollower'),
  ringProgress: document.getElementById('ringProgress'),
  ringPct: document.getElementById('ringPct'),
  statTotal: document.getElementById('statTotal'),
  statSolved: document.getElementById('statSolved'),
  statUnsolved: document.getElementById('statUnsolved'),
  statRevisit: document.getElementById('statRevisit'),
  easyBar: document.getElementById('easyBar'),
  mediumBar: document.getElementById('mediumBar'),
  hardBar: document.getElementById('hardBar'),
  easyCount: document.getElementById('easyCount'),
  mediumCount: document.getElementById('mediumCount'),
  hardCount: document.getElementById('hardCount'),
  recentList: document.getElementById('recentList'),
  questionsGrid: document.getElementById('questionsGrid'),
  analyticsGrid: document.getElementById('analyticsGrid'),
  weakGrid: document.getElementById('weakGrid'),
  searchInput: document.getElementById('searchInput'),
  filterTopic: document.getElementById('filterTopic'),
  filterDifficulty: document.getElementById('filterDifficulty'),
  filterStatus: document.getElementById('filterStatus'),
  qTitle: document.getElementById('qTitle'),
  qTopic: document.getElementById('qTopic'),
  qUrl: document.getElementById('qUrl'),
  qTime: document.getElementById('qTime'),
  qSpace: document.getElementById('qSpace'),
  qTags: document.getElementById('qTags'),
  qNotes: document.getElementById('qNotes'),
  diffButtons: Array.from(document.querySelectorAll('.diff-btn')),
  statusButtons: Array.from(document.querySelectorAll('.status-btn')),
  resetForm: document.getElementById('resetForm'),
  submitQuestion: document.getElementById('submitQuestion'),
  toastContainer: document.getElementById('toastContainer'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalClose: document.getElementById('modalClose'),
  modalContent: document.getElementById('modalContent'),
  topicSuggestions: document.getElementById('topicSuggestions'),
  particleCanvas: document.getElementById('particleCanvas'),
};

let questions = [];
let currentEditId = null;
let particles = [];
let canvasContext = null;
let canvasSize = { width: 0, height: 0 };

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

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function escapeHTML(value) {
  return value
    ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : '';
}

function getSelectedData(buttons, key) {
  const active = buttons.find((button) => button.classList.contains('active'));
  return active ? active.dataset[key] : null;
}

function setActiveButton(buttons, key, value) {
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset[key] === value);
  });
}

function resetFormFields() {
  currentEditId = null;
  dom.qTitle.value = '';
  dom.qTopic.value = '';
  dom.qUrl.value = '';
  dom.qTime.value = '';
  dom.qSpace.value = '';
  dom.qTags.value = '';
  dom.qNotes.value = '';
  setActiveButton(dom.diffButtons, 'diff', 'easy');
  setActiveButton(dom.statusButtons, 'status', 'unsolved');
  dom.submitQuestion.querySelector('.btn-text').textContent = 'Add Question';
}

function buildTopicOptions() {
  const topics = Array.from(new Set(questions.map((item) => item.topic).filter(Boolean))).sort();
  dom.filterTopic.innerHTML = [`<option value="">All Topics</option>`, ...topics.map((topic) => `<option value="${escapeHTML(topic)}">${escapeHTML(topic)}</option>`)].join('');
}

function getFilteredQuestions() {
  const searchTerm = dom.searchInput.value.trim().toLowerCase();
  const topic = dom.filterTopic.value;
  const difficulty = dom.filterDifficulty.value;
  const status = dom.filterStatus.value;

  return questions.filter((question) => {
    const matchesSearch = !searchTerm || [question.title, question.topic, question.tags.join(' ')].some((field) => field.toLowerCase().includes(searchTerm));
    const matchesTopic = !topic || question.topic === topic;
    const matchesDifficulty = !difficulty || question.difficulty === difficulty;
    const matchesStatus = !status || question.status === status;
    return matchesSearch && matchesTopic && matchesDifficulty && matchesStatus;
  });
}

function renderDashboard() {
  const total = questions.length;
  const solved = questions.filter((question) => question.status === 'solved').length;
  const unsolved = questions.filter((question) => question.status === 'unsolved').length;
  const revisit = questions.filter((question) => question.status === 'revisit').length;

  const byDifficulty = {
    easy: questions.filter((question) => question.difficulty === 'easy'),
    medium: questions.filter((question) => question.difficulty === 'medium'),
    hard: questions.filter((question) => question.difficulty === 'hard'),
  };

  const solvedByDifficulty = {
    easy: byDifficulty.easy.filter((q) => q.status === 'solved').length,
    medium: byDifficulty.medium.filter((q) => q.status === 'solved').length,
    hard: byDifficulty.hard.filter((q) => q.status === 'solved').length,
  };

  const progress = total ? Math.round((solved / total) * 100) : 0;
  const circumference = 2 * Math.PI * 80;

  dom.statTotal.textContent = total;
  dom.statSolved.textContent = solved;
  dom.statUnsolved.textContent = unsolved;
  dom.statRevisit.textContent = revisit;
  dom.ringPct.textContent = `${progress}%`;
  dom.ringProgress.style.strokeDasharray = circumference;
  dom.ringProgress.style.strokeDashoffset = circumference - (progress / 100) * circumference;

  dom.easyBar.style.width = byDifficulty.easy.length ? `${Math.round((solvedByDifficulty.easy / byDifficulty.easy.length) * 100)}%` : '0%';
  dom.mediumBar.style.width = byDifficulty.medium.length ? `${Math.round((solvedByDifficulty.medium / byDifficulty.medium.length) * 100)}%` : '0%';
  dom.hardBar.style.width = byDifficulty.hard.length ? `${Math.round((solvedByDifficulty.hard / byDifficulty.hard.length) * 100)}%` : '0%';

  dom.easyCount.textContent = `${solvedByDifficulty.easy}/${byDifficulty.easy.length}`;
  dom.mediumCount.textContent = `${solvedByDifficulty.medium}/${byDifficulty.medium.length}`;
  dom.hardCount.textContent = `${solvedByDifficulty.hard}/${byDifficulty.hard.length}`;
}

function renderRecentSolved() {
  const recent = questions
    .filter((question) => question.solved_at)
    .sort((a, b) => new Date(b.solved_at) - new Date(a.solved_at))
    .slice(0, 5);

  if (!recent.length) {
    dom.recentList.innerHTML = '<div class="empty-state">No solved questions yet. Start grinding! 💪</div>';
    return;
  }

  dom.recentList.innerHTML = recent.map((question) => `
    <div class="recent-item">
      <div class="recent-item-left">
        <div class="recent-title">${escapeHTML(question.title)}</div>
        <div class="recent-topic">${escapeHTML(question.topic)} · ${escapeHTML(question.difficulty)}</div>
      </div>
      <div class="recent-date">${formatDate(question.solved_at)}</div>
    </div>
  `).join('');
}

function renderQuestions() {
  const filtered = getFilteredQuestions();

  if (!filtered.length) {
    dom.questionsGrid.innerHTML = '<div class="empty-state">No questions found for the current filters. Add a question to get started.</div>';
    return;
  }

  dom.questionsGrid.innerHTML = filtered.map((question) => {
    const statusClass = question.status === 'solved' ? 'status-solved' : question.status === 'revisit' ? 'status-revisit' : 'status-unsolved';
    const notes = question.notes ? escapeHTML(question.notes).slice(0, 140) : 'No notes added yet.';
    const tags = question.tags.map((tag) => `<span class="q-tag">${escapeHTML(tag)}</span>`).join('');

    return `
      <article class="q-card ${escapeHTML(question.difficulty)}" data-id="${question.id}">
        <div class="q-card-header">
          <div>
            <h3 class="q-title">${escapeHTML(question.title)}</h3>
            <div class="q-meta">
              <span class="q-badge">${escapeHTML(question.topic)}</span>
              <span class="q-badge ${escapeHTML(question.difficulty)}-badge">${escapeHTML(question.difficulty)}</span>
            </div>
          </div>
          <span class="q-status ${statusClass}">${escapeHTML(question.status)}</span>
        </div>
        <p class="q-notes">${notes}${question.notes.length > 140 ? '...' : ''}</p>
        <div class="q-tags">${tags}</div>
        <div class="q-card-footer">
          <div class="q-complexity">${escapeHTML(question.time_complexity || 'O(?), O(?)')}</div>
          <div class="q-actions">
            <button class="q-btn view-btn">View</button>
            <button class="q-btn solve-btn">${question.status === 'solved' ? 'Mark Unsolved' : 'Mark Solved'}</button>
            <button class="q-btn delete-btn">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  dom.questionsGrid.querySelectorAll('.q-card').forEach((card) => {
    const questionId = card.dataset.id;
    card.querySelector('.view-btn').addEventListener('click', () => openModal(questionId));
    card.querySelector('.solve-btn').addEventListener('click', () => toggleSolved(questionId));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteQuestion(questionId));
  });
}

function renderAnalytics() {
  const total = questions.length;
  const solved = questions.filter((item) => item.status === 'solved').length;
  const unsolved = questions.filter((item) => item.status === 'unsolved').length;
  const revisit = questions.filter((item) => item.status === 'revisit').length;

  const topicStats = {};
  questions.forEach((question) => {
    if (!topicStats[question.topic]) {
      topicStats[question.topic] = { total: 0, solved: 0 };
    }
    topicStats[question.topic].total += 1;
    if (question.status === 'solved') topicStats[question.topic].solved += 1;
  });

  const rows = Object.entries(topicStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([topic, stats]) => {
      const pct = stats.total ? Math.round((stats.solved / stats.total) * 100) : 0;
      return `
        <div class="topic-row">
          <div class="topic-name">${escapeHTML(topic)}</div>
          <div class="topic-bar-track"><div class="topic-bar-fill" style="width:${pct}%"></div></div>
          <div class="topic-pct">${pct}%</div>
        </div>
      `;
    }).join('');

  dom.analyticsGrid.innerHTML = `
    <div class="analytics-card">
      <h3 class="analytics-card-title">Progress Overview</h3>
      <p>Track your completion, unsolved backlog, and revisit goals.</p>
      <div style="margin-top:1rem; color:var(--text2); line-height:1.75;">
        <div><strong>Total:</strong> ${total}</div>
        <div><strong>Solved:</strong> ${solved}</div>
        <div><strong>Unsolved:</strong> ${unsolved}</div>
        <div><strong>Revisit:</strong> ${revisit}</div>
        <div><strong>Completion:</strong> ${total ? Math.round((solved / total) * 100) : 0}%</div>
      </div>
    </div>
    <div class="analytics-card">
      <h3 class="analytics-card-title">Top Topics</h3>
      ${rows || '<div class="empty-state">Add questions to see the topics you practice most.</div>'}
    </div>
  `;
}

function renderWeakTopics() {
  const stats = {};
  questions.forEach((question) => {
    if (!stats[question.topic]) {
      stats[question.topic] = { total: 0, solved: 0, easy: 0, medium: 0, hard: 0 };
    }
    stats[question.topic].total += 1;
    stats[question.topic].solved += question.status === 'solved' ? 1 : 0;
    stats[question.topic][question.difficulty] += 1;
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
      <div class="weak-bar-track"><div class="weak-bar-fill" style="width:${item.solvedPct}%"></div></div>
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

function updateTopicSuggestions() {
  const value = dom.qTopic.value.trim().toLowerCase();
  const topics = Array.from(new Set(questions.map((question) => question.topic))).filter(Boolean);
  const filtered = topics.filter((topic) => topic.toLowerCase().includes(value) && topic.toLowerCase() !== value).slice(0, 6);

  if (!value || !filtered.length) {
    dom.topicSuggestions.innerHTML = '';
    dom.topicSuggestions.classList.remove('visible');
    return;
  }

  dom.topicSuggestions.innerHTML = filtered.map((topic) => `<button type="button" class="topic-suggestion-item">${escapeHTML(topic)}</button>`).join('');
  dom.topicSuggestions.classList.add('visible');
  dom.topicSuggestions.querySelectorAll('.topic-suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      dom.qTopic.value = item.textContent;
      dom.topicSuggestions.classList.remove('visible');
    });
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2200);
}

function openModal(questionId) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) return;

  dom.modalContent.innerHTML = `
    <div class="modal-title">${escapeHTML(question.title)}</div>
    <div class="modal-meta">
      <span class="q-badge">${escapeHTML(question.topic)}</span>
      <span class="q-badge ${question.difficulty}-badge">${escapeHTML(question.difficulty)}</span>
      <span class="q-badge ${question.status === 'solved' ? 'status-solved' : question.status === 'revisit' ? 'status-revisit' : 'status-unsolved'}">${escapeHTML(question.status)}</span>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Notes & Approach</div>
      <div class="modal-section-body">${escapeHTML(question.notes) || 'No notes available.'}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Question Details</div>
      <div class="modal-section-body">
        <strong>Topic:</strong> ${escapeHTML(question.topic)}<br>
        <strong>Difficulty:</strong> ${escapeHTML(question.difficulty)}<br>
        <strong>Status:</strong> ${escapeHTML(question.status)}<br>
        <strong>Created:</strong> ${formatDate(question.created_at)}<br>
        <strong>Solved:</strong> ${formatDate(question.solved_at)}<br>
        <strong>Time:</strong> ${escapeHTML(question.time_complexity) || 'Unknown'}<br>
        <strong>Space:</strong> ${escapeHTML(question.space_complexity) || 'Unknown'}<br>
      </div>
    </div>
    ${question.leetcode_url ? `<a class="modal-link" href="${escapeHTML(question.leetcode_url)}" target="_blank" rel="noreferrer">Open problem link</a>` : ''}
    <div class="modal-actions">
      <button class="modal-btn modal-btn-solve">${question.status === 'solved' ? 'Mark Unsolved' : 'Mark Solved'}</button>
      <button class="modal-btn modal-btn-revisit">Mark Revisit</button>
      <button class="modal-btn modal-btn-delete">Delete</button>
      <button class="modal-btn" id="modalEditBtn">Edit</button>
    </div>
  `;

  dom.modalOverlay.classList.add('open');

  dom.modalContent.querySelector('.modal-btn-solve').addEventListener('click', () => {
    toggleSolved(question.id);
    closeModal();
  });

  dom.modalContent.querySelector('.modal-btn-revisit').addEventListener('click', () => {
    updateQuestionStatus(question.id, 'revisit');
    closeModal();
  });

  dom.modalContent.querySelector('.modal-btn-delete').addEventListener('click', () => {
    deleteQuestion(question.id);
    closeModal();
  });

  dom.modalContent.querySelector('#modalEditBtn').addEventListener('click', () => {
    fillForm(question.id);
    closeModal();
    navigate('add');
  });
}

function closeModal() {
  dom.modalOverlay.classList.remove('open');
}

function toggleSolved(questionId) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) return;
  const nextStatus = question.status === 'solved' ? 'unsolved' : 'solved';
  updateQuestionStatus(questionId, nextStatus);
}

function updateQuestionStatus(questionId, status) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) return;
  question.status = status;
  question.solved_at = status === 'solved' ? question.solved_at || new Date().toISOString() : null;
  saveQuestions();
  rerenderAll();
  showToast(`Question marked ${status}.`, 'success');
}

function deleteQuestion(questionId) {
  questions = questions.filter((question) => question.id !== questionId);
  saveQuestions();
  rerenderAll();
  showToast('Question deleted.', 'error');
}

function fillForm(questionId) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) return;

  currentEditId = questionId;
  dom.qTitle.value = question.title;
  dom.qTopic.value = question.topic;
  dom.qUrl.value = question.leetcode_url || '';
  dom.qTime.value = question.time_complexity || '';
  dom.qSpace.value = question.space_complexity || '';
  dom.qTags.value = question.tags.join(', ');
  dom.qNotes.value = question.notes || '';
  setActiveButton(dom.diffButtons, 'diff', question.difficulty);
  setActiveButton(dom.statusButtons, 'status', question.status);
  dom.submitQuestion.querySelector('.btn-text').textContent = 'Save Changes';
}

function submitQuestion(event) {
  event.preventDefault();
  const title = dom.qTitle.value.trim();
  const topic = dom.qTopic.value.trim();
  const difficulty = getSelectedData(dom.diffButtons, 'diff') || 'easy';
  const status = getSelectedData(dom.statusButtons, 'status') || 'unsolved';
  const leetcode_url = dom.qUrl.value.trim();
  const time_complexity = dom.qTime.value.trim();
  const space_complexity = dom.qSpace.value.trim();
  const notes = dom.qNotes.value.trim();
  const tags = dom.qTags.value.split(',').map((tag) => tag.trim()).filter(Boolean);

  if (!title || !topic) {
    showToast('Title and topic are required.', 'error');
    return;
  }

  if (currentEditId) {
    const existing = questions.find((question) => question.id === currentEditId);
    if (!existing) return;
    existing.title = title;
    existing.topic = topic;
    existing.difficulty = difficulty;
    existing.status = status;
    existing.leetcode_url = leetcode_url;
    existing.time_complexity = time_complexity;
    existing.space_complexity = space_complexity;
    existing.notes = notes;
    existing.tags = tags;
    existing.solved_at = status === 'solved' ? existing.solved_at || new Date().toISOString() : null;
    saveQuestions();
    showToast('Question updated.', 'success');
  } else {
    const newQuestion = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
      solved_at: status === 'solved' ? new Date().toISOString() : null,
      attempts: 0,
    };
    questions.unshift(newQuestion);
    saveQuestions();
    showToast('Question added successfully.', 'success');
  }

  resetFormFields();
  rerenderAll();
  buildTopicOptions();
  navigate('questions');
}

function rerenderAll() {
  renderDashboard();
  renderRecentSolved();
  renderQuestions();
  renderAnalytics();
  renderWeakTopics();
}

function attachListeners() {
  dom.navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(item.dataset.page);
    });
  });

  dom.hamburger.addEventListener('click', () => {
    const open = dom.sidebar.classList.toggle('open');
    dom.hamburger.classList.toggle('open', open);
  });

  dom.resetForm.addEventListener('click', (event) => {
    event.preventDefault();
    resetFormFields();
  });

  dom.submitQuestion.addEventListener('click', submitQuestion);
  dom.searchInput.addEventListener('input', renderQuestions);
  dom.filterTopic.addEventListener('change', renderQuestions);
  dom.filterDifficulty.addEventListener('change', renderQuestions);
  dom.filterStatus.addEventListener('change', renderQuestions);
  dom.qTopic.addEventListener('input', updateTopicSuggestions);
  dom.qTopic.addEventListener('focus', updateTopicSuggestions);
  dom.qTopic.addEventListener('blur', () => setTimeout(() => dom.topicSuggestions.classList.remove('visible'), 180));

  dom.modalClose.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (event) => {
    if (event.target === dom.modalOverlay) closeModal();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.modalOverlay.classList.contains('open')) closeModal();
  });

  document.addEventListener('mousemove', (event) => {
    dom.cursor.style.left = `${event.clientX}px`;
    dom.cursor.style.top = `${event.clientY}px`;
    dom.cursorFollower.style.left = `${event.clientX}px`;
    dom.cursorFollower.style.top = `${event.clientY}px`;
  });
}

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
  const canvas = dom.particleCanvas;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvasSize.width = canvas.width;
  canvasSize.height = canvas.height;
}

function createParticle() {
  return {
    x: Math.random() * canvasSize.width,
    y: Math.random() * canvasSize.height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    radius: 1 + Math.random() * 1.8,
  };
}

function updateParticles() {
  if (!canvasContext) return;
  canvasContext.clearRect(0, 0, canvasSize.width, canvasSize.height);
  canvasContext.fillStyle = 'rgba(0,245,212,0.08)';
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x < 0 || particle.x > canvasSize.width) particle.vx *= -1;
    if (particle.y < 0 || particle.y > canvasSize.height) particle.vy *= -1;
    canvasContext.beginPath();
    canvasContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    canvasContext.fill();
  });

  const maxDistance = 120;
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const a = particles[i];
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDistance) {
        canvasContext.strokeStyle = `rgba(0,245,212,${1 - dist / maxDistance})`;
        canvasContext.lineWidth = 1;
        canvasContext.beginPath();
        canvasContext.moveTo(a.x, a.y);
        canvasContext.lineTo(b.x, b.y);
        canvasContext.stroke();
      }
    }
  }

  requestAnimationFrame(updateParticles);
}

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

function navigate(pageId) {
  dom.pages.forEach((page) => page.classList.toggle('active', page.id === pageId));
  dom.navItems.forEach((item) => item.classList.toggle('active', item.dataset.page === pageId));
  if (dom.sidebar.classList.contains('open')) {
    dom.sidebar.classList.remove('open');
    dom.hamburger.classList.remove('open');
  }
  if (pageId === 'dashboard') rerenderAll();
  if (pageId === 'questions') renderQuestions();
  if (pageId === 'analytics') renderAnalytics();
  if (pageId === 'weak') renderWeakTopics();
}

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
