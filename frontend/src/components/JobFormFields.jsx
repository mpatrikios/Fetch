import { Box, TextField } from '@mui/material';

/**
 * Shared form fields for job create (Complete Job Details) and edit dialogs.
 * Props:
 *   formData   — object with title?, summary, locations, skills, min_years,
 *                responsibilities, qualifications, culture_index
 *   onChange   — (field, value) => void
 *   showTitle  — render the required Job Title field at the top (default false)
 */
export default function JobFormFields({ formData, onChange, showTitle = false }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {showTitle && (
        <TextField
          label="Job Title *"
          fullWidth
          value={formData.title}
          onChange={(e) => onChange('title', e.target.value)}
          error={!formData.title?.trim()}
          helperText={!formData.title?.trim() ? 'Required' : ''}
        />
      )}
      <TextField
        label="Summary"
        fullWidth
        multiline
        minRows={3}
        value={formData.summary}
        onChange={(e) => onChange('summary', e.target.value)}
      />
      <TextField
        label="Locations"
        fullWidth
        value={formData.locations}
        onChange={(e) => onChange('locations', e.target.value)}
        helperText="Separate locations with semicolons"
      />
      <TextField
        label="Skills"
        fullWidth
        multiline
        minRows={2}
        value={formData.skills}
        onChange={(e) => onChange('skills', e.target.value)}
        helperText="Separate skills with commas"
      />
      <TextField
        label="Minimum Years of Experience"
        fullWidth
        value={formData.min_years}
        onChange={(e) => onChange('min_years', e.target.value)}
      />
      <TextField
        label="Responsibilities"
        fullWidth
        multiline
        minRows={4}
        value={formData.responsibilities}
        onChange={(e) => onChange('responsibilities', e.target.value)}
        helperText="Enter each responsibility on a new line"
      />
      <TextField
        label="Qualifications"
        fullWidth
        multiline
        minRows={4}
        value={formData.qualifications}
        onChange={(e) => onChange('qualifications', e.target.value)}
        helperText="Enter each qualification on a new line"
      />
      <TextField
        label="Culture Index"
        fullWidth
        multiline
        minRows={2}
        value={formData.culture_index}
        onChange={(e) => onChange('culture_index', e.target.value)}
        helperText="Separate traits with commas"
      />
    </Box>
  );
}
