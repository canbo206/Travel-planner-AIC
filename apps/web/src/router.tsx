import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { DiscoverPage } from './pages/DiscoverPage';
import { MyTripsPage, SavedPage } from './pages/MyTripsPage';
import { NewTripPage } from './pages/NewTripPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { TripEditorPage } from './pages/TripEditorPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DiscoverPage /> },
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/trips/new', element: <RequireAuth><NewTripPage /></RequireAuth> },
      { path: '/trips/:id', element: <TripDetailPage /> },
      { path: '/trips/:id/edit', element: <RequireAuth><TripEditorPage /></RequireAuth> },
      { path: '/me/trips', element: <RequireAuth><MyTripsPage /></RequireAuth> },
      { path: '/me/saved', element: <RequireAuth><SavedPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
