import { Box, Typography, Card, Grid } from '@mui/material';
import { People, PersonAdd, Schedule, CheckCircle } from '@mui/icons-material';
import { CardSection } from '../ui/StyledComponents';

function CandidateStats() {
  // Placeholder data - will be replaced with real API calls
  const stats = {
    total: 247,
    onboarding: 12,
    interviews: 8,
    pending: 5
  };

  const StatCard = ({ value, label, icon: Icon }) => (
    <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#f8f9fa', height: '100%' }}>
      <Icon sx={{ fontSize: 24, color: 'text.secondary', mb: 1 }} />
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'Montserrat, sans-serif' }}>
        {label}
      </Typography>
    </Card>
  );

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <People sx={{ mr: 2, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          Candidate Statistics
        </Typography>
      </Box>
      
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid item xs={6}>
          <StatCard 
            value={stats.total} 
            label="Total Candidates" 
            icon={People}
          />
        </Grid>
        <Grid item xs={6}>
          <StatCard 
            value={stats.onboarding} 
            label="Onboarding" 
            icon={PersonAdd}
          />
        </Grid>
        <Grid item xs={6}>
          <StatCard 
            value={stats.interviews} 
            label="In Interviews" 
            icon={Schedule}
          />
        </Grid>
        <Grid item xs={6}>
          <StatCard 
            value={stats.pending} 
            label="Pending Approval" 
            icon={CheckCircle}
          />
        </Grid>
      </Grid>
    </CardSection>
  );
}

export default CandidateStats;