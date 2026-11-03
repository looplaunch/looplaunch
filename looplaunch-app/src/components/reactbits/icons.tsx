/**
 * Stands in for @hugeicons/react and @hugeicons/core-free-icons in the vendored React Bits
 * components, so they draw with lucide (already in the app) instead of adding a second icon set.
 */
import type { ComponentType, CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  Code,
  File,
  FileArchive,
  FileText,
  Folder,
  Image as ImageIcon,
  Music,
  Pencil,
  Presentation,
  RefreshCw,
  Search,
  SquareTerminal,
  StickyNote,
  Table,
  Video,
  X,
} from "lucide-react";

export type IconSvgElement = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}>;

interface HugeiconsIconProps {
  icon: IconSvgElement;
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function HugeiconsIcon({ icon: Icon, size = 24, strokeWidth = 1.5, color, className, style }: HugeiconsIconProps) {
  return <Icon size={size} strokeWidth={strokeWidth} color={color} className={className} style={style} aria-hidden="true" />;
}

export const ArrowRight02Icon = ArrowRight;
export const ArrowUp02Icon = ArrowUp;
export const Cancel01Icon = X;
export const Tick02Icon = Check;
export const Notification03Icon = Bell;
export const RefreshIcon = RefreshCw;
export const Search01Icon = Search;
export const CommandLineIcon = SquareTerminal;
export const File02Icon = FileText;
export const PencilEdit01Icon = Pencil;
export const CodeIcon = Code;
export const FigmaIcon = Pencil;
export const File01Icon = File;
export const FileZipIcon = FileArchive;
export const Folder01Icon = Folder;
export const Image01Icon = ImageIcon;
export const MusicNote01Icon = Music;
export const Note01Icon = StickyNote;
export const Pdf01Icon = FileText;
export const Presentation01Icon = Presentation;
export const Table01Icon = Table;
export const Video01Icon = Video;
