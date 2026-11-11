import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';

const peso = (amount) => `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(event) {
    event.preventDefault(); setError(''); setResult(null); setLoading(true);
    try { setResult(await api.askAssistant(question)); }
    catch (caught) { setError(caught.message || 'The assistant could not answer right now. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <section className="assistant-layout">
      <div>
        <p className="eyebrow">GROUNDED ASSISTANT</p>
        <h1>Find a product</h1>
        <p>Answers are checked against the current ShopSmart catalog. Only active, in-stock products are recommended, and every recommendation links to its product page.</p>
        <form onSubmit={ask}>
          <label>Your question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} minLength="3" maxLength="300" placeholder="Which keyboard is below ₱2,000?" required /></label>
          <button disabled={loading}>{loading ? 'Checking the catalog…' : 'Ask ShopSmart'}</button>
        </form>
      </div>
      <div className="assistant-answer" aria-live="polite" aria-busy={loading}>
        <h2>Assistant response</h2>
        {loading && <StatusMessage>Checking the current catalog and preparing an answer…</StatusMessage>}
        <StatusMessage type="error">{error}</StatusMessage>
        {!result && !error && !loading && <p>Your answer will appear here.</p>}
        {result && <>
          {result.notice && <StatusMessage type="warning">{result.notice}</StatusMessage>}
          <p>{result.answer}</p>
          {result.recommendedProducts.length > 0 && <div className="recommendations">
            {result.recommendedProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                {product.name} — {peso(product.price)}
                {product.stock !== undefined && <span className="recommendation-stock"> · {product.stock} in stock</span>}
              </Link>
            ))}
          </div>}
          <details className="assistant-sources" open>
            <summary>Sources ({result.sources.length})</summary>
            {result.sources.length === 0
              ? <p>No catalog product supported a recommendation for this question.</p>
              : <ul>{result.sources.map((source) => (
                <li key={source.id}><Link to={`/products/${source.id}`}>Product #{source.id}: {source.name}</Link>{source.price !== undefined && ` — ${peso(source.price)}`}</li>
              ))}</ul>}
            <p className="assistant-mode">{result.mode === 'ai' ? 'Drafted by AI, verified against the catalog.' : 'Built from catalog rules.'}</p>
          </details>
        </>}
      </div>
    </section>
  );
}
