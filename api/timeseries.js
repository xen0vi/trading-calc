// Vercel serverless function — proxies Twelve Data so the API key stays server-side.
// Set the key in your Vercel project: Settings → Environment Variables → TWELVEDATA_KEY

const ALLOWED_SYMBOLS = new Set(['SLV', 'XAU/USD', 'USO', 'BTC/USD', 'ETH/USD', 'SOL/USD']);
const ALLOWED_INTERVALS = new Set(['1h', '2h', '4h', '1day']);

export default async function handler(req, res) {
  const key = process.env.TWELVEDATA_KEY;
  if (!key) {
    res.status(500).json({ status: 'error', message: 'Server missing TWELVEDATA_KEY environment variable' });
    return;
  }

  const symbol = (req.query.symbol || '').toString();
  const interval = (req.query.interval || '4h').toString();
  const outputsize = Math.min(parseInt(req.query.outputsize, 10) || 250, 500);

  if (!ALLOWED_SYMBOLS.has(symbol)) {
    res.status(400).json({ status: 'error', message: 'Symbol not allowed' });
    return;
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    res.status(400).json({ status: 'error', message: 'Interval not allowed' });
    return;
  }

  const url = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(symbol) +
    '&interval=' + encodeURIComponent(interval) +
    '&outputsize=' + outputsize +
    '&apikey=' + encodeURIComponent(key);

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    const ok = data && data.values && data.status !== 'error';
    if (ok) {
      // 4H candles change slowly — cache successful responses at the edge for 15 min
      // so page reloads / multiple devices don't spend Twelve Data credits.
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    } else {
      // Never cache rate-limit / error responses, or they'd persist past the reset.
      res.setHeader('Cache-Control', 'no-store');
    }
    res.status(200).json(data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ status: 'error', message: 'Upstream fetch failed' });
  }
}
