import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Typography, Box } from '@mui/material';
import ResumeUpload from './components/ResumeUpload';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Box>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Box>
                  <Typography>
                    Fetch Recruitment Platform
                  </Typography>
                  <ResumeUpload />
                </Box>
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
