// Exercise the shipped enhancement with a small DOM adapter; browser QA is separate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

const bundle = (await readdir(new URL('../../dist/_astro/', import.meta.url))).find(name => name.startsWith('WaitlistForm.') && name.endsWith('.js'));
assert.ok(bundle, 'Run npx astro build before this test');
let run = 0;
function element() {
  return {
    textContent: '', value: '', disabled: false, validity: { valid: true }, listeners: {}, attributes: {}, focused: false,
    classList: { values: new Set(), add(name) { this.values.add(name); }, contains(name) { return this.values.has(name); } },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { this.focused = true; },
  };
}
function box() {
  const email = element(), company = element(), status = element(), button = element(), form = element(), wrapper = element();
  form.querySelector = selector => ({ '[name="email"]': email, '[name="company"]': company })[selector];
  wrapper.querySelector = selector => ({ form, button, '.form-status': status, '[name="email"]': email })[selector];
  return Object.assign(wrapper, { email, company, status, button, form });
}
async function setup(search = '') {
  const boxes = [box(), box()];
  globalThis.document = { querySelectorAll: () => boxes };
  globalThis.location = { search };
  globalThis.window = { setTimeout };
  await import(new URL(`../../dist/_astro/${bundle}?run=${run++}`, import.meta.url));
  return boxes;
}
const submit = box => box.form.listeners.submit({ preventDefault() {} });

test('JSON contract, pending lock and shared success', async () => {
  const boxes = await setup();
  boxes[0].email.value = 'person@example.com';
  boxes[0].company.value = '';
  boxes[1].email.value = 'second@example.com';
  let resolve;
  let calls = 0;
  globalThis.fetch = (url, options) => {
    calls++;
    assert.equal(url, '/api/waitlist');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { email: 'person@example.com', company: '' });
    return new Promise(done => { resolve = done; });
  };
  const pending = submit(boxes[0]);
  assert.ok(boxes.every(box => box.button.disabled && box.button.textContent === 'Joining…'));
  await submit(boxes[1]);
  assert.equal(calls, 1);
  resolve({ status: 200, json: async () => ({ ok: true }) });
  await pending;
  for (const box of boxes) {
    assert.ok(box.classList.contains('is-done'));
    assert.equal(box.status.textContent, 'You’re on the list. We’ll write to person@example.com when Cerna opens.');
    assert.equal(box.button.disabled, false);
  }
});

test('all API errors retain the address and reset pending state', async () => {
  for (const [status, error, text] of [
    [400, 'invalid_email', 'That address looks incomplete. Check for a missing @ or a typo.'],
    [429, 'rate_limited', 'Too many tries from this connection. Please try again in a few minutes.'],
    [500, 'save_failed', 'We couldn’t save your address just now, so you’re not on the list yet. Please try again in a minute.'],
  ]) {
    const boxes = await setup();
    boxes[0].email.value = 'person@example.com';
    globalThis.fetch = async () => ({ status, json: async () => ({ ok: false, error }) });
    await submit(boxes[0]);
    assert.equal(boxes[0].email.value, 'person@example.com');
    assert.equal(boxes[0].status.textContent, text);
    assert.ok(!boxes[0].classList.contains('is-done'));
    assert.ok(boxes.every(box => !box.button.disabled));
  }
});

test('invalid input, network errors and malformed responses cannot claim success', async () => {
  const boxes = await setup();
  boxes[0].email.value = 'incomplete';
  boxes[0].email.validity.valid = false;
  globalThis.fetch = async () => { throw Error('must not fetch'); };
  await submit(boxes[0]);
  assert.equal(boxes[0].email.attributes['aria-invalid'], 'true');
  boxes[0].email.value = 'person@example.com';
  boxes[0].email.validity.valid = true;
  for (const response of [null, { status: 500, json: async () => ({ ok: true }) }, { status: 200, json: async () => ({ ok: false }) }]) {
    globalThis.fetch = async () => { if (response === null) throw Error('offline'); return response; };
    await submit(boxes[0]);
    assert.match(boxes[0].status.textContent, /not on the list yet/);
    assert.ok(!boxes[0].classList.contains('is-done'));
    assert.equal(boxes[0].email.value, 'person@example.com');
  }
});

test('native redirect parameters show shared success or a known error only', async () => {
  let boxes = await setup('?joined=1');
  assert.ok(boxes.every(box => box.classList.contains('is-done')));
  assert.equal(boxes[0].status.textContent, 'You’re on the list. We’ll write when Cerna opens.');
  boxes = await setup('?error=rate_limited');
  assert.ok(boxes.every(box => box.status.textContent.includes('Too many tries')));
  boxes = await setup('?error=untrusted');
  assert.ok(boxes.every(box => box.status.textContent === ''));
});
