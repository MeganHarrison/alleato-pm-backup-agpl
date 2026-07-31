import { expect } from "@playwright/test";

export async function pollFor<T>(
  fn: () => Promise<T>,
  expectation: (value: T) => void,
  timeout = 10_000,
) {
  await expect
    .poll(
      async () => {
        const value = await fn();
        expectation(value);
        return true;
      },
      { timeout },
    )
    .toBe(true);
}

export function pollForSimple<T>(fn: () => Promise<T> | T, options?: { timeout?: number; intervals?: number[] }) {
  return expect.poll(fn, options);
}