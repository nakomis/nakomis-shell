import { createTheme } from '@mui/material/styles';

// One Dark palette, matching nakom-admin and the Cognito managed login branding.
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#61afef' },
    secondary: { main: '#98c379' },
    error: { main: '#e06c75' },
    warning: { main: '#e5c07b' },
    background: { default: '#282c34', paper: '#21252b' },
    text: { primary: '#dcdfe4', secondary: '#abb2bf' },
  },
  shape: { borderRadius: 8 },
});
