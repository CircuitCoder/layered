// Canvas render loop and related stuff

type Renderable = (now: number, ctx: HTMLCanvasElement) => void;

// Render group is bounded to a canvas
const groups = new WeakMap<HTMLCanvasElement, Renderable>();
const rerenders = new Set<HTMLCanvasElement>();

export function tick(now: number) {
  for (const canvas of rerenders) {
    const renderable = groups.get(canvas);
    if (renderable !== undefined)
      renderable(now, canvas);
  }
  rerenders.clear();
  requestAnimationFrame(tick);
}

export function queue(canvas: HTMLCanvasElement) {
  rerenders.add(canvas);
}
