import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { WebStorageStateStore } from 'oidc-client-ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter } from 'react-router';
import { App, type SignInState } from './App';
import { authorityFor, loadRemoteDefinitions, loadShellConfig } from './config';
import { registerRemoteDefinitions } from './remotes/loadRemote';
import { theme } from './theme';

const root = createRoot(document.getElementById('root') as HTMLElement);

async function start() {
  const [config, remotes] = await Promise.all([loadShellConfig(), loadRemoteDefinitions()]);
  registerRemoteDefinitions(remotes);
  const origin = window.location.origin;

  root.render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider
          authority={authorityFor(config)}
          client_id={config.clientId}
          redirect_uri={`${origin}/loggedin`}
          post_logout_redirect_uri={`${origin}/`}
          response_type="code"
          scope="openid email profile"
          automaticSilentRenew
          userStore={new WebStorageStateStore({ store: window.sessionStorage })}
          onSigninCallback={(user) => {
            const requested = (user?.state as SignInState | undefined)?.returnTo ?? '/';
            // Same-origin paths only: "//evil.example" would make replaceState throw (or worse).
            const returnTo = `/${requested.replace(/^\/+/, '')}`;
            window.history.replaceState({}, document.title, returnTo);
            // Let the router pick up the new location.
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        >
          <BrowserRouter>
            <App config={config} remotes={remotes} />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

start().catch((err: Error) => {
  root.render(
    <p style={{ fontFamily: 'sans-serif', color: '#e06c75', padding: 16 }}>Failed to start: {err.message}</p>,
  );
});
