const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#document');
const fileName = document.querySelector('#file-name');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const dyslexiaFont = document.querySelector('#dyslexia-font');
let latestSummary = null;
let latestFilename = 'document';
let latestFile = null;
const tutorHistory = [];
const CACHE_PREFIX = 'reframe-result:';
const METRICS_KEY = 'reframe-metrics';

dyslexiaFont.addEventListener('change', () => {
  document.body.classList.toggle('opendyslexic', dyslexiaFont.checked);
});

fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files[0]?.name || 'Drop a file here or browse';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!fileInput.files[0]) return;
  status.textContent = 'Reading and simplifying your document...';
  results.hidden = true;
  const data = new FormData(form);
  const requestStarted = performance.now();
  const cacheKey = getCacheKey(fileInput.files[0]);
  try {
    let payload = readCachedResult(cacheKey);
    if (!payload) {
      const response = await fetch('/summarize', { method: 'POST', body: data });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not process the document.');
      safeStorageSet(cacheKey, payload);
    }
    latestSummary = payload.summary;
    latestFile = fileInput.files[0];
    latestFilename = fileInput.files[0].name;
    renderResults(payload.summary, latestFilename);
    document.querySelector('#tutor-chat').hidden = !document.querySelector('#socratic-tutor').checked;
    updateMetrics(payload.summary, requestStarted);
    status.textContent = 'Done. Your summary and rewrite are ready.';
  } catch (error) {
    const fallback = buildFallbackResult(fileInput.files[0]);
    latestSummary = fallback.summary;
    latestFile = fileInput.files[0];
    latestFilename = fileInput.files[0].name;
    renderResults(fallback.summary, latestFilename);
    updateMetrics(fallback.summary, requestStarted);
    document.querySelector('#tutor-chat').hidden = true;
    status.textContent = `Live AI unavailable: ${error.message} Demo fallback loaded.`;
  }
});

document.querySelector('#download-json').addEventListener('click', () => {
  downloadBlob(JSON.stringify({ filename: latestFilename, summary: latestSummary }, null, 2), 'application/json', '-results.json');
});

document.querySelector('#download-csv').addEventListener('click', () => {
  const rows = [['section', 'content'], ['main idea', latestSummary.one_sentence], ['detailed summary', latestSummary.detailed_summary]];
  latestSummary.key_points.forEach((item) => rows.push(['key point', item]));
  latestSummary.image_descriptions.forEach((item) => rows.push(['image description', item]));
  latestSummary.next_steps.forEach((item) => rows.push(['next step', item]));
  rows.push(['full simplified document', latestSummary.simplified_document]);
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  downloadBlob(csv, 'text/csv;charset=utf-8', '-results.csv');
});

document.querySelector('#copy-share-link').addEventListener('click', async () => {
  const shareId = `share-${Date.now()}`;
  safeStorageSet(shareId, { filename: latestFilename, summary: latestSummary });
  const link = `${window.location.origin}${window.location.pathname}#${shareId}`;
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = 'Share link copied. It opens this saved result in this browser.';
  } catch {
    status.textContent = `Copy this share link: ${link}`;
  }
});

document.querySelector('#download-button').addEventListener('click', async () => {
  const response = await fetch('/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: latestFilename, summary: latestSummary })
  });
  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${latestFilename.replace(/\.[^.]+$/, '')}-simplified.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
});

function renderResults(summary, filename) {
  document.querySelector('#result-title').textContent = filename;
  document.querySelector('#one-sentence').textContent = summary.one_sentence;
  fillList('#key-points', summary.key_points);
  document.querySelector('#detailed-summary').textContent = summary.detailed_summary;
  fillList('#image-descriptions', summary.image_descriptions.length ? summary.image_descriptions : ['None requested or found']);
  fillList('#important-words', summary.important_words.map((item) => `${item.word}: ${item.meaning}`));
  fillList('#next-steps', summary.next_steps.length ? summary.next_steps : ['None listed']);
  fillTutorQuestions(summary.tutor_questions);
  document.querySelector('#simplified-document').textContent = summary.simplified_document;
  results.hidden = false;
}

document.querySelector('#tutor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const questionInput = document.querySelector('#tutor-question');
  const tutorStatus = document.querySelector('#tutor-status');
  const question = questionInput.value.trim();
  if (!latestFile || !question) return;
  tutorStatus.textContent = 'Tutor is thinking...';
  const data = new FormData();
  data.append('document', latestFile);
  data.append('question', question);
  data.append('history', JSON.stringify(tutorHistory));
  try {
    const response = await fetch('/tutor', { method: 'POST', body: data });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'The tutor could not answer.');
    addTutorMessage('student', question);
    addTutorMessage('tutor', `${payload.reply.response}\n\nNext question: ${payload.reply.next_question}\nHint: ${payload.reply.hint}`);
    tutorHistory.push({ role: 'student', content: question }, { role: 'tutor', content: payload.reply.response });
    questionInput.value = '';
    tutorStatus.textContent = '';
  } catch (error) {
    tutorStatus.textContent = error.message;
  }
});

function addTutorMessage(role, content) {
  const message = document.createElement('div');
  message.className = `chat-message ${role}`;
  message.textContent = content;
  document.querySelector('#chat-messages').append(message);
}

function fillList(selector, items) {
  const list = document.querySelector(selector);
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  }));
}

function fillTutorQuestions(questions) {
  const list = document.querySelector('#tutor-questions');
  const items = questions.length ? questions : [{
    question: 'Tutor mode was not selected for this document.',
    hint: 'Select the option before generating a new result.',
    skill: 'study planning'
  }];
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    const question = document.createElement('strong');
    question.textContent = item.question;
    const hint = document.createElement('p');
    hint.textContent = `Hint: ${item.hint} Skill: ${item.skill}`;
    li.append(question, hint);
    return li;
  }));
}

function getCacheKey(file) {
  const options = [document.querySelector('#style').value, document.querySelector('#describe-images').checked, document.querySelector('#socratic-tutor').checked];
  return `${CACHE_PREFIX}${file.name}:${file.size}:${file.lastModified}:${options.join(':')}`;
}

function readCachedResult(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function updateMetrics(summary, startedAt) {
  const metrics = JSON.parse(localStorage.getItem(METRICS_KEY) || '{"requests":0,"minutes":0}');
  metrics.requests += 1;
  metrics.minutes += Math.max(1, Math.round((summary.simplified_document.length / 900) + 2));
  safeStorageSet(METRICS_KEY, metrics);
  document.querySelector('#requests-processed').textContent = metrics.requests;
  document.querySelector('#time-saved').textContent = `${metrics.minutes} min`;
  document.querySelector('#confidence-score').textContent = `${calculateConfidence(summary)}%`;
}

function calculateConfidence(summary) {
  let score = 80;
  if (summary.one_sentence) score += 5;
  if (summary.detailed_summary?.length > 100) score += 5;
  if (summary.simplified_document?.length > 100) score += 5;
  if (summary.key_points?.length) score += 5;
  return Math.min(score, 99);
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

function downloadBlob(content, type, suffix) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${latestFilename.replace(/\.[^.]+$/, '')}${suffix}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildFallbackResult(file) {
  const name = file?.name || 'your document';
  return { ok: true, summary: {
    one_sentence: `Upload ${name} again when the AI connection is available for a document-specific result.`,
    key_points: ['Your document was received.', 'The live AI service is temporarily unavailable.'],
    detailed_summary: 'This demo fallback keeps the interface usable while the AI service is unavailable. No document-specific claims were generated.',
    important_words: [],
    next_steps: ['Try generating again when the AI service is available.'],
    image_descriptions: [],
    tutor_questions: [],
    simplified_document: 'A document-specific simplified version will appear here after the AI service reconnects.'
  }};
}

function restoreSharedResult() {
  const shareId = window.location.hash.slice(1);
  if (!shareId) return;
  const saved = readCachedResult(shareId);
  if (saved?.summary) {
    latestSummary = saved.summary;
    latestFilename = saved.filename || 'shared document';
    renderResults(latestSummary, latestFilename);
    updateMetrics(latestSummary, performance.now());
    status.textContent = 'Saved result restored from this browser.';
  }
}

restoreSharedResult();
