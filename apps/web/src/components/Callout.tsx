import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import EmojiObjectsOutlinedIcon from '@mui/icons-material/EmojiObjectsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

export type CalloutKind = 'note' | 'tip' | 'warning' | 'assumption' | 'important' | 'simple';

const META: Record<CalloutKind, { label: string; color: 'primary' | 'secondary' | 'warning' | 'error'; Icon: typeof InfoOutlinedIcon }> = {
  note: { label: 'Note', color: 'primary', Icon: InfoOutlinedIcon },
  important: { label: 'Important', color: 'primary', Icon: InfoOutlinedIcon },
  tip: { label: 'Tip', color: 'secondary', Icon: EmojiObjectsOutlinedIcon },
  warning: { label: 'Watch out', color: 'warning', Icon: ReportProblemOutlinedIcon },
  assumption: { label: 'Estimate / assumption', color: 'warning', Icon: CalculateOutlinedIcon },
  simple: { label: 'In plain English', color: 'secondary', Icon: RecordVoiceOverOutlinedIcon },
};

export function Callout({ kind = 'note', title, children }: { kind?: CalloutKind; title?: string; children: ReactNode }) {
  const theme = useTheme();
  const { label, color, Icon } = META[kind] ?? META.note;
  const main = theme.palette[color].main;
  return (
    <Box
      component="aside"
      aria-label={title ?? label}
      sx={{ my: 2.5, px: 2, py: 1.5, borderLeft: `3px solid ${main}`, borderRadius: 1, bgcolor: alpha(main, theme.palette.mode === 'dark' ? 0.1 : 0.07) }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color: main }}>
        <Icon fontSize="small" aria-hidden />
        <Typography variant="overline" sx={{ lineHeight: 1.6 }}>
          {title ?? label}
        </Typography>
      </Box>
      <Box sx={{ '& p': { my: 0.5 }, '& > :last-child': { mb: 0 } }}>{children}</Box>
    </Box>
  );
}
