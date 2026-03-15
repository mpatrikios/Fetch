import { useState } from 'react';
import {
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Divider,
  IconButton,
  Tooltip,
  DialogContentText,
} from '@mui/material';
import { Work, Schedule, TrendingUp, CheckCircle, Cancel, UndoOutlined } from '@mui/icons-material';
import JobStatusChip from './JobStatusChip';
import { CardSection, SectionHeader } from '../common-components/StyledComponents';
import { ConfirmationDialog } from '../common-components/SharedComponents';
import { profileAPI } from '../../utils/api';

function AppliedJobsList({ appliedJobs, onRefresh }) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(null); // rec doc being confirmed
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdrawConfirm = async () => {
    if (!confirmWithdraw) return;
    try {
      setWithdrawing(true);
      await profileAPI.withdrawApplication(confirmWithdraw._id);
      setConfirmWithdraw(null);
      if (onRefresh) onRefresh();
    } catch {
      // silently close; dashboard will still show the item
      setConfirmWithdraw(null);
    } finally {
      setWithdrawing(false);
    }
  };
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
                          {job.job_title || job.title} at {job.company_name || job.company}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <JobStatusChip status={job.status} />
                          <Tooltip title="Withdraw application">
                            <IconButton size="small" onClick={() => setConfirmWithdraw(job)}>
                              <UndoOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < appliedJobs.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        )}
      <ConfirmationDialog
        open={!!confirmWithdraw}
        title="Withdraw Application"
        content={<DialogContentText>Withdraw your application for <strong>{confirmWithdraw?.job_title}</strong> at <strong>{confirmWithdraw?.company_name}</strong>? This cannot be undone.</DialogContentText>}
        onConfirm={handleWithdrawConfirm}
        onCancel={() => setConfirmWithdraw(null)}
        loading={withdrawing}
        confirmText="Withdraw"
      />
    </CardSection>
  );
}

export default AppliedJobsList;