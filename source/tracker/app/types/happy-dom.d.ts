import type DetachedWindowAPI from 'happy-dom/lib/window/DetachedWindowAPI.js';
declare global {
  interface Window {
    readonly happyDOM: DetachedWindowAPI;
  }
}
export {};
