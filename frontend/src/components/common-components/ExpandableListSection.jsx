import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';

/**
 * Reusable expandable list section with a "Read more / Show less" toggle.
 * Used for Responsibilities, Qualifications, and Culture Index in Jobs.jsx.
 */
export default function ExpandableListSection({
  title,
  items = [],
  expanded,
  onToggle,
  threshold = 4,
  emptyText = '',
}) {
  const displayItems = expanded ? items : items.slice(0, threshold);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      {items.length > 0 ? (
        <Box>
          <List disablePadding>
            {displayItems.map((item, index) => (
              <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                <ListItemText
                  primary={`• ${item}`}
                  primaryTypographyProps={{ variant: 'body1' }}
                />
              </ListItem>
            ))}
          </List>
          {items.length > threshold && (
            <Button
              size="small"
              onClick={onToggle}
              sx={{ mt: 1, p: 0, textTransform: 'none', color: 'primary.main' }}
            >
              {expanded
                ? 'Show less'
                : `Read more (${items.length - threshold} more)`}
            </Button>
          )}
        </Box>
      ) : (
        emptyText ? <Typography color="text.secondary">{emptyText}</Typography> : null
      )}
    </Box>
  );
}
