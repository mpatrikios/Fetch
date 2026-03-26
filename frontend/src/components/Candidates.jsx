import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Chip,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Divider,
  DialogContentText,
  TextField,
  IconButton
} from '@mui/material';
import { InsertDriveFile as FileIcon, LocationOn, FilterListOff, Edit as EditIcon, Label as LabelIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { candidateAPI, documentAPI, parseDelimitedString, getUniqueValues } from '../utils/api';
import {
  CardSection,
  SelectableListItem,
  FileLink,
  NotesField,
  PrimaryButton,
  SecondaryButton
} from './common-components/StyledComponents';
import {
  SummaryDisplay,
  SearchField,
  FilterMenu,
  EmptyState,
  FilterIconButton,
  ConfirmationDialog,
  SkillChips,
  DetailPanelContainer,
  PageHeader,
  ClosableDialog
} from './common-components/SharedComponents';
import { useAutoHideMessage } from '../hooks/useAutoHideMessage';

function Candidates() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialStatus = searchParams.get('status') || 'all';
  const initialCandidateStatus = searchParams.get('candidateStatus') || '';
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [candidateNotes, setCandidateNotes] = useState({}); // Object to store notes per candidate ID
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationMenuAnchor, setLocationMenuAnchor] = useState(null);
  const [selectedCandidateStatus, setSelectedCandidateStatus] = useState(initialCandidateStatus);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const [acceptingWithAssessment, setAcceptingWithAssessment] = useState(false);
  const [successMessage, showSuccess] = useAutoHideMessage(5000);
  const [errorMessage, showError] = useAutoHideMessage(5000);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [notesLastSaved, setNotesLastSaved] = useState({});
  const [savedNotesContent, setSavedNotesContent] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    location: '',
    summary: '',
    skills: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setStatusFilter(params.get('status') || 'all');
  }, [location.search]);

  useEffect(() => {
    loadCandidates();
  }, [statusFilter]);

  // Auto-select candidate if navigated from recommendations page
  useEffect(() => {
    const selectedCandidateId = location.state?.selectedCandidateId;
    if (selectedCandidateId && candidates.length > 0 && !selectedCandidate) {
      const candidate = candidates.find(c =>
        c.id === selectedCandidateId || c.candidate_id === selectedCandidateId
      );
      if (candidate) {
        handleCandidateSelect(candidate);
      }
    }
  }, [candidates, location.state, selectedCandidate]);

  // Status labels for display
  const statusLabels = {
    pending: 'Pending',
    registered: 'Registered',
    onboarding: 'Onboarding',
    processing: 'Processing',
    processing_failed: 'Processing Failed',
    accepted: 'Accepted',
    rejected: 'Rejected',
    scheduled_intake: 'Scheduled Intake',
    uploaded_documents: 'Uploaded Documents',
    completed_assessment: 'Completed Assessment',
    uploaded_results: 'Uploaded Results',
    uploaded_resume: 'Uploaded Resume',
    completed_onboarding: 'Completed Onboarding'
  };

  const uniqueLocations = useMemo(() => getUniqueValues(candidates, 'location'), [candidates]);

  // Get unique statuses for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = candidates
      .map(candidate => candidate.status || 'pending')
      .filter(status => status && status.trim() !== '');
    return [...new Set(statuses)].sort();
  }, [candidates]);

  // Filter candidates based on search query, location, and status
  const filteredCandidates = useMemo(() => {
    return candidates.filter(candidate => {
      const matchesSearch = searchQuery === '' ||
        candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLocation = selectedLocation === '' ||
        candidate.location === selectedLocation;

      const candidateStatus = candidate.status || 'pending';
      const matchesStatus = selectedCandidateStatus === '' ||
        candidateStatus === selectedCandidateStatus;

      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [candidates, searchQuery, selectedLocation, selectedCandidateStatus]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
    setSelectedCandidateStatus('');
  };

  const getStatusChipProps = (status) => {
    const colorMap = {
      pending: 'default',
      registered: 'default',
      onboarding: 'info',
      processing: 'info',
      processing_failed: 'error',
      accepted: 'success',
      rejected: 'error',
      scheduled_intake: 'warning',
      uploaded_documents: 'info',
      completed_assessment: 'warning',
      uploaded_results: 'info',
      uploaded_resume: 'info',
      completed_onboarding: 'success',
    };
    return { color: colorMap[status] ?? 'default', size: 'small' };
  };

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.list(statusFilter);
      setCandidates(response.data.candidates || []);
      setTotalCandidates(response.data.total_count ?? response.data.count ?? 0);
    } catch (err) {
      setError('Failed to load candidates');
      console.error('Load candidates error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateSelect = useCallback(async (candidate) => {
    if (selectedCandidate?.id === candidate.id) return;
    
    setSelectedCandidate(candidate);
    setDetailsLoading(true);
    setCandidateDetails(null);
    
    try {
      // Use the candidate data from MongoDB
      setCandidateDetails({
        ...candidate,
        jobTitle: candidate.Summary || 'Position information not available',
        location: candidate.location || 'Location not specified',
        skills: candidate.skills || [],
        cliftonStrengths: candidate.clifton_strengths || [],
        documents: [
          ...(candidate.has_resume ? [{ name: `${candidate.full_name.replace(/\s+/g, '_')} Resume`, type: 'resume' }] : []),
          ...(candidate.has_clifton_doc ? [{ name: `${candidate.full_name.replace(/\s+/g, '_')} CliftonStrengths`, type: 'cliftonstrengths' }] : []),
        ],
        notes: candidate.notes || 'Enter candidate notes'
      });
      
      // Set notes specific to this candidate
      const currentNotes = candidateNotes[candidate.id] || candidate.notes || 'Enter candidate notes';
      setCandidateNotes(prev => ({
        ...prev,
        [candidate.id]: currentNotes
      }));
      // Initialize saved content if not already set (to track unsaved changes)
      if (savedNotesContent[candidate.id] === undefined) {
        setSavedNotesContent(prev => ({
          ...prev,
          [candidate.id]: currentNotes
        }));
      }
    } catch (err) {
      console.error('Load candidate details error:', err);
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedCandidate, candidateNotes, savedNotesContent]);

  // notes update handler
  const handleNotesUpdate = async (candidateId) => {
    if (!candidateId) return;

    try {
      const notes = candidateNotes[candidateId] || '';
      await candidateAPI.updateNotes(candidateId, notes);
      // Update local state
      setCandidateDetails(prev => (prev && prev.id === candidateId ? { ...prev, notes } : prev));
      // Record the save timestamp and saved content
      setNotesLastSaved(prev => ({
        ...prev,
        [candidateId]: new Date()
      }));
      setSavedNotesContent(prev => ({
        ...prev,
        [candidateId]: notes
      }));
      showError('');
    } catch (err) {
      console.error('Update notes error:', err);
      // Show user-facing error message when notes fail to save
      showError('Failed to save notes. Please try again.');
    }
  };

  const updateCandidateNotes = (candidateId, notes) => {
    setCandidateNotes(prev => ({
      ...prev,
      [candidateId]: notes
    }));
  };

  // Show confirmation dialog for rejection
  const handleRejectClick = () => {
    setShowRejectDialog(true);
  };

  // Actually reject the candidate after confirmation
  const handleConfirmReject = async () => {
    if (!selectedCandidate) return;
    
    try {
      setRejecting(true);
      await candidateAPI.reject(selectedCandidate.id);
      
      // Clear candidate details and selection
      setSelectedCandidate(null);
      setCandidateDetails(null);

      // Refresh candidates list
      loadCandidates();

      setShowRejectDialog(false);
    } catch (err) {
      console.error('Reject candidate error:', err);
      showError('Failed to reject candidate. Please try again.');
    } finally {
      setRejecting(false);
    }
  };

  // Cancel rejection
  const handleCancelReject = () => {
    setShowRejectDialog(false);
  };

  // Accept candidate only (for candidates who already have CliftonStrengths results on file)
  // TODO: integrate with actual assessment sending logic (email, clifton code, etc.)
  const handleAccept = async () => {
    if (!selectedCandidate) return;
    setAcceptingOnly(true);
    showError('');
    try {
      await candidateAPI.accept(selectedCandidate.id);
      showSuccess(`Acceptance initiated — ${selectedCandidate.full_name} will be marked accepted once processing finishes.`);
      setSelectedCandidate(null);
      setCandidateDetails(null);
      loadCandidates();
    } catch (err) {
      console.error('Accept candidate error:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 404) {
        showError('Candidate not found. Please refresh the page and try again.');
      } else if (err.response?.status === 400) {
        showError(detail || 'Cannot accept candidate: a required field is missing.');
      } else {
        showError(detail ? `Failed to accept candidate: ${detail}` : 'Failed to accept candidate. Please try again.');
      }
    } finally {
      setAcceptingOnly(false);
    }
  };

  // Send assessment step — throws a normalized Error on failure
  const sendAssessmentStep = async (candidateId) => {
    try {
      await candidateAPI.sendAssessment(candidateId);
    } catch (err) {
      console.error('Send assessment error:', err);
      const detail = err.response?.data?.detail;
      throw new Error(detail
        ? `Failed to send CliftonStrengths assessment: ${detail}`
        : 'Failed to send CliftonStrengths assessment. Please try again.');
    }
  };

  // Accept step — throws a normalized Error on failure
  // Assessment is sent FIRST (see caller) so the candidate is never left
  // marked "accepted" without having received the assessment.
  const acceptStep = async (candidateId) => {
    try {
      await candidateAPI.accept(candidateId);
    } catch (err) {
      console.error('Accept candidate error:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 404) {
        throw new Error('Candidate not found. Please refresh the page and try again.');
      } else if (err.response?.status === 400) {
        throw new Error(detail || 'Cannot accept candidate: a required field is missing.');
      } else {
        throw new Error(detail
          ? `Assessment sent, but failed to accept candidate: ${detail}`
          : 'Assessment sent, but failed to accept candidate. Please try accepting again.');
      }
    }
  };

  // Accept candidate and send CliftonStrengths assessment.
  // TODO: integrate with actual assessment sending logic (email, clifton code, etc.)
  const handleAcceptAndSendAssessment = async () => {
    if (!selectedCandidate) return;
    setAcceptingWithAssessment(true);
    showError('');
    try {
      await sendAssessmentStep(selectedCandidate.id);
      await acceptStep(selectedCandidate.id);
      showSuccess(`Acceptance initiated — ${selectedCandidate.full_name} will be marked accepted once processing finishes. CliftonStrengths assessment sent.`);
      setSelectedCandidate(null);
      setCandidateDetails(null);
      loadCandidates();
    } catch (err) {
      showError(err.message);
    } finally {
      setAcceptingWithAssessment(false);
    }
  };

  // Download document from blob storage
  const handleDocumentDownload = async (docType, candidateId) => {
    try {
      const apiCall = {
        resume: documentAPI.getResumeDownloadUrl,
        cliftonstrengths: documentAPI.getCliftonDownloadUrl,
      }[docType];

      if (!apiCall) return;

      const response = await apiCall(candidateId);
      window.open(response.data.download_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      showError('Failed to download document.');
    }
  };

  // Open edit dialog with current candidate data
  const handleEditClick = () => {
    if (!candidateDetails) return;
    setEditFormData({
      full_name: candidateDetails.full_name || '',
      location: candidateDetails.location || '',
      summary: candidateDetails.Summary || candidateDetails.jobTitle || '',
      skills: (candidateDetails.skills || []).join(', ')
    });
    setShowEditDialog(true);
  };

  // Handle edit form field changes
  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!selectedCandidate) return;

    try {
      setSaving(true);
      showError('');

      const skillsArray = parseDelimitedString(editFormData.skills);

      await candidateAPI.updateProfile(selectedCandidate.id, {
        full_name: editFormData.full_name,
        location: editFormData.location,
        summary: editFormData.summary,
        skills: skillsArray
      });

      // Update local state
      setCandidateDetails(prev => ({
        ...prev,
        full_name: editFormData.full_name,
        location: editFormData.location,
        Summary: editFormData.summary,
        jobTitle: editFormData.summary,
        skills: skillsArray
      }));

      // Update the candidate in the list
      setCandidates(prev => prev.map(c =>
        c.id === selectedCandidate.id
          ? { ...c, full_name: editFormData.full_name, location: editFormData.location, Summary: editFormData.summary, skills: skillsArray }
          : c
      ));

      // Update selectedCandidate reference
      setSelectedCandidate(prev => ({
        ...prev,
        full_name: editFormData.full_name,
        location: editFormData.location,
        Summary: editFormData.summary,
        skills: skillsArray
      }));

      setShowEditDialog(false);
      showSuccess('Profile updated successfully!');
    } catch (err) {
      console.error('Update profile error:', err);
      showError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCandidate = async () => {
    if (!selectedCandidate?.id) return;
    try {
      setDeleting(true);
      await candidateAPI.deleteCandidate(selectedCandidate.id);
      setCandidates(prev => prev.filter(c => c.id !== selectedCandidate.id));
      setSelectedCandidate(null);
      setCandidateDetails(null);
      setShowDeleteDialog(false);
    } catch (err) {
      console.error('Delete candidate error:', err);
      showError('Failed to delete candidate. Please try again.');
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'grey.50', overflow: 'hidden' }}>
      {/* Header + Alerts */}
      <Box sx={{ p: 4, pb: 0, flexShrink: 0 }}>
        <PageHeader title="MLG Manage Candidates" onBack={() => navigate('/mlg-dashboard')} />

        {/* Success/Error Messages */}
        {successMessage && (
          <Alert
            severity="success"
            onClose={() => showSuccess('')}
            sx={{ mb: 2 }}
          >
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert
            severity="error"
            onClose={() => showError('')}
            sx={{ mb: 2 }}
          >
            {errorMessage}
          </Alert>
        )}
      </Box>

      {/* Grid wrapper */}
      <Box sx={{ flex: 1, px: 4, pb: 4, minHeight: 0, overflow: 'hidden' }}>
      <Grid container spacing={0} sx={{ height: '100%' }}>
        {/* Sidebar - Candidates List */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%' }}>
          <CardSection sx={{ height: '100%', overflow: 'hidden' }}>
            <Box sx={{ 
              px: 1,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'grey.200'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Candidates
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({filteredCandidates.length} of {totalCandidates})
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FilterIconButton
                    active={!!selectedLocation}
                    onClick={(e) => setLocationMenuAnchor(e.currentTarget)}
                    icon={LocationOn}
                    title="Filter by location"
                  />
                  <FilterIconButton
                    active={!!selectedCandidateStatus}
                    onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
                    icon={LabelIcon}
                    title="Filter by status"
                  />
                  {(searchQuery || selectedLocation || selectedCandidateStatus) && (
                    <IconButton
                      size="small"
                      onClick={clearFilters}
                      title="Clear filters"
                    >
                      <FilterListOff fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
              
              <SearchField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search by name..."
              />
            </Box>
            
             {/* Filtered Candidates by Name or Location */}
            <Box sx={{ 
              overflowY: 'auto', 
              height: 'calc(100% - 160px)', // Adjust for header with search and status filters
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-thumb': { 
                backgroundColor: 'grey.300',
                borderRadius: '3px'
              }
            }}>
              {filteredCandidates.length === 0 ? (
                <EmptyState
                  title="No candidates found"
                  subtitle={searchQuery || selectedLocation || selectedCandidateStatus ? 'Try adjusting your search or filters' : 'No candidates available'}
                />
              ) : (
                filteredCandidates.map((candidate, index) => (
                  <SelectableListItem
                    key={candidate.id || index}
                    selected={selectedCandidate?.id === candidate.id}
                    onClick={() => handleCandidateSelect(candidate)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {candidate.full_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {candidate.email}
                        </Typography>
                      </Box>
                      <Chip
                        label={statusLabels[candidate.status] ?? candidate.status ?? 'Pending'}
                        {...getStatusChipProps(candidate.status ?? 'pending')}
                        sx={{ ml: 1, flexShrink: 0 }}
                      />
                    </Box>
                  </SelectableListItem>
                ))
              )}
            </Box>
          </CardSection>
        </Grid>

        {/* Main Content - Candidate Details */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%' }}>
          <DetailPanelContainer selected={selectedCandidate} loading={detailsLoading} emptyText="Select a candidate to view details">
                {/* Candidate Header */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {candidateDetails?.full_name}
                    </Typography>
                    <Chip
                      label={statusLabels[candidateDetails?.status] ?? candidateDetails?.status ?? 'Pending'}
                      {...getStatusChipProps(candidateDetails?.status ?? 'pending')}
                    />
                    <IconButton
                      size="small"
                      onClick={handleEditClick}
                      title="Edit candidate profile"
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setShowDeleteDialog(true)}
                      title="Delete candidate"
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {candidateDetails?.email}
                  </Typography>
                  {candidateDetails?.location && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {candidateDetails.location}
                    </Typography>
                  )}
                  <SummaryDisplay summary={candidateDetails?.jobTitle} emptyText="Position information not available" wordLimit={25} />
                </Box>

                <Divider />

                {/* Documents Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Documents
                  </Typography>
                  {candidateDetails?.documents?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {candidateDetails.documents.map((doc, index) => (
                        <FileLink
                          key={index}
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDocumentDownload(doc.type, selectedCandidate.id);
                          }}
                        >
                          <FileIcon fontSize="small" />
                          {doc.name}
                        </FileLink>
                      ))}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No documents uploaded</Typography>
                  )}
                </Box>

                <Divider />

                {/* Skills Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Skills
                  </Typography>
                  <SkillChips items={candidateDetails?.skills} variant="skill" emptyText="No skills listed" />
                </Box>

                <Divider />

                {/* Clifton Strengths Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    CliftonStrengths
                  </Typography>
                  <SkillChips items={candidateDetails?.cliftonStrengths} variant="strength" emptyText="No CliftonStrengths assessment completed" />
                </Box>

                <Divider />

                {/* Notes Section */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Intake Notes
                  </Typography>
                  <NotesField
                    value={candidateNotes[selectedCandidate?.id] || ''}
                    onChange={(e) => updateCandidateNotes(selectedCandidate?.id, e.target.value)}
                    placeholder="Enter candidate notes"
                    onBlur={() => handleNotesUpdate(selectedCandidate?.id)}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mt: 1 }}>
                    {(() => {
                      const currentNotes = candidateNotes[selectedCandidate?.id] || '';
                      const savedNotes = savedNotesContent[selectedCandidate?.id];
                      const hasUnsavedChanges = savedNotes !== undefined && currentNotes !== savedNotes;

                      if (hasUnsavedChanges) {
                        return (
                          <Typography variant="caption" color="warning.main">
                            Unsaved changes
                          </Typography>
                        );
                      } else if (notesLastSaved[selectedCandidate?.id]) {
                        return (
                          <Typography variant="caption" color="text.secondary">
                            Last saved at {notesLastSaved[selectedCandidate?.id].toLocaleTimeString()}
                          </Typography>
                        );
                      }
                      return null;
                    })()}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleNotesUpdate(selectedCandidate?.id)}
                    >
                      Save Notes
                    </Button>
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  justifyContent: 'flex-end',
                  pt: 2
                }}>
                  <SecondaryButton onClick={handleRejectClick}>
                    Reject Candidate
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={handleAccept}
                    disabled={acceptingOnly}
                  >
                    {acceptingOnly ? 'Processing...' : 'Accept Candidate'}
                  </PrimaryButton>
                  <PrimaryButton
                    onClick={handleAcceptAndSendAssessment}
                    disabled={acceptingWithAssessment}
                  >
                    {acceptingWithAssessment ? 'Processing...' : 'Accept & Send CliftonStrengths'}
                  </PrimaryButton>
                </Box>
          </DetailPanelContainer>
        </Grid>
      </Grid>
      </Box>

      {/* Location Filter Menu */}
      <FilterMenu
        anchorEl={locationMenuAnchor}
        onClose={() => setLocationMenuAnchor(null)}
        items={uniqueLocations}
        selectedItem={selectedLocation}
        onSelect={setSelectedLocation}
        allLabel="All locations"
        searchable={true}
        searchPlaceholder="Search locations..."
        width={280}
      />

      {/* Status Filter Menu */}
      <FilterMenu
        anchorEl={statusMenuAnchor}
        onClose={() => setStatusMenuAnchor(null)}
        items={uniqueStatuses}
        selectedItem={selectedCandidateStatus}
        onSelect={setSelectedCandidateStatus}
        allLabel="All statuses"
        labelFn={(status) => statusLabels[status] || status}
      />

      {/* Delete Candidate Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        title="Delete Candidate"
        content={<DialogContentText>Permanently delete <strong>{candidateDetails?.full_name}</strong>? Their profile and documents will be removed. This cannot be undone.</DialogContentText>}
        onConfirm={handleDeleteCandidate}
        onCancel={() => setShowDeleteDialog(false)}
        loading={deleting}
        confirmText="Delete"
      />

      {/* Rejection Confirmation Dialog */}
      <ConfirmationDialog
        open={showRejectDialog}
        title="Confirm Candidate Rejection"
        content={<DialogContentText>Are you sure you want to reject <strong>{selectedCandidate?.full_name}</strong>? This action will remove them from the active candidates list and cannot be undone.</DialogContentText>}
        onConfirm={handleConfirmReject}
        onCancel={handleCancelReject}
        loading={rejecting}
        confirmText="Reject Candidate"
      />

      {/* Edit Profile Dialog */}
      <ClosableDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        title="Edit Candidate Profile"
        dividers={false}
        maxWidth="md"
        actions={
          <>
            <Button onClick={() => setShowEditDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              variant="contained"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Full Name"
            fullWidth
            value={editFormData.full_name}
            onChange={(e) => handleEditFormChange('full_name', e.target.value)}
          />
          <TextField
            label="Location"
            fullWidth
            value={editFormData.location}
            onChange={(e) => handleEditFormChange('location', e.target.value)}
          />
          <TextField
            label="Summary / Position"
            fullWidth
            multiline
            minRows={3}
            value={editFormData.summary}
            onChange={(e) => handleEditFormChange('summary', e.target.value)}
            slotProps={{
              input: {
                sx: { resize: 'vertical', overflow: 'auto' }
              }
            }}
          />
          <TextField
            label="Skills"
            fullWidth
            multiline
            minRows={2}
            value={editFormData.skills}
            onChange={(e) => handleEditFormChange('skills', e.target.value)}
            helperText="Enter skills separated by commas"
            slotProps={{
              input: {
                sx: { resize: 'vertical', overflow: 'auto' }
              }
            }}
          />
        </Box>
      </ClosableDialog>
    </Box>
  );
}

export default Candidates;