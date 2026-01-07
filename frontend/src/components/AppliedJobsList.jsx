import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Divider
} from '@mui/material';
import { Work, Schedule, TrendingUp, CheckCircle, Cancel } from '@mui/icons-material';
import JobStatusChip from './JobStatusChip';

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
    <Card elevation={3} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <Work sx={{ mr: 1 }} />
          Applied Jobs & Status
        </Typography>
        
        {appliedJobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No applications yet.
          </Typography>
        ) : (
          <List>
            {appliedJobs.map((job, index) => (
              <div key={job.id}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    {getStatusIcon(job.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">
                          {job.title} at {job.company}
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
      </CardContent>
    </Card>
  );
}

export default AppliedJobsList;