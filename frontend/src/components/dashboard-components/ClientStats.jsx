import { Box, Grid, Skeleton } from '@mui/material';
import { Business, Assessment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, DarkButton, DashboardStatCard, SectionHeader } from '../common-components/StyledComponents';
import { useNavigate } from 'react-router-dom';

function ClientStats({ stats, loading }) {
  const navigate = useNavigate();

  const clientStats = {
    totalClients: stats?.clients?.total ?? 0,
    onboarding: stats?.clients?.onboarding ?? 0
  };

  
  const navigate = useNavigate();
  const handleStatsClick = (label) => {
    if (label === "Total Clients") {
      navigate("/candidates?status=all");
    } else if (label === "Clients in Intake Process") {
      navigate("/candidates?filter=onboarding");
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
            <div onClick={() => handleStatsClick("Total Clients")}>
            <DashboardStatCard
              value={clientStats.totalClients}
              label="Total Clients"
              icon={Business}
            />
            </div>
          )}
        </Grid>
        <Grid size={{ xs: 6 }}>
          {loading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <DashboardStatCard
              value={clientStats.onboarding}
              label="Clients in Intake Process"
              icon={Assessment}
            />
          )}
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <DarkButton size="small" onClick={() => navigate('/clients')}>
          View All Clients
        </DarkButton>
      </Box>
    </CardSection>
  );
}

export default ClientStats;