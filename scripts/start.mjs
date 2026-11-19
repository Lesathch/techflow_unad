import { spawn } from 'node:child_process';
import net from 'node:net';

const app = 'techflow';
const title = 'TechFlow';
const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';
const localHost = host === '0.0.0.0' ? '127.0.0.1' : host;
const url = `http://${localHost}:${port}`;
let staleInstance = false;

async function isOurServer() {
  try {
    const response = await fetch(url + '/api/health', {signal: AbortSignal.timeout(2000)});
    const data = await response.json();
    if (!response.ok || data.status !== 'ok' || data.app !== app) return false;
    const assets = await Promise.all(['/', '/app.js', '/style.css'].map(route =>
      fetch(url + route, {signal: AbortSignal.timeout(2000)})
    ));
    staleInstance = assets.some(asset => !asset.ok);
    for (const asset of assets) await asset.body?.cancel();
    return !staleInstance;
  } catch { return false; }
}

async function portIsOccupied() {
  return new Promise(resolve => {
    const socket = net.connect({host: localHost, port});
    const done = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1500, () => done(true));
  });
}

function openBrowser() {
  if (process.argv.includes('--no-browser') || process.platform !== 'win32') return;
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  browser.on('error', () => console.log('Abre esta dirección en tu navegador: ' + url));
  browser.unref();
}

try {
  if (await isOurServer()) {
    console.log(title + ' ya está funcionando. Abriendo ' + url);
    console.log('No hace falta iniciar otra copia.');
    openBrowser();
  } else if (await portIsOccupied()) {
    console.error(staleInstance ? title + ' tiene una instancia anterior con archivos no disponibles. Cierra su ventana y vuelve a iniciar.' : 'El puerto ' + port + ' está ocupado por otra aplicación.');
    console.error('No se ha cerrado ni modificado esa aplicación.');
    process.exitCode = 1;
  } else {
    try {
      await import('../server.mjs');
      console.log('Mantén esta ventana abierta mientras usas ' + title + '.');
      openBrowser();
    } catch (error) {
      if (error.code === 'EADDRINUSE' && await isOurServer()) {
        console.log(title + ' ya está funcionando. Abriendo ' + url);
        openBrowser();
      } else {
        console.error('No se pudo iniciar ' + title + ': ' + error.message);
        process.exitCode = 1;
      }
    }
  }
} catch (error) {
  console.error('No se pudo iniciar ' + title + ': ' + error.message);
  process.exitCode = 1;
}
