const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const INDEX_FILE = path.join(__dirname, 'index.html');
const LOG_FILE = path.join(__dirname, 'changelog.txt');

function readData() {
  if (!fs.existsSync(DATA_FILE)) return { students: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Address -> coordinates via OpenStreetMap Nominatim (max 1 request per second).
let lastLookup = Promise.resolve();
function geocode(q) {
  const run = lastLookup.then(async () => {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    const r = await fetch(url, { headers: { 'User-Agent': 'FirstNotes/1.0 (personal piano lesson scheduler)' } });
    const list = await r.json();
    return list.length ? { lat: +list[0].lat, lon: +list[0].lon } : null;
  });
  lastLookup = run.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100)));
  return run;
}

// Driving distance between two addresses via Google Routes API, cached in route-cache.json.
const KEY_FILE = path.join(__dirname, 'google-key.txt');
const ROUTE_CACHE_FILE = path.join(__dirname, 'route-cache.json');
const routeCache = fs.existsSync(ROUTE_CACHE_FILE) ? JSON.parse(fs.readFileSync(ROUTE_CACHE_FILE, 'utf8')) : {};
async function driveMiles(from, to) {
  if (from.toLowerCase() === to.toLowerCase()) return 0;
  const key = from + ' -> ' + to;
  if (key in routeCache) return routeCache[key];
  if (!fs.existsSync(KEY_FILE)) throw new Error('google-key.txt is missing');
  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': fs.readFileSync(KEY_FILE, 'utf8').trim(),
      'X-Goog-FieldMask': 'routes.distanceMeters'
    },
    body: JSON.stringify({ origin: { address: from }, destination: { address: to }, travelMode: 'DRIVE', regionCode: 'US' })
  });
  const body = await r.json();
  if (!r.ok) throw new Error((body.error && body.error.message) || 'Google error ' + r.status);
  const meters = body.routes && body.routes[0] && body.routes[0].distanceMeters;
  const miles = meters == null ? null : Math.round((meters / 1609.344) * 10) / 10;
  routeCache[key] = miles;
  fs.writeFileSync(ROUTE_CACHE_FILE, JSON.stringify(routeCache, null, 2));
  return miles;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/api/route?')) {
    const params = new URL(req.url, 'http://x').searchParams;
    driveMiles(params.get('from') || '', params.get('to') || '')
      .then(miles => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ miles })); })
      .catch(e => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); });
  } else if (req.method === 'GET' && req.url.startsWith('/api/geocode?')) {
    const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
    geocode(q)
      .then(result => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); })
      .catch(() => { res.writeHead(502); res.end('lookup failed'); });
  } else if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(INDEX_FILE));
  } else if (req.method === 'GET' && req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readData()));
  } else if (req.method === 'PUT' && req.url === '/api/data') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        res.writeHead(200);
        res.end('ok');
      } catch (e) {
        res.writeHead(400);
        res.end('bad data');
      }
    });
  } else if (req.method === 'POST' && req.url === '/api/log') {
    // One timestamped line per action, appended to changelog.txt.
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      fs.appendFileSync(LOG_FILE, new Date().toLocaleString('en-US') + '  ' + body.replace(/\s*\n\s*/g, ' ') + '\n');
      res.writeHead(200);
      res.end('ok');
    });
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`First Notes running. Open one of these on the iPhone (same Wi-Fi):`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  http://${a.address}:${PORT}`);
    }
  }
  console.log(`  On this PC: http://localhost:${PORT}`);
});
