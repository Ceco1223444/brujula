import { expect, test } from '@playwright/test';

async function completeReporterOnboarding(page, name = 'Maria P.') {
  await page.goto('/field');
  await page.getByLabel('Idioma / Language').selectOption('en');
  await page.getByText('Reporter', { exact: true }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Enter the field' }).click();
  await expect(page.getByRole('heading', { name: 'Brújula · Field' })).toBeVisible();
}

async function completeCrewOnboarding(page) {
  await page.goto('/field');
  await page.getByLabel('Idioma / Language').selectOption('en');
  await page.getByText('Specialized crew', { exact: true }).click();
  await page.getByLabel('Team or lead name').fill('Crew Alpha');
  await page.getByText('Rescue', { exact: true }).click();
  await page.getByLabel('People').fill('5');
  await page.getByLabel('Where you are').fill('Caraballeda');
  await page.getByRole('button', { name: 'Enter the field' }).click();
  await expect(page.getByText('Crew Alpha · specialized crew')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/field');
  await page.evaluate(() => localStorage.clear());
});

test('onboarding starts in English, switches language instantly, and persists it', async ({ page }) => {
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Welcome to Brújula' })).toBeVisible();
  await expect(page.getByLabel('Idioma / Language')).toHaveValue('en');
  await expect(page.getByText('Reporter', { exact: true })).toBeVisible();

  await page.getByLabel('Idioma / Language').selectOption('es');
  await expect(page.getByRole('heading', { name: 'Bienvenido a Brújula' })).toBeVisible();
  await expect(page.getByText('Reportero', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bienvenido a Brújula' })).toBeVisible();
  await expect(page.getByLabel('Idioma / Language')).toHaveValue('es');
});

test('reporter can submit a report and see it progress through the outbox', async ({ page }) => {
  await completeReporterOnboarding(page);

  await page.getByPlaceholder(/Building collapsed in Playa Grande/).fill('Building collapsed in Playa Grande with 8 people trapped');
  await page.getByText('Rescue', { exact: true }).click();
  await page.getByLabel('People').fill('8');
  await page.getByLabel('Location').fill('Playa Grande');
  await page.getByRole('button', { name: 'Send report' }).click();

  await expect(page.getByText('Report saved — it will be sent to the hub')).toBeVisible();
  await expect(page.getByText('My reports')).toBeVisible();
  await expect(page.getByText('Building collapsed in Playa Grande')).toBeVisible();
  await expect(page.getByText(/Processed|Sent/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('How to help now')).toBeVisible({ timeout: 10_000 });
});

test('settings menu changes field display language after onboarding', async ({ page }) => {
  await page.reload();
  await page.getByLabel('Idioma / Language').selectOption('es');
  await page.getByText('Reportero', { exact: true }).click();
  await page.getByLabel('Tu nombre').fill('María P.');
  await page.getByRole('button', { name: 'Entrar al terreno' }).click();
  await expect(page.getByText('¿Qué está pasando?')).toBeVisible();

  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();

  await expect(page.getByText("What's happening?")).toBeVisible();
  await expect(page.getByRole('menu')).toBeHidden();

  await page.reload();
  await expect(page.getByText("What's happening?")).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('menuitemradio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
});

test('crew profile exposes mission status and assignment inbox', async ({ page }) => {
  await completeCrewOnboarding(page);

  await expect(page.getByText('My status')).toBeVisible();
  await page.getByRole('button', { name: 'En route' }).click();
  await expect(page.getByRole('button', { name: 'En route' })).toHaveClass(/selected/);

  await page.getByRole('button', { name: 'Assignments' }).click();
  await expect(page.locator('.empty', { hasText: /No assignments/i })).toBeVisible();
});

test('field assistant tab sends a question and shows the answer', async ({ page }) => {
  await completeReporterOnboarding(page, 'Ana Field');

  await page.locator('.field-tabs').getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByText(/No questions yet/)).toBeVisible();

  const composer = page.locator('.ask-composer');
  await composer.getByPlaceholder('Type your question…').fill('What should rescue crews remember?');
  await composer.getByRole('button', { name: 'Ask' }).click();

  // Mock mode answers with a fixed demo reply; the live hub grounds it in the board + KB.
  await expect(page.locator('.ask-line--q')).toContainText('What should rescue crews remember?');
  await expect(page.locator('.ask-line--a .ask-text')).not.toBeEmpty({ timeout: 10_000 });
});

test('field layout keeps touch targets usable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await completeReporterOnboarding(page, 'Field responder');

  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

  for (const control of await page.locator('button:visible').all()) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
  }
});
