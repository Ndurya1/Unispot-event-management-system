const { chromium } = require(process.env.QA_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://127.0.0.1:5174';
const api = 'http://127.0.0.1:18000';
const result = { checks: [], errors: [] };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('dialog', dialog => dialog.accept());
  await context.route('**/*', route => {
    const url = route.request().url();
    return /^https?:/.test(url) && !url.startsWith(origin) && !url.startsWith(api) ? route.abort() : route.continue();
  });
  try {
    await page.goto(origin + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('Email address', { exact: true }).fill('qa-audit-organizer@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Local-QA-only-123!');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForURL('**/organizer/dashboard');
    const venues = await (await context.request.get(api + '/venues')).json();
    await page.goto(origin + '/venues/' + venues[0].id, { waitUntil: 'networkidle' });
    result.checks.push({ name: 'dynamic venue detail renders', h1: await page.locator('h1').allTextContents() });
    await page.goto(origin + '/booking/new?venue=' + venues[0].id, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    result.checks.push({ name: 'empty booking validation', message: await page.getByRole('alert').innerText() });
    const date = new Date(); date.setDate(date.getDate() + 15 + Math.floor(Math.random() * 100));
    const eventName = 'QA browser booking ' + Date.now();
    await page.getByLabel('Event name', { exact: true }).fill(eventName);
    await page.getByLabel('Event date', { exact: true }).fill(date.toISOString().slice(0,10));
    await page.getByLabel('Start time', { exact: true }).selectOption('10:00');
    await page.getByLabel('End time', { exact: true }).selectOption('12:00');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Expected attendance', { exact: true }).fill('20');
    await page.getByLabel('Purpose of booking', { exact: true }).selectOption('Workshop');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const responsePromise = page.waitForResponse(r => r.url() === api + '/bookings' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirm booking', exact: true }).click();
    const response = await responsePromise;
    result.checks.push({ name: 'UI booking submission', status: response.status() });
    if (response.status() !== 201) throw new Error('Booking failed: ' + await response.text());
    const booking = await response.json();
    await page.getByRole('heading', { name: 'Your venue is booked.' }).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'booking-success.png'), fullPage: true });
    await page.getByRole('link', { name: 'View my bookings', exact: true }).click();
    await page.waitForLoadState('networkidle');
    result.checks.push({ name: 'View my bookings destination', path: new URL(page.url()).pathname });
    await page.goto(origin + '/organizer/dashboard', { waitUntil: 'networkidle' });
    result.checks.push({ name: 'booking persisted after navigation', confirmed: await page.getByText('CONFIRMED', { exact: true }).count() > 0 });
    const [cancelResponse] = await Promise.all([
      page.waitForResponse(r => r.url() === `${api}/bookings/${booking.id}/cancel`),
      page.locator('.dashboard-booking-row').filter({ hasText: 'CONFIRMED' }).getByRole('button', { name: 'Cancel', exact: true }).first().click(),
    ]);
    result.checks.push({ name: 'UI cancellation', status: cancelResponse.status() });
    await page.reload({ waitUntil: 'networkidle' });
    result.checks.push({ name: 'cancellation persisted', cancelled: await page.getByText('CANCELLED', { exact: true }).count() > 0 });
    const events = await (await context.request.get(api + '/events')).json();
    await page.goto(origin + '/events/' + events[0].id, { waitUntil: 'networkidle' });
    result.checks.push({ name: 'dynamic event detail renders', h1: await page.locator('h1').allTextContents() });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    const menu = page.getByRole('button', { name: /open.*menu/i });
    if (await menu.count()) {
      await menu.click();
      result.checks.push({ name: 'mobile menu opens', expanded: await page.getByRole('button', { name: /close.*menu/i }).getAttribute('aria-expanded') });
    }
  } catch (error) { result.errors.push(String(error)); }
  finally {
    fs.writeFileSync(path.join(__dirname, 'booking-journey.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
