import { Button, Typography, Card } from '@mui/material';
import { styled } from '@mui/material/styles';

// Primary Button - Red background, white text
export const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#FF5A5A',
  color: 'white',
  borderRadius: 20,
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 500,
  textTransform: 'none',
  padding: '12px 24px',
  '&:hover': {
    backgroundColor: 'rgba(255,90,90,0.8)',
  },
  '&:disabled': {
    backgroundColor: 'rgba(255,90,90,0.4)',
  }
}));

// Secondary Button - Red border, red text, white background
export const SecondaryButton = styled(Button)(({ theme }) => ({
  border: '1px solid #FF5A5A',
  color: '#FF5A5A',
  backgroundColor: 'white',
  borderRadius: 20,
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 500,
  textTransform: 'none',
  padding: '12px 24px',
  '&:hover': {
    backgroundColor: 'rgba(255,90,90,0.1)',
    borderColor: '#FF5A5A',
  }
}));

// Section Header - Montserrat font
export const SectionHeader = styled(Typography)(({ theme }) => ({
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 600,
  color: '#343434',
  marginBottom: theme.spacing(3)
}));

// Card Section - Branded card styling
export const CardSection = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  padding: '16px 24px',
  elevation: 1,
  backgroundColor: '#FFFFFF',
  '& .MuiCardContent-root': {
    padding: 0,
    '&:last-child': {
      paddingBottom: 0
    }
  }
}));

// Body Text - Petrona font
export const BodyText = styled(Typography)(({ theme }) => ({
  fontFamily: 'Petrona, serif',
  color: '#343434',
  lineHeight: 1.6
}));

// Secondary Text - Petrona font, lighter color
export const SecondaryText = styled(Typography)(({ theme }) => ({
  fontFamily: 'Petrona, serif',
  color: 'rgba(52,52,52,0.7)',
  lineHeight: 1.6
}));

export default {
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  CardSection,
  BodyText,
  SecondaryText
};