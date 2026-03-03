import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
  Skeleton,
  Tooltip,
  Menu,
  MenuItem,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { ArrowBack, OpenInNew, Refresh as RefreshIcon, History as HistoryIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { matchingAPI, candidateJobsAPI, jobAPI } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem,
  DetailPanel,
  DarkButton
} from './common-components/StyledComponents';
import { SearchField, EmptyState } from './common-components/SharedComponents';


function JobRecommendations() {
  const navigate = useNavigate();
  const { company, title } = useParams();
  const decodedCompany = decodeURIComponent(company);
  const decodedTitle = decodeURIComponent(title);

  const [recommendations, setRecommendations] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mongoMatchId, setMongoMatchId] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyAnchorEl, setHistoryAnchorEl] = useState(null);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [jobMongoId, setJobMongoId] = useState(null);
  const [jobLocation, setJobLocation] = useState('');
  const [jobSkills, setJobSkills] = useState([]);
  const [recommendSnackbar, setRecommendSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [recommendingId, setRecommendingId] = useState(null);
  // Map of candidate_id -> rec_id for candidates already recommended for this job
  const [recommendedCandidates, setRecommendedCandidates] = useState(new Map());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const loadRecommendedCandidates = useCallback(async () => {
    try {
      const res = await candidateJobsAPI.getJobRecommendations(decodedCompany, decodedTitle);
      const map = new Map(
        (res.data.recommendations || []).map(({ candidate_id, rec_id }) => [candidate_id, rec_id])
      );
      setRecommendedCandidates(map);
    } catch (err) {
      // Non-critical — silently ignore, button defaults to "Recommend this Job"
    }
  }, [decodedCompany, decodedTitle]);

  const loadJobDetails = useCallback(async () => {
    try {
      const res = await jobAPI.getDetails(decodedCompany, decodedTitle);
      const job = res.data.job;
      setJobMongoId(job.mongo_id || job.job_id || `${decodedCompany}_${decodedTitle}`);
      setJobLocation(job.locations?.[0] || '');
      setJobSkills(job.skills || []);
    } catch (err) {
      // Non-critical — use fallback values
      setJobMongoId(`${decodedCompany}_${decodedTitle}`);
    }
  }, [decodedCompany, decodedTitle]);

  const loadHistory = useCallback(async (signal) => {
    try {
      const res = await matchingAPI.getMatchHistory(decodedCompany, decodedTitle, { signal });
      if (!signal?.aborted) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      // Non-critical — silently ignore
    }
  }, [decodedCompany, decodedTitle]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Try loading from database first
        try {
          const stored = await matchingAPI.getStoredMatches(decodedCompany, decodedTitle, { signal });
          setRecommendations(stored.data.matches || []);
          setMongoMatchId(stored.data.mongo_match_id || null);
          setGeneratedAt(stored.data.created_at || null);
          await loadHistory(signal);
          return;
        } catch (err) {
          if (err.name === 'CanceledError' || err.name === 'AbortError') return;
          if (err.response?.status !== 404) throw err;
          // 404 = no stored list yet, fall through to generate
        }

        // 2. No stored list — generate for the first time
        const response = await matchingAPI.findMatches(
          decodedCompany,
          decodedTitle,
          10,    // top_k
          true,  // use_cohort=true hides scores and rankings
          { signal }
        );
        setRecommendations(response.data.matches || []);
        setMongoMatchId(response.data.mongo_match_id || null);
        setGeneratedAt(response.data.created_at || null);
        await loadHistory(signal);
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return; // Request was cancelled, ignore
        }
        setError('Failed to load recommendations');
        console.error('Load recommendations error:', err);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadRecommendations();
    loadJobDetails();
    loadRecommendedCandidates();

    return () => controller.abort();
  }, [decodedCompany, decodedTitle, loadHistory, loadJobDetails, loadRecommendedCandidates]);

  const handleRegenerate = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await matchingAPI.findMatches(decodedCompany, decodedTitle, 10, true);
      setRecommendations(response.data.matches || []);
      setMongoMatchId(response.data.mongo_match_id || null);
      setGeneratedAt(response.data.created_at || null);
      setSelectedCandidate(null);
      setActiveMatchId(null);
      await loadHistory();
    } catch (err) {
      setError('Failed to regenerate recommendations');
      console.error('Regenerate recommendations error:', err);
    } finally {
      setLoading(false);
    }
  }, [decodedCompany, decodedTitle, loadHistory]);

  const handleSelectHistoricalMatch = useCallback(async (matchId) => {
    setHistoryAnchorEl(null);
    if (matchId === activeMatchId) return;
    try {
      setLoading(true);
      const res = await matchingAPI.getMatchById(matchId);
      setRecommendations(res.data.matches || []);
      setMongoMatchId(res.data.mongo_match_id || null);
      setGeneratedAt(res.data.created_at || null);
      setActiveMatchId(matchId);
      setSelectedCandidate(null);
    } catch (err) {
      setError('Failed to load historical match');
    } finally {
      setLoading(false);
    }
  }, [activeMatchId]);

  // Filter candidates based on search query (name only)
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(candidate => {
      const name = candidate.full_name || candidate.name || candidate.candidate_name || '';
      return searchQuery === '' ||
        name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [recommendations, searchQuery]);

  const handleCandidateSelect = (candidate) => {
    setSelectedCandidate(candidate);
    setReviewError('');
  };

  const handleReviewUpdate = async (candidateId, status) => {
    if (reviewLoading) return;
    if (!mongoMatchId) {
      setReviewError('Match session expired. Please refresh the page and try again.');
      return;
    }
    try {
      setReviewLoading(true);
      setReviewError('');
      await matchingAPI.updateReview(mongoMatchId, candidateId, status);
      const updateFn = (c) =>
        c.candidate_id === candidateId
          ? { ...c, review_status: status, reviewed_at: new Date().toISOString() }
          : c;
      setRecommendations(prev => prev.map(updateFn));
      setSelectedCandidate(prev => (prev ? updateFn(prev) : prev));
    } catch (err) {
      console.error('Review update error:', err);
      setReviewError('Failed to update review status. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleRecommendJob = async () => {
    if (!selectedCandidate) return;
    const candidateId = selectedCandidate.candidate_id;
    setRecommendingId(candidateId);
    try {
      const res = await candidateJobsAPI.recommendJob(candidateId, {
        job_mongo_id: jobMongoId || `${decodedCompany}_${decodedTitle}`,
        company_name: decodedCompany,
        job_title: decodedTitle,
        job_location: jobLocation,
        skills: jobSkills,
      });
      const recId = res.data.recommendation?._id;
      setRecommendedCandidates(prev => new Map([...prev, [candidateId, recId]]));
      setRecommendSnackbar({ open: true, message: 'Job recommended successfully.', severity: 'success' });
    } catch (err) {
      if (err.response?.status === 409) {
        // Already recommended — re-fetch to get rec_id
        loadRecommendedCandidates();
      }
      const detail = err.response?.data?.detail || 'Failed to recommend job.';
      setRecommendSnackbar({ open: true, message: detail, severity: 'error' });
    } finally {
      setRecommendingId(null);
    }
  };

  const handleUnrecommendJob = async () => {
    setConfirmDialogOpen(false);
    if (!selectedCandidate) return;
    const candidateId = selectedCandidate.candidate_id;
    const recId = recommendedCandidates.get(candidateId);
    if (!recId) return;
    setRecommendingId(candidateId);
    try {
      await candidateJobsAPI.removeRecommendation(candidateId, recId);
      setRecommendedCandidates(prev => {
        const next = new Map(prev);
        next.delete(candidateId);
        return next;
      });
      setRecommendSnackbar({ open: true, message: 'Recommendation removed.', severity: 'info' });
    } catch (err) {
      setRecommendSnackbar({ open: true, message: 'Failed to remove recommendation.', severity: 'error' });
    } finally {
      setRecommendingId(null);
    }
  };

  if (error && !loading && recommendations.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/jobs')}
          sx={{ color: 'text.secondary', mt: 2 }}
        >
          Back to Jobs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, backgroundColor: 'grey.50', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/jobs')}
          sx={{ color: 'text.secondary' }}
        >
          Back to Jobs
        </Button>
        <SectionHeader variant="h4" component="h1" sx={{ mb: 0, flexGrow: 1 }}>
          Recommendations for {decodedTitle}
        </SectionHeader>
        {generatedAt && (
          <Typography variant="body2" color="text.secondary">
            Generated {new Date(generatedAt).toLocaleString()}
          </Typography>
        )}
        <Button
          onClick={handleRegenerate}
          disabled={loading}
          startIcon={<RefreshIcon />}
          variant="outlined"
          size="small"
        >
          Regenerate
        </Button>

        {/* History button */}
        {history.length > 0 && (
          <Button
            onClick={(e) => setHistoryAnchorEl(e.currentTarget)}
            startIcon={<HistoryIcon />}
            variant="outlined"
            size="small"
            disabled={loading}
          >
            History ({history.length})
          </Button>
        )}

        {/* History popover */}
        <Menu
          anchorEl={historyAnchorEl}
          open={Boolean(historyAnchorEl)}
          onClose={() => setHistoryAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {history.map((entry, index) => {
            const isActiveEntry = entry.match_id === activeMatchId || (activeMatchId === null && index === 0);
            return (
              <MenuItem
                key={entry.match_id}
                selected={isActiveEntry}
                onClick={() => handleSelectHistoricalMatch(entry.match_id)}
                sx={{ minWidth: 260 }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: isActiveEntry ? 700 : 400 }}>
                    {index === 0 ? 'Latest — ' : ''}{entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Unknown date'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.total_matches} candidates
                  </Typography>
                </Box>
              </MenuItem>
            );
          })}
        </Menu>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
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
                  Matching Candidates
                </Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Finding...
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({filteredRecommendations.length} of {recommendations.length})
                  </Typography>
                )}
              </Box>

              <SearchField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search by name..."
              />
            </Box>

            {/* Candidates List */}
            <Box sx={{
              overflowY: 'auto',
              height: 'calc(100% - 120px)',
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'grey.300',
                borderRadius: '3px'
              }
            }}>
              {loading ? (
                // Skeleton loaders while loading
                [...Array(6)].map((_, index) => (
                  <Box key={index} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'grey.200' }}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={20} />
                  </Box>
                ))
              ) : filteredRecommendations.length === 0 ? (
                <EmptyState
                  title="No candidates found"
                  subtitle={searchQuery ? 'Try adjusting your search' : 'No matching candidates available'}
                />
              ) : (
                filteredRecommendations.map((candidate, index) => (
                  <SelectableListItem
                    key={candidate.candidate_id || index}
                    selected={selectedCandidate?.candidate_id === candidate.candidate_id}
                    onClick={() => handleCandidateSelect(candidate)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {candidate.full_name || candidate.name || candidate.candidate_name || 'Unknown'}
                        </Typography>
                        {candidate.location && (
                          <Typography variant="body2" color="text.secondary">
                            {candidate.location}
                          </Typography>
                        )}
                        <Chip
                          label={candidate.review_status || 'Pending'}
                          size="small"
                          color={
                            candidate.review_status === 'Approved' ? 'success' :
                            candidate.review_status === 'Rejected' ? 'error' : 'default'
                          }
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </Box>
                  </SelectableListItem>
                ))
              )}
            </Box>
          </CardSection>
        </Grid>

        {/* Main Content - Candidate Details */}
        <Grid size={{ xs: 12, md: 8 }}>
          <CardSection sx={{ height: '100%', ml: 2, overflow: 'auto' }}>
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
            ) : (
              <DetailPanel>
                {/* Candidate Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                      {selectedCandidate.full_name || selectedCandidate.name || selectedCandidate.candidate_name || 'Unknown'}
                    </Typography>
                    {selectedCandidate.email && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {selectedCandidate.email}
                      </Typography>
                    )}
                    {selectedCandidate.location && (
                      <Typography variant="body2" color="text.secondary">
                        {selectedCandidate.location}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<OpenInNew fontSize="small" />}
                      onClick={() => navigate('/candidates', {
                        state: { selectedCandidateId: selectedCandidate.candidate_id }
                      })}
                      sx={{ flexShrink: 0 }}
                    >
                      View Profile
                    </Button>
                    {(() => {
                      const isAlreadyRecommended = recommendedCandidates.has(selectedCandidate.candidate_id);
                      const isProcessing = recommendingId === selectedCandidate.candidate_id;
                      return (
                        <DarkButton
                          size="small"
                          disabled={isProcessing}
                          onClick={isAlreadyRecommended ? () => setConfirmDialogOpen(true) : handleRecommendJob}
                          sx={{ opacity: isAlreadyRecommended ? 0.65 : 1 }}
                        >
                          {isProcessing
                            ? (isAlreadyRecommended ? 'Removing...' : 'Recommending...')
                            : isAlreadyRecommended
                              ? 'Already Recommended'
                              : 'Recommend this Job'}
                        </DarkButton>
                      );
                    })()}
                  </Box>
                </Box>

                <Divider />

                {/* Why They Match Section */}
                {selectedCandidate.explanation?.summary && (
                  <>
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        Why They Match
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {selectedCandidate.explanation.summary
                          .split(/(?:[-•*]|\d+\.)\s+/)
                          .filter(point => point.trim().length > 0)
                          .map((point, index) => {
                            // Detect gaps/risks/concerns in the explanation
                            const lowerPoint = point.toLowerCase();
                            const gapIndicators = [
                              'gap', 'risk', 'concern', 'lack', 'missing',
                              'however', 'although', 'caveat', 'limitation',
                              'not clear', 'not highlight', 'unclear', 'weakness'
                            ];
                            const isGap = gapIndicators.some(indicator => lowerPoint.includes(indicator));
                            return (
                              <Box
                                key={index}
                                sx={{
                                  p: 1.5,
                                  borderRadius: 2,
                                  backgroundColor: isGap ? 'rgba(255, 152, 0, 0.08)' : 'rgba(76, 175, 80, 0.08)',
                                  borderLeft: '3px solid',
                                  borderColor: isGap ? 'warning.main' : 'success.main',
                                }}
                              >
                                <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
                                  {point.trim()}
                                </Typography>
                              </Box>
                            );
                          })}
                      </Box>
                    </Box>
                    <Divider />
                  </>
                )}

                {/* Skills Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Skills
                  </Typography>
                  {selectedCandidate.skills?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedCandidate.skills.map((skill, index) => (
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

                {/* CliftonStrengths Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    CliftonStrengths
                  </Typography>
                  {selectedCandidate.clifton_strengths?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedCandidate.clifton_strengths.map((strength, index) => (
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

                {/* Relevant Experience Section */}
                {selectedCandidate.explanation?.relevant_experience?.length > 0 && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      Relevant Experience
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {selectedCandidate.explanation.relevant_experience.map((exp, index) => (
                        <Box key={index}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {exp.role}
                          </Typography>
                          {exp.company && (
                            <Typography variant="body2" color="text.secondary">
                              {exp.company}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                <Divider />

                {/* Review Decision Section */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Review Decision
                    </Typography>
                    <Chip
                      label={`Status: ${selectedCandidate.review_status || 'Pending'}`}
                      size="small"
                      color={
                        selectedCandidate.review_status === 'Approved' ? 'success' :
                        selectedCandidate.review_status === 'Rejected' ? 'error' : 'default'
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Mark as approved">
                      <span>
                        <Button
                          variant="contained"
                          color="success"
                          disabled={!selectedCandidate.candidate_id || reviewLoading || selectedCandidate.review_status === 'Approved'}
                          onClick={() => handleReviewUpdate(selectedCandidate.candidate_id, 'Approved')}
                        >
                          Approve
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Mark as rejected">
                      <span>
                        <Button
                          variant="contained"
                          color="error"
                          disabled={!selectedCandidate.candidate_id || reviewLoading || selectedCandidate.review_status === 'Rejected'}
                          onClick={() => handleReviewUpdate(selectedCandidate.candidate_id, 'Rejected')}
                        >
                          Reject
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Reset to pending">
                      <span>
                        <Button
                          variant="outlined"
                          disabled={!selectedCandidate.candidate_id || reviewLoading || selectedCandidate.review_status === 'Pending' || !selectedCandidate.review_status}
                          onClick={() => handleReviewUpdate(selectedCandidate.candidate_id, 'Pending')}
                        >
                          Pending
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                  {reviewError && (
                    <Alert severity="error" sx={{ mt: 2 }} onClose={() => setReviewError('')}>
                      {reviewError}
                    </Alert>
                  )}
                </Box>
              </DetailPanel>
            )}
          </CardSection>
        </Grid>
      </Grid>

      <Snackbar
        open={recommendSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setRecommendSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={recommendSnackbar.severity}
          onClose={() => setRecommendSnackbar(prev => ({ ...prev, open: false }))}
        >
          {recommendSnackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Remove Recommendation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove the job recommendation for{' '}
            {selectedCandidate?.full_name || 'this candidate'}? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUnrecommendJob} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default JobRecommendations;
