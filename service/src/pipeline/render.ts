import { chromium, type Browser } from "playwright";
import { SLIDE_DIMENSIONS } from "./template.js";

/**
 * Render HTML → PNG via Playwright (Chromium headless), usado diretamente como
 * lib Node — sem MCP nem http.server intermediário (diferente da skill
 * image-creator, que roda dentro de uma IDE de IA).
 *
 * O navegador é reaproveitado entre slides do mesmo run (um contexto por página)
 * e reciclado após ficar ocioso, para não pagar o custo de startup por slide.
 */

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserPromise;
}

/** Renderiza um HTML completo e retorna os bytes do PNG. */
export async function renderHtmlToPng(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { ...SLIDE_DIMENSIONS },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30_000 });
    // Aguarda fontes do Google Fonts assentarem para evitar FOUT no screenshot.
    // Passado como string para não avaliar `document` sob a lib de tipos do Node.
    await page.evaluate("document.fonts && document.fonts.ready");
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...SLIDE_DIMENSIONS } });
    return png as Buffer;
  } finally {
    await context.close();
  }
}

/** Encerra o navegador (chamar no shutdown do processo, se desejado). */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
