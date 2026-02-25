import { useState } from 'react';
import {
  Typography,
  Grid,
  Paper,
  Box,
  Chip,
  Alert
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { CardSection, SectionHeader, DarkButton } from '../common-components/StyledComponents';
import { profileAPI } from '../../utils/api';

function RecommendedJobs({ recommendedJobs, onRefresh }) {
  const [interestSent, setInterestSent] = useState({});
  const [error, setError] = useState('');

  const handleExpressInterest = async (job) => {
    const recId = job._id;
    try {
      setInterestSent(prev => ({ ...prev, [recId]: 'loading' }));
      await profileAPI.expressInterest(recId);
      setInterestSent(prev => ({ ...prev, [recId]: 'done' }));
      if (onRefresh) onRefresh();
    } catch (err) {
      setError('Failed to express interest. Please try again.');
      setInterestSent(prev => ({ ...prev, [recId]: null }));
    }
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
          No recommendations yet. You will receive an email when we found the right fit for you.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {recommendedJobs.slice(0, 3).map((job) => {
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
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </CardSection>
  );
}

export default RecommendedJobs;
