import { Box, Grid, Skeleton } from '@mui/material';
import { People, PersonAdd, Schedule, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, DarkButton, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';

function CandidateStats({ stats, loading }) {
  const navigate = useNavigate();

  const candidateStats = {
    total: stats?.candidates?.total ?? 0,
    onboarding: stats?.candidates?.onboarding ?? 0,
    interviews: 0, // Not tracked yet
    pending: stats?.candidates?.pending ?? 0
  };

  const handleViewAllCandidates = () => {
    navigate('/candidates');
  };

  const handleStatsClick = (label) => {
    if (label === "Total Candidates") {
      navigate("/candidates?status=all");
    } else if (label === "Onboarding") {
      navigate("/candidates?status=onboarding");
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
            <Box onClick={() => handleStatsClick("Total Candidates")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Total Candidates"); }} sx={{ cursor: 'pointer' }}>
              <DashboardStatCard
                value={candidateStats.total}
                label="Total Candidates"
                icon={People}
                size="small"
              />
            </Box>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <Box onClick={() => handleStatsClick("Onboarding")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Onboarding"); }} sx={{ cursor: 'pointer' }}>
              <DashboardStatCard
                value={candidateStats.onboarding}
                label="Onboarding"
                icon={PersonAdd}
                size="small"
              />
            </Box>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <DashboardStatCard
              value={candidateStats.interviews}
              label="In Interviews"
              icon={Schedule}
              size="small"
            />
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <Box onClick={() => handleStatsClick("Pending Approval")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Pending Approval"); }} sx={{ cursor: 'pointer' }}>
              <DashboardStatCard
                value={candidateStats.pending}
                label="Pending Approval"
                icon={CheckCircle}
                size="small"
              />
            </Box>
          )}
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