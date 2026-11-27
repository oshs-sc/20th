// Desktop-only relocation smoke test for the event bundle under /typing-writing/.
// Serve the repository root on 127.0.0.1:5177 first. Firebase adapters are replaced
// in-browser with test-only values; no Firebase project or production records are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolve } = require('node:path');
const repositoryRoot = resolve(__dirname, '../..');
assert.deepEqual(fs.readdirSync(repositoryRoot).filter(name => name !== '.git').sort(), ['README.md', 'index.html', 'typing-writing']);
const { chromium } = require('playwright');

const base = process.env.SITE_LAYOUT_BASE || 'http://127.0.0.1:5177';
const out = process.env.SITE_LAYOUT_ARTIFACT_DIR || '/tmp/oshs-site-layout';
fs.mkdirSync(out, { recursive: true });

const firebaseMock = `
export const getPublicDb = async () => ({ app: { options: { projectId: 'desktop-layout-test-only' } } });
export const getDoc = async () => ({ data: () => ({ boothMode: false, idleMinutes: 10 }) });
export const doc = (...parts) => parts;
export const collection = (...parts) => parts;
export const getDocs = async () => ({ docs: [], empty: true, size: 0 });
export const setDoc = async () => {};
export const deleteDoc = async () => {};
export const serverTimestamp = () => new Date();
export const withDeadline = async value => value;
export const sessionPolicy = value => value || { boothMode: false, idleMinutes: 10 };
export const firebaseError = value => value instanceof Error ? value : new Error(String(value));
export const errorMessage = value => firebaseError(value).message;
export const loginAdmin = async () => { throw new Error('관리자 로그인은 이 레이아웃 테스트에서 사용하지 않습니다.'); };
export const logoutAdmin = async () => {};
export const watchAdminSession = async onChange => { onChange({ authenticated: false }); return () => {}; };
export const resetAdminPassword = async () => {};
export const adminContext = async () => ({ db: {}, uid: 'test-only', email: 'unused@example.test' });
export const changeAdminEmail = async () => {};
export const changeAdminPassword = async () => {};
export const createOperator = async () => {};
`;

const databaseMock = `
import { countKeystrokes } from '/typing-writing/typing/scoring.js';
const text = '가나';
export const DEFAULT_SESSION_POLICY = { boothMode: false, idleMinutes: 10 };
export const readEvent = async () => ({ phase: 'A', activeChallengeId: 'layout-check', submissionsEnabled: true, welcomeEnabled: true });
export const readChallenge = async () => ({ challengeId: 'layout-check', text, title: '배치 확인 문구', referenceKeystrokes: countKeystrokes(text), practice: false });
export const readTypingCertificate = async () => window.__certificate || null;
export const validateTypingResult = value => value;
export const submitTyping = async (_db, _participant, record) => { window.__record = record; window.__submitCalls = (window.__submitCalls || 0) + 1; return record; };
export const submitLetter = async () => { throw new Error('이 테스트는 글을 제출하지 않습니다.'); };
export const readLettersPage = async () => ({ items: [], cursor: null, hasNext: false });
export const readTypingPage = async () => ({ items: [], cursor: null, hasNext: false });
export const readChallenges = async () => [];
export const readSessionPolicy = async () => DEFAULT_SESSION_POLICY;
export const saveSessionPolicy = async () => {};
export const deleteTyping = async () => {};
export const readTyping = async () => null;
export const reviewTyping = async () => {};
export const deleteLetter = async () => {};
export const exportFirebase = async () => {};
export const purgeLetter = async () => {};
export const readLetter = async () => null;
export const readLetterHistory = async () => [];
export const restoreLetter = async () => {};
export const reviewLetters = async () => {};
export const saveLetter = async () => {};
export const synchronizePublicLetters = async () => {};
export const deleteChallenge = async () => {};
export const saveChallenge = async () => {};
export const selectChallenge = async () => {};
export const setEvent = async () => {};
export const readPublicLetters = async () => ({ letters: [], cursor: null, hasNext: false });
export const readPublicLetter = async () => null;
`;

const publicMock = `
export const readEvent = async () => ({ phase: 'A', submissionsEnabled: true, welcomeEnabled: true });
export const readPublicLetters = async () => ({ letters: [], cursor: null, hasNext: false });
export const readPublicLetter = async () => null;
`;

async function installBackendMocks(page) {
  await page.route('**/typing-writing/db/firebase.js*', route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: firebaseMock }));
  await page.route('**/typing-writing/db/database.js*', route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: databaseMock }));
  await page.route('**/typing-writing/db/public.js*', route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: publicMock }));
}

async function pageWithMocks(browser, errors = []) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', error => errors.push(error.message));
  await installBackendMocks(page);
  return page;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pageErrors = [];
  try {
    // Preserve the user's own root HTML; no added event hub or redirect files.
    const hub = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    hub.on('pageerror', error => pageErrors.push(error.message));
    await hub.goto(base + '/');
    await hub.getByRole('heading', { name: '천안오성고등학교 20대 학생회', exact: true }).waitFor();
    await hub.screenshot({ path: `${out}/root-desktop.png`, animations: 'disabled' });

    // Confirm the moved event landing page and its relative mascot asset resolve from the new base.
    await hub.goto(base + '/typing-writing/');
    await hub.getByRole('heading', { name: '홍보×서기 행사' }).waitFor();
    assert.equal(await hub.locator('.home-events a').count(), 2);
    assert.equal(await hub.locator('.home-events a').nth(0).getAttribute('href'), './typing/');
    assert.equal(await hub.locator('.home-events a').nth(1).getAttribute('href'), './write/');
    const mascot = await hub.locator('.home-mascot img').evaluate(img => ({
      src: new URL(img.currentSrc).pathname,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
    assert.equal(mascot.src, '/typing-writing/assets/obyeol.svg');
    assert(mascot.width > 0 && mascot.height > 0, 'nested mascot SVG must load');
    await hub.screenshot({ path: `${out}/event-landing-desktop.png`, animations: 'disabled' });
    await hub.close();

    // Removed legacy routes stay absent instead of redirecting elsewhere.
    const removedPaths = ['/typing/', '/typing/admin/', '/write/', '/write/admin/', '/welcome/', '/welcome/admin/', '/redirect.js', '/style.css', '/serve.mjs'];
    for (const path of removedPaths) assert.equal((await fetch(base + path)).status, 404, path);

    // Run the real relocated typing UI/engine with only Firebase reads and writes mocked.
    const typing = await pageWithMocks(browser, pageErrors);
    const localRequests = [];
    typing.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === base) localRequests.push(url.pathname);
    });
    await typing.goto(base + '/typing-writing/typing/');
    await typing.locator('#entry-form').waitFor();
    assert(localRequests.includes('/typing-writing/typing/style.css'));
    assert(localRequests.includes('/typing-writing/typing/app.js'));
    assert.equal(await typing.locator('#typing-input').isDisabled(), true);
    await typing.locator('[name=studentNumber]').fill('20101');
    await typing.locator('[name=name]').fill('경로확인');
    await typing.locator('#entry-form button[type=submit]').click();
    await typing.locator('#typing-input:enabled').waitFor();
    assert.equal(await typing.locator('#challenge').innerText(), '가나');

    // Simulate a Korean IME composition of the first syllable, then type the next one.
    await typing.locator('#typing-input').evaluate(input => {
      input.focus();
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true, inputType: 'insertCompositionText', data: 'ㄱ', isComposing: true,
      }));
      input.value = 'ㄱ';
      input.setSelectionRange(1, 1);
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'insertCompositionText', data: 'ㄱ', isComposing: true,
      }));
      input.value = '가';
      input.setSelectionRange(1, 1);
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '가' }));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '가' }));
    });
    assert.equal(await typing.locator('#typing-input').inputValue(), '가');
    assert.equal(await typing.locator('#errors').innerText(), '0');
    await typing.locator('#typing-input').pressSequentially('나');
    await typing.locator('#record-dialog[open]').waitFor();
    await typing.waitForFunction(() => document.querySelector('#record-save-status').dataset.state === 'saved');
    const saved = await typing.evaluate(() => ({ record: window.__record, calls: window.__submitCalls }));
    assert.equal(saved.calls, 1);
    assert.equal(saved.record.participantId, '20101');
    assert.equal(saved.record.displayName, '경로확인');
    assert.equal(saved.record.errors, 0);
    assert.equal(saved.record.challengeId, 'layout-check');
    assert.equal(await typing.locator('#record-save-status').isVisible(), false);
    await typing.screenshot({ path: `${out}/typing-record-desktop.png`, animations: 'disabled' });
    await typing.close();

    // A returning participant sees the existing certificate and cannot start another attempt.
    const returning = await pageWithMocks(browser, pageErrors);
    const certificate = {
      id: 'layout-certificate', participantId: '20101', displayName: '경로확인',
      challengeId: 'layout-check', title: '배치 확인 문구', text: '가나', referenceKeystrokes: 4,
      elapsedMs: 12400, speed: 193, errors: 1, score: 187,
      completedAt: '2026-11-26T00:00:00.000Z',
    };
    await returning.goto(base + '/typing-writing/typing/');
    await returning.evaluate(value => { window.__certificate = value; }, certificate);
    await returning.locator('[name=studentNumber]').fill('20101');
    await returning.locator('[name=name]').fill('경로확인');
    await returning.locator('#entry-form button[type=submit]').click();
    await returning.locator('#record-dialog[open]').waitFor();
    assert.equal(await returning.locator('#typing-input').isDisabled(), true);
    assert.equal(await returning.locator('#typing-input').inputValue(), '가나');
    assert.equal(await returning.locator('#record-score').innerText(), '187');
    assert.equal(await returning.locator('#record-errors').innerText(), '1');
    assert.equal(await returning.locator('#record-save-status').textContent(), '');
    assert.equal(await returning.locator('#student-logout').innerText(), '다음 참가자');
    assert.equal(await returning.evaluate(() => window.__submitCalls || 0), 0);
    await returning.screenshot({ path: `${out}/returning-certificate-desktop.png`, animations: 'disabled' });
    await returning.close();

    // Writing screen counter and form controls also execute from the relocated directory.
    const writing = await pageWithMocks(browser, pageErrors);
    await writing.goto(base + '/typing-writing/write/');
    await writing.locator('#submit:not(:disabled)').waitFor();
    assert.equal(await writing.locator('#student-number').getAttribute('placeholder'), '학번');
    await writing.locator('#content').fill('안녕하세요');
    await writing.waitForFunction(() => document.querySelector('#content-count').textContent === '5자');
    assert.equal(await writing.evaluate(() => window.__submitCalls || 0), 0);
    await writing.screenshot({ path: `${out}/writing-counter-desktop.png`, animations: 'disabled' });
    await writing.close();

    // Nested admin navigation is rendered unauthenticated; no credentials are entered.
    const admin = await pageWithMocks(browser, pageErrors);
    await admin.goto(base + '/typing-writing/typing/admin/');
    await admin.locator('nav[aria-label="관리 기능"]').waitFor();
    assert.equal(await admin.locator('#login input').count(), 2);
    assert.equal(await admin.locator('#view').count(), 0);
    let links = await admin.locator('nav[aria-label="관리 기능"] a').evaluateAll(anchors =>
      anchors.map(anchor => ({ href: new URL(anchor.href).pathname, title: anchor.textContent.trim() })));
    assert.deepEqual(links.map(link => link.href), [
      '/typing-writing/typing/admin/', '/typing-writing/write/admin/', '/typing-writing/welcome/admin/',
    ]);
    await admin.screenshot({ path: `${out}/nested-admin-login-desktop.png`, animations: 'disabled' });
    await admin.locator('nav[aria-label="관리 기능"] a').nth(1).click();
    await admin.waitForURL('**/typing-writing/write/admin/');
    await admin.locator('nav[aria-label="관리 기능"] a[aria-current="page"]').waitFor();
    links = await admin.locator('nav[aria-label="관리 기능"] a').evaluateAll(anchors =>
      anchors.map(anchor => new URL(anchor.href).pathname));
    assert.deepEqual(links, [
      '/typing-writing/typing/admin/', '/typing-writing/write/admin/', '/typing-writing/welcome/admin/',
    ]);
    assert.equal(await admin.locator('#login input').count(), 2);
    await admin.close();

    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);
    console.log(JSON.stringify({
      base, desktopOnly: true, removedLegacyPaths: removedPaths.length,
      checked: ['minimal root and user HTML', 'nested event assets', 'typing login', 'IME composition and saved result',
        'returning certificate read-only flow', 'writing content counter', 'unauthenticated nested admin navigation'],
      firebase: 'isolated browser mocks only; no production reads/writes',
      screenshots: out,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
