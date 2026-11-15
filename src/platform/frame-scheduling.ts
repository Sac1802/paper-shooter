/** Browser scheduling boundary; background work returns cancellation without exposing timer handles. */
export const browserFrames = {
  now: () => performance.now(),
  request: (callback: (time: number) => void) => requestAnimationFrame(callback),
  cancel: (id: number) => cancelAnimationFrame(id),
  background(callback: () => void, milliseconds: number): () => void {
    const timer = setInterval(callback, milliseconds);
    return () => clearInterval(timer);
  },
};
