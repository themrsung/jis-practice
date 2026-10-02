# Corpus format

Each corpus is a UTF-8 text file in this folder.

```
# id: legal
# title: 日本の法令（抜粋）
# title_en: Japanese law articles
# title_ko: 일본 법령 (발췌)
# source: https://laws.e-gov.go.jp/law/321CONSTITUTION
# note: free text (license / provenance)

jp: {日本国民|にほんこくみん}は、{正当|せいとう}に{選挙|せんきょ}された{国会|こっかい}における{代表者|だいひょうしゃ}を{通|つう}じて{行動|こうどう}し、
en: We, the Japanese people, acting through our duly elected representatives in the National Diet,
ko: 일본 국민은 정당하게 선거된 국회의 대표자를 통하여 행동하고,

jp: ...
en: ...
ko: ...
```

* Lines starting with `#` are headers/comments. Entries are separated by blank lines.
* `jp:` is the line the user types. `en:` / `ko:` are translation hints.
  Leading whitespace after `jp: ` is shown (code indentation) but never typed.

## What can appear in a `jp:` line

| Content | How it is typed |
|---|---|
| Hiragana (ぁ-ゖ except ゐゑゎゔ) | JIS kana keys, ゛/゜ as a second keystroke |
| Katakana run (ァ-ヴ, ー) | its hiragana reading, then **F7** (or Ctrl+K). Every contiguous katakana run is one "word" and needs its own F7. Avoid ヵヶヮヰヱ. |
| `{漢字|かんじ}` | type the hiragana reading; converts to the kanji automatically. Reading must be hiragana only (ー allowed). Wrap anything that is not kana and not plain ASCII: kanji, 々, kanji numerals. Prefer word-sized groups with okurigana outside: `{読|よ}む`. |
| 、。「」・ー and full-width space 　 | kana-mode keys (Shift+, Shift+. Shift+[ Shift+] Shift+/ ¥ Space) |
| ASCII letters, digits, ASCII punctuation, half-width space | alphanumeric mode, JIS ASCII layout. Mode switching is automatic. |
| Full-width （）０-９Ａ-Ｚ！？：；etc. | treated as the ASCII equivalent (alphanumeric mode) |

Do not use other symbols (〜 ○ ※ — ’ “ … ♪ etc.).
Validate with `node scripts/validate.mjs corpus/<file>.txt`.
