import puppeteer from 'puppeteer';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  let embed69Url = match[1];
  return embed69Url.endsWith('/') ? embed69Url : embed69Url + '/';
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
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: 'No URL provided' });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendSSE = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // necesario en Vercel
  });

  const page = await browser.newPage();

  try {
    sendSSE({ type: 'info', message: 'Buscando embed69...' });
    const embed69Url = await extraerEmbed69DesdePelisPlus(page, url);

    sendSSE({ type: 'info', message: 'Obteniendo servidores desde embed69...' });
    let servidores = await extraerServidoresDesdeEmbed69(page, embed69Url);

    let current = 0;
    const total = servidores.length;

    for (const servidor of servidores) {
      current++;
      sendSSE({ type: 'progress', current, total, message: `Procesando ${servidor.name}` });

      const tab = await browser.newPage();
      servidor.m3u8 = await extraerM3U8(tab, servidor.url);
      await tab.close();

      sendSSE({
        type: 'success',
        output: {
          servidor: servidor.name,
          url: servidor.url,
          m3u8: servidor.m3u8 || '❌ No se detectó .m3u8',
        },
      });
    }
  } catch (e) {
    sendSSE({ type: 'error', message: e.message });
  } finally {
    await browser.close();
    sendSSE({ type: 'done', message: 'Scraping terminado.' });
    res.end();
  }
}
