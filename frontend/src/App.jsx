import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Login from './components/Login';
import Register from './components/Register';
import Onboarding from './components/Onboarding';
import MLGDashboard from './components/MlgDashboard';
import CandidateDashboard from './components/CandidateDashboard';
import Candidates from './components/Candidates';
import Jobs from './components/Jobs';
import Clients from './components/Clients';
import JobRecommendations from './components/JobRecommendations';
import ExecutiveInfo from './components/ExecutiveInfo';
import RecruiterInfo from './components/RecruiterInfo';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
          <Header />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/executives" element={<ExecutiveInfo />} />
            <Route path="/recruiters" element={<RecruiterInfo />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mlg-dashboard"
              element={
                <RoleProtectedRoute requiredRole="mlg-recruiter">
                  <MLGDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/candidates"
              element={
                <RoleProtectedRoute requiredRole="mlg-recruiter">
                  <Candidates />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <RoleProtectedRoute requiredRole="mlg-recruiter">
                  <Jobs />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <RoleProtectedRoute requiredRole="mlg-recruiter">
                  <Clients />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/jobs/:company/:title/matches"
              element={
                <RoleProtectedRoute requiredRole="mlg-recruiter">
                  <JobRecommendations />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <CandidateDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </Box>
      </Router>
    </AuthProvider>
  );
}

export default App;
