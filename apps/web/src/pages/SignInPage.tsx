import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth';
import '../styles/forms.css';

export function SignInPage() {
  const { signIn, signUp, mode } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'dev') await signIn(username);
      else if (isSignUp) await signUp(email, password, username);
      else await signIn(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page auth-page">
      <form className="card form" onSubmit={onSubmit}>
        <h1>{isSignUp ? 'Create your account' : 'Sign in'}</h1>
        {mode === 'dev' ? (
          <>
            <p className="muted">
              Local dev mode: pick any username, no password. Use two different names to test
              recreating someone else's trip.
            </p>
            <label className="field">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alex"
                required
                minLength={2}
                autoFocus
              />
            </label>
          </>
        ) : (
          <>
            {isSignUp && (
              <label className="field">
                Username
                <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} />
              </label>
            )}
            <label className="field">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
        {mode === 'supabase' && (
          <button type="button" className="btn-link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Have an account? Sign in' : 'New here? Create an account'}
          </button>
        )}
      </form>
    </main>
  );
}
