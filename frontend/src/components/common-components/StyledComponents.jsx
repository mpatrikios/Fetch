import { Button, Typography, Card, Box, Link, TextareaAutosize } from '@mui/material';
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
    backgroundColor: `${theme.palette.primary.main}CC`, // 80% opacity
  },
  '&:disabled': {
    backgroundColor: `${theme.palette.primary.main}66`, // 40% opacity
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
    backgroundColor: `${theme.palette.primary.main}1A`, // 10% opacity
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

// Card Section - Branded card styling with default elevation
const CardSectionBase = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  padding: '16px 24px',
  backgroundColor: theme.palette.background.paper,
  '& .MuiCardContent-root': {
    padding: 0,
    '&:last-child': {
      paddingBottom: 0
    }
  }
}));

export const CardSection = (props) => (
  <CardSectionBase elevation={1} {...props} />
);

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
          mt: size === 'small' ? 0 : 1
        }}
      >
        {label}
      </Typography>
    </DashboardStatCardBase>
  );
};

// Selectable List Item - Generic list item for sidebar lists
export const SelectableListItem = styled(Box)(({ theme, selected = false }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.grey[200]}`,
  cursor: 'pointer',
  backgroundColor: selected ? theme.palette.grey[100] : theme.palette.background.paper,
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: selected ? theme.palette.grey[100] : theme.palette.grey[50],
  },
  '&:last-child': {
    borderBottom: 'none',
  }
}));

// Detail Panel Container - Generic container for detail view content
export const DetailPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

// File Link - Generic styled link component for file downloads/views
export const FileLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontFamily: theme.typography.h1.fontFamily,
  fontWeight: 500,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderRadius: 8,
  border: `1px solid ${theme.palette.primary.main}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: `${theme.palette.primary.main}1A`,
    textDecoration: 'none',
  }
}));

// Notes Field - Generic styled textarea for notes
export const NotesField = styled(TextareaAutosize)(({ theme }) => ({
  width: '100%',
  minHeight: '200px',
  padding: theme.spacing(2),
  borderRadius: 8,
  border: `1px solid ${theme.palette.grey[300]}`,
  fontFamily: theme.typography.body1.fontFamily,
  fontSize: '1rem',
  color: theme.palette.text.primary,
  resize: 'vertical',
  '&:focus': {
    outline: 'none',
    borderColor: theme.palette.primary.main,
  },
  '&::placeholder': {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  }
}));

export default {
  PrimaryButton,
  SecondaryButton,
  DarkButton,
  SectionHeader,
  CardSection,
  DashboardStatCard,
  SelectableListItem,
  DetailPanel,
  FileLink,
  NotesField
};