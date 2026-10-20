import { copy, type WaitlistError } from '../content/copy';

const boxes = [...document.querySelectorAll<HTMLElement>('[data-waitlist]')];
let pending = false;
const success = (email?: string) => {
  boxes.forEach(box => {
    box.classList.add('is-done');
    box.querySelector<HTMLElement>('.form-status')!.textContent = email ? copy.form.success(email) : copy.form.redirectedSuccess;
  });
};
const showError = (box: HTMLElement, code: WaitlistError) => {
  box.querySelector<HTMLElement>('.form-status')!.textContent = copy.form.errors[code];
  const input = box.querySelector<HTMLInputElement>('[name="email"]')!;
  input.setAttribute('aria-invalid', String(code === 'invalid_email'));
  if (code === 'invalid_email') input.focus();
};
const isError = (value: unknown): value is WaitlistError => typeof value === 'string' && Object.hasOwn(copy.form.errors, value);
boxes.forEach(box => {
  const form = box.querySelector<HTMLFormElement>('form')!;
  const input = form.querySelector<HTMLInputElement>('[name="email"]')!;
  // The native form retains browser validation when the enhancement is unavailable.
  form.noValidate = true;
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    box.querySelector<HTMLElement>('.form-status')!.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const email = input.value.trim();
    if (!email || !input.validity.valid) { showError(box, 'invalid_email'); return; }
    pending = true;
    boxes.forEach(item => {
      const button = item.querySelector<HTMLButtonElement>('button')!;
      button.disabled = true;
      button.textContent = copy.form.busy;
      item.querySelector('form')!.setAttribute('aria-busy', 'true');
    });
    box.querySelector<HTMLElement>('.form-status')!.textContent = '';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company: form.querySelector<HTMLInputElement>('[name="company"]')!.value }),
        signal: controller.signal,
      });
      const result: { ok?: unknown; error?: unknown } = await response.json();
      if (response.status === 200 && result.ok === true) {
        success(email);
        box.querySelector<HTMLElement>('.form-status')!.focus();
      } else showError(box, isError(result.error) ? result.error : 'save_failed');
    } catch { showError(box, 'save_failed'); }
    finally {
      clearTimeout(timeout);
      pending = false;
      boxes.forEach(item => {
        const button = item.querySelector<HTMLButtonElement>('button')!;
        button.disabled = false;
        button.textContent = copy.form.button;
        item.querySelector('form')!.removeAttribute('aria-busy');
      });
    }
  });
});
const params = new URLSearchParams(location.search);
if (params.get('joined') === '1') success();
else {
  const error = params.get('error');
  if (isError(error)) {
    boxes.forEach(box => showError(box, error));
    boxes[0]?.querySelector<HTMLInputElement>('[name="email"]')?.focus();
  }
}
