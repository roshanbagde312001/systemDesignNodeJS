import BoltIcon from '@mui/icons-material/Bolt';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import DevicesIcon from '@mui/icons-material/Devices';
import DnsIcon from '@mui/icons-material/Dns';
import EngineeringIcon from '@mui/icons-material/Engineering';
import HubIcon from '@mui/icons-material/Hub';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PublicIcon from '@mui/icons-material/Public';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import type { NodeKind } from '@sda/shared';

export const NODE_KIND_META: Record<NodeKind, { label: string; color: string; Icon: typeof BoltIcon; simple: string }> = {
  client: { label: 'Client', color: '#64748b', Icon: DevicesIcon, simple: 'The user’s browser or app' },
  dns: { label: 'DNS', color: '#a855f7', Icon: DnsIcon, simple: 'Finds the server’s address' },
  cdn: { label: 'CDN / Edge', color: '#8b5cf6', Icon: PublicIcon, simple: 'Servers close to users' },
  loadBalancer: { label: 'Load balancer', color: '#0ea5e9', Icon: CallSplitIcon, simple: 'Spreads traffic' },
  apiGateway: { label: 'API gateway', color: '#06b6d4', Icon: HubIcon, simple: 'Front door: auth, routing' },
  service: { label: 'Node.js service', color: '#3b82f6', Icon: TerminalIcon, simple: 'Runs business logic' },
  worker: { label: 'Background worker', color: '#6366f1', Icon: EngineeringIcon, simple: 'Does slow work later' },
  database: { label: 'Database', color: '#14b8a6', Icon: StorageIcon, simple: 'Stores data permanently' },
  cache: { label: 'Redis cache', color: '#ef4444', Icon: BoltIcon, simple: 'Fast memory for hot data' },
  queue: { label: 'Message queue', color: '#f59e0b', Icon: ViewStreamIcon, simple: 'To-do list between programs' },
  storage: { label: 'Object storage', color: '#22c55e', Icon: Inventory2Icon, simple: 'Stores files and media' },
  monitoring: { label: 'Monitoring', color: '#ec4899', Icon: MonitorHeartIcon, simple: 'Metrics, logs and traces' },
};
