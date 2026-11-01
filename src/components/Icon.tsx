import {
  ArrowRight,
  Banknote,
  ChartNoAxesColumn,
  ClipboardList,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CircleHelp,
  Download,
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
  chart: ChartNoAxesColumn,
  details: ClipboardList,
  settings: Settings,
  download: Download,
  upload: Upload,
  help: CircleHelp,
  wifi: Wifi,
  offline: WifiOff,
  shield: ShieldCheck,
  chevron: ChevronDown,
  close: X,
  left: ChevronLeft,
  right: ChevronRight,
  up: ArrowUp,
  down: ArrowDown,
  sort: ArrowUpDown,
};
const ICON_SIZE = 20;
const ICON_STROKE_WIDTH = 1.8;

export type IconName = keyof typeof icons;
export function Icon({
  name,
  className = '',
}: {
  name: IconName;
  className?: string;
}) {
  const Mark = icons[name];
  return (
    <Mark
      className={`icon ${className}`}
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE_WIDTH}
      aria-hidden="true"
      focusable="false"
    />
  );
}
