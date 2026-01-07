import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './components/Header';
import Login from './components/Login';
import Register from './components/Register';
import Onboarding from './components/Onboarding';
import MLGDashboard from './components/MlgDashboard';
import CandidateDashboard from './components/CandidateDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';

function App() {
  return (
    <Router>
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Header />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
  );
}

export default App;
