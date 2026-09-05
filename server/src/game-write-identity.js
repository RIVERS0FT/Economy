/** The authenticated cookie remains authoritative. This additive header prevents stale-tab writes to a different account. */
export function assertGameWriteIdentity(user, expectedUserId) {
  if (expectedUserId === undefined) return;
  const expected = typeof expectedUserId === 'string' && /^[1-9][0-9]*$/.test(expectedUserId) ? Number(expectedUserId) : NaN;
  if (!Number.isSafeInteger(expected) || expected !== Number(user?.id)) {
    const error = new Error('登录账号已变化，请在原账号中确认操作结果');
    error.statusCode = 409;
    error.code = 'WRITE_SESSION_MISMATCH';
    throw error;
  }
}
