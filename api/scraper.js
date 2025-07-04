import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function decifrarFemBED(valorCifrado) {
  try {
    const b64Decode = (str) => Buffer.from(str, 'base64').toString('utf8');
    const paso1 = b64Decode(valorCifrado);
    const paso2 = paso1.split('').reverse().join('');
    const paso3 = b64Decode(paso2);
    return paso3;
  } catch {
    return null;
  }
}

async function extraerEmbed69DesdePelisPlus(page, pelisplusUrl) {
  await page.goto(pelisplusUrl, { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  const match = html.match(/(https?:\/\/embed69\.org\/[^\s"'<>]+)/);
  if (!match) throw new Error('No se encontró embed69 en PelisPlus');
  return match[1].endsWith('/') ? match[1] : match[1] + '/';
}

async function extraerServidoresDesdeEmbed69(page, embed69Url) {
  await page.goto(embed69Url, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const servidores = [];
  const html = await page.content();
  const matches = [...html.matchAll(/onclick="handleServerClick\((\{.*?\})\)"/g)];
  for (const match of matches) {
    try {
      let raw = match[1].replace(/&quot;/g, '"');
      const obj = JSON.parse(raw);
      if (obj.link && obj.servername && !['voe', 'download'].includes(obj.servername.toLowerCase())) {
        servidores.push({ name: obj.servername, url: obj.link });
      }
    } catch {}
  }

  const fembedValue = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const s of scripts) {
      if (s.textContent.includes('femBED')) {
        const match = s.textContent.match(/femBED\s*=\s*['"]([^'"]+)['"]/);
        if (match) return match[1];
      }
    }
    return null;
  });

  if (fembedValue) {
    const urlReal = await decifrarFemBED(fembedValue);
    if (urlReal) servidores.push({ name: 'femBED-decoded', url: urlReal });
  }

  return servidores;
}

async function extraerM3U8(page, url) {
  let mediaUrl = null;
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('.m3u8') || u.includes('.mp4')) mediaUrl = u;
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(5000);
  } catch {}
  return mediaUrl;
}

export default async function handler(req, res) {
  const pelisplusUrl = req.query.url;
  if (!pelisplusUrl) {
    res.status(400).end("No URL provided");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  function sendData(obj) {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    sendData({ type: 'info', message: 'Buscando embed69...' });
    const embedUrl = await extraerEmbed69DesdePelisPlus(page, pelisplusUrl);

    sendData({ type: 'info', message: 'Obteniendo servidores desde embed69...' });
    const servidores = await extraerServidoresDesdeEmbed69(page, embedUrl);

    let current = 0;
    for (const servidor of servidores) {
      current++;
      sendData({ type: 'progress', current, total: servidores.length, message: `Procesando ${servidor.name}` });

      const tab = await browser.newPage();
      servidor.m3u8 = await extraerM3U8(tab, servidor.url);
      await tab.close();

      sendData({
        type: 'success',
        output: {
          servidor: servidor.name,
          url: servidor.url,
          m3u8: servidor.m3u8 || '❌ No se detectó .m3u8',
        },
      });
    }

    await browser.close();
    sendData({ type: 'done', message: 'Scraping terminado.' });
    res.end();
  } catch (e) {
    sendData({ type: 'error', message: e.message });
    res.end();
  }
}
