// JIS kana typing engine: layout tables, line parser, keystroke expansion, romaji.
// Pure ES module (no DOM) so it can be shared by the browser app and Node scripts.

export const F7 = { code: 'F7', shift: false };

// Physical key (event.code) -> [unshifted kana, shifted kana]
export const KANA_LAYOUT = {
  Digit1: ['ぬ', ''], Digit2: ['ふ', ''], Digit3: ['あ', 'ぁ'], Digit4: ['う', 'ぅ'],
  Digit5: ['え', 'ぇ'], Digit6: ['お', 'ぉ'], Digit7: ['や', 'ゃ'], Digit8: ['ゆ', 'ゅ'],
  Digit9: ['よ', 'ょ'], Digit0: ['わ', 'を'], Minus: ['ほ', ''], Equal: ['へ', ''], IntlYen: ['ー', ''],
  KeyQ: ['た', ''], KeyW: ['て', ''], KeyE: ['い', 'ぃ'], KeyR: ['す', ''], KeyT: ['か', ''],
  KeyY: ['ん', ''], KeyU: ['な', ''], KeyI: ['に', ''], KeyO: ['ら', ''], KeyP: ['せ', ''],
  BracketLeft: ['゛', ''], BracketRight: ['゜', '「'],
  KeyA: ['ち', ''], KeyS: ['と', ''], KeyD: ['し', ''], KeyF: ['は', ''], KeyG: ['き', ''],
  KeyH: ['く', ''], KeyJ: ['ま', ''], KeyK: ['の', ''], KeyL: ['り', ''], Semicolon: ['れ', ''],
  Quote: ['け', ''], Backslash: ['む', '」'],
  KeyZ: ['つ', 'っ'], KeyX: ['さ', ''], KeyC: ['そ', ''], KeyV: ['ひ', ''], KeyB: ['こ', ''],
  KeyN: ['み', ''], KeyM: ['も', ''], Comma: ['ね', '、'], Period: ['る', '。'], Slash: ['め', '・'],
  IntlRo: ['ろ', ''],
};

// Physical key -> [unshifted, shifted] on the JIS alphanumeric layout
export const ASCII_LAYOUT = {
  Digit1: ['1', '!'], Digit2: ['2', '"'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'],
  Digit6: ['6', '&'], Digit7: ['7', "'"], Digit8: ['8', '('], Digit9: ['9', ')'], Digit0: ['0', ''],
  Minus: ['-', '='], Equal: ['^', '~'], IntlYen: ['¥', '|'],
  BracketLeft: ['@', '`'], BracketRight: ['[', '{'],
  Semicolon: [';', '+'], Quote: [':', '*'], Backslash: [']', '}'],
  Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], IntlRo: ['\\', '_'],
};
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') ASCII_LAYOUT['Key' + c] = [c.toLowerCase(), c];

const DAKUTEN = '゛', HANDAKUTEN = '゜';
const VOICED = {}, SEMI = {};
{
  const base = 'かきくけこさしすせそたちつてとはひふへほう';
  const voiced = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔ';
  for (let i = 0; i < base.length; i++) VOICED[voiced[i]] = base[i];
  const hb = 'はひふへほ', semi = 'ぱぴぷぺぽ';
  for (let i = 0; i < hb.length; i++) SEMI[semi[i]] = hb[i];
}

// char -> keystroke, for kana mode and alpha mode
const KANA_KEY = {}, ASCII_KEY = {};
for (const [code, [u, s]] of Object.entries(KANA_LAYOUT)) {
  if (u) KANA_KEY[u] = { code, shift: false };
  if (s) KANA_KEY[s] = { code, shift: true };
}
for (const [code, [u, s]] of Object.entries(ASCII_LAYOUT)) {
  if (u) ASCII_KEY[u] = { code, shift: false };
  if (s) ASCII_KEY[s] = { code, shift: true };
}
KANA_KEY['　'] = { code: 'Space', shift: false };
ASCII_KEY[' '] = { code: 'Space', shift: false };
ASCII_KEY['\\'] = { code: 'IntlRo', shift: false };

export const isHiragana = (c) => /[ぁ-ゖ]/.test(c);
export const isKatakana = (c) => /[ァ-ヶー]/.test(c);
export const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

// Normalize full-width ASCII to half-width.
const toHalf = (c) => {
  const n = c.charCodeAt(0);
  return n >= 0xff01 && n <= 0xff5e ? String.fromCharCode(n - 0xfee0) : c === '￥' ? '¥' : c;
};

// Keystrokes for one hiragana/kana-punctuation char, or null if not typeable in kana mode.
export function kanaKeys(c) {
  if (KANA_KEY[c]) return [KANA_KEY[c]];
  if (VOICED[c]) return [KANA_KEY[VOICED[c]], KANA_KEY[DAKUTEN]];
  if (SEMI[c]) return [KANA_KEY[SEMI[c]], KANA_KEY[HANDAKUTEN]];
  return null;
}
export function asciiKeys(c) {
  const h = toHalf(c);
  return ASCII_KEY[h] ? [ASCII_KEY[h]] : null;
}

const RUBY_RE = /\{([^{}|]+)\|([ぁ-ゖー]+)\}/y;

/**
 * Parse one corpus line into tokens.
 * Token: { type: 'kanji'|'kata'|'kana'|'ascii'|'skip', text, reading?, keys: [{code, shift}], mode }
 * 'skip' tokens are untypeable characters that are auto-filled.
 */
export function parseLine(raw) {
  const indent = raw.match(/^\s*/)[0];
  const s = raw.slice(indent.length).replace(/\s+$/, '');
  const tokens = [];
  const errors = [];
  let i = 0;
  while (i < s.length) {
    RUBY_RE.lastIndex = i;
    const m = RUBY_RE.exec(s);
    if (m) {
      const keys = readingKeys(m[2]);
      if (!keys) errors.push(`bad reading "${m[2]}"`);
      tokens.push({ type: 'kanji', text: m[1], reading: m[2], keys: keys || [], mode: 'kana' });
      i = RUBY_RE.lastIndex;
      continue;
    }
    const c = s[i];
    if (/[ァ-ヶ]/.test(c)) {
      // katakana run (ー continues a run); one run = one word = one F7
      let j = i;
      while (j < s.length && isKatakana(s[j])) j++;
      const text = s.slice(i, j);
      const reading = toHiragana(text);
      const keys = readingKeys(reading);
      if (!keys || /[ヵヶ]/.test(text)) errors.push(`untypeable katakana "${text}"`);
      tokens.push({ type: 'kata', text, reading, keys: [...(keys || []), F7], mode: 'kana' });
      i = j;
      continue;
    }
    if (c === '{' && /^\{[^{}|]+\|/.test(s.slice(i))) errors.push(`malformed ruby near "${s.slice(i, i + 12)}"`);
    let keys = kanaKeys(c), mode = 'kana', type = 'kana';
    if (!keys) { keys = asciiKeys(c); mode = 'alpha'; type = 'ascii'; }
    if (!keys) {
      if (/[一-龯々〆ヵヶ]/.test(c)) errors.push(`kanji without reading "${c}"`);
      else errors.push(`unsupported character "${c}" (U+${c.codePointAt(0).toString(16)})`);
      tokens.push({ type: 'skip', text: c, keys: [], mode: 'kana' });
    } else tokens.push({ type, text: c, keys, mode });
    i++;
  }
  return { indent, tokens, errors };
}

function readingKeys(r) {
  const out = [];
  for (const c of r) {
    const k = kanaKeys(c);
    if (!k) return null;
    out.push(...k);
  }
  return out;
}

// Replay a prefix of kana keystrokes into the composed kana string (for IME-like preview).
export function composeKana(keys) {
  let out = '';
  for (const k of keys) {
    if (k.code === 'F7') continue;
    const ch = KANA_LAYOUT[k.code]?.[k.shift ? 1 : 0];
    if (!ch) continue;
    if (ch === DAKUTEN || ch === HANDAKUTEN) {
      const last = out.at(-1);
      const table = ch === DAKUTEN ? VOICED : SEMI;
      const hit = Object.keys(table).find((v) => table[v] === last);
      out = hit ? out.slice(0, -1) + hit : out + ch;
    } else out += ch;
  }
  return out;
}

// ---------- romaji ----------
const ROMA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ゔ: 'vu',
  ぁ: 'xa', ぃ: 'xi', ぅ: 'xu', ぇ: 'xe', ぉ: 'xo', ゃ: 'xya', ゅ: 'xyu', ょ: 'xyo', っ: 'xtsu',
  '、': ', ', '。': '. ', '「': '"', '」': '"', '・': ' ', 'ー': '-', '　': ' ',
};
const YOON = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_V = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
export const ROMAJI_KEY = ROMA;

export function kanaToRomaji(kana) {
  const s = toHiragana(kana);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === 'っ' && n && ROMA[n] && /^[a-z]/.test(ROMA[n]) && !SMALL_V[n] && !YOON[n]) {
      const nr = ROMA[n];
      out += nr.startsWith('ch') ? 't' : nr[0];
      continue;
    }
    if (c === 'ん' && n && /^[aiueoy]/.test(ROMA[n] || '')) { out += "n'"; continue; }
    if (n && YOON[n] && ROMA[c] && /i$/.test(ROMA[c]) && c !== 'い') {
      const b = ROMA[c];
      out += (/^(sh|ch|j)/.test(b) ? b.slice(0, -1) : b.slice(0, -1) + 'y') + YOON[n];
      i++;
      continue;
    }
    if (n && SMALL_V[n] && ROMA[c] && !YOON[c]) {
      // ファ fa, ティ ti, ウィ wi, ヴァ va, シェ she, チェ che, ジェ je
      const b = ROMA[c];
      const stem = { fu: 'f', vu: 'v', u: 'w', te: 't', de: 'd', to: 't', do: 'd', shi: 'sh', chi: 'ch', ji: 'j', tsu: 'ts', ku: 'kw', gu: 'gw' }[b];
      if (stem) { out += stem + SMALL_V[n]; i++; continue; }
    }
    if (c === 'ー' && /[aiueo]$/.test(out)) { out += out.at(-1); continue; }
    out += ROMA[c] ?? c;
  }
  return out.replace(/ +/g, ' ').replace(/-+/g, '-');
}

export function tokensToRomaji(tokens) {
  let out = '', kana = '';
  const flush = () => { if (kana) out += kanaToRomaji(kana); kana = ''; };
  for (const t of tokens) {
    if (t.type === 'kanji' || t.type === 'kata') {
      if (t.type === 'kata') { flush(); out += kanaToRomaji(t.reading) + ' '; }
      else kana += t.reading;
    } else if (t.type === 'kana') kana += t.text;
    else { flush(); out += t.type === 'skip' ? t.text : toHalf(t.text); }
  }
  flush();
  return out.replace(/ +([,.])/g, '$1').replace(/ +/g, ' ').trim();
}

// ---------- corpus files ----------
export function parseCorpus(text) {
  const meta = {};
  const entries = [];
  let cur = null;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const hasMarkup = lines.some((l) => l.startsWith('jp:'));
  if (!hasMarkup) {
    for (const l of lines) if (l.trim()) entries.push({ jp: l.replace(/\s+$/, ''), en: '', ko: '' });
    return { meta, entries };
  }
  for (const l of lines) {
    if (l.startsWith('#')) {
      const m = l.match(/^#\s*([\w-]+):\s*(.*)$/);
      if (m) meta[m[1]] = meta[m[1]] ? meta[m[1]] + '\n' + m[2] : m[2];
      continue;
    }
    if (l.startsWith('jp:')) { cur = { jp: l.slice(3).replace(/^ /, '').replace(/\s+$/, ''), en: '', ko: '' }; entries.push(cur); }
    else if (cur && l.startsWith('en:')) cur.en = l.slice(3).trim();
    else if (cur && l.startsWith('ko:')) cur.ko = l.slice(3).trim();
  }
  return { meta, entries: entries.filter((e) => e.jp.trim()) };
}

// ---------- random drill ----------
const DRILL = [
  ...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
  ...'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ',
  'きゃ', 'きゅ', 'きょ', 'しゃ', 'しゅ', 'しょ', 'ちゃ', 'ちゅ', 'ちょ', 'にゃ', 'にゅ', 'にょ',
  'ひゃ', 'ひゅ', 'ひょ', 'みゃ', 'みゅ', 'みょ', 'りゃ', 'りゅ', 'りょ', 'ぎゃ', 'ぎゅ', 'ぎょ',
  'じゃ', 'じゅ', 'じょ', 'びゃ', 'びゅ', 'びょ', 'ぴゃ', 'ぴゅ', 'ぴょ',
];
const HANGUL = {
  a: '아', i: '이', u: '우', e: '에', o: '오', ka: '카', ki: '키', ku: '쿠', ke: '케', ko: '코',
  sa: '사', shi: '시', su: '스', se: '세', so: '소', ta: '타', chi: '치', tsu: '쓰', te: '테', to: '토',
  na: '나', ni: '니', nu: '누', ne: '네', no: '노', ha: '하', hi: '히', fu: '후', he: '헤', ho: '호',
  ma: '마', mi: '미', mu: '무', me: '메', mo: '모', ya: '야', yu: '유', yo: '요',
  ra: '라', ri: '리', ru: '루', re: '레', ro: '로', wa: '와', n: 'ㄴ(응)',
  ga: '가', gi: '기', gu: '구', ge: '게', go: '고', za: '자', ji: '지', zu: '즈', ze: '제', zo: '조',
  da: '다', de: '데', do: '도', ba: '바', bi: '비', bu: '부', be: '베', bo: '보',
  pa: '파', pi: '피', pu: '푸', pe: '페', po: '포',
  kya: '캬', kyu: '큐', kyo: '쿄', sha: '샤', shu: '슈', sho: '쇼', cha: '차', chu: '추', cho: '초',
  nya: '냐', nyu: '뉴', nyo: '뇨', hya: '햐', hyu: '휴', hyo: '효', mya: '먀', myu: '뮤', myo: '묘',
  rya: '랴', ryu: '류', ryo: '료', gya: '갸', gyu: '규', gyo: '교', ja: '자', ju: '주', jo: '조',
  bya: '뱌', byu: '뷰', byo: '뵤', pya: '퍄', pyu: '퓨', pyo: '표',
};
export function randomDrillEntry(rand = Math.random) {
  const h = DRILL[Math.floor(rand() * DRILL.length)];
  const r = kanaToRomaji(h);
  return {
    jp: `${h}　${toKatakana(h)}`,
    en: `“${r}” — hiragana ${h}, then katakana ${toKatakana(h)} (type ${h} + F7)`,
    ko: `${HANGUL[r] || r} — 히라가나 ${h} / 가타카나 ${toKatakana(h)}`,
  };
}
