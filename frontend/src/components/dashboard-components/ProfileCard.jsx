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
import { CardSection, SecondaryButton, FileLink } from '../common-components/StyledComponents';
import { myDocumentAPI } from '../../utils/api.js';
import { InsertDriveFile as FileIcon } from '@mui/icons-material';
function ProfileCard({ user }) {
  const navigate = useNavigate();
  const documents = [
    ...(user?.has_resume
      ? [{ name: `${user.full_name.replace(/\s+/g, '_')} Resume`, type: 'resume' }]
      : []),
    ...(user?.has_clifton_doc
      ? [{ name: `${user.full_name.replace(/\s+/g, '_')} CliftonStrengths`, type: 'clifton' }]
      : []),
  ];
  // Download document from blob storage
  const handleDocumentDownload = async (docType, myId) => {
    try {
      const apiCall = {
        resume: myDocumentAPI.getMyResumeDownloadUrl,
        clifton: myDocumentAPI.getMyCliftonDownloadUrl,
      }[docType];

      if (!apiCall) return;

      const response = await apiCall(myId);
      window.open(response.data.download_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      setErrorMessage('Failed to download document.');
      timeoutRefs.current.push(setTimeout(() => setErrorMessage(''), 5000));
    }
  };
  
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
          {user?.full_name?.charAt(0) || 'C'}
        </Avatar>
        <Box>
          <Typography variant="h6" gutterBottom>
            {user?.full_name || 'Candidate Name'}
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
        <ListItem>
          <ListItemIcon>
            <FileIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={"Documents"}/>
        </ListItem>
        <ListItem>
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column'}}>
            {documents?.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {documents.map((doc, index) => (
                  <FileLink
                    key={index}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentDownload(doc.type, user?.id);
                    }}
                    style={{ marginRight: 8, fontSize: '0.85rem' }}
                  >
                    {doc.name}
                  </FileLink>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" fontSize="0.85rem">No documents uploaded</Typography>
            )}
          </Box>
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