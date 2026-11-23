import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { DiscoverPage } from './pages/DiscoverPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DiscoverPage /> },
      { path: '/sign-in', element: <SignInPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
