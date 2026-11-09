import type { Env } from '../env';
import { SignupMail } from '../signup-mail';

/** Actual coordinator class with a small persistent-storage/input-gate fake.
 * This is not a workerd scheduler or deployed SQLite Durable Object test.
 */
export function mailNamespace(env: Env) {
  const records = new Map<string, Map<string, unknown>>();
  const instances = new Map<string, SignupMail>();
  const locations: string[] = [];
  let sender: typeof fetch = (...args) => fetch(...args);
  const harness = {
    records, locations,
    beforeDispatch: undefined as ((request: Pick<Request, 'url'>) => Promise<void>) | undefined,
    failWrites: false,
    send(value?: typeof fetch) { sender = value ?? ((...args) => fetch(...args)); },
    reboot() { instances.clear(); },
    namespace: undefined as unknown as DurableObjectNamespace,
  };
  const eu = {
    idFromName(name: string) { return { toString: () => name }; },
    get(id: DurableObjectId) {
      const name = id.toString();
      return {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const request = new Request(input, init);
          await harness.beforeDispatch?.(request.clone());
          let instance = instances.get(name);
          if (!instance) {
            let values = records.get(name);
            if (!values) { values = new Map(); records.set(name, values); }
            const saved = values;
            let tail: Promise<unknown> = Promise.resolve();
            const state = {
              storage: {
                async get<T>(key: string): Promise<T | undefined> { return saved.get(key) as T | undefined; },
                async put(key: string, value: unknown) {
                  if (harness.failWrites) throw new Error('dummy storage write failed');
                  saved.set(key, value);
                },
              },
              blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
                const result = tail.then(callback);
                tail = result.then(() => undefined, () => undefined);
                return result;
              },
            } as unknown as DurableObjectState;
            instance = new SignupMail(state, env, (...args) => sender(...args));
            instances.set(name, instance);
          }
          return instance.fetch(request);
        },
      };
    },
  };
  harness.namespace = {
    jurisdiction(location: string) {
      locations.push(location);
      if (location !== 'eu') throw new Error('dummy namespace requires EU jurisdiction');
      return eu;
    },
    // Force the real code to select jurisdiction before deriving the ID.
    idFromName() { throw new Error('unrestricted namespace must not be used'); },
    get() { throw new Error('unrestricted namespace must not be used'); },
  } as unknown as DurableObjectNamespace;
  return harness;
}
