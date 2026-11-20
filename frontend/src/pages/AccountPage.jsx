import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Only same-site paths are allowed after sign-in, so a link cannot send people to another website.
const safeNext = (value) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/orders');

export default function AccountPage() {
  const { user, checking, login, register, logout } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (checking) return <section><StatusMessage>Checking your account…</StatusMessage></section>;
  if (user && params.get('next')) return <Navigate to={next} replace />;

  if (user) return (
    <section className="success-card">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>Signed in as {user.name}</h1>
      <p>{user.email}</p>
      <p><Link className="button" to="/orders">My orders</Link></p>
      <button className="secondary" onClick={logout}>Sign out</button>
    </section>
  );

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'login') await login({ email: form.email, password: form.password });
      else await register(form);
      navigate(next, { replace: true });
    } catch (caught) {
      setError(caught.message);
    } finally { setBusy(false); }
  }

  return (
    <section className="account-layout">
      <form onSubmit={submit}>
        <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'NEW CUSTOMER'}</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
        <p>Use made-up test details only. This classroom store does not take real orders or payments.</p>
        <StatusMessage type="error">{error}</StatusMessage>
        {mode === 'register' && <label>Full name<input name="name" value={form.name} onChange={update} minLength="2" maxLength="80" autoComplete="name" required /></label>}
        <label>Email address<input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" value={form.password} onChange={update} minLength={mode === 'register' ? 8 : 1} maxLength="128" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
        <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="secondary" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </section>
  );
}
