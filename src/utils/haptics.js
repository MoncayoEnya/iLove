// Tiny vibration feedback on phones that support it (Android Chrome; iOS
// Safari ignores navigator.vibrate, so this is a silent no-op there).
const PATTERNS = {
  light: 10,
  medium: 20,
  success: [12, 60, 18],
  warning: [30, 40, 30],
}

export function haptic(kind = 'light') {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light)
    }
  } catch {
    // vibration blocked (e.g. no user gesture yet) — ignore
  }
}
