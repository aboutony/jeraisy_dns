import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GlobalStoreProvider } from './store/GlobalStore';
import AppShell from './components/Layout/AppShell';
import Dashboard from './pages/Dashboard/Dashboard';
import Workforce from './pages/Workforce/Workforce';
import PunchClock from './pages/PunchClock/PunchClock';
import OracleBridge from './pages/OracleBridge/OracleBridge';
import WorkOrders from './pages/WorkOrders/WorkOrders';
import Settings from './pages/Settings/Settings';
import Compliance from './pages/Compliance/Compliance';
import Profile from './pages/Profile/Profile';
import Login from './pages/Login/Login';
import './i18n';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      <Route element={
        <ProtectedRoute><AppShell /></ProtectedRoute>
      }>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workforce" element={<Workforce />} />
        <Route path="/punch-clock" element={<PunchClock />} />
        <Route path="/oracle-bridge" element={<OracleBridge />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GlobalStoreProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </GlobalStoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
