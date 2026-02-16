import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  IconButton
} from '@mui/material';
import { InsertDriveFile as FileIcon, ArrowBack, LocationOn, FilterListOff, Edit as EditIcon, Label as LabelIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { candidateAPI, documentAPI } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem,
  DetailPanel,
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
  FilterIconButton
} from './common-components/SharedComponents';

function Candidates() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [selectedCandidateStatus, setSelectedCandidateStatus] = useState('');
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const statusFilter = 'all';
  const [notesLastSaved, setNotesLastSaved] = useState({});
  const [savedNotesContent, setSavedNotesContent] = useState({});
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    location: '',
    summary: '',
    skills: ''
  });
  const [saving, setSaving] = useState(false);

  // Refs for timeout cleanup
  const timeoutRefs = useRef([]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

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
    accepted: 'Accepted',
    rejected: 'Rejected',
    scheduled_intake: 'Scheduled Intake',
    completed_assessment: 'Completed Assessment',
    uploaded_results: 'Uploaded Results',
    uploaded_resume: 'Uploaded Resume',
    completed_onboarding: 'Completed Onboarding'
  };

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = candidates
      .map(candidate => candidate.location)
      .filter(location => location && location.trim() !== '');
    return [...new Set(locations)].sort();
  }, [candidates]);

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

  // Get status indicator - only blue dot for pending, nothing for accepted
  const getStatusIndicator = (status) => {
    if (status === 'accepted') {
      return null; // No indicator for accepted candidates
    }
    // Blue dot for pending/unprocessed candidates
    return { 
      type: 'dot',
      color: 'primary.main'
    };
  };

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const response = await candidateAPI.list(statusFilter);
      setCandidates(response.data.candidates || []);
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
      // Clear any previous error on successful save
      setErrorMessage('');
    } catch (err) {
      console.error('Update notes error:', err);
      // Show user-facing error message when notes fail to save
      setErrorMessage('Failed to save notes. Please try again.');
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
      setErrorMessage('Failed to reject candidate. Please try again.');
      // Auto-hide error message after 5 seconds
      timeoutRefs.current.push(setTimeout(() => setErrorMessage(''), 5000));
    } finally {
      setRejecting(false);
    }
  };

  // Cancel rejection
  const handleCancelReject = () => {
    setShowRejectDialog(false);
  };

  // if a candidate is accepted, set status to accepted and send clifton strengths assessment
  // TODO: integrate with actual assessment sending logic (email, clifton code, etc.)
  const handleAcceptAndSendAssessment = async () => {
    if (!selectedCandidate) return;
    
    try {
      setAccepting(true);
      setErrorMessage('');
      
      await candidateAPI.accept(selectedCandidate.id);
      await candidateAPI.sendAssessment(selectedCandidate.id);
      
      // Show success message
      setSuccessMessage(`${selectedCandidate.full_name} has been accepted and CliftonStrengths assessment sent successfully!`);
      
      // Clear candidate details and selection
      setSelectedCandidate(null);
      setCandidateDetails(null);

      // Refresh candidates list
      loadCandidates();

      // Auto-hide success message after 5 seconds
      timeoutRefs.current.push(setTimeout(() => setSuccessMessage(''), 5000));
    } catch (err) {
      console.error('Accept and send assessment error:', err);
      setErrorMessage('Failed to accept candidate or send assessment. Please try again.');
      // Auto-hide error message after 5 seconds
      timeoutRefs.current.push(setTimeout(() => setErrorMessage(''), 5000));
    } finally {
      setAccepting(false);
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
      window.open(response.data.download_url, '_blank');
    } catch (err) {
      console.error('Download error:', err);
      setErrorMessage('Failed to download document.');
      timeoutRefs.current.push(setTimeout(() => setErrorMessage(''), 5000));
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
      setErrorMessage('');

      // Parse skills from comma-separated string
      const skillsArray = editFormData.skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

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
      setSuccessMessage('Profile updated successfully!');
      timeoutRefs.current.push(setTimeout(() => setSuccessMessage(''), 5000));
    } catch (err) {
      console.error('Update profile error:', err);
      setErrorMessage('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
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
    <Box sx={{ p: 4, backgroundColor: 'grey.50', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/mlg-dashboard')}
          sx={{ color: 'text.secondary' }}
        >
          Back
        </Button>
        <SectionHeader variant="h4" component="h1" sx={{ mb: 0 }}>
          MLG Manage Candidates
        </SectionHeader>
      </Box>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert 
          severity="success" 
          onClose={() => setSuccessMessage('')}
          sx={{ mb: 2 }}
        >
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert 
          severity="error" 
          onClose={() => setErrorMessage('')}
          sx={{ mb: 2 }}
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={0} sx={{ height: 'calc(100vh - 200px)' }}>
        {/* Sidebar - Candidates List */}
        <Grid size={{ xs: 12, md: 4 }}>
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
                  ({filteredCandidates.length} of {candidates.length})
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
                filteredCandidates.map((candidate, index) => {
                  const statusIndicator = getStatusIndicator(candidate.status);
                  
                  return (
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
                        {statusIndicator && (
                          <Box 
                            sx={{ 
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: statusIndicator.color,
                              ml: 1
                            }} 
                          />
                        )}
                      </Box>
                    </SelectableListItem>
                  );
                })
              )}
            </Box>
          </CardSection>
        </Grid>

        {/* Main Content - Candidate Details */}
        <Grid size={{ xs: 12, md: 8 }}>
          <CardSection sx={{ height: '100%', ml: 2 }}>
            {!selectedCandidate ? (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}>
                <Typography>Select a candidate to view details</Typography>
              </Box>
            ) : detailsLoading ? (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%'
              }}>
                <CircularProgress />
              </Box>
            ) : (
              <DetailPanel>
                {/* Candidate Header */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {candidateDetails?.full_name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleEditClick}
                      title="Edit candidate profile"
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    >
                      <EditIcon fontSize="small" />
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
                  {candidateDetails?.skills?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {candidateDetails.skills.map((skill, index) => (
                        <Chip
                          key={index}
                          label={skill}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: 'text.primary',
                            color: 'text.primary'
                          }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No skills listed</Typography>
                  )}
                </Box>

                <Divider />

                {/* Clifton Strengths Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    CliftonStrengths
                  </Typography>
                  {candidateDetails?.cliftonStrengths?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {candidateDetails.cliftonStrengths.map((strength, index) => (
                        <Chip
                          key={index}
                          label={strength}
                          size="small"
                          sx={{
                            backgroundColor: 'success.main',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'success.dark',
                            }
                          }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No CliftonStrengths assessment completed</Typography>
                  )}
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
                    onClick={handleAcceptAndSendAssessment}
                    disabled={accepting}
                  >
                    {accepting ? 'Processing...' : 'Accept Candidate & Send CliftonStrengths Assessment'}
                  </PrimaryButton>
                </Box>
              </DetailPanel>
            )}
          </CardSection>
        </Grid>
      </Grid>

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

      {/* Rejection Confirmation Dialog */}
      <Dialog
        open={showRejectDialog}
        onClose={handleCancelReject}
        aria-labelledby="reject-dialog-title"
        aria-describedby="reject-dialog-description"
      >
        <DialogTitle id="reject-dialog-title">
          Confirm Candidate Rejection
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="reject-dialog-description">
            Are you sure you want to reject <strong>{selectedCandidate?.full_name}</strong>? 
            This action will remove them from the active candidates list and cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelReject} disabled={rejecting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmReject} 
            variant="contained" 
            color="error"
            disabled={rejecting}
          >
            {rejecting ? 'Rejecting...' : 'Reject Candidate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="edit-dialog-title"
      >
        <DialogTitle id="edit-dialog-title">
          Edit Candidate Profile
        </DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Candidates;