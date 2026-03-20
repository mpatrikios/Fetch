import {
  Box,
  Typography,
  Button,
  Alert,
  Chip,
  CircularProgress
} from '@mui/material';
import { ClosableDialog } from './common-components/SharedComponents';

function CultureDocumentDialog({
  open,
  onClose,
  step,
  cultureFile,
  onFileChange,
  cultureUploading,
  cultureUploadError,
  pendingStrengths,
  onRemoveStrength,
  cliftonSaving,
  suggestedStrengths,
  onUpload,
  onConfirm
}) {
  const title = step === 'upload' ? 'Upload Culture Document' : 'Confirm CliftonStrengths';

  const actions = (
    <>
      <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
      {step === 'upload' && (
        <Button
          variant="contained"
          disabled={!cultureFile || cultureUploading}
          onClick={onUpload}
          sx={{ textTransform: 'none' }}
        >
          {cultureUploading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          {cultureUploading ? 'Uploading…' : 'Upload & Analyze'}
        </Button>
      )}
      {step === 'confirm' && (
        <Button
          variant="contained"
          disabled={pendingStrengths.length === 0 || cliftonSaving}
          onClick={onConfirm}
          sx={{ textTransform: 'none' }}
        >
          {cliftonSaving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          {cliftonSaving ? 'Saving…' : 'Confirm Strengths'}
        </Button>
      )}
    </>
  );

  return (
    <ClosableDialog open={open} onClose={onClose} title={title} actions={actions}>
      {step === 'upload' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Upload any culture assessment document (OCAI, Denison, Gallup Q12, etc.) — PDF, DOC, or DOCX.
            The AI will suggest matching CliftonStrengths themes for you to review.
          </Typography>
          <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
            {cultureFile ? cultureFile.name : 'Choose file…'}
            <input type="file" accept=".pdf,.doc,.docx" hidden onChange={onFileChange} />
          </Button>
          {cultureUploadError && <Alert severity="error">{cultureUploadError}</Alert>}
        </Box>
      )}

      {step === 'confirm' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Review and edit the AI-suggested strengths below. Click a chip to remove it. Then confirm to generate the culture embedding.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {pendingStrengths.map((s) => (
              <Chip
                key={s}
                label={s}
                onDelete={() => onRemoveStrength(s)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
          {suggestedStrengths?.filter(s => pendingStrengths.includes(s.strength)).length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Why these strengths?
              </Typography>
              {suggestedStrengths
                .filter(s => pendingStrengths.includes(s.strength))
                .map(s => (
                  <Box key={s.strength} sx={{ mt: 0.5 }}>
                    <Typography variant="caption">
                      <strong>{s.strength}:</strong> {s.rationale}
                    </Typography>
                  </Box>
                ))}
            </Box>
          )}
          {cultureUploadError && <Alert severity="error">{cultureUploadError}</Alert>}
        </Box>
      )}
    </ClosableDialog>
  );
}

export default CultureDocumentDialog;
