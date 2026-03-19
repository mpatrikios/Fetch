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
  List,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { ArrowBack, LocationOn, FilterListOff, Business, Edit as EditIcon } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useLocation } from 'react-router-dom';
import { clientAPI, parseDelimitedString, getUniqueValues } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem
} from './common-components/StyledComponents';
import {
  SummaryDisplay,
  SearchField,
  FilterMenu,
  EmptyState,
  FilterIconButton,
  ConfirmationDialog,
  DetailPanelContainer
} from './common-components/SharedComponents';
import { useAutoHideMessage } from '../hooks/useAutoHideMessage';
import DocumentUpload from './DocumentUpload';

function Clients() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationMenuAnchor, setLocationMenuAnchor] = useState(null);
  const [showAddJob, setShowAddJob] = useState(false);
  // Initialize statusFilter from URL query param
  const searchParams = new URLSearchParams(location.search);
  const initialStatus = searchParams.get('status') || '';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    company_name: '',
    status: '',
    contact_email: '',
    contact_number: '',
    contact_recruiter: '',
    summary: '',
    locations: '',
    intake_call_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [activateWarnings, setActivateWarnings] = useState([]);
  const [successMessage, showSuccess] = useAutoHideMessage(5000);

  useEffect(() => {
    loadClients();
  }, []);

  const uniqueLocations = useMemo(() => getUniqueValues(clients, 'locations'), [clients]);
  const uniqueStatuses = useMemo(() => getUniqueValues(clients, 'status'), [clients]);

  // Filter clients based on search query, location, and status
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = searchQuery === '' ||
        client.company_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLocation = selectedLocation === '' ||
        (client.locations && client.locations.includes(selectedLocation));

      const matchesStatus = statusFilter === '' ||
        client.status === statusFilter;

      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [clients, searchQuery, selectedLocation, statusFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('');
  };

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'onboarding':
        return 'info';
      case 'inactive':
        return 'default';
      default:
        return 'default';
    }
  };

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await clientAPI.list();
      setClients(response.data.clients || []);
    } catch (err) {
      setError('Failed to load clients');
      console.error('Load clients error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = async (client) => {
    if (selectedClient?.id === client.id) return;

    setSelectedClient(client);
    setDetailsLoading(true);
    setClientDetails(null);
    setShowAddJob(false);

    try {
      const response = await clientAPI.getDetails(client.id);
      setClientDetails(response.data.client);
    } catch (err) {
      console.error('Load client details error:', err);
      setError('Failed to load client details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditClick = () => {
    if (!clientDetails) return;
    setEditFormData({
      company_name: clientDetails.company_name ?? '',
      status: clientDetails.status ?? '',
      contact_email: clientDetails.contact_email ?? '',
      contact_number: clientDetails.contact_number ?? '',
      contact_recruiter: clientDetails.contact_recruiter ?? '',
      summary: clientDetails.summary ?? '',
      locations: (clientDetails.locations ?? []).join('; '),
      intake_call_notes: clientDetails.intake_call_notes ?? '',
    });
    setShowEditDialog(true);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveClient = async () => {
    if (!clientDetails) return;

    try {
      setSaving(true);
      setError('');

      const locationsArray = parseDelimitedString(editFormData.locations, ';');

      const updatePayload = {
        company_name: editFormData.company_name,
        status: editFormData.status,
        contact_email: editFormData.contact_email,
        contact_number: editFormData.contact_number,
        contact_recruiter: editFormData.contact_recruiter,
        summary: editFormData.summary,
        locations: locationsArray,
        intake_call_notes: editFormData.intake_call_notes,
      };

      await clientAPI.updateClient(clientDetails.id, updatePayload);

      setClientDetails(prev => ({
        ...prev,
        company_name: editFormData.company_name,
        status: editFormData.status,
        contact_email: editFormData.contact_email,
        contact_number: editFormData.contact_number,
        contact_recruiter: editFormData.contact_recruiter,
        summary: editFormData.summary,
        locations: locationsArray,
        intake_call_notes: editFormData.intake_call_notes,
      }));

      setClients(prev => prev.map(c =>
        c.id === clientDetails.id
          ? { ...c, company_name: editFormData.company_name, status: editFormData.status, contact_email: editFormData.contact_email, locations: locationsArray }
          : c
      ));

      setSelectedClient(prev => ({
        ...prev,
        company_name: editFormData.company_name,
        status: editFormData.status,
        locations: locationsArray,
      }));

      setShowEditDialog(false);
      showSuccess('Client updated successfully!');
    } catch (err) {
      console.error('Update client error:', err);
      setError('Failed to update client. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateClick = () => {
    const warnings = [];
    if (!clientDetails.contact_recruiter) warnings.push('Recruiter not assigned');
    if (!clientDetails.intake_call_notes) warnings.push('Intake call notes not added');
    setActivateWarnings(warnings);
    setShowActivateDialog(true);
  };

  const handleConfirmActivate = async () => {
    try {
      setActivating(true);
      const response = await clientAPI.activate(clientDetails.id);
      const activatedAt = response.data.activated_at;

      setClientDetails(prev => ({ ...prev, status: 'active', activated_at: activatedAt }));
      setClients(prev => prev.map(c =>
        c.id === clientDetails.id ? { ...c, status: 'active' } : c
      ));
      setSelectedClient(prev => ({ ...prev, status: 'active' }));
      setShowActivateDialog(false);
      showSuccess(`${clientDetails.company_name} has been activated!`);
    } catch (err) {
      console.error('Activate client error:', err);
      setError('Failed to activate client. Please try again.');
      setShowActivateDialog(false);
    } finally {
      setActivating(false);
    }
  };

  const handleJobUploadSuccess = async (newJobTitle) => {
    try {
      setShowAddJob(false);
      const jobUpdatePayload = {
        posted_jobs: [...(clientDetails.posted_jobs || []), newJobTitle]
      };
      await clientAPI.updateClient(clientDetails.id, jobUpdatePayload);

      let response = await clientAPI.getDetails(clientDetails.id);
      setClientDetails(response.data.client);
      showSuccess('Job uploaded successfully!');
    } catch (err) {
      console.error('Failed to reload client after upload:', clientDetails.id, err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && clients.length === 0) {
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
          MLG Manage Clients
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
        {/* Sidebar - Clients List */}
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
                  Clients
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({filteredClients.length} of {clients.length})
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
                </Box>
              </Box>

              {/* Status Filter */}
              {uniqueStatuses.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant={statusFilter === '' ? 'contained' : 'outlined'}
                      onClick={() => setStatusFilter('')}
                      sx={{
                        minWidth: 'auto',
                        px: 2,
                        py: 0.5,
                        fontSize: '0.75rem',
                        textTransform: 'capitalize',
                        borderRadius: 1
                      }}
                    >
                      All
                    </Button>
                    {uniqueStatuses.map((status) => (
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
                        {status}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Search Field */}
              <SearchField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search by company name..."
              />
            </Box>

            {/* Clients List */}
            <Box sx={{
              overflowY: 'auto',
              height: 'calc(100% - 160px)',
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'grey.300',
                borderRadius: '3px'
              }
            }}>
              {filteredClients.length === 0 ? (
                <EmptyState
                  title="No clients found"
                  subtitle={searchQuery || selectedLocation ? 'Try adjusting your search or filters' : 'No clients available'}
                />
              ) : (
                filteredClients.map((client, index) => (
                  <SelectableListItem
                    key={client.id || index}
                    selected={selectedClient?.id === client.id}
                    onClick={() => handleClientSelect(client)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {client.company_name}
                        </Typography>
                        {client.locations?.length > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            {client.locations[0]}{client.locations.length > 1 ? ` +${client.locations.length - 1} more` : ''}
                          </Typography>
                        )}
                        {client.posted_jobs_count > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {client.posted_jobs_count} posted job{client.posted_jobs_count !== 1 ? 's' : ''}
                          </Typography>
                        )}
                      </Box>
                      {client.status && (
                        <Chip
                          label={client.status}
                          size="small"
                          color={getStatusColor(client.status)}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </SelectableListItem>
                ))
              )}
            </Box>
          </CardSection>
        </Grid>

        {/* Main Content - Client Details */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ height: '100%' }}>
          <DetailPanelContainer selected={selectedClient} loading={detailsLoading} emptyText="Select a client to view details">
                {/* Client Header */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Business sx={{ fontSize: 32, color: 'text.secondary' }} />
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {clientDetails?.company_name}
                    </Typography>
                    {clientDetails?.status && (
                      <Chip
                        label={clientDetails.status}
                        size="small"
                        color={getStatusColor(clientDetails.status)}
                      />
                    )}
                    <IconButton
                      size="small"
                      onClick={handleEditClick}
                      title="Edit client"
                      aria-label="Edit client"
                      sx={{ ml: 'auto' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {clientDetails?.locations?.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {clientDetails.locations.join(', ')}
                    </Typography>
                  )}
                </Box>

                {/* Onboarding activation banner */}
                {clientDetails?.status?.toLowerCase() === 'onboarding' && (() => {
                  const missing = [
                    !clientDetails.contact_recruiter && 'recruiter not assigned',
                    !clientDetails.intake_call_notes && 'intake notes missing',
                  ].filter(Boolean);
                  return (
                    <Alert
                      severity={missing.length > 0 ? 'warning' : 'success'}
                      sx={{ borderRadius: 0, mx: -3, px: 3 }}
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={handleActivateClick}
                          disabled={activating}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          {activating ? 'Activating...' : 'Activate Client'}
                        </Button>
                      }
                    >
                      {missing.length > 0
                        ? `Onboarding incomplete: ${missing.join(', ')}.`
                        : 'Onboarding complete — ready to activate.'}
                    </Alert>
                  );
                })()}

                <Divider />

                {/* Summary Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Summary
                  </Typography>
                  <SummaryDisplay summary={clientDetails?.summary} />
                </Box>

                <Divider />

                {/* Contact Information Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Contact Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                        Email:
                      </Typography>
                      <Typography variant="body1">
                        {clientDetails?.contact_email || 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                        Phone:
                      </Typography>
                      <Typography variant="body1">
                        {clientDetails?.contact_number || 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                        Recruiter:
                      </Typography>
                      <Typography variant="body1">
                        {clientDetails?.contact_recruiter || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Posted Jobs Section */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Posted Jobs ({clientDetails?.posted_jobs?.length || 0})
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowAddJob(true)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        color: 'primary.main',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        }
                      }}
                    >
                      + Add New Job
                    </Button>
                  </Box>
                  {clientDetails?.posted_jobs?.length > 0 ? (
                    <List disablePadding>
                      {clientDetails.posted_jobs.map((job, index) => (
                        <SelectableListItem
                          key={index}
                          sx={{
                            py: 0.5,
                            px: 1,
                            cursor: 'pointer',
                            borderRadius: 1,
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'primary.main',
                            }
                          }}
                          onClick={() => navigate('/jobs', {
                            state: { selectedJobTitle: job, selectedCompany: clientDetails.company_name }
                          })}
                        >
                          {job}
                        </SelectableListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">No jobs posted yet</Typography>
                  )}
                </Box>
          </DetailPanelContainer>
        </Grid>
      </Grid>
      </Box>

      {/* Location Filter Menu */}
      <FilterMenu
        anchorEl={locationMenuAnchor}
        onClose={() => setLocationMenuAnchor(null)}
        items={uniqueLocations}
        selectedItem={selectedLocation}
        onSelect={setSelectedLocation}
        allLabel="All locations"
      />

      {/* Activate Client Confirmation Dialog */}
      <ConfirmationDialog
        open={showActivateDialog}
        title="Activate Client"
        content={activateWarnings.length > 0 ? (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Some onboarding steps are incomplete:
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {activateWarnings.map(w => <li key={w}>{w}</li>)}
              </ul>
            </Alert>
            <Typography variant="body2">Activate {clientDetails?.company_name} anyway?</Typography>
          </Box>
        ) : (
          <Typography variant="body2">
            Activate <strong>{clientDetails?.company_name}</strong> as an active client?
          </Typography>
        )}
        onConfirm={handleConfirmActivate}
        onCancel={() => setShowActivateDialog(false)}
        loading={activating}
        confirmText="Activate"
        confirmColor="success"
        maxWidth="xs"
        fullWidth
      />

      {/* Edit Client Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={(event, reason) => {
          if (saving && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
            return;
          }
          setShowEditDialog(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Client</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Company Name"
              fullWidth
              value={editFormData.company_name}
              onChange={(e) => handleEditFormChange('company_name', e.target.value)}
            />
            <TextField
              label="Status"
              fullWidth
              value={editFormData.status}
              onChange={(e) => handleEditFormChange('status', e.target.value)}
            />
            <TextField
              label="Contact Email"
              fullWidth
              value={editFormData.contact_email}
              onChange={(e) => handleEditFormChange('contact_email', e.target.value)}
            />
            <TextField
              label="Contact Phone"
              fullWidth
              value={editFormData.contact_number}
              onChange={(e) => handleEditFormChange('contact_number', e.target.value)}
            />
            <TextField
              label="Contact Recruiter"
              fullWidth
              value={editFormData.contact_recruiter}
              onChange={(e) => handleEditFormChange('contact_recruiter', e.target.value)}
            />
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
              multiline
              minRows={2}
              value={editFormData.locations}
              onChange={(e) => handleEditFormChange('locations', e.target.value)}
              helperText="Separate locations with semicolons"
            />
            <TextField
              label="Intake Call Notes"
              fullWidth
              multiline
              minRows={3}
              value={editFormData.intake_call_notes}
              onChange={(e) => handleEditFormChange('intake_call_notes', e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveClient}
            variant="contained"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Job Dialog */}
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
          <DocumentUpload
            uploadType="job_description"
            companyName={clientDetails?.company_name || ''}
            onSuccess={(data) => handleJobUploadSuccess(data?.job?.title || 'Unknown Job Title')}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Clients;
