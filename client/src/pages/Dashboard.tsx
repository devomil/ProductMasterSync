import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  TrendingUp,
  DollarSign,
  Target,
  ArrowUpRight,
  Package,
  Users,
  BarChart3,
  Warehouse,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  ShoppingCart,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function Dashboard() {
  const { data: intelligence, isLoading: loadingIntel } = useQuery<any>({
    queryKey: ['/api/dashboard/intelligence'],
    refetchInterval: 60000,
  });

  const { data: statistics, isLoading: loadingStats } = useQuery<any>({
    queryKey: ['/api/statistics'],
  });

  const { toast } = useToast();
  const [backfillResult, setBackfillResult] = useState<any>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/dashboard/sync-orders');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Order sync started", description: "Orders are being pulled from marketplaces. Refresh in a minute to see updates." });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/intelligence'] });
        }, 30000);
      } else {
        toast({ title: "Sync in progress", description: data.message, variant: "destructive" });
      }
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/dashboard/populate-vendor-costs');
      return res.json();
    },
    onSuccess: (data) => {
      setBackfillResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/intelligence'] });
    },
  });

  const mi = intelligence?.monthlyIntelligence;
  const cogs = intelligence?.cogsAnalysis;
  const now = new Date();
  const monthYear = `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  const revenue = mi?.monthToDateRevenue || 0;
  const vendorCosts = cogs?.totalCogs || 0;
  const referralFees = cogs?.referralFees || 0;
  const totalCogs = vendorCosts + referralFees;
  const grossProfit = revenue - totalCogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const hasRevenue = revenue > 0;
  const hasCogs = totalCogs > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Monthly Business Intelligence &ndash; {monthYear}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Comprehensive monthly performance insights and analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <Clock className="h-3 w-3 mr-1.5" />
            Updated {dateStr}
          </span>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncMutation.isPending ? 'Syncing...' : 'Sync Orders'}
          </button>
          <Link to="/marketplaces/orders">
            <button className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
              View Full Accounting
            </button>
          </Link>
        </div>
      </div>

      {loadingIntel ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">Month-to-Date Performance</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Monthly Revenue</p>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(revenue)}
              </p>
              {(mi?.walmartFundedAmount || 0) > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Includes Walmart Funded</span>
                  <span className="font-medium text-emerald-400">+{formatCurrency(mi.walmartFundedAmount)}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-slate-400">Days elapsed</span>
                </div>
                <span className="font-semibold">{mi?.daysElapsed || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-400">Daily average</span>
                <span className="font-semibold">{formatCurrency(mi?.dailyAverage || 0)}</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 text-white p-6 shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
            <div className="relative">
              {(() => {
                const today = mi?.todayRevenue || 0;
                const last24h = mi?.last24hRevenue || 0;
                const yesterday = mi?.yesterdayRevenue || 0;
                const displayValue = today > 0 ? today : last24h > 0 ? last24h : yesterday;
                const displayLabel = today > 0 ? "Today's Revenue" : last24h > 0 ? "Last 24 Hours" : "Yesterday's Revenue";
                const displaySub = today > 0 ? "Live Sales Today" : last24h > 0 ? "Rolling 24-hour sales" : "Most recent day with sales";
                return (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-teal-200" />
                      <span className="text-sm font-medium text-teal-100">{displayLabel}</span>
                    </div>
                    <p className="text-xs text-teal-200 mb-3">{displaySub}</p>
                    <p className="text-3xl font-bold tracking-tight">
                      {formatCurrency(displayValue)}
                    </p>
                  </>
                );
              })()}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-teal-200">Days elapsed</span>
                <span className="font-semibold">{mi?.daysElapsed || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-teal-200">Monthly avg/day</span>
                <span className="font-semibold">{formatCurrency(mi?.dailyAverage || 0)}</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-6 shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-slate-600">Projected Month-End</span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-orange-600 mt-3">
                {formatCurrency(mi?.projectedMonthEnd || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">projected revenue</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">Confidence:</span>
                <span className="font-semibold text-orange-600">{mi?.projectionConfidence || 0}%</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-500">Days remaining</span>
                <span className="font-semibold text-slate-700">{mi?.daysRemaining || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStatCard
            label="Revenue"
            value={formatCurrency(revenue)}
            sub="Month to Date"
            icon={TrendingUp}
            href="/marketplaces/orders"
          />
          <QuickStatCard
            label="COGS"
            value={hasCogs ? formatCurrency(totalCogs) : '--'}
            sub={hasCogs ? 'Fees + Vendor Costs' : 'Month to Date'}
            icon={DollarSign}
            muted={!hasCogs}
          />
          <QuickStatCard
            label="Gross Profit"
            value={hasCogs && hasRevenue ? formatCurrency(grossProfit) : '--'}
            sub={hasCogs && hasRevenue ? `${Math.round(grossMargin)}% margin` : 'Month to Date'}
            icon={BarChart3}
            muted={!hasCogs}
          />
          <QuickStatCard
            label="Active Accounts"
            value={formatNumber(statistics?.activeSuppliers || 0)}
            sub={`${formatNumber(statistics?.totalProducts || 0)} products`}
            icon={Users}
            href="/suppliers"
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Cost of Goods Sold Analysis &ndash; {mi?.month || 'This Month'}</h2>
              <p className="text-xs text-slate-500">Product cost tracking and profit margin insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
            >
              {backfillMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {backfillMutation.isPending ? 'Matching Costs...' : 'Refresh COGS Data'}
            </button>
            <Link to="/inventory-management">
              <button className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors">
                <Warehouse className="h-4 w-4 mr-2" />
                Manage Inventory
              </button>
            </Link>
          </div>
        </div>

        {backfillResult && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">COGS Data Updated</span>
            </div>
            <p className="text-xs text-blue-700">
              Matched {backfillResult.matched} of {backfillResult.totalItems} order items to catalog costs
              ({backfillResult.matchedByUpc} by UPC, {backfillResult.matchedByUsin} by Ingram Part#).
              {backfillResult.alreadyPopulated > 0 && ` ${backfillResult.alreadyPopulated} already had costs.`}
              {backfillResult.totalCostPopulated > 0 && ` Total vendor cost matched: ${formatCurrency(backfillResult.totalCostPopulated / 100)}.`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Cost of Goods Sold</p>
            <p className="text-2xl font-bold text-emerald-700">{hasCogs ? formatCurrency(totalCogs) : '--'}</p>
            <p className="text-xs text-slate-400 mt-0.5">Referral Fees + Vendor Costs</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Marketplace Referral Fees</p>
            <p className="text-2xl font-bold text-slate-800">{referralFees > 0 ? formatCurrency(referralFees) : '--'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{hasCogs ? `${Math.round((referralFees / totalCogs) * 100)}% of COGS` : '% of COGS'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Vendor / Material Costs</p>
            <p className="text-2xl font-bold text-slate-800">{vendorCosts > 0 ? formatCurrency(vendorCosts) : '--'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{vendorCosts > 0 ? `${Math.round((vendorCosts / totalCogs) * 100)}% of COGS` : 'Click "Refresh COGS Data" to match'}</p>
          </div>
        </div>

        {hasRevenue && hasCogs && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500 mb-1">Gross Profit</p>
              <p className={`text-2xl font-bold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatCurrency(grossProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Gross Margin</p>
              <p className={`text-2xl font-bold ${grossMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {grossMargin.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Orders with Cost Data</p>
              <p className="text-2xl font-bold text-slate-800">
                {cogs?.ordersWithCogs || 0} <span className="text-sm font-normal text-slate-400">of {mi?.totalOrders || 0}</span>
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">Cost Period: {mi?.month} {mi?.year}</p>
          <p className="text-xs text-slate-400">
            {hasCogs 
              ? `${referralFees > 0 ? 'Referral fees calculated' : ''}${cogs?.ordersWithCogs > 0 ? ` + ${cogs.ordersWithCogs} orders with vendor costs` : ''}`
              : 'Click "Refresh COGS Data" to auto-match vendor costs from catalog'
            }
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Monthly Business Intelligence &ndash; {monthYear}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Comprehensive monthly performance insights and analytics</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Updated: {dateStr}
              </span>
              <button className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors">
                <Target className="h-3 w-3 mr-1.5" />
                Dream View
              </button>
              <button className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors">
                <Calendar className="h-3 w-3 mr-1.5" />
                Set Monthly Goals
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-semibold text-emerald-700">Month-to-Date Performance</h3>
            </div>
            {loadingIntel ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-2.5">
                <PnlRow label="Revenue:" value={formatCurrency(revenue)} color="text-emerald-700" bold />
                {(mi?.walmartFundedAmount || 0) > 0 && (
                  <PnlRow label="  Walmart Funded:" value={`+${formatCurrency(mi.walmartFundedAmount)}`} color="text-blue-600" />
                )}
                {(mi?.customerRevenue || 0) > 0 && (mi?.walmartFundedAmount || 0) > 0 && (
                  <PnlRow label="  Customer Paid:" value={formatCurrency(mi.customerRevenue)} color="text-slate-500" />
                )}
                <PnlRow label="Cost of Goods:" value={hasCogs ? formatCurrency(totalCogs) : '--'} color={hasCogs ? 'text-red-600' : 'text-slate-400'} />
                <PnlRow label="  Referral Fees:" value={referralFees > 0 ? formatCurrency(referralFees) : '--'} color="text-slate-500" />
                <PnlRow label="  Vendor Costs:" value={vendorCosts > 0 ? formatCurrency(vendorCosts) : '--'} color="text-slate-500" />
                <PnlRow label="Payroll:" value="--" color="text-slate-400" />
                <PnlRow label="Operating Expenses:" value="--" color="text-slate-400" />
                <div className="border-t border-slate-200 pt-2.5 mt-3">
                  <PnlRow label="Total Expenses:" value={hasCogs ? formatCurrency(totalCogs) : '--'} color={hasCogs ? 'text-slate-700' : 'text-slate-400'} />
                </div>
                <div className="border-t border-slate-200 pt-2.5 mt-3 space-y-2">
                  <PnlRow label="Gross Profit:" value={hasCogs && hasRevenue ? formatCurrency(grossProfit) : '--'} color={grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} bold />
                  <PnlRow label="Gross Margin:" value={hasCogs && hasRevenue ? `${grossMargin.toFixed(1)}%` : '--'} color={grossMargin >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                  <PnlRow label="Net Income:" value={hasCogs && hasRevenue ? formatCurrency(grossProfit) : '--'} color={grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} bold />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 mb-4 self-start">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-blue-700">Daily Average Revenue</h3>
            </div>
            <p className="text-4xl font-bold text-slate-900 mt-2">
              {formatCurrency(mi?.dailyAverage || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">per day this month</p>
            <div className="mt-6 w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Days elapsed:</span>
                <span className="font-medium text-slate-700">{mi?.daysElapsed || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  {(mi?.todayRevenue || 0) > 0 ? 'Today:' : (mi?.last24hRevenue || 0) > 0 ? 'Last 24h:' : 'Yesterday:'}
                </span>
                <span className="font-medium text-slate-700">
                  {formatCurrency(
                    (mi?.todayRevenue || 0) > 0 ? mi.todayRevenue :
                    (mi?.last24hRevenue || 0) > 0 ? mi.last24hRevenue :
                    (mi?.yesterdayRevenue || 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 mb-4 self-start">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <h3 className="text-sm font-semibold text-orange-700">Projected Month-End</h3>
            </div>
            <p className="text-4xl font-bold text-orange-600 mt-2">
              {formatCurrency(mi?.projectedMonthEnd || 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">projected revenue</p>
            <div className="mt-6 w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Confidence:</span>
                <span className="font-medium text-orange-600">{mi?.projectionConfidence || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Days remaining:</span>
                <span className="font-medium text-slate-700">{mi?.daysRemaining || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {intelligence?.recentOrders?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>
            </div>
            <Link to="/marketplaces/orders">
              <span className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer">
                View all <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Order ID</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {intelligence.recentOrders.slice(0, 10).map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-700">{order.id}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                      {formatCurrency(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!intelligence?.amazonConnected && !loadingIntel && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Connect Your Marketplaces</h3>
              <p className="text-sm text-amber-700 mt-1">
                Revenue data will be populated automatically once your marketplace API connections are configured. 
                Visit the <Link to="/api-configuration"><span className="underline cursor-pointer font-medium">API Configuration</span></Link> page to get started.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStatCard({ label, value, sub, icon: Icon, href, muted }: {
  label: string;
  value: string;
  sub: string;
  icon: any;
  href?: string;
  muted?: boolean;
}) {
  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${muted ? 'text-slate-300' : 'text-slate-400'}`} />
      </div>
      <p className={`text-2xl font-bold ${muted ? 'text-slate-300' : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

function PnlRow({ label, value, color = 'text-slate-700', bold }: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold' : 'font-medium'} ${color}`}>{value}</span>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Shipped: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Unshipped: 'bg-blue-50 text-blue-700 border-blue-200',
    Canceled: 'bg-red-50 text-red-600 border-red-200',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}
