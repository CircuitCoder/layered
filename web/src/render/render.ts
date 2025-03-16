// Canvas render loop and related stuff

type Renderable = (now: number, ctx: HTMLCanvasElement) => void;

// Render group is bounded to a canvas
const groups = new WeakMap<HTMLCanvasElement, Renderable>();
let rerenders = new Set<HTMLCanvasElement>();

export function tick(now: number) {
  const oldRerenders = new Set(rerenders);
  rerenders.clear();
  for (const canvas of oldRerenders) {
    const renderable = groups.get(canvas);
    if (renderable !== undefined)
      renderable(now, canvas);
  }
  requestAnimationFrame(tick);
}

export function register(canvas: HTMLCanvasElement, renderable: Renderable) {
  groups.set(canvas, renderable);
  // Immediately render the first frame
  renderable(performance.now(), canvas);
}

export function queue(canvas: HTMLCanvasElement) {
  rerenders.add(canvas);
}
