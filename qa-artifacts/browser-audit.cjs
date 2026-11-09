/* Test-only runner. Uses installed Chrome and an isolated browser context. */
const { chromium } = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const origin = 'http://127.0.0.1:5174';
const api = 'http://127.0.0.1:18000';
const results = { routes: [], interactions: [], errors: [], browser: '', externalBlocked: [] };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  results.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(origin) && !url.startsWith(api)) {
      results.externalBlocked.push(new URL(url).origin);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let apiFailures = [];
  page.on('response', response => {
    if (response.url().startsWith(api) && response.status() >= 400)
      apiFailures.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  async function visit(route, role = 'anonymous', width = 1440) {
    errors.length = 0; apiFailures = [];
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    try {
      await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 20000 });
      const summary = await page.evaluate(() => ({
        textLength: document.body.innerText.length,
        heading: [...document.querySelectorAll('h1,h2')].map(e => e.textContent).slice(0, 4),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
        alerts: [...document.querySelectorAll('[role="alert"]')].map(e => e.textContent),
        unlabeledInputs: [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')]
          .filter(e => !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
          .map(e => ({ tag: e.tagName, type: e.type, placeholder: e.getAttribute('placeholder') })),
      }));
      results.routes.push({ route, role, width, finalPath: new URL(page.url()).pathname, ...summary, errors: [...errors], apiFailures: [...apiFailures] });
      if (['/', '/login', '/organizer/dashboard', '/admin', '/services/equipment-reservations'].includes(route)) {
        await page.screenshot({ path: path.join(root, `browser-${role}-${route.replaceAll('/', '_') || 'home'}-${width}.png`), fullPage: true });
      }
    } catch (error) { results.routes.push({ route, role, width, failure: String(error) }); }
  }
  try {
    for (const route of ['/', '/events', '/venues', '/organizations', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/admin', '/booking/new', '/my-waitlists', '/services', '/provider/dashboard', '/unknown-route'])
      await visit(route);
    for (const width of [390, 768]) for (const route of ['/', '/events', '/venues', '/login', '/signup']) await visit(route, 'anonymous', width);
    await visit('/login');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    results.interactions.push({ name: 'empty login uses native validation', valid: await page.locator('form').evaluate(f => f.checkValidity()) === false });
    await page.getByLabel('Email address', { exact: true }).fill('qa-audit-organizer@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrong-local-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByRole('alert').waitFor();
    results.interactions.push({ name: 'invalid login', alert: await page.getByRole('alert').innerText() });
    for (const role of ['organizer', 'student', 'system_admin', 'service_provider', 'venue_admin']) {
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto(origin + '/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Email address', { exact: true }).fill(`qa-audit-${role}@example.com`);
      await page.getByLabel('Password', { exact: true }).fill('Local-QA-only-123!');
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
      await page.waitForURL(url => url.pathname !== '/login', { timeout: 10000 });
      results.interactions.push({ name: `${role} login redirect`, path: new URL(page.url()).pathname });
      const before = page.url();
      await page.reload({ waitUntil: 'networkidle' });
      results.interactions.push({ name: `${role} session survives reload`, samePath: before === page.url() });
      let routes;
      if (role === 'organizer') routes = ['/organizer/dashboard', '/booking/new', '/notifications', '/my-waitlists', '/services', ...['event-registration-rsvp','qr-tickets-attendance','service-provider-directory','equipment-reservations','digital-certificates'].map(s => '/services/' + s), '/admin'];
      else if (role === 'system_admin') {
        const source = fs.readFileSync(path.join(root, '../src/data/adminMock.ts'), 'utf8');
        const ids = [...source.slice(0, source.indexOf('export const', source.indexOf('adminNavItems') + 20)).matchAll(/id: '([^']+)'/g)].map(m => m[1]);
        routes = ['/admin', ...ids.filter(id => id !== 'dashboard').map(id => '/admin/' + id), '/admin/search?q=QA'];
      } else if (role === 'student') routes = ['/student/dashboard', '/notifications', '/my-waitlists', '/services', '/booking/new', '/admin'];
      else if (role === 'service_provider') routes = ['/provider/dashboard', '/provider/requests', '/admin'];
      else routes = ['/organizer/dashboard', '/booking/new', '/admin'];
      for (const route of routes) await visit(route, role);
      await visit(routes[0], role, 390);
    }
    // Exercise safe failure UX with intentionally failed requests to the local API.
    await page.route(api + '/venues**', route => route.abort('failed'));
    await visit('/venues', 'network-failure');
    await page.unroute(api + '/venues**');
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    results.interactions.push({ name: 'first keyboard focus', focused: await page.evaluate(() => ({ text: document.activeElement?.textContent, tag: document.activeElement?.tagName })) });
  } catch (error) {
    results.errors.push(String(error));
  } finally {
    results.externalBlocked = [...new Set(results.externalBlocked)];
    fs.writeFileSync(path.join(root, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ routes: results.routes.length, errors: results.errors, routeErrors: results.routes.filter(r => r.errors?.length || r.failure), apiFailures: results.routes.filter(r => r.apiFailures?.length), overflow: results.routes.filter(r => r.horizontalOverflow), interactions: results.interactions }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
