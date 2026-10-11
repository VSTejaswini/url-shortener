import React, { useState } from 'react';
const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
export default function App() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function shorten(e) {
    e.preventDefault(); setError(''); setResult(null); setLoading(true);
    try {
      const body = { originalUrl: originalUrl.trim() };
      if (customAlias.trim()) body.customAlias = customAlias.trim();
      if (expiresInDays) body.expiresInDays = Number(expiresInDays);
      const response = await fetch(`${API}/api/shorten`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  async function copy() { try { await navigator.clipboard.writeText(result.shortUrl); } catch { setError('Copy failed; please select the link.'); } }
  return <main className="page"><section className="panel"><div className="eyebrow">FAST • SIMPLE • SCALABLE</div><h1>Make your links <span>shorter.</span></h1><p className="intro">Turn long URLs into clean, shareable links in seconds.</p><form onSubmit={shorten}><label>Destination URL<input type="url" required placeholder="https://example.com/very/long/link" value={originalUrl} onChange={e=>setOriginalUrl(e.target.value)}/></label><div className="fields"><label>Custom alias <small>(optional)</small><input placeholder="my-link" value={customAlias} onChange={e=>setCustomAlias(e.target.value)}/></label><label>Expires after <small>(optional)</small><select value={expiresInDays} onChange={e=>setExpiresInDays(e.target.value)}><option value="">Never</option><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="365">1 year</option></select></label></div><button disabled={loading}>{loading?'Creating link…':'Shorten URL →'}</button></form>{error&&<p role="alert" className="error">{error}</p>}{result&&<div className="result"><div className="result-label">Your short link is ready</div><a href={result.shortUrl} target="_blank" rel="noreferrer">{result.shortUrl}</a><button type="button" className="copy" onClick={copy}>Copy link</button></div>}<p className="foot">Powered by Express, PostgreSQL & Redis</p></section></main>;
}
