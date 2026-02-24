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
  TextField,
  InputAdornment,
  IconButton,
  Skeleton,
  Menu,
  MenuItem
} from '@mui/material';
import { ArrowBack, Search, Clear, OpenInNew, Refresh as RefreshIcon, History as HistoryIcon } from '@mui/icons-material';
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
  const [generatedAt, setGeneratedAt] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyAnchorEl, setHistoryAnchorEl] = useState(null);
  const [activeMatchId, setActiveMatchId] = useState(null);

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

    return () => controller.abort();
  }, [decodedCompany, decodedTitle, loadHistory]);

  const handleRegenerate = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await matchingAPI.findMatches(decodedCompany, decodedTitle, 10, true);
      setRecommendations(response.data.matches || []);
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
              </DetailPanel>
            )}
          </CardSection>
        </Grid>
      </Grid>
    </Box>
  );
}

export default JobRecommendations;
