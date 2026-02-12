import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
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
