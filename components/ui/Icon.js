/**
 * @module components/ui/Icon
 * Single place that maps semantic icon names to lucide glyphs, so screens never import the icon library.
 */
import { AlertTriangle, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Flag, Gauge, Info, LogOut, MapPin, PawPrint, RefreshCw, Settings, ShieldCheck, X } from 'lucide-react-native';
import { colors } from '../../theme/index.js';

const glyphs = {
  close: X,
  back: ChevronLeft,
  forward: ChevronRight,
  down: ChevronDown,
  check: Check,
  alert: AlertTriangle,
  info: Info,
  flag: Flag,
  camera: Camera,
  map: MapPin,
  dog: PawPrint,
  settings: Settings,
  copy: Copy,
  shield: ShieldCheck,
  gauge: Gauge,
  logout: LogOut,
  refresh: RefreshCw,
};

/** Decorative by default (hidden from accessibility); the owning control supplies the label. */
export default function Icon({ name, size = 20, color = colors.ink, strokeWidth = 2 }) {
  const Glyph = glyphs[name];
  if (!Glyph) return null;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} accessible={false} aria-hidden importantForAccessibility="no" />;
}

export const iconNames = Object.keys(glyphs);
