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
    // Cache at the edge for 5 minutes to conserve the free-tier request budget.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ status: 'error', message: 'Upstream fetch failed' });
  }
}
