import { Box, Grid, Skeleton } from '@mui/material';
import { Work, Assignment } from '@mui/icons-material';
import { CardSection, DarkButton, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';


function JobsMatching({ stats, loading }) {

  const jobStats = {
    totalJobs: stats?.jobs?.total ?? 0,
    jobsWithMatches: stats?.jobs?.with_matches ?? 0
  };

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Work sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0 }}>
          Jobs & Matching
        </SectionHeader>
      </Box>
      
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <DashboardStatCard
              value={jobStats.totalJobs}
              label="Total Jobs in Database"
              icon={Work}
            />
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <DashboardStatCard
              value={jobStats.jobsWithMatches}
              label="Jobs with Generated Matches"
              icon={Assignment}
            />
          )}
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <DarkButton size="small">
          View All Jobs
        </DarkButton>
      </Box>
    </CardSection>
  );
}

export default JobsMatching;