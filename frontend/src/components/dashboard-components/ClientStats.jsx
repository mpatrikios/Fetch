import { Box, Grid, Skeleton, Tooltip } from '@mui/material';
import { Business, Assessment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';

function ClientStats({ stats, loading }) {
  const navigate = useNavigate();

  const clientStats = {
    totalClients: stats?.clients?.total ?? 0,
    onboarding: stats?.clients?.onboarding ?? 0
  };

  const handleStatsClick = (label) => {
    if (label === "Total Clients") {
      navigate("/clients");
    } else if (label === "Clients in Intake Process") {
      navigate("/clients?status=onboarding");
    }
  };

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Business sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0 }}>
          Client Statistics
        </SectionHeader>
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <Tooltip title="View all clients">
              <Box onClick={() => handleStatsClick("Total Clients")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Total Clients"); }} sx={{ cursor: 'pointer', height: '100%' }}>
                <DashboardStatCard
                  value={clientStats.totalClients}
                  label="Total Clients"
                  icon={Business}
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
            <Tooltip title="View clients in intake">
              <Box onClick={() => handleStatsClick("Clients in Intake Process")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStatsClick("Clients in Intake Process"); }} sx={{ cursor: 'pointer', height: '100%' }}>
                <DashboardStatCard
                  value={clientStats.onboarding}
                  label="Clients in Intake Process"
                  icon={Assessment}
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

export default ClientStats;
