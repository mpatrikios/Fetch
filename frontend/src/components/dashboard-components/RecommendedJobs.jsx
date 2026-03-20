import { useState } from 'react';
import {
  Typography,
  Grid,
  Paper,
  Box,
  Chip,
  Alert,
  Divider,
  Button
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { CardSection, SectionHeader, DarkButton } from '../common-components/StyledComponents';
import { profileAPI } from '../../utils/api';
import CalendlyEmbed from '../CalendlyEmbed';

function RecommendedJobs({ recommendedJobs, onRefresh, user }) {
  const [interestSent, setInterestSent] = useState({});
  const [showCalendly, setShowCalendly] = useState({});
  const [error, setError] = useState('');

  const handleExpressInterest = async (job) => {
    const recId = job._id;
    try {
      setInterestSent(prev => ({ ...prev, [recId]: 'loading' }));
      await profileAPI.expressInterest(recId);
      setInterestSent(prev => ({ ...prev, [recId]: 'done' }));
      setShowCalendly(prev => ({ ...prev, [recId]: true }));
    } catch (err) {
      setError('Failed to express interest. Please try again.');
      setInterestSent(prev => ({ ...prev, [recId]: null }));
    }
  };

  const handleCalendlyDone = (recId) => {
    setShowCalendly(prev => ({ ...prev, [recId]: false }));
    if (onRefresh) onRefresh();
  };

  return (
    <CardSection>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Star sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0 }}>
          Recommended Jobs & Next Steps
        </SectionHeader>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {recommendedJobs.length === 0 ? (
        <Typography>
          No recommendations yet. You will receive an email when we find the right fit for you.
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 480, overflowY: 'auto', pr: 0.5 }}>
        <Grid container spacing={2}>
          {recommendedJobs.map((job) => {
            const recId = job._id;
            const isDone = interestSent[recId] === 'done';
            const isLoading = interestSent[recId] === 'loading';

            return (
              <Grid size={{ xs: 12 }} key={recId}>
                <Paper elevation={1} sx={{ p: 2, '&:hover': { elevation: 3 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {job.job_title || 'Job Title'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {job.company_name || 'Company Name'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {job.job_location || 'Location not specified'}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {job.skills?.map(skill => (
                          <Chip key={skill} label={skill} size="small" />
                        ))}
                      </Box>
                    </Box>

                    <DarkButton
                      disabled={isDone || isLoading}
                      onClick={() => handleExpressInterest(job)}
                      sx={{ ml: 2, flexShrink: 0 }}
                    >
                      {isDone ? 'Interest Sent' : isLoading ? 'Sending...' : 'Express Interest'}
                    </DarkButton>
                  </Box>

                  {showCalendly[recId] && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Schedule a follow-up call to complete your application:
                      </Typography>
                      <CalendlyEmbed
                        url={import.meta.env.VITE_CALENDLY_FOLLOWUP_URL}
                        user={user}
                        onEventScheduled={() => handleCalendlyDone(recId)}
                      />
                      <Button size="small" onClick={() => handleCalendlyDone(recId)} sx={{ mt: 1 }}>
                        Done
                      </Button>
                    </>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
        </Box>
      )}
    </CardSection>
  );
}

export default RecommendedJobs;
