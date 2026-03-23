/**
 * Generates a color palette from a single hex color
 */

export interface ColorPalette {
  bg: string;
  text: string;
  link: string;
  hover: string;
  border: string;
  overlay: string;
  bottomBorder: string;
  opacity: number;
  svgColor: string;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.min(255, Math.max(0, Math.round(rgb.r + rgb.r * (percent / 100))));
  const g = Math.min(255, Math.max(0, Math.round(rgb.g + rgb.g * (percent / 100))));
  const b = Math.min(255, Math.max(0, Math.round(rgb.b + rgb.b * (percent / 100))));

  return rgbToHex(r, g, b);
}

export function generatePaletteFromHex(hex: string): ColorPalette {
  // Validate hex color
  if (!hex.match(/^#[0-9A-Fa-f]{6}$/)) {
    hex = '#FFFFFF'; // Default to white
  }

  const lighterVariant = adjustBrightness(hex, -80); // Dark background
  const darkerVariant = adjustBrightness(hex, -50); // Border
  const lighterBorder = adjustBrightness(hex, -30); // Lighter border variant
  const overlayRgb = hexToRgb(darkerVariant);
  const overlayColor = overlayRgb ? `rgba(${overlayRgb.r},${overlayRgb.g},${overlayRgb.b},0.75)` : 'rgba(33,13,0,0.75)';

  return {
    bg: lighterVariant, // Very dark background
    text: hex, // Main color as text
    link: darkerVariant, // Darker for links
    hover: hex, // Hover same as text
    border: lighterBorder, // Border is slightly lighter than dark
    overlay: overlayColor, // Overlay with transparency
    bottomBorder: darkerVariant, // Same as link color
    opacity: 0.6,
    svgColor: hex, // SVG uses the main color
  };
}

export function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}
