import { useState, useEffect } from 'react';
import { useAutoHideMessage } from '../hooks/useAutoHideMessage';
import {
  Container,
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Grid,
} from '@mui/material';
import { ArrowBack, Description } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { profileAPI } from '../utils/api';
import DocumentUpload from './DocumentUpload';
import { CardSection, SectionHeader, SecondaryButton, PrimaryButton } from './common-components/StyledComponents';

function CandidateProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, showSuccess] = useAutoHideMessage(5000);
  const [formData, setFormData] = useState({ full_name: '', location: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await profileAPI.getProfile();
      const p = response.data;
      setProfile(p);
      setFormData({ full_name: p.full_name || '', location: p.location || '' });
    } catch {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await profileAPI.updateProfile({
        full_name: formData.full_name || undefined,
        location: formData.location || undefined,
      });
      showSuccess('Profile updated successfully.');
      await loadProfile();
    } catch {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <SecondaryButton startIcon={<ArrowBack />} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </SecondaryButton>
      </Box>

      <Typography variant="h4" gutterBottom>Edit Profile</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      <Grid container spacing={3}>
        {/* Profile Info */}
        <Grid size={{ xs: 12 }}>
          <CardSection>
            <SectionHeader variant="h6" sx={{ mb: 2 }}>Personal Information</SectionHeader>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Email"
                value={profile?.email || ''}
                fullWidth
                disabled
                helperText="Email cannot be changed"
              />
              <TextField
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                fullWidth
                placeholder="e.g. Chicago, IL"
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PrimaryButton onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </PrimaryButton>
              </Box>
            </Box>
          </CardSection>
        </Grid>

        {/* Documents */}
        <Grid size={{ xs: 12 }}>
          <CardSection>
            <SectionHeader variant="h6" sx={{ mb: 2 }}>Documents</SectionHeader>

            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Description fontSize="small" color="action" />
                <Typography variant="subtitle2">Resume</Typography>
              </Box>
              {profile?.resume_filename && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Current file: {profile.resume_filename}
                </Typography>
              )}
              <DocumentUpload
                uploadType="resume"
                onSuccess={() => {
                  showSuccess('Resume updated successfully.');
                  loadProfile();
                }}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Description fontSize="small" color="action" />
                <Typography variant="subtitle2">CliftonStrengths Results</Typography>
              </Box>
              {profile?.clifton_filename && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Current file: {profile.clifton_filename}
                </Typography>
              )}
              <DocumentUpload
                uploadType="cliftonstrengths"
                onSuccess={() => {
                  showSuccess('CliftonStrengths results updated successfully.');
                  loadProfile();
                }}
              />
            </Box>
          </CardSection>
        </Grid>
      </Grid>
    </Container>
  );
}

export default CandidateProfile;
