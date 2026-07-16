import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRegistrationEmailConfiguration,
  sendRegistrationEmail,
} from '../src/email.js';

function withEmailEnvironment(values, callback) {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });
}

test('reports whether both Resend settings are configured', async () => {
  await withEmailEnvironment({ RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: undefined }, () => {
    assert.deepEqual(getRegistrationEmailConfiguration(), {
      configured: false,
      apiKeyConfigured: true,
      fromConfigured: false,
    });
  });

  await withEmailEnvironment({
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'RIVERSOFT <noreply@example.com>',
  }, () => {
    assert.deepEqual(getRegistrationEmailConfiguration(), {
      configured: true,
      apiKeyConfigured: true,
      fromConfigured: true,
    });
  });
});

test('returns a safe explicit error when email delivery is not configured', async () => {
  await withEmailEnvironment({ RESEND_API_KEY: undefined, RESEND_FROM_EMAIL: undefined }, async () => {
    await assert.rejects(
      () => sendRegistrationEmail({
        to: 'player@example.com',
        code: '123456',
        idempotencyKey: 'email-test-key',
        expiresInMinutes: 10,
      }),
      (error) => {
        assert.equal(error.statusCode, 424);
        assert.equal(error.code, 'EMAIL_SERVICE_NOT_CONFIGURED');
        assert.match(error.message, /未配置/);
        return true;
      },
    );
  });
});
