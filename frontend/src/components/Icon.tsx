import {
  ArrowSquareOut,
  Check,
  Clock,
  Copy,
  DownloadSimple,
  Eye,
  EyeSlash,
  FileText,
  Key,
  Lightning,
  Link as LinkIcon,
  Lock,
  LockOpen,
  Package,
  PencilSimple,
  Rows,
  Spinner,
  WarningCircle,
  X,
} from '@phosphor-icons/react'

/**
 * One icon family, one weight. Phosphor glyphs are drawn on a 256 grid with a
 * 16 stroke; `weight="regular"` keeps the hairline character the world uses.
 */
const SIZE = 15

const common = {
  size: SIZE,
  weight: 'regular' as const,
  'aria-hidden': true,
} as const

export const Icon = {
  Copy: (props: { size?: number }) => <Copy {...common} size={props.size ?? SIZE} />,
  Check: (props: { size?: number }) => <Check {...common} size={props.size ?? SIZE} />,
  Link: (props: { size?: number }) => <LinkIcon {...common} size={props.size ?? SIZE} />,
  Raw: (props: { size?: number }) => <FileText {...common} size={props.size ?? SIZE} />,
  Open: (props: { size?: number }) => <ArrowSquareOut {...common} size={props.size ?? SIZE} />,
  Edit: (props: { size?: number }) => <PencilSimple {...common} size={props.size ?? SIZE} />,
  Download: (props: { size?: number }) => <DownloadSimple {...common} size={props.size ?? SIZE} />,
  Lock: (props: { size?: number }) => <Lock {...common} size={props.size ?? SIZE} />,
  Unlock: (props: { size?: number }) => <LockOpen {...common} size={props.size ?? SIZE} />,
  Key: (props: { size?: number }) => <Key {...common} size={props.size ?? SIZE} />,
  Clock: (props: { size?: number }) => <Clock {...common} size={props.size ?? SIZE} />,
  Rows: (props: { size?: number }) => <Rows {...common} size={props.size ?? SIZE} />,
  Eye: (props: { size?: number }) => <Eye {...common} size={props.size ?? SIZE} />,
  EyeOff: (props: { size?: number }) => <EyeSlash {...common} size={props.size ?? SIZE} />,
  Spinner: (props: { size?: number }) => <Spinner {...common} size={props.size ?? SIZE} />,
  Alert: (props: { size?: number }) => <WarningCircle {...common} size={props.size ?? SIZE} />,
  Close: (props: { size?: number }) => <X {...common} size={props.size ?? SIZE} />,
  Bolt: (props: { size?: number }) => <Lightning {...common} size={props.size ?? SIZE} />,
  Stow: (props: { size?: number }) => <Package {...common} size={props.size ?? SIZE} />,
}

export { SIZE as ICON_SIZE }
