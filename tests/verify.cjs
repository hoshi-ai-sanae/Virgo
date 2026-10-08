const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { questions, types, evaluate, decide } = require('../diagnosis.js');
const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

// 独立した集計で全4096通りを検証する。
for (let n = 0; n < 4096; n++) {
  const answers = Array.from({ length: 6 }, (_, i) => (n >> (i * 2)) & 3);
  const keys = answers.map((choice, i) => questions[i][1][choice][1]);
  const counts = keys.reduce((map, key) => map.set(key, (map.get(key) || 0) + 1), new Map());
  const max = Math.max(...counts.values());
  const tied = [...counts].filter(([, count]) => count === max).map(([key]) => key);
  let expected;
  for (let i = 5; i >= 0; i--) if (tied.includes(keys[i])) { expected = keys[i]; break; }
  const actual = evaluate(answers);
  assert.equal(actual.main, expected);
  assert.deepEqual([...actual.others].sort(), tied.filter(key => key !== expected).sort());
}
assert.deepEqual(decide(['A', 'B', 'C', 'D']), { main: 'D', others: ['A', 'B', 'C'] });
assert.equal(decide(['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A']).main, 'A');
assert.throws(() => evaluate(new Array(6)));
assert.throws(() => evaluate([0, 1]));
console.log('PASS: 全4096回答・全分類同点・未回答検証');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const url = process.env.APP_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
  async function layout() {
    await page.locator('img:visible').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '横はみ出し');
    assert.equal(await page.locator('img:visible').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0 && Math.abs(img.getBoundingClientRect().width / img.getBoundingClientRect().height - img.naturalWidth / img.naturalHeight) < .02 && img.alt.length > 0)), true, '画像読み込み・比率・代替テキスト');
  }
  async function run(keys) {
    await page.locator('#start-button').click();
    for (let i = 0; i < 6; i++) {
      assert.equal(await page.locator('#count').innerText(), `${i + 1}／6`);
      assert.equal(await page.locator('#next-button').isDisabled(), true);
      await page.locator('input[type=radio]').nth(questions[i][1].findIndex(([, key]) => key === keys[i])).check();
      assert.equal(await page.locator('#quiz-screen').isVisible(), true);
      await layout();
      await page.locator('#next-button').click();
    }
    const expected = decide(keys);
    assert.equal(await page.locator('#result-title').innerText(), types[expected.main].title);
    for (const text of types[expected.main].message) assert.ok((await page.locator('#result-message').innerText()).includes(text));
    assert.equal(await page.locator('#result-step').innerText(), types[expected.main].step);
    assert.equal(await page.locator('#result-self').innerText(), types[expected.main].self);
    assert.equal(await page.locator('#tie-note p').count(), expected.others.length);
    for (const key of expected.others) assert.ok((await page.locator('#tie-note').innerText()).includes(`${types[key].title}も、あなたの中にあります`));
    await layout();
    await page.locator('#retry-button').click();
    assert.equal(await page.locator('#result-title').innerText(), '');
  }
  await page.goto(url);
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await layout();
    for (const key of Object.keys(types)) await run(new Array(6).fill(key));
    await run(['A', 'B', 'A', 'B', 'A', 'B']);
    await run(['A', 'B', 'C', 'A', 'B', 'C']);
  }
  // 戻って全回答を変え、古い得点が残らないことを確認。
  await page.locator('#start-button').click();
  for (let i = 0; i < 5; i++) {
    await page.locator('input').nth(questions[i][1].findIndex(([, key]) => key === 'A')).check();
    await page.locator('#next-button').click();
  }
  for (let i = 5; i > 0; i--) await page.locator('#back-button').click();
  assert.equal(await page.locator('input:checked').count(), 1);
  for (let i = 0; i < 6; i++) {
    await page.locator('input').nth(questions[i][1].findIndex(([, key]) => key === 'B')).check();
    await page.locator('#next-button').click();
  }
  assert.equal(await page.locator('#result-title').innerText(), '整える優しさ');
  await page.locator('#retry-button').click();
  // マウスを使わず、開始→ラジオ選択→結果→再診断。
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) {
    assert.equal(await page.locator('input:checked').count(), 0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('input').nth(1).isChecked(), true);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  }
  assert.equal(await page.locator('#result-screen').isVisible(), true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#start-screen').isVisible(), true);
  assert.deepEqual(errors, []);
  assert.ok(requests.every(request => request.startsWith('file:') || request.startsWith(new URL(url).origin + '/')), '外部通信がないこと');
  const out = path.resolve(__dirname, '../preview-output');
  require('node:fs').mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'mobile-start.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(out, 'desktop-start.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#start-button').click();
  await page.locator('input').first().check();
  await page.screenshot({ path: path.join(out, 'mobile-question.png'), fullPage: true });
  for (let i = 0; i < 6; i++) {
    await page.locator('input').nth(questions[i][1].findIndex(([, key]) => key === 'A')).check();
    await page.locator('#next-button').click();
  }
  await page.screenshot({ path: path.join(out, 'mobile-result.png'), fullPage: true });
  console.log('PASS: 5画面幅・4結果・2/3分類同点・回答変更・再診断・キーボード・画像・外部通信なし');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
