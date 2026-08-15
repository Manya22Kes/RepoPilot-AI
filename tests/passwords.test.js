const { hashPassword, verifyPassword } = require('../src/utils/passwords');

describe('password hashing', () => {
  it('hashes a password to something different from the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('my-password');
    expect(await verifyPassword('my-password', hash)).toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('my-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });
});
