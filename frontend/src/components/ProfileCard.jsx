import { 
  Card, 
  CardContent, 
  Box, 
  Typography, 
  Avatar, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Button 
} from '@mui/material';
import { Email, Phone, LocationOn } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function ProfileCard({ user }) {
  const navigate = useNavigate();

  return (
    <Card elevation={3}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar
            sx={{ 
              width: 64, 
              height: 64, 
              mr: 2, 
              bgcolor: '#FF5A5A' 
            }}
          >
            {user?.name?.charAt(0) || 'C'}
          </Avatar>
          <Box>
            <Typography variant="h6" gutterBottom>
              {user?.name || 'Candidate Name'}
            </Typography>
          </Box>
        </Box>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <Email fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={user?.email || 'email@example.com'} />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Phone fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={user?.phone || 'Phone not provided'} />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <LocationOn fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={user?.location || 'Location not provided'} />
          </ListItem>
        </List>
        
        <Button 
          variant="outlined" 
          fullWidth 
          sx={{ mt: 2 }}
          onClick={() => navigate('/profile')}
        >
          Edit Profile
        </Button>
      </CardContent>
    </Card>
  );
}

export default ProfileCard;