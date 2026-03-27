import { useState } from 'react';
import { Box, Typography, Button, List, ListItemButton, ListItemText, Chip, Skeleton } from '@mui/material';
import { CalendarToday, VideoCall, CalendarMonth } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, SectionHeader } from '../common-components/StyledComponents';
import { useMeetings } from '../../hooks/useMeetings';
import MeetingsCalendarDialog from './MeetingsCalendarDialog';

function UpcomingMeetings() {
  const navigate = useNavigate();
  const { meetings, loading } = useMeetings();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleMeetingClick = (meeting) => {
    if (!meeting.candidate_id) return;
    navigate('/candidates', { state: { selectedCandidateId: meeting.candidate_id } });
  };

  const upcoming = meetings.slice(0, 3);

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CalendarToday sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0, flexGrow: 1 }}>
          Upcoming Meetings
        </SectionHeader>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CalendarMonth />}
          onClick={() => setCalendarOpen(true)}
        >
          View Calendar
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 1 }} />)
        ) : upcoming.length > 0 ? (
          <List sx={{ p: 0 }}>
            {upcoming.map((meeting) => (
              <ListItemButton
                key={meeting.event_id}
                onClick={() => handleMeetingClick(meeting)}
                disabled={!meeting.candidate_id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 1,
                  backgroundColor: 'grey.50',
                  '&.Mui-disabled': { opacity: 0.65 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  <VideoCall sx={{ color: 'text.secondary' }} />
                </Box>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" sx={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {meeting.title}
                    </Typography>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" color="text.secondary" component="span">
                        {new Date(meeting.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' at '}
                        {new Date(meeting.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary" component="span">
                        with {meeting.invitee_name}
                      </Typography>
                    </>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
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
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <CalendarToday sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No upcoming meetings
            </Typography>
          </Box>
        )}
      </Box>

      <MeetingsCalendarDialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        meetings={meetings}
      />
    </CardSection>
  );
}

export default UpcomingMeetings;
