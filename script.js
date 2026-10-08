'use strict';
const { questions, types, evaluate } = diagnosis;
let index = 0;
let answers = [];
const $ = id => document.getElementById(id);

function show(name, focusId) {
  document.querySelectorAll('.screen').forEach(screen => { screen.hidden = screen.id !== `${name}-screen`; });
  window.scrollTo({ top: 0, behavior: 'instant' });
  $(focusId).focus({ preventScroll: true });
}
function renderQuestion() {
  const [text, choices] = questions[index];
  $('count').textContent = `${index + 1}／${questions.length}`;
  $('progress').value = index + 1;
  $('question-text').textContent = text;
  $('answers').replaceChildren();
  choices.forEach(([labelText], choice) => {
    const label = document.createElement('label');
    label.className = 'answer';
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'answer'; radio.value = choice;
    radio.checked = answers[index] === choice;
    const span = document.createElement('span');
    span.textContent = labelText;
    radio.addEventListener('change', () => { answers[index] = choice; $('next-button').disabled = false; });
    label.append(radio, span);
    $('answers').append(label);
  });
  $('next-button').disabled = answers[index] === undefined;
  $('next-button').textContent = index === questions.length - 1 ? '結果を見る →' : '次へ →';
  show('quiz', 'question-text');
}
function clearResult() {
  ['result-title', 'result-message', 'result-step', 'result-self', 'tie-note'].forEach(id => $(id).replaceChildren());
  $('result-image').removeAttribute('src');
  $('result-image').alt = '';
  $('tie-note').hidden = true;
}
function reset() { index = 0; answers = []; clearResult(); show('start', 'start-title'); }
function finish() {
  const result = evaluate(answers);
  const type = types[result.main];
  $('result-title').textContent = type.title;
  $('result-image').src = type.image;
  $('result-image').alt = type.alt;
  $('result-message').replaceChildren(...type.message.map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
  $('result-step').textContent = type.step;
  $('result-self').textContent = type.self;
  $('tie-note').replaceChildren(...result.others.map(key => { const p = document.createElement('p'); p.textContent = `${types[key].title}も、あなたの中にあります`; return p; }));
  $('tie-note').hidden = result.others.length === 0;
  show('result', 'result-title');
}
$('start-button').addEventListener('click', () => { index = 0; answers = []; clearResult(); renderQuestion(); });
$('question-form').addEventListener('submit', event => {
  event.preventDefault();
  if (answers[index] === undefined) return;
  if (index < questions.length - 1) { index += 1; renderQuestion(); } else finish();
});
$('back-button').addEventListener('click', () => { if (index > 0) { index -= 1; renderQuestion(); } else show('start', 'start-title'); });
$('retry-button').addEventListener('click', reset);
