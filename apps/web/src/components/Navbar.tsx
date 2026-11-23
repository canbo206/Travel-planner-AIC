import { Link, NavLink } from 'react-router';

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

export function Navbar() {
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
        <button className="btn btn-primary" type="button">
          + New trip
        </button>
      </div>
    </header>
  );
}
