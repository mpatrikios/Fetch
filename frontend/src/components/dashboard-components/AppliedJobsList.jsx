import {
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Divider,
} from '@mui/material';
import { Work, Schedule, TrendingUp, CheckCircle, Cancel } from '@mui/icons-material';
import JobStatusChip from './JobStatusChip';
import { CardSection, SectionHeader } from '../common-components/StyledComponents';

function AppliedJobsList({ appliedJobs }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Schedule color="warning" />;
      case 'interview':
        return <TrendingUp color="info" />;
      case 'accepted':
        return <CheckCircle color="success" />;
      case 'rejected':
        return <Cancel color="error" />;
      default:
        return <Schedule color="disabled" />;
    }
  };

  return (
    <CardSection sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Work sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0 }}>
          Applied Jobs & Status
        </SectionHeader>
      </Box>

        {appliedJobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No applications yet.
          </Typography>
        ) : (
          <List>
            {appliedJobs.map((job, index) => (
              <div key={job._id || job.id}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    {getStatusIcon(job.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">
                          {job.job_title} at {job.company_name}
                        </Typography>
                        <JobStatusChip status={job.status} />
                      </Box>
                    }
                  />
                </ListItem>
                {index < appliedJobs.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        )}
    </CardSection>
  );
}

export default AppliedJobsList;
