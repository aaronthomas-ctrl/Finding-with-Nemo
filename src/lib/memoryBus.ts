/** Tiny event bus: the chat tells the 3D view which memories it just used, so those dots light up. */
const EVT = 'memories:used';

export function announceMemories(ids: string[]) {
  window.dispatchEvent(new CustomEvent<string[]>(EVT, { detail: ids }));
}

export function onMemoriesUsed(cb: (ids: string[]) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<string[]>).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
