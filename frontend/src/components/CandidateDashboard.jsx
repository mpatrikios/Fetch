import { useState, useEffect } from 'react';
import { Container, Box, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { authAPI, profileAPI } from '../utils/api';
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
      
      // Get current user info and profile (for has_resume, has_clifton_doc)
      const [userResponse, profileResponse] = await Promise.all([
        authAPI.getCurrentUser(),
        profileAPI.getProfile(),
      ]);
      setUser({ ...userResponse.data, ...profileResponse.data });
      
      // Get jobs recommended specifically for this candidate
      const recsResponse = await profileAPI.getRecommendations();
      setRecommendedJobs(recsResponse.data.recommendations || []);

      // Get jobs the candidate has expressed interest in
      const appsResponse = await profileAPI.getApplications();
      setAppliedJobs(appsResponse.data.applications || []);
      
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
            Welcome back, {user?.full_name || 'Candidate'}!
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
            <RecommendedJobs recommendedJobs={recommendedJobs} onRefresh={loadDashboardData} user={user} />
          </Grid>
        </Grid>
      </Container>
  );
}

export default CandidateDashboard;