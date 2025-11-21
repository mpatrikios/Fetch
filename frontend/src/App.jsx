import { Container, Typography, Box } from '@mui/material';
import ResumeUpload from './components/ResumeUpload';

function App() {
  return (
      <Box>
        {/* Header */}
            <Typography>
              Fetch Recruitment Platform
            </Typography>
          {/* Main Content */}
          <ResumeUpload />
      </Box>
  );
}

export default App;
