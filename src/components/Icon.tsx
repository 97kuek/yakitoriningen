import {
  ArrowRight,
  Banknote,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  HandPlatter,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Ticket,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
const icons = {
  plus: Plus,
  minus: Minus,
  cash: Banknote,
  check: Check,
  arrow: ArrowRight,
  reset: RotateCcw,
  refresh: RefreshCw,
  ticket: Ticket,
  tray: HandPlatter,
  chart: ChartNoAxesColumn,
  settings: Settings,
  download: Download,
  upload: Upload,
  help: CircleHelp,
  wifi: Wifi,
  offline: WifiOff,
  shield: ShieldCheck,
  chevron: ChevronDown,
  close: X,
};
export type IconName = keyof typeof icons | 'skewer';
export function Icon({
  name,
  className = '',
}: {
  name: IconName;
  className?: string;
}) {
  if (name === 'skewer')
    return (
      <svg
        className={`icon ${className}`}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="m4 21 3-4M17 5l3-3" />
        <rect
          x="6"
          y="12"
          width="7"
          height="7"
          rx="2"
          transform="rotate(35 9.5 15.5)"
        />
        <rect
          x="11"
          y="5"
          width="7"
          height="7"
          rx="2"
          transform="rotate(35 14.5 8.5)"
        />
      </svg>
    );
  const Mark = icons[name];
  return (
    <Mark
      className={`icon ${className}`}
      size={20}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
    />
  );
}
