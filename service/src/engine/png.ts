import { deflateSync } from "node:zlib";

/**
 * Encoder PNG mínimo, 100% Node (sem Chromium/canvas), usado pelo StubEngine
 * para produzir bytes PNG VÁLIDOS na fase contrato-primeiro. Suficiente para
 * validar o pipeline end-to-end (o chat da Supercorps exibe uma imagem real).
 * Na fase 2 o render real vem do Playwright.
 */

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return [30, 30, 40];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Gera um PNG sólido com uma faixa mais escura no topo e no rodapé, evocando
 * as regiões onde logo (topo-esq) e @ (rodapé-esq) entram na versão real.
 */
export function solidPng(width: number, height: number, bg: RGB): Buffer {
  const [r, g, b] = bg;
  const dark: RGB = [Math.round(r * 0.6), Math.round(g * 0.6), Math.round(b * 0.6)];
  const bandH = Math.round(height * 0.12);

  // Cada linha: 1 byte de filtro (0) + width*3 bytes RGB.
  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const inBand = y < bandH || y >= height - bandH;
    const [cr, cg, cb] = inBand ? dark : bg;
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filtro None
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = cr;
      raw[p + 1] = cg;
      raw[p + 2] = cb;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
