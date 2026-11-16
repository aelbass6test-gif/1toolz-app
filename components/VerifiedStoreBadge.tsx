import React, { useId } from 'react';
import { Settings, VerificationBadgeTier } from '../types';
import { VERIFICATION_TIER_META, getStoreVerificationTier } from '../utils/commerceEcosystem';

interface VerifiedStoreBadgeProps {
  verified?: boolean;
  tier?: VerificationBadgeTier;
  settings?: Partial<Settings> | null;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  customTitle?: string;
  className?: string;
}

const SealIconSvg: React.FC<{ tier: VerificationBadgeTier; size: number }> = ({ tier, size }) => {
  const uid = useId().replace(/:/g, '');

  if (tier === 'platform_official') {
    const bgId = `abdo-official-bg-${uid}`;
    const rimId = `abdo-official-rim-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_1px_3px_rgba(245,158,11,0.35)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={bgId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="55%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>
          <linearGradient id={rimId} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path
          d="M12 2L19.5 4.8V11.2C19.5 16.35 16.3 20.65 12 22C7.7 20.65 4.5 16.35 4.5 11.2V4.8L12 2Z"
          fill={`url(#${bgId})`}
          stroke={`url(#${rimId})`}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M8.6 12.1L10.95 14.45L15.65 9.45"
          stroke={`url(#${rimId})`}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (tier === 'vip_gold') {
    const goldId = `abdo-gold-bg-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_1px_3px_rgba(245,158,11,0.4)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={goldId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <path
          d="M12 1.8L14.45 3.6L17.48 3.35L18.45 6.23L21.1 7.75L20.38 10.72L21.9 13.36L19.72 15.48L19.55 18.5L16.58 19.12L14.78 21.58L12 20.45L9.22 21.58L7.42 19.12L4.45 18.5L4.28 15.48L2.1 13.36L3.62 10.72L2.9 7.75L5.55 6.23L6.52 3.35L9.55 3.6L12 1.8Z"
          fill={`url(#${goldId})`}
          stroke="#fef3c7"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 12.2L10.85 14.55L15.7 9.4"
          stroke="#ffffff"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const greenId = `abdo-emerald-bg-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_1px_2px_rgba(16,185,129,0.3)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={greenId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.9L14.45 3.65L17.48 3.4L18.45 6.25L21.05 7.75L20.35 10.72L21.85 13.35L19.7 15.45L19.52 18.45L16.58 19.08L14.78 21.52L12 20.4L9.22 21.52L7.42 19.08L4.48 18.45L4.3 15.45L2.15 13.35L3.65 10.72L2.95 7.75L5.55 6.25L6.52 3.4L9.55 3.65L12 1.9Z"
        fill={`url(#${greenId})`}
      />
      <path
        d="M8.5 12.2L10.85 14.55L15.65 9.45"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const VerifiedStoreBadge: React.FC<VerifiedStoreBadgeProps> = ({
  verified = true,
  tier: explicitTier,
  settings,
  size = 'sm',
  showLabel = false,
  customTitle,
  className = ''
}) => {
  if (!verified) return null;

  const tier: VerificationBadgeTier = explicitTier || getStoreVerificationTier(settings);
  const meta = VERIFICATION_TIER_META[tier];
  const iconSize = size === 'xs' ? 14 : size === 'md' ? 19 : 16;
  const titleText = customTitle || meta.titleTextAr;

  if (showLabel) {
    const pillStyle =
      tier === 'platform_official'
        ? 'bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 text-amber-300 border-amber-400/70 shadow-sm shadow-amber-500/10 ring-1 ring-amber-400/20'
        : tier === 'vip_gold'
        ? 'bg-gradient-to-l from-amber-500/20 via-yellow-400/15 to-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/45 shadow-2xs'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

    return (
      <span
        title={titleText}
        aria-label={meta.shortLabelAr}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black shrink-0 tracking-tight ${pillStyle} ${className}`}
      >
        <SealIconSvg tier={tier} size={iconSize} />
        <span>{meta.shortLabelAr}</span>
      </span>
    );
  }

  return (
    <span
      title={titleText}
      aria-label={meta.shortLabelAr}
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <SealIconSvg tier={tier} size={iconSize} />
    </span>
  );
};

export default VerifiedStoreBadge;
