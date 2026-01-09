import { Box, Typography, Grid } from '@mui/material';
import { People, PersonAdd, Schedule, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, DarkButton, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';


function CandidateStats() {
  const navigate = useNavigate();
  
  // MOCK DATA TODO: Replace with real data fetching logic
  const stats = {
    total: 247,
    onboarding: 12,
    interviews: 8,
    pending: 5
  };

  const handleViewAllCandidates = () => {
    navigate('/candidates');
  };

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <People sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0 }}>
          Candidate Statistics
        </SectionHeader>
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
        <DarkButton size="small" onClick={handleViewAllCandidates}>
          View All Candidates
        </DarkButton>
      </Box>
    </CardSection>
  );
}

export default CandidateStats;