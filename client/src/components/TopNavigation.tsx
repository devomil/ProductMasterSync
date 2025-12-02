import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Home, 
  Package, 
  Users, 
  Database, 
  BarChart3, 
  Settings, 
  ChevronDown,
  FileText,
  Upload,
  Download,
  Link as LinkIcon,
  Map,
  CheckCircle,
  ShoppingCart,
  Zap,
  Brain,
  FolderTree,
  Truck,
  Activity,
  Package2,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const TopNavigation = () => {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

  const NavButton = ({ 
    to, 
    children, 
    isDropdown = false 
  }: { 
    to?: string; 
    children: React.ReactNode; 
    isDropdown?: boolean;
  }) => {
    const buttonClasses = `
      flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
      ${to && isActive(to) 
        ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }
    `;

    if (to) {
      return (
        <Link to={to}>
          <div className={buttonClasses}>
            {children}
          </div>
        </Link>
      );
    }

    return (
      <div className={buttonClasses}>
        {children}
      </div>
    );
  };

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center space-x-8">
            {/* Logo/Home */}
            <NavButton to="/">
              <Home className="h-4 w-4" />
              Dashboard
            </NavButton>

            {/* Products Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Products
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <Link to="/products" className="flex items-center gap-2 w-full">
                    <Package className="h-4 w-4" />
                    Product Catalog
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/categories" className="flex items-center gap-2 w-full">
                    <FileText className="h-4 w-4" />
                    Categories
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Suppliers Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Suppliers
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <Link to="/suppliers" className="flex items-center gap-2 w-full">
                    <Users className="h-4 w-4" />
                    Supplier Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/suppliers-advanced" className="flex items-center gap-2 w-full">
                    <BarChart3 className="h-4 w-4" />
                    Advanced Supplier Analytics
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/shipping-templates" className="flex items-center gap-2 w-full">
                    <Truck className="h-4 w-4" />
                    Shipping Templates
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/inventory-management" className="flex items-center gap-2 w-full">
                    <Activity className="h-4 w-4" />
                    Inventory Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/data-sources" className="flex items-center gap-2 w-full">
                    <Database className="h-4 w-4" />
                    Data Sources
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/connections" className="flex items-center gap-2 w-full">
                    <LinkIcon className="h-4 w-4" />
                    Connection Testing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/mapping-templates" className="flex items-center gap-2 w-full">
                    <Map className="h-4 w-4" />
                    Mapping Templates
                  </Link>
                </DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>

            {/* Data Management Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <Link to="/data-imports" className="flex items-center gap-2 w-full">
                    <Upload className="h-4 w-4" />
                    Data Imports
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/data-exports" className="flex items-center gap-2 w-full">
                    <Download className="h-4 w-4" />
                    Data Exports
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/approvals" className="flex items-center gap-2 w-full">
                    <CheckCircle className="h-4 w-4" />
                    Approvals
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/audit-logs" className="flex items-center gap-2 w-full">
                    <FileText className="h-4 w-4" />
                    Audit Logs
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Purchasing AI */}
            <NavButton to="/purchasing-ai">
              <Brain className="h-4 w-4" />
              Purchasing AI
            </NavButton>

            {/* Marketplaces Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Marketplaces
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <Link to="/marketplaces/overview" className="flex items-center gap-2 w-full">
                    <BarChart3 className="h-4 w-4" />
                    Marketplace Hub
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/marketplaces/catalog" className="flex items-center gap-2 w-full">
                    <FileText className="h-4 w-4" />
                    Marketplace Catalog
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/marketplaces/listings" className="flex items-center gap-2 w-full">
                    <Package className="h-4 w-4" />
                    Active Listings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/marketplaces/orders" className="flex items-center gap-2 w-full">
                    <ShoppingCart className="h-4 w-4" />
                    Manage Orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/marketplaces/flxpoint" className="flex items-center gap-2 w-full">
                    <RefreshCw className="h-4 w-4" />
                    Flxpoint Sync
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/marketplaces/comparison" className="flex items-center gap-2 w-full">
                    <BarChart3 className="h-4 w-4" />
                    Cross-Marketplace Data
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Package className="h-4 w-4" />
                    <span>Amazon</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/amazon" className="flex items-center gap-2 w-full">
                        <Package className="h-4 w-4" />
                        Overview
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/amazon/integration" className="flex items-center gap-2 w-full">
                        <LinkIcon className="h-4 w-4" />
                        Integration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/amazon/multi-asin" className="flex items-center gap-2 w-full">
                        <BarChart3 className="h-4 w-4" />
                        Multi-ASIN Search
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Package className="h-4 w-4" />
                    <span>Walmart</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/walmart" className="flex items-center gap-2 w-full">
                        <Package className="h-4 w-4" />
                        Overview
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/walmart/integration" className="flex items-center gap-2 w-full">
                        <LinkIcon className="h-4 w-4" />
                        Integration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/walmart/product-sync" className="flex items-center gap-2 w-full">
                        <Activity className="h-4 w-4" />
                        Product Sync
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/walmart/analytics" className="flex items-center gap-2 w-full">
                        <BarChart3 className="h-4 w-4" />
                        Analytics
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Package className="h-4 w-4" />
                    <span>eBay</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/ebay" className="flex items-center gap-2 w-full">
                        <Package className="h-4 w-4" />
                        Overview
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/ebay/integration" className="flex items-center gap-2 w-full">
                        <LinkIcon className="h-4 w-4" />
                        Integration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/ebay/product-sync" className="flex items-center gap-2 w-full">
                        <Activity className="h-4 w-4" />
                        Product Sync
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/ebay/analytics" className="flex items-center gap-2 w-full">
                        <BarChart3 className="h-4 w-4" />
                        Analytics
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Package className="h-4 w-4" />
                    <span>Newegg</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/newegg" className="flex items-center gap-2 w-full">
                        <Package className="h-4 w-4" />
                        Overview
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/newegg/integration" className="flex items-center gap-2 w-full">
                        <LinkIcon className="h-4 w-4" />
                        Integration
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/newegg/product-sync" className="flex items-center gap-2 w-full">
                        <Activity className="h-4 w-4" />
                        Product Sync
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/marketplaces/newegg/analytics" className="flex items-center gap-2 w-full">
                        <BarChart3 className="h-4 w-4" />
                        Analytics
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* System */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  System
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <Link to="/system-analysis" className="flex items-center gap-2 w-full">
                    <BarChart3 className="h-4 w-4" />
                    System Analysis
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/system-monitoring" className="flex items-center gap-2 w-full">
                    <Settings className="h-4 w-4" />
                    System Monitoring
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/validation-rules" className="flex items-center gap-2 w-full">
                    <CheckCircle className="h-4 w-4" />
                    Validation Rules
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/api-configuration" className="flex items-center gap-2 w-full">
                    <Settings className="h-4 w-4" />
                    API Configuration
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavigation;