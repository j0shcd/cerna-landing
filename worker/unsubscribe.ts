const encoder = new TextEncoder();
export async function unsubscribeToken(signupId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`unsubscribe:${signupId}`));
  const hex = [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${signupId}.${hex}`;
}
export async function verifyUnsubscribeToken(token: unknown, secret: string): Promise<string | null> {
  if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{1,128}\.[0-9a-f]{64}$/.test(token)) return null;
  const id = token.slice(0, token.indexOf('.'));
  const expected = await unsubscribeToken(id, secret);
  let difference = 0;
  // Both strings have the same length after validation; compare every byte.
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return difference === 0 ? id : null;
}
