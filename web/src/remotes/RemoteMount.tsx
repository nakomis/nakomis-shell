import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { Component, type ReactNode, useEffect, useState } from 'react';
import type { ShellContext } from '../../../contract/shell-contract';
import { loadRemoteApp, type RemoteApp } from './loadRemote';

class RemoteErrorBoundary extends Component<
  { name: string; onRetry: () => void; children: ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <RemoteError
          message={`${this.props.name} crashed: ${this.state.error.message}`}
          onRetry={() => {
            this.setState({ error: undefined });
            this.props.onRetry();
          }}
        />
      );
    }
    return this.props.children;
  }
}

function RemoteError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </Alert>
  );
}

export function RemoteMount({ name, context }: { name: string; context: ShellContext }) {
  const [App, setApp] = useState<RemoteApp>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt triggers a reload
  useEffect(() => {
    let cancelled = false;
    setApp(undefined);
    setError(undefined);
    loadRemoteApp(name, attempt > 0).then(
      (app) => !cancelled && setApp(() => app),
      (err: Error) => !cancelled && setError(`Could not load ${name}: ${err.message}`),
    );
    return () => {
      cancelled = true;
    };
  }, [name, attempt]);

  const retry = () => setAttempt((a) => a + 1);

  if (error) return <RemoteError message={error} onRetry={retry} />;
  if (!App) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress aria-label={`Loading ${name}`} />
      </Box>
    );
  }
  return (
    <RemoteErrorBoundary name={name} onRetry={retry}>
      <App {...context} />
    </RemoteErrorBoundary>
  );
}
