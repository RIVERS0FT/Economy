import { test, expect } from '@playwright/test';

test('a delayed old-account error cannot mark the new account save epoch stale', async ({ page }) => {
  await page.route('**/audit-error-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Error session harness</title>' }));
  await page.goto('audit-error-harness');
  const result = await page.evaluate(async () => {
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const apiUrl = '/economy/src/api/game.ts';
    const session = await import(sessionUrl);
    const api = await import(apiUrl);
    session.beginGameWriteSession(809);
    let started!: () => void;
    let release!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    window.fetch = async () => {
      const response = Response.json({}, { status: 409 });
      response.json = async () => { started(); await gate; return { code: 'SAVE_EPOCH_MISMATCH', message: 'old account epoch changed' }; };
      return response;
    };
    const request = api.getGameState().then(() => 'incorrect-success', (error: { code: string }) => error.code);
    await reading;
    session.endGameWriteSession();
    api.resetGameSession();
    session.beginGameWriteSession(810);
    release();
    return { code: await request, stale: api.getPageSaveEpochErrorMessage() };
  });
  expect(result.code).toBe('WRITE_SESSION_CHANGED');
  expect(result.stale).toBe('');
});
