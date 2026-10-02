// Staggered JIS keyboard renderer.
import { KANA_LAYOUT, ASCII_LAYOUT, ROMAJI_KEY, toKatakana } from './engine.js';

// [code, width(u), label] ; label used for non-character keys
const FN_ROW = [
  ['Escape', 1, 'Esc'], ['gap', 0.5], ['F1', 1, 'F1'], ['F2', 1, 'F2'], ['F3', 1, 'F3'], ['F4', 1, 'F4'],
  ['gap', 0.25], ['F5', 1, 'F5'], ['F6', 1, 'F6'], ['F7', 1, 'F7'], ['F8', 1, 'F8'],
  ['gap', 0.25], ['F9', 1, 'F9'], ['F10', 1, 'F10'], ['F11', 1, 'F11'], ['F12', 1, 'F12'],
];
const ROWS = [
  [['Backquote', 1, '半/全'], ...'1234567890'.split('').map((d) => ['Digit' + d, 1]), ['Minus', 1], ['Equal', 1], ['IntlYen', 1], ['Backspace', 1, 'BS']],
  [['Tab', 1.5, 'Tab'], ...'QWERTYUIOP'.split('').map((c) => ['Key' + c, 1]), ['BracketLeft', 1], ['BracketRight', 1], ['Enter', 1.5, 'Enter']],
  [['CapsLock', 1.75, '英数'], ...'ASDFGHJKL'.split('').map((c) => ['Key' + c, 1]), ['Semicolon', 1], ['Quote', 1], ['Backslash', 1], ['EnterLow', 1.25]],
  [['ShiftLeft', 2.25, 'Shift'], ...'ZXCVBNM'.split('').map((c) => ['Key' + c, 1]), ['Comma', 1], ['Period', 1], ['Slash', 1], ['IntlRo', 1], ['ShiftRight', 1.75, 'Shift']],
  [['ControlLeft', 1.25, 'Ctrl'], ['MetaLeft', 1.25, '⌘/Win'], ['AltLeft', 1.25, 'Alt'], ['NonConvert', 1.25, '無変換'], ['Space', 5, ''], ['Convert', 1.25, '変換'], ['KanaMode', 1.25, 'かな'], ['AltRight', 1.25, 'Alt'], ['ControlRight', 1.25, 'Ctrl']],
];

const LEFT_HAND = new Set(['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB']);

export const KEYBOARD_MODES = [
  ['blank', 'Blank'],
  ['homing', 'Blank + F/J'],
  ['hiragana', 'ひらがな'],
  ['ascii', 'ABC / 123 / 記号'],
  ['katakana', 'カタカナ'],
  ['romaji', 'Romaji'],
];

const romaji = (k) => (k === '゛' || k === '゜' || !ROMAJI_KEY[k] ? k : ROMAJI_KEY[k].trim() || k);

function legends(code, mode) {
  const kana = KANA_LAYOUT[code], ascii = ASCII_LAYOUT[code];
  switch (mode) {
    case 'hiragana': return kana ? { main: kana[0], sub: kana[1] } : null;
    case 'katakana': return kana ? { main: toKatakana(kana[0]), sub: toKatakana(kana[1]) } : null;
    case 'romaji': return kana ? { main: romaji(kana[0]), sub: kana[1] ? romaji(kana[1]) : '', latin: true } : null;
    case 'ascii': return ascii ? { main: /^[a-z]$/.test(ascii[0]) ? ascii[1] : ascii[0], sub: /^[a-z]$/.test(ascii[0]) ? '' : ascii[1], latin: true } : null;
    default: return null;
  }
}

export class Keyboard {
  constructor(root) {
    this.root = root;
    this.keys = new Map();
    this.mode = 'hiragana';
  }

  render(mode) {
    this.mode = mode;
    this.keys.clear();
    this.root.textContent = '';
    this.root.dataset.mode = mode;
    const rows = [FN_ROW, ...ROWS];
    rows.forEach((row, ri) => {
      const el = document.createElement('div');
      el.className = 'kb-row' + (ri === 0 ? ' kb-fn' : '');
      for (const [code, w, label] of row) {
        const k = document.createElement('div');
        k.style.setProperty('--w', w);
        if (code === 'gap') { k.className = 'kb-gap'; el.append(k); continue; }
        if (code === 'EnterLow') { k.className = 'kb-gap'; el.append(k); continue; }
        k.className = 'key';
        k.dataset.code = code;
        const lg = legends(code, mode);
        if (label !== undefined) {
          k.classList.add('key-mod');
          k.textContent = label;
          if (code === 'Enter') k.classList.add('key-enter');
        } else if (lg) {
          if (lg.latin) k.classList.add('latin');
          const main = document.createElement('span');
          main.className = 'lg-main';
          main.textContent = lg.main;
          const sub = document.createElement('span');
          sub.className = 'lg-sub';
          sub.textContent = lg.sub || '';
          k.append(sub, main);
        }
        if (code === 'KeyF' || code === 'KeyJ') k.classList.add('homing');
        el.append(k);
        this.keys.set(code, k);
      }
      this.root.append(el);
    });
  }

  // Highlight the next expected keystroke ({code, shift}) or clear with null.
  setNext(key, enabled) {
    for (const el of this.root.querySelectorAll('.next')) el.classList.remove('next');
    if (!key || !enabled) return;
    this.keys.get(key.code)?.classList.add('next');
    if (key.shift) this.keys.get(LEFT_HAND.has(key.code) ? 'ShiftRight' : 'ShiftLeft')?.classList.add('next');
  }

  flash(code, ok) {
    const el = this.keys.get(code);
    if (!el) return;
    const cls = ok ? 'hit' : 'miss';
    el.classList.remove('hit', 'miss');
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove(cls), 220);
  }

  setShift(down) {
    for (const c of ['ShiftLeft', 'ShiftRight']) this.keys.get(c)?.classList.toggle('held', down);
    this.root.classList.toggle('shifted', down);
  }
}
