import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canRecordAudio, closeAudioContext, createAudioContext, documentHidden, getAudioContextCtor, getOfflineAudioContextCtor,
  hasPushManager, hasServiceWorker, notificationPermission, playBeep, registerServiceWorker, requestNotificationPermission,
  showSystemNotification, vibrate,
} from "@/lib/browser";

afterEach(() => vi.unstubAllGlobals());

/** Run every helper; none may throw. Returns the results so callers can assert the "unsupported" values. */
async function runAll() {
  return {
    perm: notificationPermission(),
    asked: await requestNotificationPermission(),
    shown: await showSystemNotification("t", { body: "b" }),
    sw: hasServiceWorker(),
    push: hasPushManager(),
    reg: await registerServiceWorker(),
    ctor: getAudioContextCtor(),
    offline: getOfflineAudioContextCtor(),
    ctx: createAudioContext(),
    beep: playBeep(null),
    vib: vibrate([100]),
    rec: canRecordAudio(),
    hidden: documentHidden(),
    close: closeAudioContext(null),
  };
}
const UNSUPPORTED = {
  perm: "unsupported", asked: "unsupported", shown: false, sw: false, push: false, reg: false, ctor: null, offline: null,
  ctx: null, beep: false, vib: false, rec: false, hidden: false, close: undefined,
};

describe("browser helpers with the APIs missing", () => {
  it("no window at all (SSR / node)", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("document", undefined);
    expect(await runAll()).toEqual(UNSUPPORTED);
  });

  it("window and navigator exist but none of the APIs do (old WebView / iOS Safari tab)", async () => {
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", { hidden: false });
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("PushManager", undefined);
    vi.stubGlobal("MediaRecorder", undefined);
    expect(await runAll()).toEqual(UNSUPPORTED);
  });

  it("APIs present as undefined values (defined-but-undefined)", async () => {
    vi.stubGlobal("window", { Notification: undefined, PushManager: undefined, AudioContext: undefined, MediaRecorder: undefined, location: { protocol: "https:" } });
    vi.stubGlobal("navigator", { serviceWorker: undefined, vibrate: undefined, mediaDevices: undefined });
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("PushManager", undefined);
    vi.stubGlobal("MediaRecorder", undefined);
    expect(await runAll()).toEqual(UNSUPPORTED);
  });
});

describe("browser helpers with hostile APIs (present but throwing)", () => {
  function hostile() {
    const boom = () => {
      throw new Error("boom");
    };
    class ThrowingNotification {
      constructor() {
        boom();
      }
      static get permission(): string {
        return boom() as never;
      }
      static requestPermission() {
        return Promise.reject(new Error("blocked"));
      }
    }
    const win: Record<string, unknown> = { location: { protocol: "https:" }, Notification: ThrowingNotification, PushManager: function () { boom(); }, MediaRecorder: function () { boom(); } };
    Object.defineProperty(win, "AudioContext", { get: boom, configurable: true });
    Object.defineProperty(win, "OfflineAudioContext", { get: boom, configurable: true });
    const nav: Record<string, unknown> = { vibrate: boom };
    Object.defineProperty(nav, "serviceWorker", { get: boom, configurable: true });
    Object.defineProperty(nav, "mediaDevices", { get: boom, configurable: true });
    vi.stubGlobal("window", win);
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("Notification", ThrowingNotification);
    vi.stubGlobal("PushManager", win.PushManager);
    vi.stubGlobal("MediaRecorder", win.MediaRecorder);
    const doc = {};
    Object.defineProperty(doc, "hidden", { get: boom });
    vi.stubGlobal("document", doc);
  }

  it("never throws and reports unsupported", async () => {
    hostile();
    const r = await runAll();
    expect(r).toEqual({ ...UNSUPPORTED, hidden: false });
  });

  it("playBeep survives a broken AudioContext", () => {
    const ctx = { state: "running", currentTime: 0, createOscillator: () => { throw new Error("no audio"); } } as unknown as AudioContext;
    expect(playBeep(ctx)).toBe(false);
    const closing = { close: () => { throw new Error("x"); } } as unknown as AudioContext;
    expect(() => closeAudioContext(closing)).not.toThrow();
  });
});

describe("browser helpers when the APIs work", () => {
  it("shows the notification through the service worker registration first", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const ctorSpy = vi.fn();
    class N { constructor(...a: unknown[]) { ctorSpy(...a); } static permission = "granted"; }
    vi.stubGlobal("window", { Notification: N, location: { protocol: "https:" } });
    vi.stubGlobal("Notification", N);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration: async () => ({ showNotification }) } });
    expect(await showSystemNotification("Hello", { body: "x" })).toBe(true);
    expect(showNotification).toHaveBeenCalledWith("Hello", { body: "x" });
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("falls back to the constructor, and to false when that throws (Android Chrome)", async () => {
    const ctorSpy = vi.fn();
    class Ok { constructor(...a: unknown[]) { ctorSpy(...a); } static permission = "granted"; }
    vi.stubGlobal("window", { Notification: Ok, location: { protocol: "https:" } });
    vi.stubGlobal("Notification", Ok);
    vi.stubGlobal("navigator", {});
    expect(await showSystemNotification("Hi")).toBe(true);
    expect(ctorSpy).toHaveBeenCalled();
    class Illegal { constructor() { throw new TypeError("Illegal constructor"); } static permission = "granted"; }
    vi.stubGlobal("window", { Notification: Illegal, location: { protocol: "https:" } });
    vi.stubGlobal("Notification", Illegal);
    expect(await showSystemNotification("Hi")).toBe(false);
  });

  it("does not notify without permission", async () => {
    class N { static permission = "default"; }
    vi.stubGlobal("window", { Notification: N, location: { protocol: "https:" } });
    vi.stubGlobal("Notification", N);
    expect(await showSystemNotification("Hi")).toBe(false);
  });

  it("supported feature detection, vibration, webkit audio prefix and beep", () => {
    const osc = { type: "", frequency: { value: 0 }, connect: () => ({ connect: () => {} }), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => {} };
    const resume = vi.fn().mockResolvedValue(undefined);
    class FakeCtx { state = "suspended"; currentTime = 0; destination = {}; resume = resume; createOscillator = () => osc; createGain = () => gain; close = () => Promise.resolve(); }
    const vib = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { webkitAudioContext: FakeCtx, webkitOfflineAudioContext: FakeCtx, MediaRecorder: function () {}, PushManager: function () {}, location: { protocol: "https:" } });
    vi.stubGlobal("MediaRecorder", function () {});
    vi.stubGlobal("PushManager", function () {});
    vi.stubGlobal("navigator", { vibrate: vib, serviceWorker: {}, mediaDevices: { getUserMedia: () => {} } });
    expect(getAudioContextCtor()).toBe(FakeCtx);
    expect(getOfflineAudioContextCtor()).toBe(FakeCtx);
    expect(hasServiceWorker()).toBe(true);
    expect(hasPushManager()).toBe(true);
    expect(canRecordAudio()).toBe(true);
    expect(vibrate([1, 2])).toBe(true);
    expect(vib).toHaveBeenCalledWith([1, 2]);
    const ctx = createAudioContext();
    expect(ctx).toBeInstanceOf(FakeCtx);
    expect(playBeep(ctx)).toBe(true);
    expect(resume).toHaveBeenCalled();
  });

  it("registerServiceWorker swallows registration failures", async () => {
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    vi.stubGlobal("navigator", { serviceWorker: { register: () => Promise.reject(new Error("SecurityError")) } });
    expect(await registerServiceWorker()).toBe(false);
    vi.stubGlobal("navigator", { serviceWorker: { register: () => Promise.resolve({}) } });
    expect(await registerServiceWorker()).toBe(true);
  });
});
