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
  TextField,
  InputAdornment,
  IconButton,
  Skeleton,
  Tooltip
} from '@mui/material';
import { ArrowBack, Search, Clear, OpenInNew } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { matchingAPI } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem,
  DetailPanel
} from './common-components/StyledComponents';

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

  useEffect(() => {
    const controller = new AbortController();

    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await matchingAPI.findMatches(
          decodedCompany,
          decodedTitle,
          10,    // top_k
          true,  // use_cohort=true hides scores and rankings
          { signal: controller.signal }
        );
        setRecommendations(response.data.matches || []);
        setMongoMatchId(response.data.mongo_match_id || null);
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          return; // Request was cancelled, ignore
        }
        setError('Failed to load recommendations');
        console.error('Load recommendations error:', err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => controller.abort();
  }, [decodedCompany, decodedTitle]);

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
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/jobs')}
          sx={{ color: 'text.secondary' }}
        >
          Back to Jobs
        </Button>
        <SectionHeader variant="h4" component="h1" sx={{ mb: 0 }}>
          Recommendations for {decodedTitle}
        </SectionHeader>
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
                {searchQuery && !loading && (
                  <Box sx={{ ml: 'auto' }}>
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <Clear fontSize="small" />
                    </IconButton>
                  </Box>
                )}
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
                    {searchQuery ? 'Try adjusting your search' : 'No matching candidates available'}
                  </Typography>
                </Box>
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
                        {candidate.review_status && (
                          <Chip
                            label={candidate.review_status.charAt(0).toUpperCase() + candidate.review_status.slice(1)}
                            size="small"
                            color={
                              candidate.review_status === 'approved' ? 'success' :
                              candidate.review_status === 'rejected' ? 'error' : 'default'
                            }
                            sx={{ mt: 0.5 }}
                          />
                        )}
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
                    {selectedCandidate.review_status && (
                      <Chip
                        label={`Status: ${selectedCandidate.review_status.charAt(0).toUpperCase() + selectedCandidate.review_status.slice(1)}`}
                        size="small"
                        color={
                          selectedCandidate.review_status === 'approved' ? 'success' :
                          selectedCandidate.review_status === 'rejected' ? 'error' : 'default'
                        }
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Mark as approved">
                      <span>
                        <Button
                          variant="contained"
                          color="success"
                          disabled={reviewLoading || selectedCandidate.review_status === 'approved'}
                          onClick={() => handleReviewUpdate(selectedCandidate.candidate_id, 'approved')}
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
                          disabled={reviewLoading || selectedCandidate.review_status === 'rejected'}
                          onClick={() => handleReviewUpdate(selectedCandidate.candidate_id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Reset to pending">
                      <span>
                        <Button
                          variant="outlined"
                          disabled={reviewLoading || selectedCandidate.review_status === 'pending' || !selectedCandidate.review_status}
                          onClick={() => handleReviewUpdate(selectedCandidate.candidate_id, 'pending')}
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
    </Box>
  );
}

export default JobRecommendations;
