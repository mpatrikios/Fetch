import { Box, Grid, Skeleton, Tooltip } from '@mui/material';
import { Work, Assignment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';


function JobsMatching({ stats, loading }) {
  const navigate = useNavigate();

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
            <Tooltip title="View all jobs">
              <Box
                role="button"
                tabIndex={0}
                onClick={() => navigate('/jobs')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/jobs'); } }}
                sx={{ cursor: 'pointer', height: '100%' }}
              >
                <DashboardStatCard
                  value={jobStats.totalJobs}
                  label="Total Jobs in Database"
                  icon={Work}
                  size="small"
                />
              </Box>
            </Tooltip>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <Tooltip title="View jobs with generated matches">
              <Box
                role="button"
                tabIndex={0}
                onClick={() => navigate('/jobs?filter=has_matches')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/jobs?filter=has_matches'); } }}
                sx={{ cursor: 'pointer', height: '100%' }}
              >
                <DashboardStatCard
                  value={jobStats.jobsWithMatches}
                  label="Jobs with Generated Matches"
                  icon={Assignment}
                  size="small"
                />
              </Box>
            </Tooltip>
          )}
        </Grid>
      </Grid>
    </CardSection>
  );
}

export default JobsMatching;
