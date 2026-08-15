import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api.js';
import Layout from './components/Layout.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import Login from './pages/Login.jsx';
import ReposPage from './pages/ReposPage.jsx';
import RunsPage from './pages/RunsPage.jsx';
import RunDetailPage from './pages/RunDetailPage.jsx';
import ApprovalsPage from './pages/ApprovalsPage.jsx';
import CostsPage from './pages/CostsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

function RequireAuth({ children }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/repos" replace />} />
            <Route path="/repos" element={<ReposPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/costs" element={<CostsPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
