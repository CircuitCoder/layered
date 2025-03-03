export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function nextTick() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function getLinkInAnscenstor(e: EventTarget | null): string | null {
  if (e instanceof HTMLAnchorElement) return e.href;
  else if (e instanceof SVGAElement) return e.href.animVal;

  if (e instanceof Element) return getLinkInAnscenstor(e.parentElement);

  return null;
}

export function randomWithin(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class SemiReactive<T> {
  data: T | null;
  promise: Promise<void>;
  resolve: () => void;

  constructor() {
    this.data = null;
    let r: () => void;
    this.promise = new Promise((resolve) => r = resolve);
    this.resolve = r!;
  }

  set(value: T) {
    const orig = this.data;
    this.data = value;
    if(orig === null) this.resolve();
  }

  async get(): Promise<T> {
    if(this.data === null) await this.promise;
    return this.data!;
  }
}

const Blackhole = new Promise(() => {});

export class Debouncer {
  epoch: number;
  delay: number;

  constructor(delay: number) {
    this.epoch = 0;
    this.delay = delay;
  }

  async notify(): Promise<void> {
    this.epoch++;
    const cur = this.epoch;
    await wait(this.delay);
    if(cur !== this.epoch) await Blackhole;
  }
}
