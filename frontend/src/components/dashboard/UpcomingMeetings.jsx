import { Box, Typography, Card, List, ListItem, ListItemText, Chip } from '@mui/material';
import { CalendarToday, VideoCall } from '@mui/icons-material';
import { CardSection } from '../ui/StyledComponents';

function UpcomingMeetings() {
  // Placeholder data - will be replaced with real API calls
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CalendarToday sx={{ mr: 2, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
          Upcoming Meetings
        </Typography>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {meetings.length > 0 ? (
          <List sx={{ p: 0 }}>
            {meetings.map((meeting) => (
              <ListItem 
                key={meeting.id} 
                sx={{ 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 2, 
                  mb: 1,
                  backgroundColor: '#fafafa'
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
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {meeting.date} at {meeting.time}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        with {meeting.participant}
                      </Typography>
                    </Box>
                  }
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