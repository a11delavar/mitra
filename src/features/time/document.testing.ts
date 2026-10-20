// Gives a test a page to announce `visibilitychange` on, in place before its first read of `TimeZone.deviceId` listens.
(globalThis as { document?: EventTarget }).document ??= new EventTarget()
