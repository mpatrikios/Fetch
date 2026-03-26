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
} from '@mui/material';
import { ArrowBack, OpenInNew, Refresh as RefreshIcon, History as HistoryIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { matchingAPI, candidateJobsAPI, jobAPI } from '../utils/api';
import {
  CardSection,
  SelectableListItem,
  DarkButton
} from './common-components/StyledComponents';
import { SearchField, EmptyState, ConfirmationDialog, SkillChips, DetailPanelContainer, PageHeader } from './common-components/SharedComponents';


function JobRecommendations() {
  const navigate = useNavigate();
  const { company, title, jobId } = useParams();
  const decodedCompany = decodeURIComponent(company);
  const decodedTitle = decodeURIComponent(title);
  const decodedJobId = decodeURIComponent(jobId);

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
  // Map of candidate_id -> { rec_id, status } for candidates already recommended for this job
  const [recommendedCandidates, setRecommendedCandidates] = useState(new Map());
  // Enriched pipeline entries from candidate_jobs (used to show manually-recommended candidates)
  const [pipelineProfiles, setPipelineProfiles] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const loadRecommendedCandidates = useCallback(async () => {
    try {
      const res = await candidateJobsAPI.getJobRecommendations(decodedCompany, decodedTitle, decodedJobId);
      const entries = res.data.recommendations || [];
      const map = new Map(
        entries.map(({ candidate_id, rec_id, status }) => [candidate_id, { rec_id, status }])
      );
      setRecommendedCandidates(map);
      setPipelineProfiles(entries);
    } catch (err) {
      // Non-critical — silently ignore
    }
  }, [decodedCompany, decodedTitle, decodedJobId]);

  const loadJobDetails = useCallback(async () => {
    try {
      const res = await jobAPI.getDetailsById(decodedJobId);
      const job = res.data.job;
      setJobMongoId(job.mongo_id || job.job_id || `${decodedCompany}_${decodedTitle}`);
      setJobLocation(job.locations?.[0] || '');
      setJobSkills(job.skills || []);
    } catch (err) {
      // Non-critical — use fallback values
      setJobMongoId(`${decodedCompany}_${decodedTitle}`);
    }
  }, [decodedCompany, decodedTitle, decodedJobId]);

  const loadHistory = useCallback(async (signal) => {
    try {
      const res = await matchingAPI.getMatchHistory(decodedCompany, decodedTitle, decodedJobId, { signal });
      if (!signal?.aborted) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      // Non-critical — silently ignore
    }
  }, [decodedCompany, decodedTitle, decodedJobId]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Try loading from database first
        try {
          const stored = await matchingAPI.getStoredMatches(decodedCompany, decodedTitle, decodedJobId, { signal });
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
          decodedJobId,
          null,  // top_k — dynamic (30% of pool, capped at 40)
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
  }, [decodedCompany, decodedTitle, decodedJobId, loadHistory, loadJobDetails, loadRecommendedCandidates]);

  const handleRegenerate = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await matchingAPI.findMatches(decodedCompany, decodedTitle, decodedJobId, null, true);
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
  }, [decodedCompany, decodedTitle, decodedJobId, loadHistory]);

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
      const name = candidate.full_name || '';
      return searchQuery === '' ||
        name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [recommendations, searchQuery]);

  // Manually-recommended candidates not present in the ML results
  const pipelineOnlyCandidates = useMemo(() => {
    const mlIds = new Set(recommendations.map(r => r.candidate_id));
    return pipelineProfiles
      .filter(p => !mlIds.has(p.candidate_id))
      .filter(p => {
        const name = p.full_name || '';
        return searchQuery === '' || name.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [recommendations, pipelineProfiles, searchQuery]);

  const handleCandidateSelect = (candidate) => {
    setSelectedCandidate(candidate);
    setReviewError('');
  };

  const handleReviewUpdate = async (candidateId, status) => {
    if (reviewLoading) return;
    if (!mongoMatchId) {
      setReviewError('Unable to submit review — match data not yet loaded. Please wait a moment and try again.');
      return;
    }
    try {
      setReviewLoading(true);
      setReviewError('');
      const response = await matchingAPI.updateReview(mongoMatchId, candidateId, status);
      const { reviewed_at, reviewed_by, review_status } = (response && response.data) || {};
      const updateFn = (c) =>
        c.candidate_id === candidateId
          ? {
              ...c,
              review_status: review_status ?? status,
              reviewed_at: reviewed_at ?? c.reviewed_at ?? null,
              reviewed_by: reviewed_by ?? c.reviewed_by ?? null,
            }
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

  const handleApproveAndRecommend = async () => {
    if (!selectedCandidate) return;
    const candidateId = selectedCandidate.candidate_id;
    await handleReviewUpdate(candidateId, 'Approved');
    if (!recommendedCandidates.has(candidateId)) {
      await handleRecommendJob();
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
      setRecommendedCandidates(prev => new Map([...prev, [candidateId, { rec_id: recId, status: 'recommended' }]]));
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
    const rec = recommendedCandidates.get(candidateId);
    if (!rec) return;
    const recId = rec.rec_id;
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'grey.50', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 4, pb: 0, flexShrink: 0 }}>
      <PageHeader
        title={`Recommendations for ${decodedTitle}`}
        onBack={() => navigate('/jobs')}
        backLabel="Back to Jobs"
        rightActions={
          <>
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
          </>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      </Box>

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
                    ({filteredRecommendations.length + pipelineOnlyCandidates.length} of {recommendations.length + pipelineOnlyCandidates.length})
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
              {/* AI Matches section */}
              {(filteredRecommendations.length > 0 || loading) && (
                <Box sx={{ px: 2, py: 0.75, backgroundColor: 'rgba(0,0,0,0.04)', borderBottom: '1px solid', borderColor: 'grey.200' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    AI Matches
                  </Typography>
                </Box>
              )}
              {loading ? (
                [...Array(6)].map((_, index) => (
                  <Box key={index} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'grey.200' }}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={20} />
                  </Box>
                ))
              ) : filteredRecommendations.length === 0 && pipelineOnlyCandidates.length === 0 ? (
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
                          {candidate.full_name || 'Unknown'}
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

              {/* MLG Recommended section — manually-recommended candidates not in ML results */}
              {!loading && pipelineOnlyCandidates.length > 0 && (
                <>
                  <Box sx={{ px: 2, py: 0.75, backgroundColor: 'rgba(0,0,0,0.04)', borderBottom: '1px solid', borderColor: 'grey.200' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      MLG Recommended
                    </Typography>
                  </Box>
                  {pipelineOnlyCandidates.map(candidate => (
                    <SelectableListItem
                      key={candidate.candidate_id}
                      selected={selectedCandidate?.candidate_id === candidate.candidate_id}
                      onClick={() => handleCandidateSelect(candidate)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {candidate.full_name || 'Unknown'}
                          </Typography>
                          {candidate.location && (
                            <Typography variant="body2" color="text.secondary">
                              {candidate.location}
                            </Typography>
                          )}
                          {recommendedCandidates.has(candidate.candidate_id) && (
                            <Chip
                              label={recommendedCandidates.get(candidate.candidate_id).status}
                              size="small"
                              color={
                                recommendedCandidates.get(candidate.candidate_id).status === 'applied' ? 'primary' :
                                recommendedCandidates.get(candidate.candidate_id).status === 'pending' ? 'warning' : 'default'
                              }
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </SelectableListItem>
                  ))}
                </>
              )}
            </Box>
          </CardSection>
        </Grid>

        {/* Main Content - Candidate Details */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%' }}>
          <DetailPanelContainer selected={selectedCandidate} emptyText="Select a candidate to view details">
                {selectedCandidate && (<>
                {/* Candidate Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                      {selectedCandidate.full_name || 'Unknown'}
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
                    {selectedCandidate.distance_km != null && (
                      <Typography variant="body2" color="text.secondary">
                        {Math.round(selectedCandidate.distance_km)} km from job location
                      </Typography>
                    )}
                  </Box>
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
                </Box>

                <Divider />

                {/* Candidate Bio */}
                {selectedCandidate.summary && (
                  <>
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        About
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                        {selectedCandidate.summary}
                      </Typography>
                    </Box>
                    <Divider />
                  </>
                )}

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
                              'not clear', 'not highlight', 'unclear', 'weakness',
                              'weak', 'no demonstrated', 'no evident', 'no explicit mention'
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
                  <SkillChips items={selectedCandidate.skills} variant="skill" emptyText="No skills listed" highlightItems={selectedCandidate.explanation?.keyword_overlap || []} />
                </Box>

                <Divider />

                {/* CliftonStrengths Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    CliftonStrengths
                  </Typography>
                  <SkillChips
                    items={selectedCandidate.clifton_strengths}
                    variant="strength"
                    emptyText={selectedCandidate.missing_clifton
                      ? "No assessment uploaded — culture score defaulted to 0.0 in ranking."
                      : "No CliftonStrengths assessment completed"}
                  />
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

                {/* Actions Section */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Actions
                    </Typography>
                    {recommendations.some(r => r.candidate_id === selectedCandidate.candidate_id) && (
                      <Chip
                        label={`Status: ${selectedCandidate.review_status || 'Pending'}`}
                        size="small"
                        color={
                          selectedCandidate.review_status === 'Approved' ? 'success' :
                          selectedCandidate.review_status === 'Rejected' ? 'error' : 'default'
                        }
                      />
                    )}
                  </Box>
                  {recommendations.some(r => r.candidate_id === selectedCandidate.candidate_id) ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Approve and recommend this job to the candidate">
                        <span>
                          <Button
                            variant="contained"
                            color="success"
                            disabled={!selectedCandidate.candidate_id || reviewLoading || selectedCandidate.review_status === 'Approved'}
                            onClick={handleApproveAndRecommend}
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
                  ) : (
                    (() => {
                      const isAlreadyRecommended = recommendedCandidates.has(selectedCandidate.candidate_id);
                      const isProcessing = recommendingId === selectedCandidate.candidate_id;
                      return (
                        <DarkButton
                          size="small"
                          disabled={isProcessing}
                          onClick={isAlreadyRecommended ? () => setConfirmDialogOpen(true) : handleRecommendJob}
                          sx={isAlreadyRecommended ? { opacity: 0.65, fontSize: '0.75rem', py: 0.5, px: 1.5 } : {}}
                        >
                          {isProcessing
                            ? (isAlreadyRecommended ? 'Removing...' : 'Recommending...')
                            : isAlreadyRecommended
                              ? 'Already Recommended'
                              : 'Recommend this Job'}
                        </DarkButton>
                      );
                    })()
                  )}
                  {reviewError && (
                    <Alert severity="error" sx={{ mt: 2 }} onClose={() => setReviewError('')}>
                      {reviewError}
                    </Alert>
                  )}
                </Box>

                </>)}
          </DetailPanelContainer>
        </Grid>
      </Grid>
      </Box>

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

      <ConfirmationDialog
        open={confirmDialogOpen}
        title="Remove Recommendation"
        content={`Remove the job recommendation for ${selectedCandidate?.full_name || 'this candidate'}? This cannot be undone.`}
        onConfirm={handleUnrecommendJob}
        onCancel={() => setConfirmDialogOpen(false)}
        confirmText="Remove"
      />
    </Box>
  );
}

export default JobRecommendations;
