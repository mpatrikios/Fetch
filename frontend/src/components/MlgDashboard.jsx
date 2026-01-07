import { Box, Grid } from '@mui/material';
import { SectionHeader } from './common-components/StyledComponents';
import UpcomingMeetings from './dashboard-components/UpcomingMeetings';
import CandidateStats from './dashboard-components/CandidateStats';
import JobsMatching from './dashboard-components/JobsMatching';
import ClientStats from './dashboard-components/ClientStats';

function MLGDashboard() {
  return (
    <Box sx={{ p: 4, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <SectionHeader variant="h4" component="h1" sx={{ mb: 4 }}>
        MLG Recruiter Dashboard
      </SectionHeader>
      
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <UpcomingMeetings />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CandidateStats />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <JobsMatching />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ClientStats />
        </Grid>
      </Grid>
    </Box>
  );
}

export default MLGDashboard;