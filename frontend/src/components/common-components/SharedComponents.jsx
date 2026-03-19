import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  CircularProgress
} from '@mui/material';
import { CardSection, DetailPanel } from './StyledComponents';
import { Search, Clear } from '@mui/icons-material';

/**
 * Expandable text display with "Read more/Show less" toggle
 */
export const SummaryDisplay = ({
  summary,
  emptyText = 'No summary available',
  wordLimit = 40
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!summary) {
    return <Typography variant="body1" color="text.secondary">{emptyText}</Typography>;
  }

  const words = summary.split(' ');
  const shouldTruncate = words.length > wordLimit;
  const truncatedSummary = shouldTruncate ? words.slice(0, wordLimit).join(' ') + ' ...' : summary;

  return (
    <Box>
      <Typography variant="body1" color="text.primary" sx={{ mb: shouldTruncate ? 1 : 0 }}>
        {expanded ? summary : truncatedSummary}
      </Typography>
      {shouldTruncate && (
        <Button
          size="small"
          onClick={() => setExpanded(prev => !prev)}
          sx={{
            p: 0,
            textTransform: 'none',
            color: 'primary.main',
            fontSize: '0.875rem',
            minHeight: 'auto',
            lineHeight: 1
          }}
        >
          {expanded ? 'Show less' : 'Read more...'}
        </Button>
      )}
    </Box>
  );
};

/**
 * Search text field with search icon and clear button
 */
export const SearchField = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...'
}) => {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={onClear}
                edge="end"
                aria-label="Clear search"
              >
                <Clear fontSize="small" />
              </IconButton>
            </InputAdornment>
          )
        }
      }}
    />
  );
};

/**
 * Filter dropdown menu with optional search
 */
export const FilterMenu = ({
  anchorEl,
  onClose,
  items,
  selectedItem,
  onSelect,
  allLabel = 'All',
  searchable = false,
  searchPlaceholder = 'Search...',
  width = 220,
  labelFn = null
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = searchable && searchQuery
    ? items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const handleSelect = (item) => {
    onSelect(item);
    handleClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      slotProps={{
        paper: {
          sx: { width }
        }
      }}
    >
      {searchable && (
        <Box sx={{ px: 1, py: 1, position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      edge="end"
                      aria-label="Clear filter search"
                    >
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }
            }}
          />
        </Box>
      )}
      <Box sx={{ maxHeight: searchable ? 250 : 300, overflowY: 'auto' }}>
        <MenuItem
          onClick={() => handleSelect('')}
          selected={selectedItem === ''}
        >
          <em>{allLabel}</em>
        </MenuItem>
        {filteredItems.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No items found
            </Typography>
          </MenuItem>
        ) : (
          filteredItems.map((item) => (
            <MenuItem
              key={item}
              onClick={() => handleSelect(item)}
              selected={selectedItem === item}
            >
              {labelFn ? labelFn(item) : item}
            </MenuItem>
          ))
        )}
      </Box>
    </Menu>
  );
};

/**
 * Empty state display for lists
 */
export const EmptyState = ({
  title = 'No items found',
  subtitle = ''
}) => {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '200px',
      flexDirection: 'column',
      color: 'text.secondary'
    }}>
      <Typography variant="body1" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2">
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Right-side detail panel: handles empty, loading, and content states with overflow scrolling
 */
export const DetailPanelContainer = ({ selected, loading = false, emptyText, children }) => (
  <CardSection sx={{ height: '100%', ml: 2, overflow: 'auto' }}>
    {!selected ? (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
        <Typography>{emptyText}</Typography>
      </Box>
    ) : loading ? (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    ) : (
      <DetailPanel>
        {children}
      </DetailPanel>
    )}
  </CardSection>
);

/**
 * Reusable confirmation dialog (title + message + Cancel + Confirm)
 */
export const ConfirmationDialog = ({
  open, title, content, onConfirm, onCancel,
  loading = false, confirmText = 'Confirm', confirmColor = 'error',
  maxWidth, fullWidth
}) => (
  <Dialog open={open} onClose={onCancel} maxWidth={maxWidth} fullWidth={fullWidth}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      {typeof content === 'string'
        ? <DialogContentText>{content}</DialogContentText>
        : content}
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} disabled={loading}>Cancel</Button>
      <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={loading}>
        {confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

/**
 * Renders a list of skill or strength chips
 */
export const SkillChips = ({ items = [], variant = 'skill', emptyText, highlightItems = [] }) => {
  if (!items.length) {
    return emptyText ? <Typography color="text.secondary">{emptyText}</Typography> : null;
  }
  const highlightSet = new Set(highlightItems.map(h => h.toLowerCase()));
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {items.map((item, i) => {
        const isHighlighted = variant === 'skill' && highlightSet.size > 0 && highlightSet.has(item.toLowerCase());
        const chipSx = isHighlighted
          ? { backgroundColor: 'primary.main', color: 'white' }
          : variant === 'strength'
            ? { backgroundColor: 'success.main', color: 'white' }
            : { borderColor: 'text.primary', color: 'text.primary' };
        return (
          <Chip key={i} label={item} size="small"
            variant={isHighlighted || variant === 'strength' ? 'filled' : 'outlined'}
            sx={chipSx} />
        );
      })}
    </Box>
  );
};

/**
 * Icon button that highlights when filter is active
 */
export const FilterIconButton = ({
  active,
  onClick,
  icon,
  title
}) => {
  const IconComponent = icon;
  return (
    <IconButton
      size="small"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      sx={{
        color: active ? 'primary.main' : 'text.secondary',
        backgroundColor: active ? 'primary.light' : 'transparent',
        '&:hover': { backgroundColor: active ? 'primary.light' : 'grey.100' }
      }}
    >
      <IconComponent fontSize="small" />
    </IconButton>
  );
};
