import { Box, Typography, Card, Grid, LinearProgress } from '@mui/material';
import { Work, Assignment, TrendingUp } from '@mui/icons-material';
import { CardSection } from '../ui/StyledComponents';

function JobsMatching() {
  // Placeholder data - will be replaced with real API calls
  const jobStats = {
    totalJobs: 34,
    jobsWithMatches: 28,
    matchingPercentage: 82
  };

  const StatsCard = ({ value, label, icon: Icon, showProgress = false, percentage }) => (
    <Card sx={{ p: 3, textAlign: 'center', backgroundColor: '#f8f9fa', height: '100%' }}>
      <Icon sx={{ fontSize: 32, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
        {value}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontFamily: 'Montserrat, sans-serif' }}>
        {label}
      </Typography>
      {showProgress && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={percentage} 
            sx={{ 
              height: 8, 
              borderRadius: 5,
              backgroundColor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'text.secondary'
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {percentage}% completion rate
          </Typography>
        </Box>
      )}
    </Card>
  );

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Work sx={{ mr: 2, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          Jobs & Matching
        </Typography>
      </Box>
      
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid item xs={12}>
          <StatsCard 
            value={jobStats.totalJobs} 
            label="Total Jobs in Database" 
            icon={Work}
          />
        </Grid>
        <Grid item xs={12}>
          <StatsCard 
            value={jobStats.jobsWithMatches} 
            label="Jobs with Generated Matches" 
            icon={Assignment}
            showProgress={true}
            percentage={jobStats.matchingPercentage}
          />
        </Grid>
      </Grid>
    </CardSection>
  );
}

export default JobsMatching;