// Работа с HEX-цветами: градиенты для тем без фото.

function parseHex(hex: string): [number, number, number] {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = Number.parseInt(value.slice(0, 6), 16);
  if (Number.isNaN(num)) return [122, 90, 248];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Смешивает цвет с чёрным: amount 0 — исходный, 1 — чёрный. */
export function shade(hex: string, amount = 0.3): string {
  const [r, g, b] = parseHex(hex);
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}

/** Полупрозрачная версия цвета для подсветок. */
export function alpha(hex: string, value: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}
