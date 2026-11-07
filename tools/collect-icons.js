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

const ROOT = path.resolve(__dirname, '..');

/* アイコン名を第何引数で受け取るヘルパー。新しいヘルパーを足したらここに追加する。 */
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
  Object.keys(ICON_ARG).forEach(function (name) {
    const re = new RegExp('\\b' + name + '\\s*\\(', 'g');
    let call;
    while ((call = re.exec(src))) {
      const args = argsOf(src, call.index + call[0].length - 1);
      const arg = args[ICON_ARG[name]];
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

if (require.main === module) {
  const used = collect();
  if (process.argv.indexOf('--check') === -1) {
    console.log(used.join(','));
    console.log('count: ' + used.length);
  } else {
    const documented = fontList();
    const missing = used.filter(function (name) {
      return documented.indexOf(name) === -1;
    });
    const stale = documented.filter(function (name) {
      return used.indexOf(name) === -1;
    });
    console.log('used: ' + used.length + ' / in fonts.css: ' + documented.length);
    console.log('missing from fonts.css: ' + (missing.length ? missing.join(', ') : '(none)'));
    console.log('listed but unused: ' + (stale.length ? stale.join(', ') : '(none)'));
    if (missing.length) process.exitCode = 1;
  }
}

module.exports = { collect: collect, fontList: fontList };
