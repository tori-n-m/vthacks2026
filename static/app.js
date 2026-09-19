const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#document');
const fileName = document.querySelector('#file-name');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
let latestSummary = null;
let latestFilename = 'document';

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
    latestFilename = fileInput.files[0].name;
    renderResults(payload.summary, latestFilename);
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
  link.download = `${latestFilename.replace(/\.[^.]+$/, '')}-simplified.txt`;
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
  document.querySelector('#simplified-document').textContent = summary.simplified_document;
  results.hidden = false;
}

function fillList(selector, items) {
  const list = document.querySelector(selector);
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  }));
}
