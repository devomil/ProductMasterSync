import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package2, 
  FileSliders, 
  Building2, 
  Upload, 
  Download, 
  Settings, 
  CheckSquare, 
  AlertCircle, 
  History,
  Database,
  FileCode,
  ShoppingCart,
  BarChart3,
  Shield,
  Activity
} from "lucide-react";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ href, icon, children, active }) => {
  return (
    <Link href={href}>
      <div className={`sidebar-link group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer ${
        active 
          ? "bg-primary/10 border-l-3 border-l-primary text-primary" 
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
      }`}>
        <span className={`mr-3 ${active ? "text-primary" : "text-neutral-400"}`}>
          {icon}
        </span>
        {children}
      </div>
    </Link>
  );
};

const Sidebar = () => {
  const [location] = useLocation();

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 border-r border-neutral-200 bg-white">
        <div className="h-0 flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="px-4 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Data Management</h3>
              <div className="mt-2 space-y-1">
                <SidebarLink 
                  href="/" 
                  icon={<LayoutDashboard size={20} />} 
                  active={location === "/"}
                >
                  Dashboard
                </SidebarLink>
                <SidebarLink 
                  href="/products" 
                  icon={<Package2 size={20} />} 
                  active={location === "/products"}
                >
                  Master Catalog
                </SidebarLink>
                <SidebarLink 
                  href="/categories" 
                  icon={<FileSliders size={20} />} 
                  active={location === "/categories"}
                >
                  Categories
                </SidebarLink>
                <SidebarLink 
                  href="/suppliers" 
                  icon={<Building2 size={20} />} 
                  active={location === "/suppliers"}
                >
                  Suppliers
                </SidebarLink>
                <SidebarLink 
                  href="/advanced-deduplication" 
                  icon={<Shield size={20} />} 
                  active={location === "/advanced-deduplication"}
                >
                  Advanced Deduplication
                </SidebarLink>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Integration</h3>
              <div className="mt-2 space-y-1">
                <SidebarLink 
                  href="/data-sources" 
                  icon={<Database size={20} />} 
                  active={location === "/data-sources"}
                >
                  Data Sources
                </SidebarLink>
                <SidebarLink 
                  href="/mapping-templates" 
                  icon={<FileCode size={20} />} 
                  active={location === "/mapping-templates"}
                >
                  Mapping Templates
                </SidebarLink>
                <SidebarLink 
                  href="/data-imports" 
                  icon={<Upload size={20} />} 
                  active={location === "/data-imports"}
                >
                  Data Imports
                </SidebarLink>
                <SidebarLink 
                  href="/data-exports" 
                  icon={<Download size={20} />} 
                  active={location === "/data-exports"}
                >
                  Data Exports
                </SidebarLink>
                <SidebarLink 
                  href="/amazon-integration" 
                  icon={<ShoppingCart size={20} />} 
                  active={location === "/amazon-integration"}
                >
                  Amazon Integration
                </SidebarLink>
                <SidebarLink 
                  href="/amazon-analytics" 
                  icon={<BarChart3 size={20} />} 
                  active={location === "/amazon-analytics"}
                >
                  Amazon Analytics
                </SidebarLink>
                <SidebarLink 
                  href="/system-monitoring" 
                  icon={<Activity size={20} />} 
                  active={location === "/system-monitoring"}
                >
                  System Monitoring
                </SidebarLink>
                <SidebarLink 
                  href="/multi-asin-search" 
                  icon={<Package2 size={20} />} 
                  active={location === "/multi-asin-search"}
                >
                  Multi-ASIN Discovery
                </SidebarLink>
                <SidebarLink 
                  href="/asin-demo" 
                  icon={<ShoppingCart size={20} />} 
                  active={location === "/asin-demo"}
                >
                  ASIN Demo
                </SidebarLink>
                <SidebarLink 
                  href="/api-configuration" 
                  icon={<Settings size={20} />} 
                  active={location === "/api-configuration"}
                >
                  API Configuration
                </SidebarLink>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Workflow</h3>
              <div className="mt-2 space-y-1">
                <SidebarLink 
                  href="/approvals" 
                  icon={<CheckSquare size={20} />} 
                  active={location === "/approvals"}
                >
                  Approvals
                </SidebarLink>
                <SidebarLink 
                  href="/validation-rules" 
                  icon={<AlertCircle size={20} />} 
                  active={location === "/validation-rules"}
                >
                  Validation Rules
                </SidebarLink>
                <SidebarLink 
                  href="/audit-logs" 
                  icon={<History size={20} />} 
                  active={location === "/audit-logs"}
                >
                  Audit Logs
                </SidebarLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
