import { Box, Grid, Skeleton } from '@mui/material';
import { Business, Assessment } from '@mui/icons-material';
import { CardSection, DarkButton, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';


function ClientStats({ stats, loading }) {

  const clientStats = {
    totalClients: stats?.clients?.total ?? 0,
    onboarding: stats?.clients?.intake_phase ?? 0
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
            <DashboardStatCard
              value={clientStats.totalClients}
              label="Total Clients in Database"
              icon={Business}
            />
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <DashboardStatCard
              value={clientStats.onboarding}
              label="Clients Onboarding"
              icon={Assessment}
            />
          )}
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <DarkButton size="small">
          View All Clients
        </DarkButton>
      </Box>
    </CardSection>
  );
}

export default ClientStats;