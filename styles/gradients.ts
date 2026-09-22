import { colors } from './colors';

export const gradients = {
  tabBar: `linear-gradient(180deg, ${colors.primary[600]} 0%, ${colors.primary[800]} 52%, ${colors.primary[950]} 100%)`,
  tabItemActive:
    'linear-gradient(145deg, rgba(255,255,255,0.28) 0%, rgba(219,234,254,0.08) 100%)',
  tabItemIdle:
    'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
  hero: `linear-gradient(145deg, ${colors.primary[700]} 0%, ${colors.primary[800]} 48%, ${colors.primary[950]} 100%), radial-gradient(circle at top right, rgba(147,197,253,0.28) 0%, transparent 52%)`,
  refresh: `linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 100%)`,
  statSheen: 'radial-gradient(circle at 88% 12%, rgba(255,255,255,0.2) 0%, transparent 46%)',
  statBalance: `linear-gradient(160deg, ${colors.primary[700]} 0%, ${colors.primary[800]} 46%, ${colors.primary[950]} 100%)`,
  statUpcoming: 'linear-gradient(160deg, #B45309 0%, #7C2D12 42%, #1B2437 100%)',
  statTasks: 'linear-gradient(160deg, #0F766E 0%, #115E59 42%, #142033 100%)',
  spendCard:
    'linear-gradient(145deg, #C2410C 0%, #9A3412 42%, #431407 100%), radial-gradient(circle at top right, rgba(253,186,116,0.22) 0%, transparent 56%)',
  incomeCard:
    'linear-gradient(145deg, #047857 0%, #065F46 46%, #022C22 100%), radial-gradient(circle at top right, rgba(110,231,183,0.2) 0%, transparent 56%)',
  statPace: `linear-gradient(160deg, ${colors.primary[700]} 0%, ${colors.primary[800]} 46%, ${colors.primary[950]} 100%)`,
  statSave: 'linear-gradient(160deg, #047857 0%, #065F46 46%, #022C22 100%)',
  statDays: 'linear-gradient(160deg, #B45309 0%, #7C2D12 46%, #431407 100%)',
  statIn: 'linear-gradient(160deg, #059669 0%, #047857 46%, #064E3B 100%)',
  statOut: 'linear-gradient(160deg, #EA580C 0%, #9A3412 46%, #431407 100%)',
  statNet: `linear-gradient(160deg, ${colors.primary[800]} 0%, #1E293B 52%, ${colors.primary[950]} 100%)`,
  action: `linear-gradient(145deg, ${colors.primary[500]} 0%, ${colors.primary[700]} 48%, ${colors.primary[800]} 100%), linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 42%)`,
  imagineStudio:
    'radial-gradient(ellipse at 22% 18%, rgba(147,197,253,0.34) 0%, transparent 52%), radial-gradient(ellipse at 82% 78%, rgba(167,139,250,0.26) 0%, transparent 48%), linear-gradient(180deg, #1E293B 0%, #0B1220 100%)',
  imagineShimmer:
    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0.06) 68%, transparent 100%)',
  languageCard: 'linear-gradient(120deg, #F8FAFC 0%, #EFF6FF 48%, #F8FAFC 100%)',
  languageCardOn: 'linear-gradient(120deg, #EFF6FF 0%, #DBEAFE 46%, #EDE9FE 100%)',
} as const;
