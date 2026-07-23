import type { Brand } from "../runs.js";
import type { SlideCopy } from "./copy.js";

/**
 * Template HTML de um slide de carrossel (1080x1350, 4:5).
 * O branding é embutido no próprio HTML — mais confiável que overlay pós-render:
 *  - logo no topo-esquerda, tamanho fixo;
 *  - @ (instagramHandle) no rodapé-esquerda.
 */

const WIDTH = 1080;
const HEIGHT = 1350;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeHandle(handle: string): string {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

/** Escurece/clareia levemente uma cor #RRGGBB para o gradiente de fundo. */
function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (c: number) => Math.max(0, Math.min(255, Math.round(c * factor)));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Escolhe texto claro/escuro conforme a luminância do fundo. */
function textColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
  return lum > 0.6 ? "#141414" : "#ffffff";
}

export function slideHtml(input: {
  copy: SlideCopy;
  brandColor: string;
  brand: Brand;
  isCover: boolean;
}): string {
  const { copy, brandColor, brand, isCover } = input;
  const fg = textColor(brandColor);
  const bgTop = shade(brandColor, 1.12);
  const bgBottom = shade(brandColor, 0.82);
  const handle = escapeHtml(normalizeHandle(brand.instagramHandle));

  const logo = brand.logoUrl
    ? `<img class="logo" src="${escapeHtml(brand.logoUrl)}" alt="" />`
    : `<div class="logo logo--text">${escapeHtml(brand.name ?? handle)}</div>`;

  const headlineSize = isCover ? 92 : 68;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: linear-gradient(160deg, ${bgTop} 0%, ${brandColor} 45%, ${bgBottom} 100%);
    color: ${fg};
    display: flex; flex-direction: column;
    padding: 96px 88px;
  }
  header { display: flex; align-items: center; height: 120px; }
  .logo { max-height: 96px; max-width: 320px; object-fit: contain; }
  .logo--text { font-weight: 800; font-size: 40px; letter-spacing: -0.02em; opacity: 0.95; }
  main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 40px; }
  .headline {
    font-weight: 900; font-size: ${headlineSize}px; line-height: 1.05;
    letter-spacing: -0.03em; text-wrap: balance;
  }
  .text { font-weight: 400; font-size: 40px; line-height: 1.4; opacity: 0.92; max-width: 90%; }
  .cta {
    font-weight: 800; font-size: 44px; line-height: 1.2;
    padding: 28px 40px; border-radius: 24px;
    background: ${fg}; color: ${brandColor}; align-self: flex-start;
  }
  footer { display: flex; align-items: center; height: 80px; }
  .handle { font-weight: 600; font-size: 34px; opacity: 0.88; }
</style>
</head>
<body>
  <header>${logo}</header>
  <main>
    ${copy.headline ? `<div class="headline">${escapeHtml(copy.headline)}</div>` : ""}
    ${copy.text ? `<div class="text">${escapeHtml(copy.text)}</div>` : ""}
    ${copy.cta ? `<div class="cta">${escapeHtml(copy.cta)}</div>` : ""}
  </main>
  <footer><span class="handle">${handle}</span></footer>
</body>
</html>`;
}

export const SLIDE_DIMENSIONS = { width: WIDTH, height: HEIGHT } as const;
