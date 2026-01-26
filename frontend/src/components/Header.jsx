import { AppBar, Toolbar, Typography, Button, Box, Avatar } from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { isAuthenticated, logout } = useAuth();

  const handleUserTypeSelect = (type) => {
    localStorage.setItem('userType', type);
    navigate('/login');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppBar position="static">
      <Toolbar sx={{ px: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Avatar sx={{
            backgroundColor: '#FF5A5A',
            mr: 2,
            width: 40,
            height: 40
          }}>
            <PetsIcon sx={{ color: 'white' }} />
          </Avatar>
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 500,
              color: '#343434'
            }}
          >
            The Marcus-Levi Group
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {!isAuthenticated && (
            <>
              <Button sx={navButtonSx} onClick={() => handleUserTypeSelect('mlg-recruiter')}>
                Recruiters
              </Button>
              <Button sx={navButtonSx} onClick={() => handleUserTypeSelect('candidate')}>
                Executives
              </Button>
              <Button sx={navButtonSx} onClick={() => handleUserTypeSelect('mlg-recruiter')}>
                MLG Recruiter Login
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