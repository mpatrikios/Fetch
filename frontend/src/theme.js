import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { 
      main: "#FF5A5A" 
    },
    text: {
      primary: "#343434",
      secondary: "rgba(52,52,52,0.7)"
    },
    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF"
    }
  },
  typography: {
    fontFamily: "Petrona, serif",
    h1: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 600,
      color: "#343434"
    },
    h2: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 600,
      color: "#343434"
    },
    h3: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 500,
      color: "#343434"
    },
    h4: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 500,
      color: "#343434"
    },
    h5: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 500,
      color: "#343434"
    },
    h6: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 500,
      color: "#343434"
    },
    button: { 
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 500,
      textTransform: "none"
    },
    body1: {
      fontFamily: "Petrona, serif",
      color: "#343434"
    },
    body2: {
      fontFamily: "Petrona, serif",
      color: "rgba(52,52,52,0.7)"
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 500,
          textTransform: "none"
        },
        contained: {
          backgroundColor: "#FF5A5A",
          color: "white",
          '&:hover': {
            backgroundColor: "rgba(255,90,90,0.8)"
          }
        },
        outlined: {
          borderColor: "#FF5A5A",
          color: "#FF5A5A",
          backgroundColor: "white",
          '&:hover': {
            backgroundColor: "rgba(255,90,90,0.1)",
            borderColor: "#FF5A5A"
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          padding: "16px 24px",
          elevation: 1
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '&.Mui-focused fieldset': {
              borderColor: "rgba(0, 0, 0, 0.23)"
            }
          },
          '& .MuiInputLabel-root': {
            fontFamily: "Montserrat, sans-serif"
          },
          '& .MuiFormHelperText-root': {
            fontFamily: "Petrona, serif"
          }
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          color: "#343434",
          boxShadow: "none",
          borderBottom: "1px solid rgba(0,0,0,0.1)"
        }
      }
    }
  }
});

export default theme;