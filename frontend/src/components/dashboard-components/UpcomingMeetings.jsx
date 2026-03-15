import { Box, Typography, Button, List, ListItem, ListItemText, Chip } from '@mui/material';
import { CalendarToday, VideoCall, CalendarMonth } from '@mui/icons-material';
import { CardSection, SectionHeader } from '../common-components/StyledComponents';

function UpcomingMeetings() {
  // MOCK DATA TODO: Replace with real data fetching logic
  const meetings = [
    {
      id: 1,
      title: "Client Interview - TechCorp",
      time: "10:00 AM",
      date: "Today",
      type: "calendly",
      participant: "John Smith"
    },
    {
      id: 2,
      title: "Candidate Screening",
      time: "2:00 PM",
      date: "Today",
      type: "google",
      participant: "Sarah Johnson"
    },
    {
      id: 3,
      title: "Weekly Team Sync",
      time: "9:00 AM",
      date: "Tomorrow",
      type: "google",
      participant: "MLG Team"
    }
  ];

  return (
    <CardSection sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CalendarToday sx={{ mr: 2, color: 'text.secondary' }} />
        <SectionHeader variant="h6" sx={{ mb: 0, flexGrow: 1 }}>
          Upcoming Meetings
        </SectionHeader>
        <Button size="small" variant="outlined" startIcon={<CalendarMonth />}>
          View Calendar
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {meetings.length > 0 ? (
          <List sx={{ p: 0 }}>
            {meetings.map((meeting) => (
              <ListItem
                key={meeting.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 1,
                  backgroundColor: 'grey.50'
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
                        {meeting.date} at {meeting.time}
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
                  label={meeting.type === 'calendly' ? 'Calendly' : 'Google Calendar'}
                  size="small"
                  sx={{
                    backgroundColor: 'action.hover',
                    color: 'text.primary',
                    fontSize: '0.7rem'
                  }}
                />
              </ListItem>
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
    </CardSection>
  );
}

export default UpcomingMeetings;
