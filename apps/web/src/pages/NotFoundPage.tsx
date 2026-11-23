import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p className="subtitle">
        That page doesn't exist. <Link to="/">Back to Discover</Link>
      </p>
    </main>
  );
}
