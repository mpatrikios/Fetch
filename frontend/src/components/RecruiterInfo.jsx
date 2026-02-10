import {
  Box,
  Button,
  Typography,
  Container,
  Grid,
  Card
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import VerifiedIcon from '@mui/icons-material/Verified';
import SpeedIcon from '@mui/icons-material/Speed';

function RecruiterInfo() {
  const benefits = [
    {
      icon: <GroupsIcon sx={{ fontSize: 40, color: '#FF5A5A' }} />,
      title: 'Pre-Vetted Talent Pool',
      description: 'Access a curated network of executive-level candidates who have been thoroughly screened and assessed.'
    },
    {
      icon: <VerifiedIcon sx={{ fontSize: 40, color: '#FF5A5A' }} />,
      title: 'Quality Matches',
      description: 'Our AI-powered matching ensures you receive candidates who align with your specific requirements and culture.'
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 40, color: '#FF5A5A' }} />,
      title: 'Faster Hiring',
      description: 'Reduce time-to-hire with candidates ready to move and a streamlined recruitment process.'
    }
  ];

  const handleContactClick = () => {
    window.location.href = 'mailto:contact@marcuslevigroup.com?subject=Recruiting Partnership Inquiry';
  };

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
              For Recruiters
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
              Partner with The Marcus-Levi Group to find exceptional executive talent for your organization.
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
                Ready to Find Top Talent?
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontFamily: 'Petrona, serif',
                  color: 'rgba(52,52,52,0.7)',
                  mb: 4
                }}
              >
                Get in touch with our team to discuss your executive hiring needs.
              </Typography>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                onClick={handleContactClick}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontFamily: 'Montserrat, sans-serif'
                }}
              >
                Contact Us
              </Button>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default RecruiterInfo;
