import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <nav>
        <Link className="logo" to="/">
          Roadtrip
        </Link>
        <NavLink className={navClass} to="/" end>
          Discover
        </NavLink>
        <NavLink className={navClass} to="/me/trips">
          My Trips
        </NavLink>
        <NavLink className={navClass} to="/me/saved">
          Saved
        </NavLink>
      </nav>
      <div className="nav-actions">
        <Link className="btn btn-primary" to="/trips/new">
          + New trip
        </Link>
        {user ? (
          <button
            className="avatar"
            title={`Signed in as @${user.username} — click to sign out`}
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            {user.username.slice(0, 1).toUpperCase()}
          </button>
        ) : (
          <Link className="nav-link" to="/sign-in">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
