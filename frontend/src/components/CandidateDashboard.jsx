import { useState, useEffect } from 'react';
import { Container, Box, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { authAPI, jobAPI } from '../utils/api';
import ProfileCard from './dashboard-components/ProfileCard';
import AppliedJobsList from './dashboard-components/AppliedJobsList';
import RecommendedJobs from './dashboard-components/RecommendedJobs';

function CandidateDashboard() {
  const [user, setUser] = useState(null);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get current user info
      const userResponse = await authAPI.getCurrentUser();
      setUser(userResponse.data);
      
      // Get recommended jobs
      const jobsResponse = await jobAPI.list();
      const jobs = jobsResponse.data.jobs || [];
      setRecommendedJobs(jobs.slice(0, 5));
      
      // Mock applied jobs data - replace with actual API call
      setAppliedJobs([
        {
          id: 1,
          title: 'Software Engineer',
          company: 'Tech Corp',
          status: 'pending',
          appliedDate: '2024-01-15'
        },
        {
          id: 2,
          title: 'Product Manager',
          company: 'StartUp Inc',
          status: 'interview',
          appliedDate: '2024-01-10'
        }
      ]);
      
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Welcome Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Welcome back, {user?.name || 'Candidate'}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your applications and discover new opportunities
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Profile Section */}
          <Grid size={{ xs: 12, md: 4 }}>
            <ProfileCard user={user} />
          </Grid>

          {/* Main Content */}
          <Grid size={{ xs: 12, md: 8 }}>
            <AppliedJobsList appliedJobs={appliedJobs} />
            <RecommendedJobs recommendedJobs={recommendedJobs} />
          </Grid>
        </Grid>
      </Container>
  );
}

export default CandidateDashboard;