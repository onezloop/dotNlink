import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement the PointerEvent constructor; polyfill on top of
// MouseEvent (which does honor clientX/clientY/buttons) so fireEvent.pointerX
// helpers in tests produce events our drag handlers can actually read.
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    public readonly pointerId: number;
    public readonly pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  // @ts-expect-error jsdom lacks a native PointerEvent to satisfy the lib.dom type
  window.PointerEvent = PointerEventPolyfill;
}

// jsdom doesn't implement matchMedia; the app uses it to read/watch the
// system light/dark preference.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}

// jsdom doesn't implement ResizeObserver; Board.tsx uses it to size checkpoint
// circles from real cell pixels. jsdom's layout is a no-op anyway (elements
// always report 0-size), so a stub that never fires is a faithful substitute
// here — components fall back to their CSS default sizing, same as real
// browsers do before the first observation lands.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverStub;
}

// jsdom doesn't implement the Pointer Capture APIs our drag interaction relies on.
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = function setPointerCapture() {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture() {};
}
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}
