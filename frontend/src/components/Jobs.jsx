import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  DialogContentText,
  TextField,
  Chip,
  Snackbar,
} from '@mui/material';
import { LocationOn, FilterListOff, Description, InsertDriveFile as FileIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useLocation } from 'react-router-dom';
import { jobAPI, documentAPI, candidateAPI, candidateJobsAPI, parseDelimitedString } from '../utils/api';
import {
  CardSection,
  SelectableListItem,
  FileLink
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
  ClosableDialog,
  PageHeader
} from './common-components/SharedComponents';
import { useAutoHideMessage } from '../hooks/useAutoHideMessage';
import DocumentUpload from './DocumentUpload';
import CompanyNameField from './CompanyNameField';
import ExpandableListSection from './common-components/ExpandableListSection';
import JobFormFields from './JobFormFields';
import JobDetailsHeader from './JobDetailsHeader';
import { useCultureDocumentUpload } from '../hooks/useCultureDocumentUpload';
import CultureDocumentDialog from './CultureDocumentDialog';


function Jobs() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [hasMatchesFilter, setHasMatchesFilter] = useState(searchParams.get('filter') === 'has_matches');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedResponsibilities, setExpandedResponsibilities] = useState(false);
  const [expandedQualifications, setExpandedQualifications] = useState(false);
  const [expandedCultureIndex, setExpandedCultureIndex] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationMenuAnchor, setLocationMenuAnchor] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    summary: '',
    locations: '',
    skills: '',
    responsibilities: '',
    qualifications: '',
    min_years: '',
    culture_index: '',
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, showSuccess] = useAutoHideMessage(5000);
  const {
    cultureDialogOpen,
    cultureDialogStep,
    cultureFile, setCultureFile,
    cultureUploading,
    cultureUploadError, setCultureUploadError,
    pendingStrengths, setPendingStrengths,
    cliftonSaving,
    handleOpenCultureDialog,
    handleCultureDocUpload,
    handleConfirmStrengths,
    handleCloseCultureDialog,
  } = useCultureDocumentUpload({ jobDetails, setJobDetails, showSuccess });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [pendingJobReview, setPendingJobReview] = useState(null);
  const [reviewFormData, setReviewFormData] = useState({
    title: '', summary: '', locations: '', skills: '',
    responsibilities: '', qualifications: '', min_years: '', culture_index: '',
  });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [manualRecommendingId, setManualRecommendingId] = useState(null);
  const [recommendSnackbar, setRecommendSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [recommendedCandidates, setRecommendedCandidates] = useState(new Map());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setHasMatchesFilter(params.get('filter') === 'has_matches');
  }, [location.search]);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadPushedCandidates = useCallback(async (company, title) => {
    try {
      const res = await candidateJobsAPI.getJobRecommendations(company, title, jobDetails.mongo_id);
      const map = new Map(
        (res.data.recommendations || []).map(({ candidate_id, rec_id }) => [candidate_id, rec_id])
      );
      setRecommendedCandidates(map);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (!manualQuery.trim()) {
      setManualResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setManualSearching(true);
      try {
        const res = await candidateAPI.search(manualQuery);
        setManualResults(res.data.candidates || []);
      } catch {
        setManualResults([]);
      } finally {
        setManualSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualQuery]);

  const handleCloseManualDialog = () => {
    setManualDialogOpen(false);
    setManualQuery('');
    setManualResults([]);
  };

  const handleManualRecommend = async (candidate) => {
    if (!jobDetails) return;
    setManualRecommendingId(candidate.candidate_id);
    try {
      const res = await candidateJobsAPI.recommendJob(candidate.candidate_id, {
        job_mongo_id: jobDetails.mongo_id || `${jobDetails.company}_${jobDetails.title}`,
        company_name: jobDetails.company,
        job_title: jobDetails.title,
        job_location: jobDetails.locations?.[0] || '',
        skills: jobDetails.skills || [],
      });
      const recId = res.data.recommendation?._id;
      setRecommendedCandidates(prev => new Map([...prev, [candidate.candidate_id, recId]]));
      setRecommendSnackbar({ open: true, message: `Job recommended to ${candidate.full_name}.`, severity: 'success' });
    } catch (err) {
      if (err.response?.status === 409) {
        setRecommendSnackbar({ open: true, message: 'Already recommended to this candidate.', severity: 'info' });
      } else {
        setRecommendSnackbar({ open: true, message: 'Failed to recommend job.', severity: 'error' });
      }
    } finally {
      setManualRecommendingId(null);
    }
  };

  const handleJobSelect = useCallback(async (job) => {
    if (selectedJob?.mongo_id === job.mongo_id) return;

    setSelectedJob(job);
    setDetailsLoading(true);
    setJobDetails(null);
    setExpandedResponsibilities(false);
    setExpandedQualifications(false);
    setExpandedCultureIndex(false);
    setShowAddJob(false);
    setRecommendedCandidates(new Map());

    try {
      const response = await jobAPI.getDetailsById(job.mongo_id);
      setJobDetails(response.data.job);
    } catch (err) {
      console.error('Load job details error:', err);
      setError('Failed to load job details');
    } finally {
      setDetailsLoading(false);
    }
    loadPushedCandidates(job.company, job.title);
  }, [selectedJob, loadPushedCandidates]);

  /* automatically select job if navigated to by the clients page */
  useEffect(() => {
    const { selectedJobId, selectedJobTitle, selectedCompany } = location.state || {};
    if (jobs.length > 0 && !selectedJob) {
      let job = null;
      if (selectedJobId) {
        job = jobs.find(j => j.id === selectedJobId || j.job_id === selectedJobId);
      } else if (selectedJobTitle && selectedCompany) {
        job = jobs.find(j =>
          j.title === selectedJobTitle && j.company === selectedCompany
        );
      }
      if (job) {
        handleJobSelect(job);
      }
    }
  }, [jobs, selectedJob, handleJobSelect, location.state]);

  const uniqueLocations = useMemo(() => {
    const locations = jobs
      .flatMap(job => job.locations || [])
      .filter(location => location && location.trim() !== '');
    return [...new Set(locations)].sort();
  }, [jobs]);

  // Filter jobs based on search query, location, and has_matches
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = searchQuery === '' ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLocation = selectedLocation === '' ||
        (Array.isArray(job.locations) ? job.locations : []).some(loc => loc.trim() === selectedLocation.trim());

      const matchesHasMatches = !hasMatchesFilter || !!job.last_match_generated_at;

      return matchesSearch && matchesLocation && matchesHasMatches;
    });
  }, [jobs, searchQuery, selectedLocation, hasMatchesFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
    setHasMatchesFilter(false);
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await jobAPI.list();
      setJobs(response.data.jobs || []);
    } catch (err) {
      setError('Failed to load jobs');
      console.error('Load jobs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionDownload = async () => {
    if (!jobDetails?.mongo_id) return;
    try {
      const response = await documentAPI.getJobDownloadUrl(jobDetails.mongo_id);
      window.open(response.data.download_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download document.');
    }
  };

  const handleFindRecommendations = () => {
    if (!jobDetails) return;
    navigate(`/jobs/${encodeURIComponent(jobDetails.company)}/${encodeURIComponent(jobDetails.title)}/${encodeURIComponent(jobDetails.mongo_id)}/matches`);
  };

  const handleEditClick = () => {
    if (!jobDetails) return;
    setEditFormData({
      summary: jobDetails.summary ?? '',
      locations: (jobDetails.locations ?? []).join('; '),
      skills: (jobDetails.skills ?? []).join(', '),
      responsibilities: (jobDetails.responsibilities ?? []).join('\n'),
      qualifications: (jobDetails.qualifications ?? []).join('\n'),
      min_years: jobDetails.min_years ?? '',
      culture_index: jobDetails.culture_index ?? '',
    });
    setShowEditDialog(true);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveJob = async () => {
    if (!jobDetails) return;

    try {
      setSaving(true);
      setError('');

      const skillsArray = parseDelimitedString(editFormData.skills, ',');
      const locationsArray = parseDelimitedString(editFormData.locations, ';');
      const responsibilitiesArray = parseDelimitedString(editFormData.responsibilities, '\n');
      const qualificationsArray = parseDelimitedString(editFormData.qualifications, '\n');

      const updatePayload = {
        summary: editFormData.summary,
        locations: locationsArray,
        skills: skillsArray,
        responsibilities: responsibilitiesArray,
        qualifications: qualificationsArray,
        min_years: editFormData.min_years,
        culture_index: editFormData.culture_index,
      };

      await jobAPI.updateJob(jobDetails.mongo_id, updatePayload);

      setJobDetails(prev => ({
        ...prev,
        summary: editFormData.summary,
        locations: locationsArray,
        skills: skillsArray,
        responsibilities: responsibilitiesArray,
        qualifications: qualificationsArray,
        min_years: editFormData.min_years,
        culture_index: editFormData.culture_index,
      }));

      setJobs(prev => prev.map(j =>
        j.mongo_id === jobDetails.mongo_id
          ? { ...j, locations: locationsArray, skills: skillsArray.slice(0, 10) }
          : j
      ));

      setShowEditDialog(false);
      showSuccess('Job updated successfully!');
    } catch (err) {
      console.error('Update job error:', err);
      setError('Failed to update job. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleJobUploadSuccess = async (data) => {
    if (data?.needs_review) {
      const p = data.parsed_fields || {};
      setPendingJobReview(data);
      setReviewFormData({
        title: p.JobTitle || '',
        summary: p.Summary || '',
        locations: (p.Locations || []).join('; '),
        skills: (p.Skills || []).join(', '),
        responsibilities: (p.Responsibilities || []).join('\n'),
        qualifications: (p.Qualifications || []).join('\n'),
        min_years: p.MinYears || '',
        culture_index: p.CultureIndex || '',
      });
      setShowAddJob(false);
      setCompanyName('');
      setSelectedJob(null);
      return;
    }
    if (data?.job?.mongo_id) {
      try {
        const response = await jobAPI.getDetailsById(data.job.mongo_id);
        setJobDetails(response.data.job);
        setJobs(prev => [response.data.job, ...prev]);
        setShowAddJob(false);
        setCompanyName('');
        setSelectedJob(response.data.job);
        showSuccess('Job uploaded successfully!');
      } catch (err) {
        setError('Failed to fetch job details.');
      }

    }
  };

  const handleFinalizeJob = async () => {
    if (!reviewFormData.title.trim()) {
      setError('Job title is required');
      return;
    }
    setReviewSaving(true);
    setError('');
    try {
      await jobAPI.finalizeJob({
        company_name: pendingJobReview.company_name,
        title: reviewFormData.title.trim(),
        summary: reviewFormData.summary,
        locations: parseDelimitedString(reviewFormData.locations, ';'),
        skills: parseDelimitedString(reviewFormData.skills, ','),
        responsibilities: parseDelimitedString(reviewFormData.responsibilities, '\n'),
        qualifications: parseDelimitedString(reviewFormData.qualifications, '\n'),
        min_years: reviewFormData.min_years,
        culture_index: reviewFormData.culture_index,
        blob_path: pendingJobReview.blob_path,
        blob_filename: pendingJobReview.blob_filename,
      });
      setPendingJobReview(null);
      await loadJobs();
      showSuccess('Job created successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save job');
    } finally {
      setReviewSaving(false);
    }
  };
  const handleDeleteJob = async () => {
    if (!jobDetails?.mongo_id) return;
    try {
      setDeleting(true);
      await jobAPI.deleteJob(jobDetails.mongo_id, jobDetails.company);
      setJobs(prev => prev.filter(j => j.mongo_id !== jobDetails.mongo_id));
      setSelectedJob(null);
      setJobDetails(null);
      setShowDeleteDialog(false);
    } catch (err) {
      console.error('Delete job error:', err);
      setError('Failed to delete job. Please try again.');
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

  if (error && jobs.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'grey.50', overflow: 'hidden' }}>
      <Box sx={{ p: 4, pb: 0, flexShrink: 0 }}>
      {/* Header */}
      <PageHeader title="MLG Manage Jobs" onBack={() => navigate('/mlg-dashboard')} />

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" onClose={() => showSuccess('')} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      </Box>

      <Box sx={{ flex: 1, px: 4, pb: 4, minHeight: 0, overflow: 'hidden' }}>
      <Grid container spacing={0} sx={{ height: '100%' }}>
        {/* Sidebar - Jobs List */}
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
                  Jobs
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({filteredJobs.length} of {jobs.length})
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FilterIconButton
                    active={!!selectedLocation}
                    onClick={(e) => setLocationMenuAnchor(e.currentTarget)}
                    icon={LocationOn}
                    title="Filter by location"
                  />
                  {(searchQuery || selectedLocation || hasMatchesFilter) && (
                    <IconButton
                      size="small"
                      onClick={clearFilters}
                      title="Clear filters"
                    >
                      <FilterListOff fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => setShowAddJob(true)}
                    title="Add new job"
                    aria-label="Add new job"
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <SearchField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search by title or company..."
              />
            </Box>

            {/* Jobs List */}
            <Box sx={{
              overflowY: 'auto',
              height: 'calc(100% - 120px)',
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'grey.300',
                borderRadius: '3px'
              }
            }}>
              {filteredJobs.length === 0 ? (
                <EmptyState
                  title="No jobs found"
                  subtitle={searchQuery || selectedLocation ? 'Try adjusting your search or filters' : 'No jobs available'}
                />
              ) : (
                filteredJobs.map((job, index) => (
                  <SelectableListItem
                    key={job.mongo_id || index}
                    selected={selectedJob?.mongo_id === job.mongo_id}
                    onClick={() => handleJobSelect(job)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {job.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {job.company}
                        </Typography>
                        {job.locations?.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {job.locations.map((loc) => (
                              <Chip
                                key={loc}
                                label={loc}
                                size="small"
                                icon={<LocationOn sx={{ fontSize: 8 }} />}
                                sx={{ fontSize: 12, height: 20 }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                      {job.has_embeddings && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: 'success.main',
                            ml: 1
                          }}
                          title="Ready for matching"
                        />
                      )}
                    </Box>
                  </SelectableListItem>
                ))
              )}
            </Box>
          </CardSection>
        </Grid>

        {/* Main Content - Job Details */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%' }}>
          <DetailPanelContainer selected={selectedJob} loading={detailsLoading} emptyText="Select a job to view details">
                {/* Job Header */}
                <JobDetailsHeader
                  jobDetails={jobDetails}
                  onEdit={handleEditClick}
                  onDelete={() => setShowDeleteDialog(true)}
                  onFindRecommendations={handleFindRecommendations}
                  onRecommendCandidate={() => setManualDialogOpen(true)}
                />

                <Divider />

                {/* Summary Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Summary
                  </Typography>
                  <SummaryDisplay summary={jobDetails?.summary} />
                </Box>

                <Divider />

                {/* Skills Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Skills
                  </Typography>
                  <SkillChips items={jobDetails?.skills} variant="skill" emptyText="No skills listed" />
                </Box>

                <Divider />

                {/* CliftonStrengths Section */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>CliftonStrengths</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleOpenCultureDialog}
                      sx={{ textTransform: 'none' }}
                    >
                      {jobDetails?.culture_strengths_status === 'pending_review'
                        ? 'Review Suggestions'
                        : jobDetails?.culture_doc_filename
                          ? 'Re-upload Culture Doc'
                          : 'Upload Culture Doc'}
                    </Button>
                  </Box>

                  {jobDetails?.culture_strengths_status === 'pending_review' && (
                    <Chip
                      label="Pending Review"
                      color="warning"
                      size="small"
                      sx={{ mb: 1.5 }}
                    />
                  )}
                  <SkillChips
                    items={jobDetails?.clifton_strengths}
                    variant="strength"
                    emptyText="No CliftonStrengths defined"
                  />
                </Box>

                <Divider />

                {/* Responsibilities Section */}
                <ExpandableListSection
                  title="Responsibilities"
                  items={jobDetails?.responsibilities || []}
                  expanded={expandedResponsibilities}
                  onToggle={() => setExpandedResponsibilities((v) => !v)}
                  threshold={4}
                  emptyText="No responsibilities listed"
                />

                <Divider />

                {/* Qualifications Section */}
                <ExpandableListSection
                  title="Qualifications"
                  items={jobDetails?.qualifications || []}
                  expanded={expandedQualifications}
                  onToggle={() => setExpandedQualifications((v) => !v)}
                  threshold={4}
                  emptyText="No qualifications listed"
                />

                {/* Culture Index Section */}
                {jobDetails?.culture_index && (
                  <>
                    <Divider />
                    <ExpandableListSection
                      title="Culture Index"
                      items={parseDelimitedString(jobDetails.culture_index, ',')}
                      expanded={expandedCultureIndex}
                      onToggle={() => setExpandedCultureIndex((v) => !v)}
                      threshold={3}
                    />
                  </>
                )}

                <Divider />

                {/* Documents Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Documents
                  </Typography>
                  {jobDetails?.has_description || jobDetails?.culture_doc_filename ? (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {jobDetails?.has_description && (
                        <FileLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDescriptionDownload();
                          }}
                        >
                          <FileIcon fontSize="small" />
                          Job Description Document
                        </FileLink>
                      )}
                      {jobDetails?.culture_doc_filename && (
                        <FileLink
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const res = await documentAPI.getCultureDocDownloadUrl(jobDetails.mongo_id);
                              window.open(res.data.download_url, '_blank', 'noopener,noreferrer');
                            } catch (err) {
                              console.error('Culture doc download error:', err);
                              setError('Failed to download culture document.');
                            }
                          }}
                        >
                          <FileIcon fontSize="small" />
                          Culture Document ({jobDetails.culture_doc_filename})
                        </FileLink>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      py: 3,
                      color: 'text.secondary'
                    }}>
                      <Description sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                      <Typography variant="body2">
                        No documents uploaded yet
                      </Typography>
                    </Box>
                  )}
                </Box>

          </DetailPanelContainer>
        </Grid>
      </Grid>
      </Box>

      {/* Manually Recommend Candidate Dialog */}
      <ClosableDialog
        open={manualDialogOpen}
        onClose={handleCloseManualDialog}
        title="Recommend Candidate"
        actions={<Button onClick={handleCloseManualDialog} sx={{ textTransform: 'none' }}>Close</Button>}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Search for a candidate to manually recommend <strong>{jobDetails?.title}</strong> to.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search by name or email..."
          value={manualQuery}
          onChange={(e) => setManualQuery(e.target.value)}
          sx={{ mb: 1 }}
          InputProps={{
            endAdornment: manualSearching ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : null,
          }}
        />
        {manualResults.length > 0 ? (
          <List dense disablePadding>
            {manualResults.map((c) => {
              const alreadyPushed = recommendedCandidates.has(c.candidate_id);
              const isProcessing = manualRecommendingId === c.candidate_id;
              return (
                <ListItemButton
                  key={c.candidate_id}
                  disabled={alreadyPushed || isProcessing}
                  onClick={() => handleManualRecommend(c)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={c.full_name}
                    secondary={`${c.email}${c.location ? ` · ${c.location}` : ''}`}
                  />
                  {alreadyPushed && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
                      Already recommended
                    </Typography>
                  )}
                  {isProcessing && <CircularProgress size={16} sx={{ ml: 1 }} />}
                </ListItemButton>
              );
            })}
          </List>
        ) : manualQuery.trim() && !manualSearching ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No candidates found
          </Typography>
        ) : null}
      </ClosableDialog>

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

      {/* Culture Document / Clifton Strengths Dialog */}
      <CultureDocumentDialog
        open={cultureDialogOpen}
        onClose={handleCloseCultureDialog}
        step={cultureDialogStep}
        cultureFile={cultureFile}
        onFileChange={(e) => { setCultureFile(e.target.files[0] || null); setCultureUploadError(''); }}
        cultureUploading={cultureUploading}
        cultureUploadError={cultureUploadError}
        pendingStrengths={pendingStrengths}
        onRemoveStrength={(s) => setPendingStrengths(prev => prev.filter(x => x !== s))}
        cliftonSaving={cliftonSaving}
        suggestedStrengths={jobDetails?.suggested_clifton_strengths}
        onUpload={handleCultureDocUpload}
        onConfirm={handleConfirmStrengths}
      />

      {/* Add Job Modal */}
      <ClosableDialog open={showAddJob} onClose={() => setShowAddJob(false)} title="Add Job">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <CompanyNameField
            label="Company Name"
            value={companyName}
            onChange={(val) => setCompanyName(val)}
            options={[...new Set(jobs.map((job) => job.company))]}
            required
            error={companyName.trim() === ''}
          />
        </Box>
        <DocumentUpload
          uploadType="job_description"
          companyName={companyName.trim()}
          onSuccess={(data) => { handleJobUploadSuccess(data); setCompanyName(''); }}
        />
      </ClosableDialog>

      {/* Location Filter Menu */}
      <FilterMenu
        anchorEl={locationMenuAnchor}
        onClose={() => setLocationMenuAnchor(null)}
        items={uniqueLocations}
        selectedItem={selectedLocation}
        onSelect={setSelectedLocation}
        allLabel="All locations"
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      />

      {/* Delete Job Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        title="Delete Job"
        content={<DialogContentText>Delete <strong>{jobDetails?.title}</strong> at <strong>{jobDetails?.company}</strong>? This cannot be undone.</DialogContentText>}
        onConfirm={handleDeleteJob}
        onCancel={() => setShowDeleteDialog(false)}
        loading={deleting}
        confirmText="Delete"
      />

      {/* Complete Job Details Dialog (partial parse) */}
      <ClosableDialog
        open={!!pendingJobReview}
        onClose={() => setPendingJobReview(null)}
        title="Complete Job Details"
        dividers={false}
        maxWidth="md"
        actions={
          <>
            <Button onClick={() => setPendingJobReview(null)} disabled={reviewSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalizeJob}
              variant="contained"
              disabled={!reviewFormData.title.trim() || reviewSaving}
            >
              {reviewSaving ? 'Saving...' : 'Save Job'}
            </Button>
          </>
        }
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
          Some fields could not be extracted from the document. Please fill in any missing details below.
        </Typography>
        <JobFormFields
          formData={reviewFormData}
          onChange={(field, value) => setReviewFormData((prev) => ({ ...prev, [field]: value }))}
          showTitle
        />
      </ClosableDialog>

      {/* Edit Job Dialog */}
      <ClosableDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        title="Edit Job Details"
        dividers={false}
        maxWidth="md"
        actions={
          <>
            <Button onClick={() => setShowEditDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveJob}
              variant="contained"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <Box sx={{ pt: 1 }}>
          <JobFormFields
            formData={editFormData}
            onChange={handleEditFormChange}
          />
        </Box>
      </ClosableDialog>
    </Box>
  );
}

export default Jobs;
