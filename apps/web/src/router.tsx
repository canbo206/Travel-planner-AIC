import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { DiscoverPage } from './pages/DiscoverPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DiscoverPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
