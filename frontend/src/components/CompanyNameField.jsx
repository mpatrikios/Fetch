import { useState, useRef, useEffect } from "react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
const CompanyNameField = ({
  label = "Company Name",
  value,
  onChange,
  options,
  required,
  error,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = open && filteredOptions.length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <TextField
        label={label}
        fullWidth
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        required={required}
        error={error}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={open ? "close suggestions" : "open suggestions"}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => setOpen((prev) => !prev)}
                >
                  {open ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowLeftIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      {showDropdown && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1400,
            maxHeight: 200,
            overflowY: "auto",
            mt: 0.5,
          }}
        >
          <MenuList dense disablePadding>
            {filteredOptions.map((opt) => (
              <MenuItem
                key={opt}
                selected={opt === value}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </MenuItem>
            ))}
          </MenuList>
        </Paper>
      )}
    </div>
  );
};

export default CompanyNameField;