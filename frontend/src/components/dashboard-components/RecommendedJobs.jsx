import {
  Typography,
  Grid,
  Paper,
  Box,
  Chip
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { CardSection, SectionHeader, DarkButton } from '../common-components/StyledComponents';

function RecommendedJobs({ recommendedJobs }) {
  // TODO: Replace with API call to get jobs recommended specifically for this user
  // Backend needs: GET /api/recommendations/{user_id} endpoint
  // This should return jobs that MLG recruiters have manually recommended for this specific candidate
  
  // TODO: Add onClick handler for "Next Steps" button
  // Should either:
  // 1. Navigate to job details page with application instructions
  // 2. Open modal with next steps (schedule call, prepare documents, etc.)
  // 3. Send notification to MLG recruiter about candidate interest

  return (
    <CardSection>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Star sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0 }}>
          Recommended Jobs & Next Steps
        </SectionHeader>
      </Box>
        
        {recommendedJobs.length === 0 ? (
          <Typography>
            No recommendations yet. You will recieve an email when we found the right fit for you.
          </Typography>
        ) : (
          <Grid container spacing={2}>

            {/* TODO: Remove .slice(0, 3) limit once pagination or "View More" is implemented */}

            {recommendedJobs.slice(0, 3).map((job, index) => (
              <Grid size={{ xs: 12 }} key={index}>
                <Paper elevation={1} sx={{ p: 2, '&:hover': { elevation: 3 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>

                      {/* TODO: Update these field mappings to match actual recommendation data structure */}

                      <Typography variant="h6" gutterBottom>
                        {job.title || 'Job Title'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {job.company || 'Company Name'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {job.location || 'Remote'}
                      </Typography>
            
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {job.isRemote && <Chip label="Remote" size="small" />}
                        <Chip label={job.employmentType || 'Full-time'} size="small" />

                        {/* TODO: Add recruiter notes/reasons as chips or separate section */}

                        {job.tags?.map(tag => <Chip key={tag} label={tag} size="small" />)}
                      </Box>
                      
                    </Box>

                    {/* TODO: Implement Next Steps functionality */}
                    
                    <DarkButton>
                      Next Steps
                    </DarkButton>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
    </CardSection>
  );
}

export default RecommendedJobs;