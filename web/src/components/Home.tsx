import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router';
import type { RemoteDefinition } from '../../../contract/shell-contract';
import { iconFor } from '../icons';

export function Home({ remotes }: { remotes: RemoteDefinition[] }) {
  return (
    <Grid container spacing={2}>
      {remotes.map((remote) => (
        <Grid key={remote.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Card>
            <CardActionArea
              {...(remote.href
                ? { component: 'a', href: remote.href, target: '_blank', rel: 'noopener' }
                : { component: Link, to: remote.path })}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {iconFor(remote.icon)}
                <Typography variant="h6">{remote.title}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
