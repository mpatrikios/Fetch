import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { ArrowBack, LocationOn, FilterListOff, Work, Description, Edit as EditIcon, InsertDriveFile as FileIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { jobAPI, documentAPI } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem,
  DetailPanel,
  PrimaryButton,
  FileLink
} from './common-components/StyledComponents';
import {
  SummaryDisplay,
  SearchField,
  FilterMenu,
  EmptyState,
  FilterIconButton
} from './common-components/SharedComponents';
import DocumentUpload from './DocumentUpload';
import CompanyNameField from './CompanyNameField';


function Jobs() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [successMessage, setSuccessMessage] = useState('');
  const timeoutRefs = useRef([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

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
      const response = await jobAPI.getDetails(job.company, job.title);
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

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = jobs
      .flatMap(job => job.locations || [])
      .filter(location => location && location.trim() !== '');
    return [...new Set(locations)].sort();
  }, [jobs]);

  // Filter jobs based on search query and location
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = searchQuery === '' ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLocation = selectedLocation === '' ||
        (job.locations || []).includes(selectedLocation);

      return matchesSearch && matchesLocation;
    });
  }, [jobs, searchQuery, selectedLocation]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
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

      const skillsArray = editFormData.skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const locationsArray = editFormData.locations
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const responsibilitiesArray = editFormData.responsibilities
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const qualificationsArray = editFormData.qualifications
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

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
        j.job_id === jobDetails.job_id
          ? { ...j, locations: locationsArray, skills: skillsArray.slice(0, 10) }
          : j
      ));

      setShowEditDialog(false);
      setSuccessMessage('Job updated successfully!');
      timeoutRefs.current.push(setTimeout(() => setSuccessMessage(''), 5000));
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
      await loadJobs();
      setSuccessMessage('Job uploaded successfully!');
      timeoutRefs.current.push(setTimeout(() => setSuccessMessage(''), 5000));
    } catch (err) {
      console.error('Failed to reload jobs after upload:', err);
    }
  }
        
  const SummaryDisplay = ({ summary }) => {
    if (!summary) return <Typography variant="body1" color="text.primary">No summary available</Typography>;

    const words = summary.split(' ');
    const shouldTruncate = words.length > 40;
    const truncatedSummary = shouldTruncate ? words.slice(0, 40).join(' ') + ' ...': summary;

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

  if (error && jobs.length === 0) {
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
          MLG Manage Jobs
        </SectionHeader>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage('')} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Grid container spacing={0} sx={{ height: 'calc(100vh - 200px)' }}>
        {/* Sidebar - Jobs List */}
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
                  {(searchQuery || selectedLocation) && (
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
                    key={job.job_id || index}
                    selected={selectedJob?.job_id === job.job_id}
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
        <Grid size={{ xs: 12, md: 8 }}>
          <CardSection sx={{ height: '100%', ml: 2 }}>
            {!selectedJob ? (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary'
              }}>
                <Typography>Select a job to view details</Typography>
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
                  {jobDetails?.skills?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {jobDetails.skills.map((skill, index) => (
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
                  {jobDetails?.clifton_strengths?.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {jobDetails.clifton_strengths.map((strength, index) => (
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
                    <Typography color="text.secondary">No CliftonStrengths defined</Typography>
                  )}
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
                        const traits = jobDetails.culture_index
                          .split(',')
                          .map(t => t.trim())
                          .filter(t => t.length > 0);
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

              </DetailPanel>
            )}
          </CardSection>
        </Grid>
      </Grid>
      
      {/* Add Job Modal */}
      <Dialog
        open={showAddJob}
        onClose={() => {
          setShowAddJob(false);
          setUploadingJob(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Job
          <IconButton
            aria-label="close"
            onClick={() => setShowAddJob(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
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
                error={companyName.trim() === ""}
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
