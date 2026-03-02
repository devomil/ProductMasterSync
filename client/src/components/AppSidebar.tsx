import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Users,
  Truck,
  Activity,
  Building2,
  Upload,
  Download,
  Database,
  Map,
  Link as LinkIcon,
  ShoppingCart,
  BarChart3,
  RefreshCw,
  Brain,
  Cpu,
  Settings,
  CheckCircle,
  AlertCircle,
  History,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Layers,
  Globe,
  Search,
  ListOrdered,
  Package2,
  Warehouse,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href?: string;
  icon: any;
  children?: NavItem[];
}

const navigation: { section: string; items: NavItem[] }[] = [
  {
    section: '',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    ]
  },
  {
    section: 'Catalog',
    items: [
      { label: 'Products', href: '/products', icon: Package },
      { label: 'Categories', href: '/categories', icon: FolderTree },
    ]
  },
  {
    section: 'Supply Chain',
    items: [
      { label: 'Suppliers', href: '/suppliers', icon: Users },
      { label: 'Brand Partners', href: '/brand-partners', icon: Building2 },
      { label: 'Shipping Templates', href: '/shipping-templates', icon: Truck },
      { label: 'Inventory', href: '/inventory-management', icon: Warehouse },
    ]
  },
  {
    section: 'Marketplaces',
    items: [
      { label: 'Marketplace Hub', href: '/marketplaces/overview', icon: Globe },
      { label: 'Marketplace Catalog', href: '/marketplaces/catalog', icon: Layers },
      { label: 'Active Listings', href: '/marketplaces/listings', icon: ListOrdered },
      { label: 'Manage Orders', href: '/marketplaces/orders', icon: ShoppingCart },
      { label: 'Comparison', href: '/marketplaces/comparison', icon: BarChart3 },
      {
        label: 'Amazon', icon: Package, children: [
          { label: 'Overview', href: '/marketplaces/amazon', icon: BarChart3 },
          { label: 'Integration', href: '/marketplaces/amazon/integration', icon: LinkIcon },
          { label: 'Multi-ASIN Search', href: '/marketplaces/amazon/multi-asin', icon: Search },
        ]
      },
      {
        label: 'Walmart', icon: Package, children: [
          { label: 'Overview', href: '/marketplaces/walmart', icon: BarChart3 },
          { label: 'Integration', href: '/marketplaces/walmart/integration', icon: LinkIcon },
        ]
      },
      {
        label: 'eBay', icon: Package, children: [
          { label: 'Overview', href: '/marketplaces/ebay', icon: BarChart3 },
        ]
      },
      {
        label: 'Newegg', icon: Package, children: [
          { label: 'Overview', href: '/marketplaces/newegg', icon: BarChart3 },
        ]
      },
      { label: 'Flxpoint Sync', href: '/marketplaces/flxpoint', icon: RefreshCw },
      { label: 'Ingram Micro', href: '/marketplaces/ingram-micro', icon: Package2 },
    ]
  },
  {
    section: 'Data Management',
    items: [
      { label: 'Data Imports', href: '/data-imports', icon: Upload },
      { label: 'Data Exports', href: '/data-exports', icon: Download },
      { label: 'Data Sources', href: '/data-sources', icon: Database },
      { label: 'Mapping Templates', href: '/mapping-templates', icon: Map },
      { label: 'Connections', href: '/connections', icon: LinkIcon },
    ]
  },
  {
    section: 'AI & Analytics',
    items: [
      { label: 'Purchasing AI', href: '/purchasing-ai', icon: Brain },
      { label: 'Research Opportunities', href: '/research-opportunities', icon: Cpu },
      { label: 'System Analysis', href: '/system-analysis', icon: Activity },
    ]
  },
  {
    section: 'System',
    items: [
      { label: 'Approvals', href: '/approvals', icon: CheckCircle },
      { label: 'Validation Rules', href: '/validation-rules', icon: AlertCircle },
      { label: 'Audit Logs', href: '/audit-logs', icon: History },
      { label: 'API Configuration', href: '/api-configuration', icon: Settings },
    ]
  }
];

function NavLink({ item, collapsed, location }: { item: NavItem; collapsed: boolean; location: string }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = item.icon;
  const isActive = item.href === '/' ? location === '/' : item.href ? location.startsWith(item.href) : false;
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren && item.children!.some(c => c.href && location.startsWith(c.href));

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-150',
            isChildActive
              ? 'text-emerald-700 bg-emerald-50 font-medium'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{item.label}</span>
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </>
          )}
        </button>
        {!collapsed && expanded && (
          <div className="ml-4 pl-3 border-l border-slate-200 mt-1 space-y-0.5">
            {item.children!.map(child => (
              <NavLink key={child.label} item={child} collapsed={false} location={location} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!item.href) return null;

  return (
    <Link to={item.href}>
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-150 cursor-pointer',
          isActive
            ? 'text-emerald-700 bg-emerald-50 font-medium'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-emerald-600')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </div>
    </Link>
  );
}

export default function AppSidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-slate-200 flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Layers className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="text-sm font-bold text-slate-900 tracking-tight">MultiChannel</span>
              <span className="text-sm font-bold text-emerald-600 tracking-tight">OS</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Layers className="h-4.5 w-4.5 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navigation.map((group, gi) => (
          <div key={gi}>
            {group.section && !collapsed && (
              <div className="px-3 mb-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{group.section}</span>
              </div>
            )}
            {collapsed && group.section && (
              <div className="flex justify-center mb-2">
                <div className="h-px w-5 bg-slate-200" />
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink key={item.label} item={item} collapsed={collapsed} location={location} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-shrink-0 border-t border-slate-200 p-3">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-slate-700">MultiChannelOS</p>
              <p className="text-[10px] text-slate-500">v1.0 Beta</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 h-10 w-10 flex items-center justify-center rounded-lg bg-white shadow-md border border-slate-200 text-slate-600"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-200 flex-shrink-0',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
