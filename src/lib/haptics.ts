// Тактильный отклик. На iOS Safari navigator.vibrate не поддерживается —
// это no-op, реальная вибрация будет на Android.
export function haptic(pattern: number | number[] = 12): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}
