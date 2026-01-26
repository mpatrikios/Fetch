import { Box, Grid } from '@mui/material';
import { SectionHeader } from './common-components/StyledComponents';
import UpcomingMeetings from './dashboard-components/UpcomingMeetings';
import CandidateStats from './dashboard-components/CandidateStats';
import JobsMatching from './dashboard-components/JobsMatching';
import ClientStats from './dashboard-components/ClientStats';
import { useDashboardStats } from '../hooks/useDashboardStats';

function MLGDashboard() {
  const { stats, loading } = useDashboardStats();

  return (
    <Box sx={{ p: 4, backgroundColor: 'grey.50', minHeight: '100vh' }}>
      <SectionHeader variant="h4" component="h1" sx={{ mb: 4 }}>
        MLG Recruiter Dashboard
      </SectionHeader>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <UpcomingMeetings />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CandidateStats stats={stats} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <JobsMatching stats={stats} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ClientStats stats={stats} loading={loading} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default MLGDashboard;
