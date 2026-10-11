import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Route, Routes, useLocation } from 'react-router';
import type { RemoteDefinition, ShellConfig } from '../../contract/shell-contract';
import { isSigningOut, useShellContext } from './auth/useShellContext';
import { Home } from './components/Home';
import { isActive, Layout } from './components/Layout';
import { RemoteMount } from './remotes/RemoteMount';

export interface SignInState {
  returnTo: string;
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 12, px: 2 }}>
      {children}
    </Box>
  );
}

export function App({ config, remotes }: { config: ShellConfig; remotes: RemoteDefinition[] }) {
  const auth = useAuth();
  const location = useLocation();
  const context = useShellContext(config);
  const redirecting = useRef(false);
  // Bumped when a sidebar item for the current remote is clicked, to remount it at its root.
  const [navNonce, setNavNonce] = useState(0);

  const needsSignIn = !auth.isLoading && !auth.isAuthenticated && !auth.error && !auth.activeNavigator;
  const callbackPending = location.pathname === '/loggedin' && /[?&](code|error)=/.test(location.search);
  useEffect(() => {
    if (!needsSignIn || redirecting.current || callbackPending || isSigningOut()) return;
    redirecting.current = true;
    // Remotes navigate with their own routers, so the window has the real location.
    const here = window.location.pathname + window.location.search;
    const state: SignInState = { returnTo: here.startsWith('/loggedin') ? '/' : here };
    auth.signinRedirect({ state }).catch(() => {
      redirecting.current = false;
    });
  }, [needsSignIn, callbackPending, auth]);

  // A failed silent renew also sets auth.error; only treat it as fatal when we're not signed in.
  if (auth.error && !auth.isAuthenticated) {
    return (
      <Centred>
        <Alert severity="error">Sign-in failed: {auth.error.message}</Alert>
        <Button variant="contained" onClick={() => auth.signinRedirect().catch(() => {})}>
          Sign in again
        </Button>
      </Centred>
    );
  }

  if (!context) {
    return (
      <Centred>
        <CircularProgress aria-label="Signing in" />
        <Typography color="text.secondary">Signing in…</Typography>
      </Centred>
    );
  }

  const mountable = remotes.filter((r) => !r.href);

  return (
    <Layout
      remotes={remotes}
      env={config.env}
      username={context.user.username}
      onSignOut={context.signOut}
      onNavigate={(remote) => {
        if (isActive(window.location.pathname, remote.path)) setNavNonce((n) => n + 1);
      }}
    >
      <Routes>
        <Route path="/" element={<Home remotes={remotes} />} />
        <Route path="/loggedin" element={<Home remotes={remotes} />} />
        {mountable.map((remote) => (
          <Route
            key={remote.name}
            path={`${remote.path}/*`}
            element={
              <RemoteMount
                key={`${remote.name}-${navNonce}`}
                name={remote.name}
                context={{ ...context, basePath: remote.path }}
              />
            }
          />
        ))}
        <Route path="*" element={<Alert severity="warning">Nothing here: {location.pathname}</Alert>} />
      </Routes>
    </Layout>
  );
}
