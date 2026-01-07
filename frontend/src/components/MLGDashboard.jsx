import { Box, Grid } from '@mui/material';
import { SectionHeader } from './ui/StyledComponents';
import UpcomingMeetings from './dashboard/UpcomingMeetings';
import CandidateStats from './dashboard/CandidateStats';
import JobsMatching from './dashboard/JobsMatching';
import ClientStats from './dashboard/ClientStats';

function MLGDashboard() {
  return (
    <Box sx={{ p: 4, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <SectionHeader variant="h4" component="h1" sx={{ mb: 4 }}>
        MLG Recruiter Dashboard
      </SectionHeader>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <UpcomingMeetings />
        </Grid>
        <Grid item xs={6}>
          <CandidateStats />
        </Grid>
        <Grid item xs={6}>
          <JobsMatching />
        </Grid>
        <Grid item xs={6}>
          <ClientStats />
        </Grid>
      </Grid>
    </Box>
  );
}

export default MLGDashboard;