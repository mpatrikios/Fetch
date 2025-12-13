import { InlineWidget } from 'react-calendly';
import { Box } from '@mui/material';

function CalendlyEmbed({ url, user = null, prefill = {}, pageSettings = {} }) {
  const defaultPageSettings = {
    backgroundColor: 'ffffff',
    hideEventTypeDetails: false,
    hideLandingPageDetails: false,
    primaryColor: '1976d2',
    textColor: '4d5055',
    hideGdprBanner: true,
    ...pageSettings
  };

  const defaultPrefill = {
    email: user?.email || '',
    ...prefill
  };

  return (
    <Box sx={{ minHeight: '600px' }}>
      <InlineWidget
        url={url}
        prefill={defaultPrefill}
        pageSettings={defaultPageSettings}
        styles={{
          height: '600px',
          width: '100%'
        }}
      />
    </Box>
  );
}

export default CalendlyEmbed;