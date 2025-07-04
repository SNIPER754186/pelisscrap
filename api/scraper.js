import { spawn } from 'child_process';

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) {
    res.status(400).send('No URL provided');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Ejecutar tu script Puppeteer con spawn para emitir datos por stdout
  const process = spawn('node', ['api/scraper_script.js', url]);

  process.stdout.on('data', (data) => {
    // Asume que el script imprime JSON por línea
    data.toString().split('\n').forEach(line => {
      if (line.trim()) {
        res.write(`data: ${line}\n\n`);
      }
    });
  });

  process.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: data.toString() })}\n\n`);
  });

  process.on('close', () => {
    res.write('data: {"type":"done","message":"Scraping terminado."}\n\n');
    res.end();
  });

  req.on('close', () => {
    process.kill();
    res.end();
  });
}
