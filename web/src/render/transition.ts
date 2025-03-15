const EPS = 1e-6;

// Solve cubic equation (1-t)^2 * t * c1 + (1-t) * t^2 * c2 + t^3 - x0 = 0 with newton's method
function solveX(c1: number, c2: number, x0: number): number {
  // Guess t by assuming it's a line from (0, 0) to (1, 1)
  let t = x0;

  while(true) {
    const f = (1-t)*(1-t)*t*c1 + (1-t)*t*t*c2 + t*t*t - x0;
    if(Math.abs(f) < EPS) return t;
    const df = ((1 - t) * (1 - t) - 2 * (1 - t) * t) * c1
      + (-t * t + 2 * t * (1 - t)) * c2
      + 3 * t * t;
    const dt = f / df;
    t -= dt;
  }
}

export interface TransitionValue {
  evalAt(t: number): number;
}

class Constant implements TransitionValue {
  constructor(private val: number) {}

  evalAt(_t: number): number {
    return this.val;
  }
}

class BezierEasingFunction implements TransitionValue {
  constructor(private x1: number, private y1: number, private x2: number, private y2: number) {
    // TODO: assert
  }

  evalAt(time: number): number {
    // Clamp t to [0, 1]
    const clamped = Math.min(1, Math.max(0, time));
    const t = solveX(this.x1, this.x2, clamped);
    return (1 - t) * (1 - t) * t * this.y1 + (1 - t) * t * t * this.y2 + t * t * t;
  }
}

class Transition implements TransitionValue {
  constructor(
    private startVal: number, private endVal: number,
    private startT: number, private duration: number,
    private easing: TransitionValue) {
    // TODO: assert
  }

  evalAt(t: number) {
    const resacled = (t - this.startT) / this.duration;
    const progress = this.easing.evalAt(resacled);
    return this.startVal + (this.endVal - this.startVal) * progress;
  }
}
