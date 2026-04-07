import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <Link to="/">FIT<span>FLEX</span></Link>
          </div>
          <div className="nav-links">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
            <Link to="/exercises" className={location.pathname === '/exercises' ? 'active' : ''}>Train</Link>
            <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>History</Link>
          </div>
        </div>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </>
  );
}
