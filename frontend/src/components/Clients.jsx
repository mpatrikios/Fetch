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
  IconButton
} from '@mui/material';
import { ArrowBack, LocationOn, FilterListOff, Business } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { clientAPI } from '../utils/api';
import {
  SectionHeader,
  CardSection,
  SelectableListItem,
  DetailPanel
} from './common-components/StyledComponents';
import {
  SummaryDisplay,
  SearchField,
  FilterMenu,
  EmptyState,
  FilterIconButton
} from './common-components/SharedComponents';

function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationMenuAnchor, setLocationMenuAnchor] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const allLocations = clients.flatMap(client => client.locations || []);
    return [...new Set(allLocations)].filter(loc => loc && loc.trim() !== '').sort();
  }, [clients]);

  // Get unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = clients
      .map(client => client.status)
      .filter(status => status && status.trim() !== '');
    return [...new Set(statuses)].sort();
  }, [clients]);

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
          MLG Manage Clients
        </SectionHeader>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={0} sx={{ height: 'calc(100vh - 200px)' }}>
        {/* Sidebar - Clients List */}
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
        <Grid size={{ xs: 12, md: 8 }}>
          <CardSection sx={{ height: '100%', ml: 2 }}>
            {!selectedClient ? (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary'
              }}>
                <Typography>Select a client to view details</Typography>
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
                  </Box>
                  {clientDetails?.locations?.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {clientDetails.locations.join(', ')}
                    </Typography>
                  )}
                </Box>

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

                <Divider />

                {/* Posted Jobs Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Posted Jobs ({clientDetails?.posted_jobs?.length || 0})
                  </Typography>
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
              </DetailPanel>
            )}
          </CardSection>
        </Grid>
      </Grid>

      {/* Location Filter Menu */}
      <FilterMenu
        anchorEl={locationMenuAnchor}
        onClose={() => setLocationMenuAnchor(null)}
        items={uniqueLocations}
        selectedItem={selectedLocation}
        onSelect={setSelectedLocation}
        allLabel="All locations"
      />
    </Box>
  );
}

export default Clients;
