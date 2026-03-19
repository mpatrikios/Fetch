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
  const [successMessage, showSuccess] = useAutoHideMessage(5000);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setHasMatchesFilter(params.get('filter') === 'has_matches');
  }, [location.search]);

  useEffect(() => {
    loadJobs();
  }, []);

  const handleJobSelect = useCallback(async (job) => {
    if (selectedJob?.job_id === job.job_id) return;

    setSelectedJob(job);
    setDetailsLoading(true);
    setJobDetails(null);
    setExpandedResponsibilities(false);
    setExpandedQualifications(false);
    setExpandedCultureIndex(false);
    setShowAddJob(false);

    try {
      const response = await jobAPI.getDetails(job.mongo_id);
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
    navigate(`/jobs/${encodeURIComponent(jobDetails.company)}/${encodeURIComponent(jobDetails.title)}/matches`);
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

  const handleJobUploadSuccess = async (newJob) => {
    try {
      setShowAddJob(false);
      const response = await jobAPI.getDetails(newJob.mongo_id);
      setJobDetails(response.data.job);
      setJobs(prev => [...prev, response.data.job]);
      showSuccess('Job uploaded successfully!');
    } catch (err) {
      console.error('Failed to reload jobs after upload:', err);
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
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    CliftonStrengths
                  </Typography>
                  <SkillChips items={jobDetails?.clifton_strengths} variant="strength" emptyText="No CliftonStrengths defined" />
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
                  {jobDetails?.has_description ? (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
