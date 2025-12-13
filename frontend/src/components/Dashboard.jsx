import { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { authAPI } from '../utils/api';
import ResumeUpload from './ResumeUpload';

const onboardingSteps = [
  {
    label: 'Create profile, upload resume',
    status: 'uploaded_resume',
    description: ''
  },
  {
    label: 'Schedule intake call',
    status: 'scheduled_intake',
    description: 'This is a 30-45 minute call to discuss your search and help us connect you with roles of interest. Just bring yourself!'
  },
  {
    label: 'Complete Clifton Strengths assessment',
    status: 'completed_assessment',
    description: 'A comprehensive strengths assessment tool to help understand your culture and personality. A prepaid link has been sent to your email. Takes about 30-45 minutes.'
  },
  {
    label: 'Upload Clifton Strengths results',
    status: 'uploaded_results',
    description: 'Upload your completed Clifton Strengths Assessment results so we can start matching you with opportunities!'
  },
  {
    label: 'Schedule follow-up call',
    status: 'completed_onboarding',
    description: ''
  }
];

function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showResumeUpload, setShowResumeUpload] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data);
      
      // Determine current step based on user status
      const statusToStepMap = {
        'registered': 0,
        'uploaded_resume': 1,  // When resume uploaded, move to step 1 (schedule intake)
        'scheduled_intake': 2,
        'completed_assessment': 3,
        'uploaded_results': 4,
        'completed_onboarding': 5
      };
      
      const currentStepIndex = statusToStepMap[response.data.status] || 0;
      setCurrentStep(currentStepIndex);
      
      // Show resume upload if status is not yet uploaded_resume
      if (!response.data.status || response.data.status === 'registered') {
        setShowResumeUpload(true);
      }
    } catch (err) {
      setError('Failed to load user data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUploadSuccess = async () => {
    try {
      // Update status to uploaded_resume
      await authAPI.updateStatus('uploaded_resume');
      setShowResumeUpload(false);
      await fetchUserData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getStepIcon = (stepIndex) => {
    if (stepIndex < currentStep) {
      // Completed steps
      return <CheckCircleIcon color="primary" />;
    } else if (stepIndex === currentStep) {
      // Current active step
      return <RadioButtonUncheckedIcon color="primary" />;
    } else {
      // Future steps
      return <RadioButtonUncheckedIcon color="disabled" />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const isOnboardingComplete = user?.status === 'completed_onboarding';

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Welcome, {user?.name}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isOnboardingComplete 
            ? "You've completed the onboarding process. We'll be in touch with opportunities that match your profile."
            : "Let's complete your job placement process"}
        </Typography>
      </Box>

      {/* Show Resume Upload if needed */}
      {showResumeUpload && (
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Upload Your Resume
          </Typography>
          <ResumeUpload onSuccess={handleResumeUploadSuccess} />
        </Paper>
      )}

      {/* Onboarding Progress Box - Only show if not completed */}
      {!isOnboardingComplete && !showResumeUpload && (
        <Paper elevation={2} sx={{ p: 4, backgroundColor: '#f8f9fa' }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Your Job Placement Process
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
            {currentStep} of 5 Steps Complete
          </Typography>

          <Stepper activeStep={currentStep} orientation="vertical">
            {onboardingSteps.map((step, index) => (
              <Step key={step.label} expanded>
                <StepLabel 
                  icon={getStepIcon(index)}
                  optional={
                    step.description && (
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    )
                  }
                >
                  {step.label}
                </StepLabel>
                <StepContent>
                  {index === currentStep && index === 1 && (
                    <Box mt={2}>
                      <Button 
                        variant="contained" 
                        size="small"
                        href="https://calendly.com/your-link" 
                        target="_blank"
                      >
                        Schedule Call
                      </Button>
                    </Box>
                  )}
                  {index === currentStep && index === 2 && (
                    <Box mt={2}>
                      <Button 
                        variant="contained" 
                        size="small"
                        href="https://www.gallup.com/cliftonstrengths" 
                        target="_blank"
                      >
                        Take Assessment
                      </Button>
                    </Box>
                  )}
                  {index === currentStep && index === 3 && (
                    <Box mt={2}>
                      <Button variant="contained" size="small">
                        Upload Results
                      </Button>
                    </Box>
                  )}
                  {index === currentStep && index === 4 && (
                    <Box mt={2}>
                      <Button 
                        variant="contained" 
                        size="small"
                        href="https://calendly.com/your-link" 
                        target="_blank"
                      >
                        Schedule Follow-up
                      </Button>
                    </Box>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {/* Main Content Area - Show when onboarding is complete */}
      {isOnboardingComplete && (
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Your Profile is Complete!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Our team is actively searching for opportunities that match your skills and preferences. 
            We'll notify you as soon as we find suitable positions.
          </Typography>
        </Paper>
      )}
    </Container>
  );
}

export default Dashboard;