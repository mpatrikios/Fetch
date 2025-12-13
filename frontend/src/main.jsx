import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, GlobalStyles } from '@mui/material'
import theme from './theme.js'
import App from './App.jsx'

const globalStyles = (
  <GlobalStyles
    styles={{
      "@import": "url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Petrona:wght@300;400;500;600&display=swap')",
      body: {
        fontFamily: "Petrona, serif"
      }
    }}
  />
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      <App />
    </ThemeProvider>
  </StrictMode>,
)
