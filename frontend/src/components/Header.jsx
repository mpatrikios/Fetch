import { AppBar, Toolbar, Button, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessDashboard } from '../utils/api';
import logo from '../assets/logo.png';

// Shared navigation button styles
const navButtonSx = {
  color: '#343434',
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 400,
  '&:hover': {
    color: '#FF5A5A'
  }
};

function Header() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppBar position="static">
      <Toolbar sx={{ px: 4 }}>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isAuthenticated) navigate('/login');
            else if (user?.role === 'mlg-recruiter') navigate('/mlg-dashboard');
            else if (canAccessDashboard(user)) navigate('/dashboard');
            else navigate('/onboarding');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!isAuthenticated) navigate('/login');
              else if (user?.role === 'mlg-recruiter') navigate('/mlg-dashboard');
              else if (canAccessDashboard(user)) navigate('/dashboard');
              else navigate('/onboarding');
            }
          }}
          sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, cursor: 'pointer' }}
        >
          <Box component="img" src={logo} alt="The Marcus-Levi Group" sx={{ height: 40, mr: 2 }} />
          <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 500, color: '#343434' }}>
            The Marcus-Levi Group
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {!isAuthenticated && (
            <>
              <Button sx={navButtonSx} onClick={() => navigate('/executives')}>
                For Executives
              </Button>
              <Button sx={navButtonSx} onClick={() => navigate('/recruiters')}>
                For Recruiters
              </Button>
              <Button sx={navButtonSx} onClick={() => navigate('/login')}>
                Login
              </Button>
            </>
          )}

          {isAuthenticated && (
            <Button
              variant="outlined"
              color="primary"
              onClick={handleLogout}
              sx={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 500
              }}
            >
              Logout
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;