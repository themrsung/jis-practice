import { parseCorpus, parseLine, tokensToRomaji, composeKana, randomDrillEntry, toHiragana, KANA_LAYOUT, ASCII_LAYOUT } from './engine.js';
import { Keyboard, KEYBOARD_MODES } from './keyboard.js';

const CORPORA = [
  { id: 'legal', label: 'Legal — 日本の法令', file: 'corpus/legal.txt' },
  { id: 'popculture', label: 'Pop culture — 残酷な天使のテーゼ', file: 'corpus/popculture.txt' },
  { id: 'coding', label: 'Coding — Java Vector3', file: 'corpus/coding.txt' },
  { id: 'english', label: 'English — US Constitution (カタカナ)', file: 'corpus/english.txt' },
  { id: 'nonenglish', label: 'Non-English — Weimar Art. 48 (カタカナ)', file: 'corpus/nonenglish.txt' },
  { id: 'german', label: 'German — Beethoven 9 「歓喜の歌」 (カタカナ)', file: 'corpus/german.txt' },
  { id: 'korean', label: 'Korean — KOSPI 200', file: 'corpus/korean.txt' },
  { id: 'drill', label: 'Random kana drill', drill: true },
];
const UPLOAD_KEY = 'jis-practice-upload';
const PREFS_KEY = 'jis-practice-prefs';

const $ = (id) => document.getElementById(id);
const store = {
  get(area, k) { try { return JSON.parse(area.getItem(k)); } catch { return null; } },
  set(area, k, v) { try { area.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const state = {
  corpus: null, // { id, title, meta, entries, drill? }
  lineIdx: 0,
  line: null, // { entry, indent, tokens, flat, starts }
  pos: 0,
  errorAt: new Set(), // flat positions that had a miss
  stats: { total: 0, correct: 0, lines: 0 },
  cache: new Map(),
};

const prefs = Object.assign(
  { romaji: false, furigana: true, en: false, ko: false, next: true, ansi: true, kb: 'hiragana' },
  store.get(localStorage, PREFS_KEY) || {},
);

const keyboard = new Keyboard($('keyboard'));
window.jis = state; // for debugging from the console

// ---------- corpus loading ----------
async function loadCorpus(def) {
  if (def.drill) return { id: 'drill', title: 'ランダムかなドリル', meta: { title_en: 'Random hiragana–katakana pairs' }, entries: [], drill: true };
  if (state.cache.has(def.id)) return state.cache.get(def.id);
  if (def.upload) return def.corpus;
  const res = await fetch(def.file);
  if (!res.ok) throw new Error(`failed to load ${def.file}`);
  const { meta, entries } = parseCorpus(await res.text());
  const c = { id: def.id, title: meta.title || def.label, meta, entries };
  state.cache.set(def.id, c);
  return c;
}

function corpusDefs() {
  const up = store.get(sessionStorage, UPLOAD_KEY);
  return up ? [...CORPORA, { id: 'upload', label: `Uploaded — ${up.name}`, upload: true, corpus: up.corpus }] : CORPORA;
}

function fillCorpusSelect(selected) {
  const sel = $('corpus');
  sel.textContent = '';
  for (const d of corpusDefs()) sel.append(new Option(d.label, d.id, false, d.id === selected));
}

async function selectCorpus(id, { randomLine = false } = {}) {
  const def = corpusDefs().find((d) => d.id === id) || CORPORA[0];
  setStatus('');
  try {
    state.corpus = await loadCorpus(def);
  } catch (e) {
    setStatus(e.message, true);
    return;
  }
  fillCorpusSelect(def.id);
  const n = state.corpus.entries.length;
  state.lineIdx = randomLine && n ? Math.floor(Math.random() * n) : 0;
  $('corpus-title').textContent = state.corpus.title;
  $('practice').classList.toggle('mono', state.corpus.id === 'coding');
  const m = state.corpus.meta || {};
  const src = $('source');
  src.textContent = '';
  if (m.source) {
    src.append('Source: ');
    m.source.split('\n').forEach((u, i) => {
      if (i) src.append(' · ');
      const url = u.match(/https?:\/\/\S+/)?.[0];
      if (url) { const a = document.createElement('a'); a.href = url; a.textContent = u; a.target = '_blank'; a.rel = 'noopener'; src.append(a); }
      else src.append(u);
    });
  }
  if (m.note) src.append(document.createElement('br'), m.note.replace(/\n/g, ' '));
  startLine();
}

// ---------- line state ----------
function startLine() {
  const c = state.corpus;
  const entry = c.drill ? randomDrillEntry() : c.entries[state.lineIdx];
  if (!entry) { setStatus('This corpus has no lines.', true); return; }
  const { indent, tokens } = parseLine(entry.jp);
  const flat = [];
  const starts = [];
  tokens.forEach((t, ti) => {
    starts.push(flat.length);
    t.keys.forEach((key) => flat.push({ key, ti, mode: t.mode }));
  });
  starts.push(flat.length);
  state.line = { entry, indent, tokens, flat, starts };
  state.pos = 0;
  state.errorAt = new Set();
  if (!flat.length) { advance(); return; }
  render();
}

function advance() {
  state.stats.lines++;
  if (!state.corpus.drill) state.lineIdx = (state.lineIdx + 1) % state.corpus.entries.length; // loop
  startLine();
}

function step(delta) {
  const n = state.corpus.entries.length || 1;
  state.lineIdx = (state.lineIdx + delta + n) % n;
  startLine();
}

// ---------- rendering ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function tokenState(ti) {
  const a = state.line.starts[ti], b = state.line.starts[ti + 1];
  if (state.pos >= b) return 'done'; // also covers keyless (skip) tokens once reached
  return state.pos >= a ? 'cur' : 'todo';
}

function render() {
  const { tokens, indent, entry, starts } = state.line;
  const target = $('target');
  const typed = $('typed');
  target.textContent = '';
  typed.textContent = '';
  if (indent) { target.append(el('span', 'indent', indent)); typed.append(el('span', 'indent', indent)); }

  tokens.forEach((t, ti) => {
    const st = tokenState(ti);
    const miss = [...state.errorAt].some((p) => p >= starts[ti] && p < starts[ti + 1]);
    let node;
    if (t.type === 'kanji') {
      node = el('ruby');
      node.append(t.text);
      const rt = el('rt', null, t.reading);
      node.append(rt);
    } else node = el('span', null, t.text);
    node.className = `tok ${st}${miss ? ' miss' : ''}${t.type === 'skip' ? ' skip' : ''}`;
    target.append(node);

    // IME-like typed line
    if (st === 'done') typed.append(el('span', 'out', t.text));
    else if (st === 'cur') {
      const done = state.line.flat.slice(starts[ti], state.pos).map((f) => f.key);
      if (t.mode === 'kana' && done.length) {
        const comp = composeKana(done);
        typed.append(el('span', 'comp', comp));
      }
      if (t.type === 'kata' && state.pos === starts[ti + 1] - 1) typed.append(el('span', 'pill', 'F7'));
    }
  });
  typed.append(el('span', 'caret'));
  target.classList.toggle('no-furigana', !prefs.furigana);

  $('romaji').textContent = tokensToRomaji(tokens);
  $('en').textContent = entry.en ? 'EN  ' + entry.en : 'EN  —';
  $('ko').textContent = entry.ko ? 'KO  ' + entry.ko : 'KO  —';
  for (const k of ['romaji', 'en', 'ko']) $(k).hidden = !prefs[k];

  const n = state.corpus.entries.length;
  $('line-no').textContent = state.corpus.drill ? '∞' : `${state.lineIdx + 1} / ${n}`;
  const nextKey = state.line.flat[state.pos];
  const mi = $('mode-ind');
  if (nextKey) {
    mi.textContent = nextKey.key.code === 'F7' ? 'F7 → カタカナ' : nextKey.mode === 'kana' ? 'かな' : '英数 A';
    mi.dataset.mode = nextKey.key.code === 'F7' ? 'f7' : nextKey.mode;
  }
  keyboard.setNext(nextKey?.key, prefs.next);
  renderStats();
}

function renderStats() {
  const { total, correct, lines } = state.stats;
  $('st-total').textContent = total;
  $('st-correct').textContent = correct;
  $('st-acc').textContent = total ? (100 * correct / total).toFixed(1) + '%' : '–';
  $('st-lines').textContent = lines;
}

function setStatus(msg, isError = false) {
  const s = $('status');
  s.textContent = msg;
  s.classList.toggle('error', isError);
}

// ---------- input ----------
const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'CapsLock', 'Fn', 'OSLeft', 'OSRight']);
const TYPABLE = new Set([...Object.keys(KANA_LAYOUT), ...Object.keys(ASCII_LAYOUT), 'Space', 'F7']);

function isFormTarget(t) {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') keyboard.setShift(true);
  if (!state.line || isFormTarget(e.target)) return;
  let code = e.code;
  if (prefs.ansi && code === 'Backquote') code = 'IntlYen';
  if (prefs.ansi && code === 'AltRight') code = 'IntlRo';
  if (MODIFIERS.has(code) || e.metaKey) return;
  const ctrlK = e.ctrlKey && code === 'KeyK';
  if (e.ctrlKey && !ctrlK) return;
  if (e.altKey && code !== 'IntlRo') return;
  if (!TYPABLE.has(code) && !ctrlK) return;
  e.preventDefault();
  if (e.repeat) return;

  const exp = state.line.flat[state.pos]?.key;
  if (!exp) return;
  let ok;
  if (exp.code === 'F7') ok = code === 'F7' || ctrlK;
  else if (exp.code === 'Space') ok = code === 'Space' && !ctrlK;
  else ok = !ctrlK && code === exp.code && e.shiftKey === exp.shift;

  state.stats.total++;
  keyboard.flash(ctrlK ? 'F7' : code, ok);
  if (ok) {
    state.stats.correct++;
    state.pos++;
    if (state.pos >= state.line.flat.length) { advance(); return; }
  } else state.errorAt.add(state.pos);
  render();
});
document.addEventListener('keyup', (e) => { if (e.key === 'Shift') keyboard.setShift(false); });
window.addEventListener('blur', () => keyboard.setShift(false));

// ---------- uploads ----------
const KURO = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/';
let tokenizerPromise = null;
function getTokenizer() {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = KURO + 'build/kuromoji.js';
    s.onerror = () => reject(new Error('could not load the kanji dictionary'));
    s.onload = () => {
      // kuromoji path-joins the dictionary URL, collapsing "https://" to "https:/"
      const open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (m, u, ...rest) {
        return open.call(this, m, typeof u === 'string' ? u.replace(/^(https?):\/(?!\/)/, '$1://') : u, ...rest);
      };
      window.kuromoji.builder({ dicPath: KURO + 'dict/' }).build((err, t) => (err ? reject(err) : resolve(t)));
    };
    document.head.append(s);
  });
  return tokenizerPromise;
}

const HAS_KANJI = /[一-龯々〆ヵヶ]/;
const RUBY = /(\{[^{}|]+\|[ぁ-ゖー]+\})/;

// Wrap unannotated kanji in {漢字|よみ} using the morphological analyzer.
function annotate(tokenizer, line) {
  return line.split(RUBY).map((part, i) => {
    if (i % 2 === 1 || !HAS_KANJI.test(part)) return part;
    return tokenizer.tokenize(part).map((tk) => {
      const s = tk.surface_form;
      if (!HAS_KANJI.test(s) || !tk.reading || tk.reading === '*') return s;
      let r = toHiragana(tk.reading);
      let head = '', tail = '', body = s;
      while (body.length > 1 && !HAS_KANJI.test(body.at(-1)) && toHiragana(body.at(-1)) === r.at(-1)) { tail = body.at(-1) + tail; body = body.slice(0, -1); r = r.slice(0, -1); }
      while (body.length > 1 && !HAS_KANJI.test(body[0]) && toHiragana(body[0]) === r[0]) { head += body[0]; body = body.slice(1); r = r.slice(1); }
      return r ? `${head}{${body}|${r}}${tail}` : s;
    }).join('');
  }).join('');
}

$('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const { meta, entries } = parseCorpus(text);
    if (!entries.length) throw new Error('The file has no text lines.');
    if (entries.some((x) => HAS_KANJI.test(x.jp.replace(/\{[^{}|]+\|[ぁ-ゖー]+\}/g, '')))) {
      setStatus('Looking up kanji readings (downloading dictionary, first time only)…');
      try {
        const t = await getTokenizer();
        for (const x of entries) x.jp = annotate(t, x.jp);
      } catch {
        setStatus('Could not load the reading dictionary — kanji without {漢字|よみ} markup will be skipped.', true);
      }
    }
    const corpus = { id: 'upload', title: meta.title || file.name, meta, entries };
    store.set(sessionStorage, UPLOAD_KEY, { name: file.name, corpus });
    state.cache.delete('upload');
    await selectCorpus('upload');
    setStatus(`Loaded ${entries.length} lines from ${file.name} (this session only).`);
  } catch (err) {
    setStatus(err.message, true);
  }
});

// ---------- controls ----------
function savePrefs() { store.set(localStorage, PREFS_KEY, prefs); }

for (const [id, key] of [['h-romaji', 'romaji'], ['h-furigana', 'furigana'], ['h-en', 'en'], ['h-ko', 'ko'], ['h-next', 'next'], ['ansi', 'ansi']]) {
  const box = $(id);
  box.checked = prefs[key];
  box.addEventListener('change', () => { prefs[key] = box.checked; savePrefs(); box.blur(); if (state.line) render(); });
}

const kbSel = $('kb-mode');
for (const [v, label] of KEYBOARD_MODES) kbSel.append(new Option(label, v, false, v === prefs.kb));
kbSel.addEventListener('change', () => { prefs.kb = kbSel.value; savePrefs(); kbSel.blur(); keyboard.render(prefs.kb); if (state.line) render(); });

$('corpus').addEventListener('change', (e) => { e.target.blur(); selectCorpus(e.target.value); });
$('prev').addEventListener('click', (e) => { e.currentTarget.blur(); step(-1); });
$('next').addEventListener('click', (e) => { e.currentTarget.blur(); step(1); });
$('random').addEventListener('click', (e) => {
  e.currentTarget.blur();
  if (state.corpus.drill) return startLine();
  state.lineIdx = Math.floor(Math.random() * state.corpus.entries.length);
  startLine();
});
$('reset').addEventListener('click', (e) => { e.currentTarget.blur(); state.stats = { total: 0, correct: 0, lines: 0 }; renderStats(); });

// ---------- boot ----------
keyboard.render(prefs.kb);
fillCorpusSelect();
const defs = corpusDefs().filter((d) => !d.upload);
selectCorpus(defs[Math.floor(Math.random() * defs.length)].id, { randomLine: true });
