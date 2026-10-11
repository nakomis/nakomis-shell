import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShellContext } from '../../../contract/shell-contract';
import { RemoteMount } from './RemoteMount';

const loadRemote = vi.fn();
vi.mock('@module-federation/runtime', () => ({
  loadRemote: (id: string) => loadRemote(id),
  registerRemotes: vi.fn(),
}));

const context = {
  basePath: '/fleet',
  env: 'sandbox',
  user: { username: 'martin' },
} as unknown as ShellContext;

beforeEach(() => loadRemote.mockReset());

test('renders the remote App with the shell context', async () => {
  loadRemote.mockResolvedValue({
    default: (props: ShellContext) => (
      <div>
        fleet at {props.basePath} for {props.user.username}
      </div>
    ),
  });

  render(<RemoteMount name="fleet" context={context} />);

  expect(await screen.findByText('fleet at /fleet for martin')).toBeInTheDocument();
  expect(loadRemote).toHaveBeenCalledWith('fleet/App');
});

test('shows a retryable error when the remote fails to load', async () => {
  loadRemote
    .mockRejectedValueOnce(new Error('404'))
    .mockResolvedValueOnce({ default: () => <div>loaded</div> });

  render(<RemoteMount name="broken" context={context} />);

  expect(await screen.findByText(/Could not load broken: 404/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('loaded')).toBeInTheDocument();
});

test('contains a crash inside the remote', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  loadRemote.mockResolvedValue({
    default: () => {
      throw new Error('kaboom');
    },
  });

  render(<RemoteMount name="crashy" context={context} />);

  await waitFor(() => expect(screen.getByText(/crashy crashed: kaboom/)).toBeInTheDocument());
});

test('reports a remote without a default export', async () => {
  loadRemote.mockResolvedValue({});

  render(<RemoteMount name="empty" context={context} />);

  expect(await screen.findByText(/did not expose a default component/)).toBeInTheDocument();
});
