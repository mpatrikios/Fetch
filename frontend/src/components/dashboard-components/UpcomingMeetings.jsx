import { useEffect, useState } from 'react';
import { Box, Typography, Button, List, ListItem, ListItemText, Chip, CircularProgress } from '@mui/material';
import { CalendarToday, VideoCall, CalendarMonth } from '@mui/icons-material';
import { CardSection, SectionHeader } from '../common-components/StyledComponents';
import { calendlyAPI } from '../../utils/api';

function formatDateTime(isoString) {
  const date = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const dateLabel = isToday
    ? 'Today'
    : isTomorrow
    ? 'Tomorrow'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const timeLabel = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { dateLabel, timeLabel };
}

function UpcomingMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    calendlyAPI.getUpcoming()
      .then((res) => setMeetings(res.data))
      .catch(() => setError('Could not load meetings.'))
      .finally(() => setLoading(false));
  }, []);

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
          onClick={() => window.open('https://calendly.com/app/scheduled_events', '_blank')}
        >
          View Calendar
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Typography variant="body2" color="text.secondary">{error}</Typography>
          </Box>
        ) : meetings.length > 0 ? (
          <List sx={{ p: 0 }}>
            {meetings.map((meeting) => {
              const { dateLabel, timeLabel } = formatDateTime(meeting.start_time);
              return (
                <ListItem
                  key={meeting.id}
                  onClick={() => window.open(meeting.event_url, '_blank')}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    mb: 1,
                    backgroundColor: 'grey.50',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
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
                          {dateLabel} at {timeLabel}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary" component="span">
                          with {meeting.participant}
                        </Typography>
                      </>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                  <Chip
                    label="Calendly"
                    size="small"
                    sx={{
                      backgroundColor: 'action.hover',
                      color: 'text.primary',
                      fontSize: '0.7rem',
                    }}
                  />
                </ListItem>
              );
            })}
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
    </CardSection>
  );
}

export default UpcomingMeetings;
