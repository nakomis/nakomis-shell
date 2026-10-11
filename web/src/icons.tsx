import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import Apps from '@mui/icons-material/Apps';
import Construction from '@mui/icons-material/Construction';
import Devices from '@mui/icons-material/Devices';
import Groups from '@mui/icons-material/Groups';
import MonitorHeart from '@mui/icons-material/MonitorHeart';
import Pets from '@mui/icons-material/Pets';
import type { ReactElement } from 'react';

const ICONS: Record<string, ReactElement> = {
  admin: <AdminPanelSettings />,
  fleet: <Devices />,
  bootboots: <Pets />,
  sandbox: <Construction />,
  scrum: <Groups />,
  status: <MonitorHeart />,
};

export const iconFor = (name: string): ReactElement => ICONS[name] ?? <Apps />;
