# JIS Practice

Untimed JIS **kana-input** (かな入力) typing practice with real Japanese text — <https://jis-practice.sjun.me>

No timer, no WPM. Only keypresses and accuracy (correct keypresses ÷ total keypresses).

## Features

- **Direct key capture.** Keys are read by physical position (`KeyboardEvent.code`) on the JIS kana layout; the OS IME is never involved. ゛/゜ are separate keystrokes.
- **Kanji auto-convert** once their reading is typed. **Katakana words need F7** (Ctrl+K also accepted, as on macOS) after each word.
- **Alphanumeric mode** switches automatically for Latin letters, digits and code (JIS ASCII layout).
- **Staggered JIS keyboard** with six keycap modes: blank, blank + F/J, ひらがな, ABC/123/記号, カタカナ, romaji (normal + shifted).
- **Hints** (each can be shown/hidden): romaji, furigana, English translation, Korean translation.
- **Line-by-line** practice; random corpus and random starting line by default; loops at the end.
- **Upload your own** `.txt` (one line per practice line). Kanji readings are looked up in the browser with [kuromoji](https://github.com/takuyaa/kuromoji.js), or annotate them yourself as `{漢字|かんじ}`. Uploads live only in that browser tab's session storage and are never sent anywhere.
- **ANSI fallback**: on US keyboards, `` ` `` acts as the JIS ¥ key (ー) and right Alt/⌥ as the JIS \ key (ろ).

## Corpora (`corpus/`)

| File | Content | Source |
|---|---|---|
| `legal.txt` | 日本国憲法 (preamble + selected articles), 民法 1–3, 刑法 199, 著作権法 13 | e-Gov 法令検索 (not copyrightable, 著作権法 §13) |
| `popculture.txt` | Original prose about 「残酷な天使のテーゼ」 and Evangelion | Facts checked against the sources listed in the file |
| `coding.txt` | Java `Vector3 implements VectorType<Vector3>` with Japanese comments | Original |
| `english.txt` | US Constitution (Preamble, Art. I §1–3, Bill of Rights) in katakana | National Archives transcription (public domain) |
| `nonenglish.txt` | Weimar Constitution Art. 48 (German) in katakana | Wikisource (public domain) |
| `korean.txt` | KOSPI 200 companies, CEOs and main products | KRX constituents, DART company filings |
| — | Random hiragana/katakana pair drill | Generated |

All English and Korean translations were written for this project and are not official translations.

The lyrics of 「残酷な天使のテーゼ」 are not included because they are under copyright. To practise them, upload them yourself as a `.txt`; uploads stay in your browser.

See [`corpus/FORMAT.md`](corpus/FORMAT.md) for the file format. Validate with:

```sh
node scripts/validate.mjs corpus/*.txt
```

## Development

Plain static files, no build step:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## License

MIT — see [LICENSE](LICENSE). The corpus texts keep the status described above.
