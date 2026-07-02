// Design tokens - reference CSS variables for theme-aware colors
// CSS variables are defined in globals.css and change with .dark class
export const theme = {
  bg: "var(--theme-bg)",
  text: "var(--theme-text)",
  textMuted: "var(--theme-text-muted)",
  textLight: "var(--theme-text-light)",
  border: "var(--theme-border)",
  borderLight: "var(--theme-border-light)",
  accent: "#3b6044",
};

// Color conversion utilities
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generatePalette(baseColor: string) {
  const { h, s } = hexToHsl(baseColor);
  return {
    50: hslToHex(h, Math.max(s - 30, 10), 97),
    100: hslToHex(h, Math.max(s - 20, 15), 94),
    500: hslToHex(h, s, 50),
    600: hslToHex(h, s, 42),
  };
}

export const palette = generatePalette(theme.accent);

// Score color helper
export function getScoreColor(score: number) {
  if (score >= 80) return palette[600];
  if (score >= 60) return palette[500];
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#f97316";
  return "#ef4444";
}
