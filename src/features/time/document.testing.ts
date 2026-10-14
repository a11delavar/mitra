// Imported first by a test that needs a page to announce `visibilitychange`, before any module that listens for it.
(globalThis as { document?: EventTarget }).document ??= new EventTarget()
