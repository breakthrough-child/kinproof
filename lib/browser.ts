/**
 * Every browser-API access in the app goes through here. Each helper feature-detects first and
 * is wrapped in try/catch, so a missing or hostile API (older Android WebViews, iOS Safari outside a
 * home-screen PWA, in-app browsers, privacy modes) degrades to "not supported" and never throws.
 * Safe to import anywhere; call from effects/handlers (all helpers also work during SSR).
 */

export type NotificationState = "unsupported" | NotificationPermission;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const hasWindow = () => typeof window !== "undefined";

// ---- Notification ----------------------------------------------------------
export function notificationPermission(): NotificationState {
  return safe(
    () => (hasWindow() && "Notification" in window && typeof Notification !== "undefined" ? Notification.permission : "unsupported"),
    "unsupported",
  );
}

export async function requestNotificationPermission(): Promise<NotificationState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

/**
 * Show a system notification. Uses the service worker registration when available (the only way that
 * works on Android Chrome, where `new Notification()` throws), then the constructor. Never throws.
 */
export async function showSystemNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  try {
    if (hasServiceWorker()) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

// ---- Service worker / Push -------------------------------------------------
export function hasServiceWorker(): boolean {
  return safe(() => hasWindow() && "serviceWorker" in navigator && !!navigator.serviceWorker, false);
}

export function hasPushManager(): boolean {
  return safe(() => hasWindow() && "PushManager" in window && typeof PushManager !== "undefined" && hasServiceWorker(), false);
}

export async function registerServiceWorker(url = "/sw.js"): Promise<boolean> {
  if (!hasServiceWorker() || safe(() => window.location.protocol === "file:", true)) return false;
  try {
    await navigator.serviceWorker.register(url);
    return true;
  } catch {
    return false;
  }
}

// ---- Web Audio -------------------------------------------------------------
type AudioCtor = typeof AudioContext;

export function getAudioContextCtor(): AudioCtor | null {
  return safe(() => {
    if (!hasWindow()) return null;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
  }, null);
}

export function createAudioContext(): AudioContext | null {
  return safe(() => {
    const Ctor = getAudioContextCtor();
    return Ctor ? new Ctor() : null;
  }, null);
}

export function getOfflineAudioContextCtor(): typeof OfflineAudioContext | null {
  return safe(() => {
    if (!hasWindow()) return null;
    const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
    return w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null;
  }, null);
}

/** Short alert beep. Returns false if audio is unavailable or blocked (autoplay policy). */
export function playBeep(ctx: AudioContext | null): boolean {
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
    return true;
  } catch {
    return false;
  }
}

export function closeAudioContext(ctx: AudioContext | null) {
  try {
    void ctx?.close().catch(() => {});
  } catch {
    /* ignore */
  }
}

// ---- Vibration (unsupported on iOS) ---------------------------------------
export function vibrate(pattern: number | number[]): boolean {
  return safe(() => hasWindow() && typeof navigator.vibrate === "function" && navigator.vibrate(pattern), false);
}

// ---- Recording -------------------------------------------------------------
export function canRecordAudio(): boolean {
  return safe(
    () =>
      hasWindow() &&
      "MediaRecorder" in window &&
      typeof MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function",
    false,
  );
}

export function documentHidden(): boolean {
  return safe(() => typeof document !== "undefined" && document.hidden, false);
}
