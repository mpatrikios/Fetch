import {
  Box,
  Button,
  Typography,
  Container,
  Grid,
  Card,
  Link
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HandshakeIcon from '@mui/icons-material/Handshake';

function ExecutiveInfo() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: <WorkOutlineIcon sx={{ fontSize: 40, color: '#FF5A5A' }} />,
      title: 'Exclusive Opportunities',
      description: 'Access executive-level positions at top companies that are not publicly advertised.'
    },
    {
      icon: <TrendingUpIcon sx={{ fontSize: 40, color: '#FF5A5A' }} />,
      title: 'Career Advancement',
      description: 'Get matched with roles that align with your skills, experience, and career goals.'
    },
    {
      icon: <HandshakeIcon sx={{ fontSize: 40, color: '#FF5A5A' }} />,
      title: 'Personalized Support',
      description: 'Work with dedicated recruiters who understand your unique value and advocate for you.'
    }
  ];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FFFFFF', pt: 0 }}>
      <Container maxWidth="xl" sx={{ py: 10 }}>
        <Grid container spacing={6}>
          {/* Left side content */}
          <Grid size={{ xs: 12, md: 6 }} sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
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
              For Executives
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontFamily: 'Petrona, serif',
                color: 'rgba(52,52,52,0.7)',
                lineHeight: 1.6,
                fontWeight: 400,
                fontSize: { xs: '1.25rem', md: '1.5rem' },
                mb: 4
              }}
            >
              Join The Marcus-Levi Group's exclusive talent pool and connect with career opportunities that match your expertise and aspirations.
            </Typography>

            {/* Benefits */}
            <Box sx={{ mb: 4 }}>
              {benefits.map((benefit, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                  <Box sx={{ mr: 2, mt: 0.5 }}>
                    {benefit.icon}
                  </Box>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 600,
                        color: '#343434',
                        mb: 0.5
                      }}
                    >
                      {benefit.title}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: 'Petrona, serif',
                        color: 'rgba(52,52,52,0.7)'
                      }}
                    >
                      {benefit.description}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Grid>

          {/* Right side card */}
          <Grid size={{ xs: 12, md: 6 }} sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Card sx={{
              width: 420,
              p: 5,
              textAlign: 'center'
            }}>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  color: '#343434',
                  mb: 2
                }}
              >
                Ready to Get Started?
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontFamily: 'Petrona, serif',
                  color: 'rgba(52,52,52,0.7)',
                  mb: 4
                }}
              >
                Create your profile and let us match you with your next career opportunity.
              </Typography>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  py: 1.5,
                  mb: 2,
                  fontSize: '1rem',
                  fontFamily: 'Montserrat, sans-serif'
                }}
              >
                Get Started
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'Petrona, serif',
                    color: 'rgba(52,52,52,0.7)'
                  }}
                >
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    sx={{
                      color: '#FF5A5A',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    Sign In
                  </Link>
                </Typography>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default ExecutiveInfo;
