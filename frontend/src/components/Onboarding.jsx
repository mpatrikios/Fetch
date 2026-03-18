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
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import DocumentUpload from './DocumentUpload';
import CalendlyEmbed from './CalendlyEmbed';

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

function Onboarding() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [showIntakeCalendly, setShowIntakeCalendly] = useState(false);
  const [showFollowupCalendly, setShowFollowupCalendly] = useState(false);

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
        'uploaded_results': 3,
        'completed_onboarding': 4
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
      await authAPI.updateStatus('onboarding');
      setShowResumeUpload(false);
      await fetchUserData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleMockWebhook = async (eventType) => {
    try {
      let newStatus;
      if (eventType === 'intake') {
        newStatus = 'scheduled_intake';
      } else if (eventType === 'followup') {
        newStatus = 'completed_onboarding';
      }
      
      if (newStatus) {
        await authAPI.updateStatus(newStatus);
        await fetchUserData();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleCliftonUploadSuccess = async () => {
    try {
      // Update status to uploaded_results when CliftonStrengths upload succeeds
      await authAPI.updateStatus('completed_onboarding');
      await fetchUserData();
    } catch (err) {
      console.error('Failed to update status after CliftonStrengths upload:', err);
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

  const isOnboardingComplete = user?.status === 'completed_onboarding';

  // Auto-redirect to dashboard after 5 seconds when onboarding is complete
  useEffect(() => {
    if (isOnboardingComplete) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnboardingComplete, navigate]);

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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Welcome, {user?.full_name}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isOnboardingComplete 
            ? "You've completed the onboarding process. We'll be in touch with opportunities that match your profile."
            : "Let's complete your onboarding process"}
        </Typography>
      </Box>

      {/* Show Resume Upload if needed */}
      {showResumeUpload && (
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Upload Your Resume
          </Typography>
          <DocumentUpload onSuccess={handleResumeUploadSuccess} />
        </Paper>
      )}

      {/* Onboarding Progress Box - Only show if not completed */}
      {!isOnboardingComplete && !showResumeUpload && (
        <Paper elevation={2} sx={{ p: 4, backgroundColor: '#f8f9fa' }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Your Job Placement Process
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
            {currentStep} of 4 Steps Complete
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
                      {!showIntakeCalendly ? (
                        <Button 
                          variant="contained" 
                          size="small"
                          onClick={() => setShowIntakeCalendly(true)}
                        >
                          Schedule Intake Call
                        </Button>
                      ) : (
                        <Box>
                          <Button 
                            variant="text" 
                            size="small"
                            onClick={() => setShowIntakeCalendly(false)}
                            sx={{ mb: 2 }}
                          >
                            Hide Scheduler
                          </Button>
                          {import.meta.env.VITE_CALENDLY_INTAKE_URL ? (
                            <Box>
                              <CalendlyEmbed 
                                url={import.meta.env.VITE_CALENDLY_INTAKE_URL}
                                user={user}
                              />
                              <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                  For testing: Simulate scheduling confirmation
                                </Typography>
                                <Button 
                                  variant="outlined" 
                                  size="small"
                                  color="secondary"
                                  onClick={() => handleMockWebhook('intake')}
                                >
                                  Mock POST API Call
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Alert severity="error" sx={{ mb: 2 }}>
                              The intake call scheduling link is not configured. Please contact support or try again later.
                            </Alert>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                  {index === currentStep && index === 2 && (
                    <Box mt={2}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Please upload your completed CliftonStrengths assessment results:
                      </Typography>
                      <DocumentUpload 
                        onSuccess={handleCliftonUploadSuccess}
                        acceptedFileTypes=".pdf,.doc,.docx"
                        uploadType="cliftonstrengths"
                      />
                    </Box>
                  )}
                  {index === currentStep && index === 3 && (
                    <Box mt={2}>
                      {!showFollowupCalendly ? (
                        <Button 
                          variant="contained" 
                          size="small"
                          onClick={() => setShowFollowupCalendly(true)}
                        >
                          Schedule Follow-up Call
                        </Button>
                      ) : (
                        <Box>
                          <Button 
                            variant="text" 
                            size="small"
                            onClick={() => setShowFollowupCalendly(false)}
                            sx={{ mb: 2 }}
                          >
                            Hide Scheduler
                          </Button>
                          {import.meta.env.VITE_CALENDLY_FOLLOWUP_URL ? (
                            <Box>
                              <CalendlyEmbed 
                                url={import.meta.env.VITE_CALENDLY_FOLLOWUP_URL}
                                user={user}
                              />
                              <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                  For testing: Simulate scheduling confirmation
                                </Typography>
                                <Button 
                                  variant="outlined" 
                                  size="small"
                                  color="secondary"
                                  onClick={() => handleMockWebhook('followup')}
                                >
                                  Mock POST API Call
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Alert severity="error" sx={{ mb: 2 }}>
                              The follow-up call scheduling link is not configured. Please contact support or try again later.
                            </Alert>
                          )}
                        </Box>
                      )}
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
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Redirecting you to your dashboard...
          </Typography>
        </Paper>
      )}
    </Container>
  );
}

export default Onboarding;