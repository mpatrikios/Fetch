import { Button, Typography, Card, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

// Primary Button - Red background, white text
export const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: 'white',
  borderRadius: 20,
  fontFamily: theme.typography.h1.fontFamily,
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
  border: `1px solid ${theme.palette.primary.main}`,
  color: theme.palette.primary.main,
  backgroundColor: theme.palette.background.paper,
  borderRadius: 20,
  fontFamily: theme.typography.h1.fontFamily,
  fontWeight: 500,
  textTransform: 'none',
  padding: '12px 24px',
  '&:hover': {
    backgroundColor: 'rgba(255,90,90,0.1)',
    borderColor: theme.palette.primary.main,
  }
}));

// Dark Button - Dark background for dashboard
export const DarkButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.text.primary,
  color: theme.palette.background.paper,
  borderRadius: 20,
  fontFamily: theme.typography.h1.fontFamily,
  fontWeight: 500,
  textTransform: 'none',
  padding: '8px 16px',
  fontSize: '0.875rem',
  '&:hover': {
    backgroundColor: theme.palette.text.secondary,
  }
}));

// Section Header - Montserrat font
export const SectionHeader = styled(Typography)(({ theme }) => ({
  fontFamily: theme.typography.h1.fontFamily,
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(3)
}));

// Card Section - Branded card styling
export const CardSection = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  padding: '16px 24px',
  elevation: 1,
  backgroundColor: theme.palette.background.paper,
  '& .MuiCardContent-root': {
    padding: 0,
    '&:last-child': {
      paddingBottom: 0
    }
  }
}));

// Dashboard Stat Card - Styled card component
export const DashboardStatCardBase = styled(Card)(({ theme, size = 'large' }) => ({
  padding: size === 'small' ? theme.spacing(2) : theme.spacing(3),
  textAlign: 'center',
  backgroundColor: theme.palette.grey[50],
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center'
}));

// Dashboard Stat Card - Complete component
export const DashboardStatCard = ({ value, label, icon: Icon, size = 'large' }) => {
  const iconSize = size === 'small' ? 24 : 32;
  const valueVariant = size === 'small' ? 'h4' : 'h3';
  const labelVariant = size === 'small' ? 'caption' : 'body1';
  
  return (
    <DashboardStatCardBase size={size}>
      {Icon && <Icon sx={{ fontSize: iconSize, color: 'text.secondary', mb: size === 'small' ? 1 : 2 }} />}
      <Typography variant={valueVariant} sx={{ fontWeight: 'bold', color: 'text.primary', mb: 1 }}>
        {value}
      </Typography>
      <Typography 
        variant={labelVariant} 
        color="text.secondary" 
        sx={{ 
          mt: size === 'small' ? 0 : 1, 
          fontFamily: 'Montserrat, sans-serif' 
        }}
      >
        {label}
      </Typography>
    </DashboardStatCardBase>
  );
};

export default {
  PrimaryButton,
  SecondaryButton,
  DarkButton,
  SectionHeader,
  CardSection,
  DashboardStatCard
};