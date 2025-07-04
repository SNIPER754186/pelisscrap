import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: "Missing URL" });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath || '/usr/bin/chromium-browser',
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    res.write(`data: ${JSON.stringify({ type: 'success', message: 'Página cargada correctamente' })}\n\n`);

    // Puedes scrapear aquí...
    const html = await page.content();
    res.write(`data: ${JSON.stringify({ type: 'html', html })}\n\n`);

  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  } finally {
    if (browser) await browser.close();
    res.write(`data: ${JSON.stringify({ type: 'done', message: 'Scraping terminado' })}\n\n`);
    res.end();
  }
}
