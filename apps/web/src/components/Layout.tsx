import { Outlet } from 'react-router';
import { AuthProvider } from '../lib/auth';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <AuthProvider>
      <Navbar />
      <Outlet />
    </AuthProvider>
  );
}
