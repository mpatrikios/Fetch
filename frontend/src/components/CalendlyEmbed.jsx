import { InlineWidget } from 'react-calendly';
import { Box } from '@mui/material';

/**
 * Embeds a Calendly scheduling widget with customizable prefill and page settings.
 *
 * @param {Object} props - The component props.
 * @param {string} props.url - The Calendly scheduling URL to embed.
 * @param {Object} [props.user=null] - Optional user object, used to prefill the email field.
 *   @property {string} [email] - The user's email address to prefill in the Calendly form.
 * @param {Object} [props.prefill={}] - Optional object to prefill additional Calendly fields (e.g., name, email).
 *   See Calendly InlineWidget documentation for supported fields.
 * @param {Object} [props.pageSettings={}] - Optional object to customize the appearance and behavior of the Calendly widget.
 *   See Calendly InlineWidget documentation for supported settings (e.g., colors, visibility of details).
 * @returns {JSX.Element} The Calendly embed widget.
 */
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
    name: user?.name || '',
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