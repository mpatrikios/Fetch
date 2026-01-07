import { Box, Typography, Grid } from '@mui/material';
import { People, PersonAdd, Schedule, CheckCircle } from '@mui/icons-material';
import { CardSection, DarkButton, DashboardStatCard } from '../common-components/StyledComponents';


function CandidateStats() {
  // MOCK DATA TODO: Replace with real data fetching logic
  const stats = {
    total: 247,
    onboarding: 12,
    interviews: 8,
    pending: 5
  };

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <People sx={{ mr: 2, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          Candidate Statistics
        </Typography>
      </Box>
      
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid size={{ xs: 6 }}>
          <DashboardStatCard 
            value={stats.total} 
            label="Total Candidates" 
            icon={People}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <DashboardStatCard 
            value={stats.onboarding} 
            label="Onboarding" 
            icon={PersonAdd}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <DashboardStatCard 
            value={stats.interviews} 
            label="In Interviews" 
            icon={Schedule}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <DashboardStatCard 
            value={stats.pending} 
            label="Pending Approval" 
            icon={CheckCircle}
            size="small"
          />
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <DarkButton size="small">
          View All Candidates
        </DarkButton>
      </Box>
    </CardSection>
  );
}

export default CandidateStats;