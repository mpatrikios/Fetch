import { Box, Typography, Card, Grid, Chip } from '@mui/material';
import { Business, PersonAdd, Assessment } from '@mui/icons-material';
import { CardSection } from '../ui/StyledComponents';

function ClientStats() {
  // Placeholder data - will be replaced with real API calls
  const clientStats = {
    totalClients: 18,
    intakePhase: 3
  };

  const recentClients = [
    { name: "TechCorp Solutions", phase: "intake", industry: "Technology" },
    { name: "Healthcare Plus", phase: "active", industry: "Healthcare" },
    { name: "Financial Dynamics", phase: "intake", industry: "Finance" }
  ];

  const StatsCard = ({ value, label, icon: Icon }) => (
    <Card sx={{ p: 3, textAlign: 'center', backgroundColor: '#f8f9fa', height: '100%' }}>
      <Icon sx={{ fontSize: 32, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
        {value}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontFamily: 'Montserrat, sans-serif' }}>
        {label}
      </Typography>
    </Card>
  );

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Business sx={{ mr: 2, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          Client Statistics
        </Typography>
      </Box>
      
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        <Grid item xs={12}>
          <StatsCard 
            value={clientStats.totalClients} 
            label="Total Clients in Database" 
            icon={Business}
          />
        </Grid>
        <Grid item xs={12}>
          <StatsCard 
            value={clientStats.intakePhase} 
            label="Clients in Intake Phase" 
            icon={Assessment}
          />
        </Grid>
        
        {/* Recent Client Activity */}
        <Grid item xs={12}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontFamily: 'Montserrat, sans-serif', color: '#666' }}>
              Recent Activity
            </Typography>
            {recentClients.map((client, index) => (
              <Box 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 1.5,
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: 'white'
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}>
                    {client.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {client.industry}
                  </Typography>
                </Box>
                <Chip 
                  label={client.phase} 
                  size="small"
                  sx={{ 
                    backgroundColor: 'action.hover',
                    color: 'text.primary',
                    fontSize: '0.7rem',
                    textTransform: 'capitalize'
                  }}
                />
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>
    </CardSection>
  );
}

export default ClientStats;