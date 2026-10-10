require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const { pool, initDb } = require('./db');
const app = express();
const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', err => console.error('Redis:', err.message));
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(x=>x.trim()) : true }));
app.use(express.json({ limit: '16kb' }));
function encode62(n) { let s = ''; do { s = alphabet[Number(n % 62n)] + s; n /= 62n; } while (n); return s; }
function validUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.'); }
  catch { return false; }
}
const createLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); await redis.ping(); res.json({ status: 'ok', database: 'ok', redis: 'ok' }); }
  catch { res.status(503).json({ status: 'unhealthy' }); }
});
app.get('/api', (_req,res)=>res.json({message:'URL Shortener API',health:'/health'}));
app.post('/api/shorten', createLimiter, async (req, res) => {
  const { originalUrl, customAlias, expiresInDays } = req.body || {};
  if (typeof originalUrl !== 'string' || originalUrl.length > 2048 || !validUrl(originalUrl))
    return res.status(400).json({ error: 'Enter a valid http(s) URL (max 2048 characters).' });
  if (customAlias !== undefined && (typeof customAlias !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(customAlias) || ['api','health'].includes(customAlias.toLowerCase())))
    return res.status(400).json({ error: 'Alias must be 3–32 letters, numbers, _ or -.' });
  if (expiresInDays !== undefined && (typeof expiresInDays !== 'number' || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650))
    return res.status(400).json({ error: 'Expiration must be 1–3650 days.' });
  try {
    const idResult = await pool.query("SELECT nextval(pg_get_serial_sequence('urls','id')) AS id");
    const id = BigInt(idResult.rows[0].id);
    const code = customAlias || encode62(id);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;
    await pool.query('INSERT INTO urls (id, short_code, original_url, expires_at) VALUES ($1,$2,$3,$4)', [id.toString(), code, originalUrl, expiresAt]);
    // Cache is best-effort; PostgreSQL remains the source of truth.
    try { await redis.set(`url:${code}`, JSON.stringify({ originalUrl, expiresAt: expiresAt?.toISOString() || null }), { EX: expiresInDays ? expiresInDays * 86400 : 86400 }); } catch (e) { console.warn('Cache write skipped:', e.message); }
    res.status(201).json({ originalUrl, shortCode: code, shortUrl: `${baseUrl}/${code}`, expiresAt });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That custom alias is already taken.' });
    console.error(err); res.status(500).json({ error: 'Unable to shorten URL.' });
  }
});
app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(shortCode)) return res.status(404).send('Not found');
  try {
    let item = null;
    try { const cached = await redis.get(`url:${shortCode}`); if (cached) item = JSON.parse(cached); } catch (e) { console.warn('Cache read skipped:', e.message); }
    if (!item) {
      const result = await pool.query('SELECT original_url, expires_at FROM urls WHERE short_code=$1', [shortCode]);
      if (!result.rowCount) return res.status(404).send('Short URL not found');
      item = { originalUrl: result.rows[0].original_url, expiresAt: result.rows[0].expires_at };
      const ttl = item.expiresAt ? Math.min(86400, Math.floor((new Date(item.expiresAt).getTime() - Date.now()) / 1000)) : 86400;
      if (ttl > 0) { try { await redis.set(`url:${shortCode}`, JSON.stringify(item), { EX: ttl }); } catch (e) { console.warn('Cache write skipped:', e.message); } }
    }
    if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) return res.status(410).send('Short URL expired');
    return res.redirect(302, item.originalUrl);
  } catch (err) { console.error(err); return res.status(500).send('Unable to redirect'); }
});
async function start() {
  await initDb();
  try { await redis.connect(); console.log('Redis connected'); } catch (e) { console.warn('Redis unavailable; database fallback active:', e.message); }
  app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`));
}
start().catch(e => { console.error('Startup failed:', e); process.exit(1); });
process.on('SIGTERM', async () => { await Promise.allSettled([pool.end(), redis.isOpen ? redis.quit() : Promise.resolve()]); process.exit(0); });
