import { Box, Grid, Skeleton, Tooltip } from '@mui/material';
import { People, PersonAdd, CheckCircle, HowToReg } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';

function CandidateStats({ stats, loading }) {
  const navigate = useNavigate();

  const candidateStats = {
    total: stats?.candidates?.total ?? 0,
    onboarding: stats?.candidates?.onboarding ?? 0,
    accepted: stats?.candidates?.accepted ?? 0,
    pending: stats?.candidates?.pending ?? 0
  };

  const handleStatsClick = (label) => {
    if (label === "Total Candidates") {
      navigate("/candidates?status=all");
    } else if (label === "Onboarding") {
      navigate("/candidates?status=onboarding");
    } else if (label === "Fully Onboarded") {
      navigate("/candidates?status=accepted");
    } else if (label === "Pending Approval") {
      navigate("/candidates?status=pending");
    }
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
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <Tooltip title="View all candidates">
              <Box onClick={() => handleStatsClick("Total Candidates")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Total Candidates"); }} sx={{ cursor: 'pointer', height: '100%' }}>
                <DashboardStatCard
                  value={candidateStats.total}
                  label="Total Candidates"
                  icon={People}
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
            <Tooltip title="View candidates in onboarding">
              <Box onClick={() => handleStatsClick("Onboarding")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Onboarding"); }} sx={{ cursor: 'pointer', height: '100%' }}>
                <DashboardStatCard
                  value={candidateStats.onboarding}
                  label="Onboarding"
                  icon={PersonAdd}
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
            <Tooltip title="View fully onboarded candidates">
              <Box onClick={() => handleStatsClick("Fully Onboarded")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Fully Onboarded"); }} sx={{ cursor: 'pointer', height: '100%' }}>
                <DashboardStatCard
                  value={candidateStats.accepted}
                  label="Fully Onboarded"
                  icon={CheckCircle}
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
            <Tooltip title="View candidates pending approval">
              <Box onClick={() => handleStatsClick("Pending Approval")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Pending Approval"); }} sx={{ cursor: 'pointer', height: '100%' }}>
                <DashboardStatCard
                  value={candidateStats.pending}
                  label="Pending Approval"
                  icon={HowToReg}
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

export default CandidateStats;
