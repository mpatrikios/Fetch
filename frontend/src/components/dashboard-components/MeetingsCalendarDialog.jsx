import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { Close as CloseIcon, VideoCall } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function groupByDate(meetings) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const groups = {};
  meetings.forEach((m) => {
    const d = new Date(m.start_time);
    d.setHours(0, 0, 0, 0);
    let label;
    if (d.getTime() === today.getTime()) label = 'Today';
    else if (d.getTime() === tomorrow.getTime()) label = 'Tomorrow';
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  });
  return groups;
}

function MeetingsCalendarDialog({ open, onClose, meetings }) {
  const navigate = useNavigate();
  const grouped = groupByDate(meetings);

  const handleMeetingClick = (meeting) => {
    if (!meeting.candidate_id) return;
    onClose();
    navigate('/candidates', { state: { selectedCandidateId: meeting.candidate_id } });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif' }}>
          All Upcoming Calls
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {Object.keys(grouped).length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">No upcoming meetings scheduled.</Typography>
          </Box>
        ) : (
          Object.entries(grouped).map(([dateLabel, dayMeetings]) => (
            <Box key={dateLabel} sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, display: 'block', mb: 0.5 }}
              >
                {dateLabel}
              </Typography>
              <List disablePadding>
                {dayMeetings.map((meeting) => (
                  <ListItemButton
                    key={meeting.event_id}
                    onClick={() => handleMeetingClick(meeting)}
                    disabled={!meeting.candidate_id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 0.5,
                      '&.Mui-disabled': { opacity: 0.6 },
                    }}
                  >
                    <VideoCall sx={{ mr: 1.5, color: 'text.secondary', flexShrink: 0 }} />
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                          {new Date(meeting.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {' — '}
                          {meeting.invitee_name}
                        </Typography>
                      }
                      secondary={meeting.title}
                    />
                    {!meeting.candidate_id && (
                      <Chip label="Not in DB" size="small" sx={{ fontSize: '0.65rem' }} />
                    )}
                    {meeting.join_url && (
                      <Chip
                        label="Join"
                        size="small"
                        component="a"
                        href={meeting.join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        clickable
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', ml: 1 }}
                      />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Box>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MeetingsCalendarDialog;
