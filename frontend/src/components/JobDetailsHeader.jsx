import { Box, Typography, IconButton, Button } from '@mui/material';
import { Edit as EditIcon, DeleteOutline as DeleteIcon, Work, PersonAdd } from '@mui/icons-material';
import { PrimaryButton } from './common-components/StyledComponents';

/**
 * Job detail panel header: title, edit/delete actions, company info, and
 * the Generate/View Recommendations + Recommend Candidate buttons.
 */
export default function JobDetailsHeader({
  jobDetails,
  onEdit,
  onDelete,
  onFindRecommendations,
  onRecommendCandidate,
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {jobDetails?.title}
          </Typography>
          <IconButton
            size="small"
            onClick={onEdit}
            title="Edit job details"
            aria-label="Edit job details"
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={onDelete}
            title="Delete job"
            aria-label="Delete job"
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {jobDetails?.company}
        </Typography>
        {jobDetails?.locations?.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {jobDetails.locations.join('; ')}
          </Typography>
        )}
        {jobDetails?.min_years && (
          <Typography variant="body2" color="text.secondary">
            Experience: {jobDetails.min_years}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
        <PrimaryButton
          onClick={onFindRecommendations}
          disabled={!jobDetails?.has_embeddings}
          startIcon={<Work />}
          sx={{ flexShrink: 0 }}
        >
          {jobDetails?.last_match_generated_at ? 'View Recommendations' : 'Generate Recommendations'}
        </PrimaryButton>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PersonAdd fontSize="small" />}
          onClick={onRecommendCandidate}
          sx={{ flexShrink: 0 }}
        >
          Recommend Candidate
        </Button>
      </Box>
    </Box>
  );
}
