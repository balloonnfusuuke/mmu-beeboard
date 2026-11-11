/* assets/js/i18n.js の辞書と、FAQ の並び（assets/js/pages/faq.js の ITEMS）を突き合わせる。
   DOM も localStorage も使わない。document は lang を書くところだけの最小の代役。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const i18nSource = readFileSync(join(root, 'assets/js/i18n.js'), 'utf8');
const faqSource = readFileSync(join(root, 'assets/js/pages/faq.js'), 'utf8');

/* i18n.js は window を global として受け取り、document.documentElement.lang を書く。 */
function loadI18n() {
  const documentElement = { lang: '' };
  const document = {
    readyState: 'complete',
    documentElement,
    addEventListener() {},
    querySelectorAll() {
      return [];
    }
  };
  const context = vm.createContext({ document });
  context.window = context;
  vm.runInContext(i18nSource, context, { filename: 'assets/js/i18n.js' });
  return context.BB.i18n;
}

/* faq.js の ITEMS だけを取り出して評価する。画面のコードは動かさない。 */
function loadFaqItems() {
  const start = faqSource.indexOf('var ITEMS = [');
  assert.notEqual(start, -1, 'faq.js に ITEMS がありません');
  const end = faqSource.indexOf('];', start);
  assert.notEqual(end, -1, 'faq.js の ITEMS が閉じていません');
  const literal = faqSource.slice(start + 'var ITEMS = '.length, end + 1);
  const context = vm.createContext({});
  return vm.runInContext('(' + literal + ')', context);
}

/* 辞書を「キーの並び」に平らにする。途中のオブジェクトは葉にしない。 */
function flatten(node, prefix, out) {
  for (const key of Object.keys(node)) {
    const value = node[key];
    const path = prefix ? prefix + '.' + key : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out.push(path);
  }
  return out;
}

const i18n = loadI18n();
const items = loadFaqItems();
const enKeys = flatten(i18n.dict.en, '', []).sort();
const jaKeys = flatten(i18n.dict.ja, '', []).sort();

test('en と ja のキーの一覧が同じ', () => {
  const onlyEn = enKeys.filter((key) => !jaKeys.includes(key));
  const onlyJa = jaKeys.filter((key) => !enKeys.includes(key));
  assert.deepEqual(onlyEn, [], 'ja に無いキー: ' + onlyEn.join(', '));
  assert.deepEqual(onlyJa, [], 'en に無いキー: ' + onlyJa.join(', '));
});

test('faq.js の ITEMS はすべて辞書にある', () => {
  const keys = items.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length, 'ITEMS に同じ key が 2 回あります');
  for (const item of items) {
    for (const lang of ['en', 'ja']) {
      const dict = i18n.dict[lang].faq.items;
      assert.ok(dict[item.key], lang + ' の faq.items.' + item.key + ' がありません');
      assert.equal(typeof dict[item.key].q, 'string', lang + ' の ' + item.key + '.q が文字列ではありません');
      assert.equal(typeof dict[item.key].a, 'string', lang + ' の ' + item.key + '.a が文字列ではありません');
      assert.ok(dict[item.key].q.length > 0, lang + ' の ' + item.key + '.q が空です');
      assert.ok(dict[item.key].a.length > 0, lang + ' の ' + item.key + '.a が空です');
      if (item.href) {
        assert.equal(
          typeof dict[item.key].link,
          'string',
          lang + ' の ' + item.key + '.link がありません（href があります）'
        );
      }
    }
  }
});

test('t() がキー名をそのまま返さない（en と ja の両方）', () => {
  for (const lang of ['en', 'ja']) {
    i18n.setLang(lang);
    assert.equal(i18n.lang(), lang);
    for (const item of items) {
      for (const field of ['q', 'a']) {
        const key = 'faq.items.' + item.key + '.' + field;
        const value = i18n.t(key);
        assert.notEqual(value, key, lang + ' で ' + key + ' が未定義です');
        assert.ok(value.length > 0, lang + ' で ' + key + ' が空です');
      }
      if (item.href) {
        const key = 'faq.items.' + item.key + '.link';
        assert.notEqual(i18n.t(key), key, lang + ' で ' + key + ' が未定義です');
      }
    }
  }
});

test('q25 のあとに q26・q27・q28・q29・q30 が並ぶ', () => {
  /* vm の context で作られた配列は prototype が違うので、素の配列に戻してから比べる。 */
  const ai = Array.from(items, (item) => item).filter((item) => item.cat === 'ai').map((item) => item.key);
  const tail = ai.slice(ai.indexOf('q25'));
  assert.deepEqual(tail, ['q25', 'q26', 'q27', 'q28', 'q29', 'q30']);
  assert.equal(items.find((item) => item.key === 'q29').href, 'settings.html');
});
