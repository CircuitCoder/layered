export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function nextTick() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}