import { Chip } from '@mui/material';

function JobStatusChip({ status }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'applied':
        return 'success';
      case 'pending':
        return 'warning';
      case 'interview':
        return 'info';
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Chip 
      label={getStatusLabel(status)} 
      color={getStatusColor(status)}
      size="small"
    />
  );
}

export default JobStatusChip;