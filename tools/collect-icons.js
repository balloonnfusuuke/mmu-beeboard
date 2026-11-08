#!/usr/bin/env node
/* 使用している Material Symbols のアイコン名を全量で洗い出す。
   静的 HTML のマークアップだけでなく、JS のテンプレート文字列・三項演算子・
   アイコンを引数に取るヘルパー呼び出しも対象にする。

   使い方:
     node tools/collect-icons.js            # 名前の一覧をカンマ区切りで出力
     node tools/collect-icons.js --check    # assets/css/fonts.css の ICON_NAMES と照合

   アイコンを増やしたら --check が落ちるので、出力された一覧でフォントを
   取り直し、fonts.css の ICON_NAMES を更新する（取得 URL は fonts.css の先頭）。 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/* アイコン名を第何引数で受け取るヘルパー。ふつうは下の iconHelpers() が
   本体から自動で見つけるので、ここに書くのは自動判定できない形のときだけ。 */
const ICON_ARG = {
  detailPill: 0,
  section: 0,
  cardShell: 2
};

/* アイコン名を保持する変数・プロパティ。代入式と三項演算子の両方を拾う。 */
const ICON_HOLDERS = ['icon', 'iconName', 'noteIcon', 'emptyIcon'];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'tools') return;
    if (entry.name.startsWith('.')) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/.test(entry.name)) out.push(full);
  });
  return out;
}

/* 開き括弧の位置から、対応する閉じ括弧までの引数をトップレベルで分割する。 */
function argsOf(src, openIndex) {
  const args = [];
  let depth = 0;
  let current = '';
  let quote = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      current += ch;
      if (ch === '\\') {
        current += src[i + 1] || '';
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (depth === 1) continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        args.push(current);
        return args;
      }
    }
    if (ch === ',' && depth === 1) {
      args.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  return args;
}

/* 開き波括弧の位置から、対応する閉じ波括弧までの本体を返す。 */
function bodyOf(src, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(openIndex + 1, i);
    }
  }
  return null;
}

/* アイコン名を引数で受け取るヘルパーを本体から見つける。
   material-symbols-outlined の span を組み立て、その中身に引数をそのまま
   差し込んでいる関数が対象。ヘルパーを増やすたびに ICON_ARG へ書き足す運用は
   漏れる（button / promise / linkCard がこれで漏れた）ので自動判定にする。 */
function iconHelpers(src) {
  const map = {};
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const body = bodyOf(src, m.index + m[0].length - 1);
    if (!body || body.indexOf('material-symbols-outlined') === -1) continue;
    m[2].split(',').forEach(function (param, index) {
      const name = param.replace(/=.*$/, '').trim();
      if (!name) return;
      const injected = new RegExp(
        'material-symbols-outlined[^>]*>\\s*\'\\s*\\+\\s*' + name + '\\s*\\+\\s*\''
      );
      if (injected.test(body)) map[m[1]] = index;
    });
  }
  return map;
}

function literalsIn(expression) {
  const out = [];
  const re = /'([a-z][a-z0-9_]*)'|"([a-z][a-z0-9_]*)"/g;
  let m;
  while ((m = re.exec(expression))) {
    /* name="name" のような属性値はアイコン名ではない。 */
    if (expression[m.index - 1] === '=') continue;
    out.push(m[1] || m[2]);
  }
  return out;
}

function collectFrom(src, found) {
  /* 1. マークアップ: <span class="material-symbols-outlined ...">name</span> */
  const markup = /material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g;
  let m;
  while ((m = markup.exec(src))) found.add(m[1]);

  /* 2. アイコンを引数に取るヘルパー呼び出し */
  const helpers = Object.assign({}, ICON_ARG, iconHelpers(src));
  Object.keys(helpers).forEach(function (name) {
    const re = new RegExp('\\b' + name + '\\s*\\(', 'g');
    let call;
    while ((call = re.exec(src))) {
      const args = argsOf(src, call.index + call[0].length - 1);
      const arg = args[helpers[name]];
      if (!arg) continue;
      literalsIn(arg).forEach(function (literal) {
        found.add(literal);
      });
    }
  });

  /* 3. アイコン名を持つ変数・プロパティへの代入（三項演算子の両辺も拾う） */
  ICON_HOLDERS.forEach(function (holder) {
    const re = new RegExp('\\b' + holder + '\\s*[:=]\\s*([^;\\n]+)', 'g');
    let assign;
    while ((assign = re.exec(src))) {
      literalsIn(assign[1]).forEach(function (literal) {
        found.add(literal);
      });
    }
  });

  /* 4. span の中身が式になっている場合（三項演算子など）。
     material-symbols-outlined の開始タグから閉じタグまでを切り出し、その中の
     文字列リテラルを拾う。t() / esc() の引数はアイコン名ではないので除く。 */
  const spanRe = /material-symbols-outlined/g;
  let span;
  while ((span = spanRe.exec(src))) {
    const open = src.indexOf('>', span.index);
    if (open === -1) continue;
    const close = src.indexOf('</span>', open);
    if (close === -1 || close - open > 400) continue;
    const inner = src
      .slice(open + 1, close)
      .replace(/\b(?:t|esc|escHtml)\s*\([^()]*\)/g, '');
    literalsIn(inner).forEach(function (literal) {
      found.add(literal);
    });
  }
}

function collect() {
  const found = new Set();
  walk(ROOT, []).forEach(function (file) {
    collectFrom(fs.readFileSync(file, 'utf8'), found);
  });
  return Array.from(found).sort();
}

function fontList() {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/fonts.css'), 'utf8');
  const block = css.slice(0, css.indexOf('*/'));
  /* 一覧は最後の ICON_NAMES（...）: 行。上の説明文にも同じ語が出るため後ろから探す。 */
  const marker = block.lastIndexOf('ICON_NAMES（');
  if (marker === -1) return [];
  const after = block.slice(block.indexOf(':', marker) + 1);
  return after
    .replace(/[\s*]/g, '')
    .split(',')
    .filter(Boolean);
}

/* ---------- woff2 本体の検証 ----------
   fonts.css の ICON_NAMES は「こう収録した」という記録にすぎない。実際の
   woff2 に入っていなければアイコンは生テキストで表示されるので、--check では
   フォントの GSUB（合字）を読み、収録済みのアイコン名を直接照合する。
   これがないと、古い一覧でサブセットし直したフォントでも --check が通ってしまう。 */

const WOFF2_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill'
];

/* woff2 を展開して tag -> Buffer の表を返す。 */
function readWoff2(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error(file + ': woff2 ではない');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);

  let p = 48;
  function base128() {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buf[p++];
      value = (value << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error(file + ': テーブル長が壊れている');
  }

  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++];
    const tagIndex = flags & 0x3f;
    const transform = (flags >> 6) & 3;
    let tag;
    if (tagIndex === 63) {
      tag = buf.toString('ascii', p, p + 4);
      p += 4;
    } else {
      tag = WOFF2_TAGS[tagIndex];
    }
    const origLength = base128();
    /* glyf/loca は transform 3 が「無変換」、それ以外は 0 が「無変換」。 */
    const transformed = tag === 'glyf' || tag === 'loca' ? transform !== 3 : transform !== 0;
    const length = transformed ? base128() : origLength;
    entries.push({ tag: tag, length: length });
  }

  const data = zlib.brotliDecompressSync(buf.slice(p, p + compressedSize));
  const tables = {};
  let offset = 0;
  entries.forEach(function (entry) {
    tables[entry.tag] = data.slice(offset, offset + entry.length);
    offset += entry.length;
  });
  return tables;
}

/* cmap から glyph id -> 文字 の対応を作る（合字の構成要素を名前へ戻すため）。 */
function glyphChars(cmap) {
  const count = cmap.readUInt16BE(2);
  let best = null;
  for (let i = 0; i < count; i++) {
    const offset = cmap.readUInt32BE(8 + i * 8);
    const format = cmap.readUInt16BE(offset);
    if (format === 4 || format === 12) best = { offset: offset, format: format };
  }
  const map = {};
  if (!best) return map;

  if (best.format === 4) {
    const offset = best.offset;
    const segX2 = cmap.readUInt16BE(offset + 6);
    const segments = segX2 / 2;
    const endAt = offset + 14;
    const startAt = endAt + segX2 + 2;
    const deltaAt = startAt + segX2;
    const rangeAt = deltaAt + segX2;
    for (let s = 0; s < segments; s++) {
      const end = cmap.readUInt16BE(endAt + s * 2);
      const start = cmap.readUInt16BE(startAt + s * 2);
      const delta = cmap.readInt16BE(deltaAt + s * 2);
      const rangeOffset = cmap.readUInt16BE(rangeAt + s * 2);
      for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
        let gid;
        if (rangeOffset === 0) {
          gid = (cp + delta) & 0xffff;
        } else {
          const at = rangeAt + s * 2 + rangeOffset + (cp - start) * 2;
          gid = cmap.readUInt16BE(at);
          if (gid) gid = (gid + delta) & 0xffff;
        }
        if (gid) map[gid] = String.fromCodePoint(cp);
      }
    }
  } else {
    const offset = best.offset;
    const groups = cmap.readUInt32BE(offset + 12);
    for (let i = 0; i < groups; i++) {
      const start = cmap.readUInt32BE(offset + 16 + i * 12);
      const end = cmap.readUInt32BE(offset + 20 + i * 12);
      const gid = cmap.readUInt32BE(offset + 24 + i * 12);
      for (let cp = start; cp <= end; cp++) map[gid + (cp - start)] = String.fromCodePoint(cp);
    }
  }
  return map;
}

/* GSUB の合字（lookup type 4 / 拡張の type 7）を集めてアイコン名にする。 */
function ligatureNames(gsub, chars) {
  const u16 = function (at) { return gsub.readUInt16BE(at); };
  const u32 = function (at) { return gsub.readUInt32BE(at); };

  function coverage(at) {
    const format = u16(at);
    const glyphs = [];
    if (format === 1) {
      const count = u16(at + 2);
      for (let i = 0; i < count; i++) glyphs.push(u16(at + 4 + i * 2));
    } else if (format === 2) {
      const ranges = u16(at + 2);
      for (let i = 0; i < ranges; i++) {
        const start = u16(at + 4 + i * 6);
        const end = u16(at + 6 + i * 6);
        for (let g = start; g <= end; g++) glyphs.push(g);
      }
    }
    return glyphs;
  }

  const names = [];
  function collectLigatures(subtable) {
    if (u16(subtable) !== 1) return;
    const glyphs = coverage(subtable + u16(subtable + 2));
    const setCount = u16(subtable + 4);
    for (let s = 0; s < setCount; s++) {
      const setAt = subtable + u16(subtable + 6 + s * 2);
      const ligCount = u16(setAt);
      for (let l = 0; l < ligCount; l++) {
        const ligAt = setAt + u16(setAt + 2 + l * 2);
        const components = u16(ligAt + 2);
        const parts = [glyphs[s]];
        for (let c = 1; c < components; c++) parts.push(u16(ligAt + 4 + (c - 1) * 2));
        names.push(parts.map(function (gid) { return chars[gid] || ''; }).join(''));
      }
    }
  }

  const lookupList = u16(8);
  const lookupCount = u16(lookupList);
  for (let i = 0; i < lookupCount; i++) {
    const lookupAt = lookupList + u16(lookupList + 2 + i * 2);
    const type = u16(lookupAt);
    const subCount = u16(lookupAt + 4);
    for (let s = 0; s < subCount; s++) {
      const subAt = lookupAt + u16(lookupAt + 6 + s * 2);
      if (type === 7) {
        if (u16(subAt + 2) === 4) collectLigatures(subAt + u32(subAt + 4));
      } else if (type === 4) {
        collectLigatures(subAt);
      }
    }
  }
  return names;
}

/* フォントに実際に収録されているアイコン名の集合。 */
function fontIcons() {
  const tables = readWoff2(path.join(ROOT, 'assets/fonts/material-symbols-outlined.woff2'));
  if (!tables.GSUB || !tables.cmap) throw new Error('woff2 に GSUB / cmap がない');
  return new Set(ligatureNames(tables.GSUB, glyphChars(tables.cmap)));
}

if (require.main === module) {
  const used = collect();
  if (process.argv.indexOf('--check') === -1) {
    console.log(used.join(','));
    console.log('count: ' + used.length);
  } else {
    const documented = fontList();
    const inFont = fontIcons();
    const missing = used.filter(function (name) {
      return documented.indexOf(name) === -1;
    });
    const stale = documented.filter(function (name) {
      return used.indexOf(name) === -1;
    });
    const notInFont = used.filter(function (name) {
      return !inFont.has(name);
    });
    console.log('used: ' + used.length + ' / in fonts.css: ' + documented.length +
      ' / in woff2: ' + inFont.size);
    console.log('missing from fonts.css: ' + (missing.length ? missing.join(', ') : '(none)'));
    console.log('listed but unused: ' + (stale.length ? stale.join(', ') : '(none)'));
    console.log('missing from woff2: ' + (notInFont.length ? notInFont.join(', ') : '(none)'));
    if (missing.length || notInFont.length) process.exitCode = 1;
  }
}

module.exports = { collect: collect, fontList: fontList, fontIcons: fontIcons };
