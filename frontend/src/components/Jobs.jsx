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
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import { ArrowBack, LocationOn, FilterListOff, Work, Description, Edit as EditIcon, InsertDriveFile as FileIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useLocation } from 'react-router-dom';
import { jobAPI, documentAPI, parseDelimitedString } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem,
  PrimaryButton,
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
  DetailPanelContainer
} from './common-components/SharedComponents';
import { useAutoHideMessage } from '../hooks/useAutoHideMessage';
import DocumentUpload from './DocumentUpload';
import CompanyNameField from './CompanyNameField';


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
  const [cultureDialogOpen, setCultureDialogOpen] = useState(false);
  const [cultureDialogStep, setCultureDialogStep] = useState('upload'); // 'upload' | 'confirm'
  const [cultureFile, setCultureFile] = useState(null);
  const [cultureUploading, setCultureUploading] = useState(false);
  const [cultureUploadError, setCultureUploadError] = useState('');
  const [pendingStrengths, setPendingStrengths] = useState([]);
  const [cliftonSaving, setCliftonSaving] = useState(false);
  const [successMessage, showSuccess] = useAutoHideMessage(5000);
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setHasMatchesFilter(params.get('filter') === 'has_matches');
  }, [location.search]);

  useEffect(() => {
    loadJobs();
  }, []);

  const handleJobSelect = useCallback(async (job) => {
    if (selectedJob?.mongo_id === job.mongo_id) return;

    setSelectedJob(job);
    setDetailsLoading(true);
    setJobDetails(null);
    setExpandedResponsibilities(false);
    setExpandedQualifications(false);
    setExpandedCultureIndex(false);
    setShowAddJob(false);

    try {
      const response = await jobAPI.getDetailsById(job.mongo_id);
      setJobDetails(response.data.job);
    } catch (err) {
      console.error('Load job details error:', err);
      setError('Failed to load job details');
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedJob]);

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

  const handleOpenCultureDialog = () => {
    if (jobDetails?.culture_strengths_status === 'pending_review' &&
        jobDetails?.suggested_clifton_strengths?.length > 0) {
      setPendingStrengths(jobDetails.suggested_clifton_strengths.map(s => s.strength));
      setCultureDialogStep('confirm');
    } else {
      setCultureFile(null);
      setCultureUploadError('');
      setCultureDialogStep('upload');
    }
    setCultureDialogOpen(true);
  };

  const handleCultureDocUpload = async () => {
    if (!cultureFile) return;
    setCultureUploading(true);
    setCultureUploadError('');
    try {
      const res = await jobAPI.uploadCultureDocument(jobDetails.mongo_id, cultureFile);
      const data = res.data;
      setJobDetails(prev => ({
        ...prev,
        culture_strengths_status: data.culture_strengths_status,
        suggested_clifton_strengths: data.suggested_clifton_strengths,
        culture_doc_filename: cultureFile.name,
      }));
      setPendingStrengths(data.suggested_clifton_strengths.map(s => s.strength));
      setCultureDialogStep('confirm');
    } catch (err) {
      setCultureUploadError(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setCultureUploading(false);
    }
  };

  const handleConfirmStrengths = async () => {
    setCliftonSaving(true);
    try {
      await jobAPI.updateCliftonStrengths(jobDetails.mongo_id, pendingStrengths);
      const res = await jobAPI.getDetailsById(jobDetails.mongo_id);
      setJobDetails(res.data.job);
      setCultureDialogOpen(false);
      showSuccess('CliftonStrengths confirmed and culture embedding generated');
    } catch (err) {
      setCultureUploadError(err?.response?.data?.detail || 'Save failed');
    } finally {
      setCliftonSaving(false);
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
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/mlg-dashboard')}
          sx={{ color: 'text.secondary' }}
        >
          Back
        </Button>
        <SectionHeader variant="h4" component="h1" sx={{ mb: 0 }}>
          MLG Manage Jobs
        </SectionHeader>
      </Box>

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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {jobDetails?.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={handleEditClick}
                        title="Edit job details"
                        aria-label="Edit job details"
                        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setShowDeleteDialog(true)}
                        title="Delete job"
                        aria-label="Delete job"
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                      {jobDetails?.company}
                    </Typography>
                    {jobDetails?.locations?.length > 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {jobDetails.locations.join('; ')}
                      </Typography>
                    )}
                    {jobDetails?.min_years && (
                      <Typography variant="body2" color="text.secondary">
                        Experience: {jobDetails.min_years}
                      </Typography>
                    )}
                  </Box>
                  <PrimaryButton
                    onClick={handleFindRecommendations}
                    disabled={!jobDetails?.has_embeddings}
                    startIcon={<Work />}
                    sx={{ flexShrink: 0 }}
                  >
                    {jobDetails?.last_match_generated_at ? 'View Recommendations' : 'Generate Recommendations'}
                  </PrimaryButton>
                </Box>

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
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Responsibilities
                  </Typography>
                  {jobDetails?.responsibilities?.length > 0 ? (
                    <Box>
                      <List disablePadding>
                        {(expandedResponsibilities
                          ? jobDetails.responsibilities
                          : jobDetails.responsibilities.slice(0, 4)
                        ).map((resp, index) => (
                          <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                            <ListItemText
                              primary={`• ${resp}`}
                              primaryTypographyProps={{ variant: 'body1' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                      {jobDetails.responsibilities.length > 4 && (
                        <Button
                          size="small"
                          onClick={() => setExpandedResponsibilities(!expandedResponsibilities)}
                          sx={{ mt: 1, p: 0, textTransform: 'none', color: 'primary.main' }}
                        >
                          {expandedResponsibilities
                            ? 'Show less'
                            : `Read more (${jobDetails.responsibilities.length - 4} more)`}
                        </Button>
                      )}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No responsibilities listed</Typography>
                  )}
                </Box>

                <Divider />

                {/* Qualifications Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Qualifications
                  </Typography>
                  {jobDetails?.qualifications?.length > 0 ? (
                    <Box>
                      <List disablePadding>
                        {(expandedQualifications
                          ? jobDetails.qualifications
                          : jobDetails.qualifications.slice(0, 4)
                        ).map((qual, index) => (
                          <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                            <ListItemText
                              primary={`• ${qual}`}
                              primaryTypographyProps={{ variant: 'body1' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                      {jobDetails.qualifications.length > 4 && (
                        <Button
                          size="small"
                          onClick={() => setExpandedQualifications(!expandedQualifications)}
                          sx={{ mt: 1, p: 0, textTransform: 'none', color: 'primary.main' }}
                        >
                          {expandedQualifications
                            ? 'Show less'
                            : `Read more (${jobDetails.qualifications.length - 4} more)`}
                        </Button>
                      )}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">No qualifications listed</Typography>
                  )}
                </Box>

                {/* Culture Index Section */}
                {jobDetails?.culture_index && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        Culture Index
                      </Typography>
                      {(() => {
                        const traits = parseDelimitedString(jobDetails.culture_index, ',');
                        const displayTraits = expandedCultureIndex ? traits : traits.slice(0, 3);
                        return (
                          <Box>
                            <List disablePadding>
                              {displayTraits.map((trait, index) => (
                                <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                                  <ListItemText
                                    primary={`• ${trait}`}
                                    primaryTypographyProps={{ variant: 'body1' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                            {traits.length > 3 && (
                              <Button
                                size="small"
                                onClick={() => setExpandedCultureIndex(!expandedCultureIndex)}
                                sx={{ mt: 1, p: 0, textTransform: 'none', color: 'primary.main' }}
                              >
                                {expandedCultureIndex
                                  ? 'Show less'
                                  : `Read more (${traits.length - 3} more)`}
                              </Button>
                            )}
                          </Box>
                        );
                      })()}
                    </Box>
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

      {/* Culture Document / Clifton Strengths Dialog */}
      <Dialog open={cultureDialogOpen} onClose={() => setCultureDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {cultureDialogStep === 'upload' ? 'Upload Culture Document' : 'Confirm CliftonStrengths'}
          <IconButton onClick={() => setCultureDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8, color: (t) => t.palette.grey[500] }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {cultureDialogStep === 'upload' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Upload any culture assessment document (OCAI, Denison, Gallup Q12, etc.) — PDF, DOC, or DOCX.
                The AI will suggest matching CliftonStrengths themes for you to review.
              </Typography>
              <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
                {cultureFile ? cultureFile.name : 'Choose file…'}
                <input type="file" accept=".pdf,.doc,.docx" hidden
                  onChange={(e) => { setCultureFile(e.target.files[0] || null); setCultureUploadError(''); }} />
              </Button>
              {cultureUploadError && <Alert severity="error">{cultureUploadError}</Alert>}
            </Box>
          )}

          {cultureDialogStep === 'confirm' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Review and edit the AI-suggested strengths below. Click a chip to remove it. Then confirm to generate the culture embedding.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {pendingStrengths.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    onDelete={() => setPendingStrengths(prev => prev.filter(x => x !== s))}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
              {jobDetails?.suggested_clifton_strengths?.filter(s => pendingStrengths.includes(s.strength)).length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Why these strengths?
                  </Typography>
                  {jobDetails.suggested_clifton_strengths
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
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCultureDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          {cultureDialogStep === 'upload' && (
            <Button
              variant="contained"
              disabled={!cultureFile || cultureUploading}
              onClick={handleCultureDocUpload}
              sx={{ textTransform: 'none' }}
            >
              {cultureUploading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              {cultureUploading ? 'Uploading…' : 'Upload & Analyze'}
            </Button>
          )}
          {cultureDialogStep === 'confirm' && (
            <Button
              variant="contained"
              disabled={pendingStrengths.length === 0 || cliftonSaving}
              onClick={handleConfirmStrengths}
              sx={{ textTransform: 'none' }}
            >
              {cliftonSaving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              {cliftonSaving ? 'Saving…' : 'Confirm Strengths'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Add Job Modal */}
      <Dialog
        open={showAddJob}
        onClose={() => setShowAddJob(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Job
          <IconButton
            aria-label="close"
            onClick={() => setShowAddJob(false)}
            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
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
        </DialogContent>
      </Dialog>

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
      <Dialog
        open={!!pendingJobReview}
        onClose={() => setPendingJobReview(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Complete Job Details
          <IconButton
            onClick={() => setPendingJobReview(null)}
            sx={{ position: 'absolute', right: 8, top: 8, color: (t) => t.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Some fields could not be extracted from the document. Please fill in any missing details below.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Job Title *"
              fullWidth
              value={reviewFormData.title}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, title: e.target.value }))}
              error={!reviewFormData.title.trim()}
              helperText={!reviewFormData.title.trim() ? 'Required' : ''}
            />
            <TextField
              label="Summary"
              fullWidth
              multiline
              minRows={3}
              value={reviewFormData.summary}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, summary: e.target.value }))}
            />
            <TextField
              label="Locations"
              fullWidth
              value={reviewFormData.locations}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, locations: e.target.value }))}
              helperText="Separate locations with semicolons"
            />
            <TextField
              label="Skills"
              fullWidth
              multiline
              minRows={2}
              value={reviewFormData.skills}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, skills: e.target.value }))}
              helperText="Separate skills with commas"
            />
            <TextField
              label="Minimum Years of Experience"
              fullWidth
              value={reviewFormData.min_years}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, min_years: e.target.value }))}
            />
            <TextField
              label="Responsibilities"
              fullWidth
              multiline
              minRows={4}
              value={reviewFormData.responsibilities}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, responsibilities: e.target.value }))}
              helperText="Enter each responsibility on a new line"
            />
            <TextField
              label="Qualifications"
              fullWidth
              multiline
              minRows={4}
              value={reviewFormData.qualifications}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, qualifications: e.target.value }))}
              helperText="Enter each qualification on a new line"
            />
            <TextField
              label="Culture Index"
              fullWidth
              multiline
              minRows={2}
              value={reviewFormData.culture_index}
              onChange={(e) => setReviewFormData(prev => ({ ...prev, culture_index: e.target.value }))}
              helperText="Separate traits with commas"
            />
          </Box>
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Job Details</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Summary"
              fullWidth
              multiline
              minRows={3}
              value={editFormData.summary}
              onChange={(e) => handleEditFormChange('summary', e.target.value)}
            />
            <TextField
              label="Locations"
              fullWidth
              value={editFormData.locations}
              onChange={(e) => handleEditFormChange('locations', e.target.value)}
              helperText="Separate locations with semicolons"
            />
            <TextField
              label="Skills"
              fullWidth
              multiline
              minRows={2}
              value={editFormData.skills}
              onChange={(e) => handleEditFormChange('skills', e.target.value)}
              helperText="Separate skills with commas"
            />
            <TextField
              label="Minimum Years of Experience"
              fullWidth
              value={editFormData.min_years}
              onChange={(e) => handleEditFormChange('min_years', e.target.value)}
            />
            <TextField
              label="Responsibilities"
              fullWidth
              multiline
              minRows={4}
              value={editFormData.responsibilities}
              onChange={(e) => handleEditFormChange('responsibilities', e.target.value)}
              helperText="Enter each responsibility on a new line"
            />
            <TextField
              label="Qualifications"
              fullWidth
              multiline
              minRows={4}
              value={editFormData.qualifications}
              onChange={(e) => handleEditFormChange('qualifications', e.target.value)}
              helperText="Enter each qualification on a new line"
            />
            <TextField
              label="Culture Index"
              fullWidth
              multiline
              minRows={2}
              value={editFormData.culture_index}
              onChange={(e) => handleEditFormChange('culture_index', e.target.value)}
              helperText="Separate traits with commas"
            />
          </Box>
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Jobs;
