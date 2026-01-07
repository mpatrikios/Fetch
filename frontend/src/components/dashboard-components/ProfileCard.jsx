import { 
  Box, 
  Typography, 
  Avatar, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText
} from '@mui/material';
import { Email, Phone, LocationOn } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CardSection, SecondaryButton } from '../common-components/StyledComponents';

function ProfileCard({ user }) {
  const navigate = useNavigate();

  return (
    <CardSection>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Avatar
          sx={{ 
            width: 64, 
            height: 64, 
            mr: 2, 
            bgcolor: 'primary.main' 
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
      
      <SecondaryButton 
        fullWidth 
        sx={{ mt: 2 }}
        onClick={() => navigate('/profile')}
      >
        Edit Profile
      </SecondaryButton>
    </CardSection>
  );
}

export default ProfileCard;