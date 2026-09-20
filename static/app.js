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
  try {
    const response = await fetch('/summarize', { method: 'POST', body: data });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not process the document.');
    latestSummary = payload.summary;
    latestFile = fileInput.files[0];
    latestFilename = fileInput.files[0].name;
    renderResults(payload.summary, latestFilename);
    document.querySelector('#tutor-chat').hidden = !document.querySelector('#socratic-tutor').checked;
    status.textContent = 'Done. Your summary and rewrite are ready.';
  } catch (error) {
    status.textContent = error.message;
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

document.querySelector('#download-json').addEventListener('click', () => {
  downloadBlob(JSON.stringify({ filename: latestFilename, summary: latestSummary }, null, 2), 'application/json', '-results.json');
});

document.querySelector('#download-csv').addEventListener('click', () => {
  const rows = [['section', 'content'], ['main idea', latestSummary.one_sentence], ['detailed summary', latestSummary.detailed_summary]];
  latestSummary.key_points.forEach((item) => rows.push(['key point', item]));
  latestSummary.image_descriptions.forEach((item) => rows.push(['image description', item]));
  latestSummary.next_steps.forEach((item) => rows.push(['next step', item]));
  rows.push(['full simplified document', latestSummary.simplified_document]);
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(csv, 'text/csv;charset=utf-8', '-results.csv');
});

function downloadBlob(content, type, suffix) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${latestFilename.replace(/\.[^.]+$/, '')}${suffix}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

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
