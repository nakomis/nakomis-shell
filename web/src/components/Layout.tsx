import Logout from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { DeployEnv, RemoteDefinition } from '../../../contract/shell-contract';
import { iconFor } from '../icons';

export const RAIL_WIDTH = 64;

export function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface LayoutProps {
  remotes: RemoteDefinition[];
  env: DeployEnv;
  username: string;
  onSignOut: () => void;
  onNavigate: (remote: RemoteDefinition) => void;
  children: ReactNode;
}

export function Layout({ remotes, env, username, onSignOut, onNavigate, children }: LayoutProps) {
  const { pathname } = useLocation();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'background.paper' }}
      >
        <Toolbar variant="dense">
          <Typography
            component={Link}
            to="/"
            variant="h6"
            sx={{ color: 'text.primary', textDecoration: 'none', flexGrow: 1 }}
          >
            Nakomis
          </Typography>
          {env !== 'prod' && <Chip label={env} color="warning" size="small" sx={{ mr: 2 }} />}
          <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
            {username}
          </Typography>
          <Tooltip title="Sign out">
            <IconButton color="inherit" onClick={onSignOut} aria-label="Sign out">
              <Logout />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: RAIL_WIDTH, boxSizing: 'border-box', bgcolor: 'background.paper' },
        }}
      >
        <Toolbar variant="dense" />
        <List component="nav" aria-label="Apps">
          {remotes.map((remote) => {
            const external = Boolean(remote.href);
            return (
              <Tooltip key={remote.name} title={remote.title} placement="right">
                <ListItemButton
                  selected={!external && isActive(pathname, remote.path)}
                  aria-label={remote.title}
                  sx={{ justifyContent: 'center', py: 1.5 }}
                  {...(external
                    ? { component: 'a', href: remote.href, target: '_blank', rel: 'noopener' }
                    : { component: Link, to: remote.path, onClick: () => onNavigate(remote) })}
                >
                  <ListItemIcon sx={{ minWidth: 0 }}>{iconFor(remote.icon)}</ListItemIcon>
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 1, sm: 2 } }}>
        <Toolbar variant="dense" />
        {children}
      </Box>
    </Box>
  );
}
