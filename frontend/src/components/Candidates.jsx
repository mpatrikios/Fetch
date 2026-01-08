import { useState, useEffect, useMemo } from 'react';
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
  MenuItem,
  InputAdornment,
  IconButton,
  Menu
} from '@mui/material';
import { InsertDriveFile as FileIcon, ArrowBack, Search, Clear, LocationOn, FilterListOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { candidateAPI } from '../utils/api';
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

function Candidates() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [candidateNotes, setCandidateNotes] = useState({}); // Object to store notes per candidate ID
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationMenuAnchor, setLocationMenuAnchor] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadCandidates();
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [statusFilter]);

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = candidates
      .map(candidate => candidate.location)
      .filter(location => location && location.trim() !== '');
    return [...new Set(locations)].sort();
  }, [candidates]);

  // Filter candidates based on search query and location
  const filteredCandidates = useMemo(() => {
    return candidates.filter(candidate => {
      const matchesSearch = searchQuery === '' || 
        candidate.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLocation = selectedLocation === '' || 
        candidate.location === selectedLocation;
      
      return matchesSearch && matchesLocation;
    });
  }, [candidates, searchQuery, selectedLocation]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
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

  const handleCandidateSelect = async (candidate) => {
    if (selectedCandidate?.id === candidate.id) return;
    
    setSelectedCandidate(candidate);
    setDetailsLoading(true);
    setCandidateDetails(null);
    setExpandedSummary(false); // Reset summary expansion
    
    try {
      // Use the candidate data from MongoDB
      setCandidateDetails({
        ...candidate,
        jobTitle: candidate.summary || 'Position information not available',
        location: candidate.location || 'Location not specified',
        skills: candidate.skills || [],
        cliftonStrengths: candidate.clifton_strengths || [],
        documents: [
          { name: `${candidate.name.replace(/\s+/g, '_')} Resume`, type: 'resume' },
          { name: `${candidate.name.replace(/\s+/g, '_')} CliftonStrengths`, type: 'cliftonstrengths' }
        ],
        notes: candidate.notes || 'Enter candidate notes'
      });
      
      // Set notes specific to this candidate
      const currentNotes = candidateNotes[candidate.id] || candidate.notes || 'Enter candidate notes';
      setCandidateNotes(prev => ({
        ...prev,
        [candidate.id]: currentNotes
      }));
    } catch (err) {
      console.error('Load candidate details error:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // notes update handler
  const handleNotesUpdate = async (candidateId) => {
    if (!candidateId) return;
    
    try {
      const notes = candidateNotes[candidateId] || '';
      await candidateAPI.updateNotes(candidateId, notes);
      // Update local state
      setCandidateDetails(prev => ({ ...prev, notes }));
    } catch (err) {
      console.error('Update notes error:', err);
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
      setExpandedSummary(false);
      
      // Refresh candidates list
      loadCandidates();
      
      setShowRejectDialog(false);
    } catch (err) {
      console.error('Reject candidate error:', err);
      setErrorMessage('Failed to reject candidate. Please try again.');
      // Auto-hide error message after 5 seconds
      setTimeout(() => setErrorMessage(''), 5000);
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
      setSuccessMessage(`${selectedCandidate.name} has been accepted and CliftonStrengths assessment sent successfully!`);
      
      // Clear candidate details and selection
      setSelectedCandidate(null);
      setCandidateDetails(null);
      setExpandedSummary(false);
      
      // Refresh candidates list
      loadCandidates();
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Accept and send assessment error:', err);
      setErrorMessage('Failed to accept candidate or send assessment. Please try again.');
      // Auto-hide error message after 5 seconds
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setAccepting(false);
    }
  };

  const SummaryDisplay = ({ summary }) => {
    if (!summary) return <Typography variant="body1" color="text.primary">Position information not available</Typography>;
    
    const words = summary.split(' ');
    const shouldTruncate = words.length > 25; // Roughly 2 lines
    const truncatedSummary = shouldTruncate ? words.slice(0, 25).join(' ') + '...': summary;
    
    return (
      <Box>
        <Typography variant="body1" color="text.primary" sx={{ mb: shouldTruncate ? 1 : 0 }}>
          {expandedSummary ? summary : truncatedSummary}
        </Typography>
        {shouldTruncate && (
          <Button
            size="small"
            onClick={() => setExpandedSummary(!expandedSummary)}
            sx={{ 
              p: 0,
              textTransform: 'none',
              color: 'primary.main',
              fontSize: '0.875rem',
              minHeight: 'auto',
              lineHeight: 1
            }}
          >
            {expandedSummary ? 'Show less' : 'Read more...'}
          </Button>
        )}
      </Box>
    );
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
                  <IconButton 
                    size="small" 
                    onClick={(e) => setLocationMenuAnchor(e.currentTarget)}
                    title="Filter by location"
                    sx={{ 
                      color: selectedLocation ? 'primary.main' : 'text.secondary',
                      backgroundColor: selectedLocation ? 'primary.light' : 'transparent',
                      '&:hover': { backgroundColor: selectedLocation ? 'primary.light' : 'grey.100' }
                    }}
                  >
                    <LocationOn fontSize="small" />
                  </IconButton>
                  {(searchQuery || selectedLocation) && (
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
              
              {/* Status Filter Tabs */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    Status:
                  </Typography>
                  {['pending', 'all'].map((status) => (
                    <Button
                      key={status}
                      size="small"
                      variant={statusFilter === status ? 'contained' : 'outlined'}
                      onClick={() => setStatusFilter(status)}
                      sx={{
                        minWidth: 'auto',
                        px: 2,
                        py: 0.5,
                        fontSize: '0.75rem',
                        textTransform: 'capitalize',
                        borderRadius: 1
                      }}
                    >
                      {status === 'all' ? 'All' : status}
                    </Button>
                  ))}
                </Box>
              </Box>
              
              {/* Search Field */}
              <TextField
                size="small"
                fullWidth
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery('')}
                        edge="end"
                      >
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
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
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '200px',
                  flexDirection: 'column',
                  color: 'text.secondary'
                }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No candidates found
                  </Typography>
                  <Typography variant="body2">
                    {searchQuery || selectedLocation ? 'Try adjusting your search or filters' : 'No candidates available'}
                  </Typography>
                </Box>
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
                            {candidate.name}
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
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                    {candidateDetails?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {candidateDetails?.email}
                  </Typography>
                  {candidateDetails?.location && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {candidateDetails.location}
                    </Typography>
                  )}
                  <SummaryDisplay summary={candidateDetails?.jobTitle} />
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
                          onClick={(e) => e.preventDefault()}
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
                    onBlur={() => handleNotesUpdate(selectedCandidate?.id)} // saves to mongo when user stops talking
                  />
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
      <Menu
        anchorEl={locationMenuAnchor}
        open={Boolean(locationMenuAnchor)}
        onClose={() => setLocationMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem 
          onClick={() => {
            setSelectedLocation('');
            setLocationMenuAnchor(null);
          }}
          selected={selectedLocation === ''}
        >
          <em>All locations</em>
        </MenuItem>
        {uniqueLocations.map((location) => (
          <MenuItem 
            key={location} 
            onClick={() => {
              setSelectedLocation(location);
              setLocationMenuAnchor(null);
            }}
            selected={selectedLocation === location}
          >
            {location}
          </MenuItem>
        ))}
      </Menu>

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
            Are you sure you want to reject <strong>{selectedCandidate?.name}</strong>? 
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
    </Box>
  );
}

export default Candidates;