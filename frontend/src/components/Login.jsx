import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  Grid,
  Container,
  Card
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(formData.email, formData.password);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const userType = localStorage.getItem('userType');
  const isRecruiter = userType === 'mlg-recruiter';

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FFFFFF', pt: 0, position: 'relative' }}>
      <Container maxWidth="xl" sx={{ height: '100vh', py: 10, position: 'relative' }}>
        <Grid container spacing={6} sx={{ height: '100%' }}>
          {/* Left side content */}
          <Grid item xs={12} md={6} sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            alignItems: 'flex-start',
            px: 4
          }}>
            <Typography 
              variant="h2" 
              sx={{ 
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                mb: 3,
                color: '#343434',
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                lineHeight: 1.2
              }}
            >
              {isRecruiter ? 'MLG Recruiters' : 'Executives'}
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                fontFamily: 'Petrona, serif',
                color: 'rgba(52,52,52,0.7)',
                lineHeight: 1.6,
                fontWeight: 400,
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              {isRecruiter 
                ? 'Access your recruiting dashboard and candidate pipeline.'
                : 'Join our exclusive talent pool today.'}
            </Typography>
          </Grid>

          {/* Empty right side for spacing */}
          <Grid item xs={12} md={6} />
        </Grid>

        {/* Login form positioned absolutely on the right */}
        <Card sx={{ 
          width: 420,
          p: 4,
          position: 'fixed',
          right: { xs: 20, md: 80 },
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10
        }}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} noValidate>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  placeholder="Email"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  placeholder="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  disabled={loading || !formData.email || !formData.password}
                  sx={{ 
                    py: 1.5,
                    mb: 3,
                    fontSize: '1rem'
                  }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                
                {!isRecruiter && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Link 
                      href="/register" 
                      sx={{ 
                        color: '#FF5A5A',
                        textDecoration: 'none',
                        fontFamily: 'Petrona, serif',
                        '&:hover': {
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      Create account
                    </Link>
                  </Box>
                )}
              </Box>
        </Card>
      </Container>
    </Box>
  );
}

export default Login;