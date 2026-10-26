import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  User,
  Package,
  ArrowUpDown,
  Download,
  Building,
  Layers,
  MessageSquare,
  Phone,
  Mail,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { StockPushLog, Brand, WarehouseProduct, Salesman, PushStatus } from '../../types/stockist';
import { Client } from '../../db';

interface GlobalPushLedgerViewProps {
  pushes: StockPushLog[];
  clients: Client[];
  brands: Brand[];
  products: WarehouseProduct[];
  salesmen: Salesman[];
  onOpenLogPushModal: (clientId?: string, productId?: string) => void;
  onOpenNewCampaign: () => void;
}

export function GlobalPushLedgerView({
  pushes,
  clients,
  brands,
  products,
  salesmen,
  onOpenLogPushModal,
  onOpenNewCampaign,
}: GlobalPushLedgerViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedSalesman, setSelectedSalesman] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Filtered push log entries
  const filteredPushes = useMemo(() => {
    return pushes.filter((p) => {
      const matchBrand = selectedBrand === 'All' || p.brandName === selectedBrand || p.brandId === selectedBrand;
      const matchStatus = selectedStatus === 'All' || p.status === selectedStatus;
      const matchSalesman = selectedSalesman === 'All' || p.salesmanName === selectedSalesman;
      const matchCategory = selectedCategory === 'All' || p.clientCategory === selectedCategory;
      const matchSearch =
        !searchTerm.trim() ||
        p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.salesmanName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchBrand && matchStatus && matchSalesman && matchCategory && matchSearch;
    });
  }, [pushes, selectedBrand, selectedStatus, selectedSalesman, selectedCategory, searchTerm]);

  // Detect duplicate pushes (same customer + same product pitched by > 1 reps or multiple times)
  const collisionPushesSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pushes) {
      const key = `${p.clientId}__${p.productId}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const collisions = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) collisions.add(key);
    }
    return collisions;
  }, [pushes]);

  const totalWon = pushes.filter((p) => p.status === 'Ordered').length;
  const totalQuoted = pushes.filter((p) => p.status === 'Quoted' || p.status === 'Under Negotiation').length;
  const totalSampled = pushes.filter((p) => p.status === 'Sample Sent').length;

  const exportCSV = () => {
    const headers = ['Date Pushed', 'Customer', 'Category', 'Brand', 'SKU', 'Product Name', 'Salesman', 'Channel', 'Status', 'Price Offered', 'Notes', 'Campaign'];
    const rows = filteredPushes.map((p) => [
      new Date(p.pushedAt).toISOString().split('T')[0],
      `"${p.clientName.replace(/"/g, '""')}"`,
      `"${p.clientCategory}"`,
      `"${p.brandName}"`,
      `"${p.sku}"`,
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${p.salesmanName}"`,
      `"${p.channel}"`,
      `"${p.status}"`,
      p.priceOffered || 0,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      `"${p.campaignTitle || 'Direct Push'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `material_pushes_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header & Stats Banner */}
      <div className="p-5 bg-[#161a22] rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                Warehouse Materials & Accessories Push Registry
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cross-salesman audit trail tracking every single brand material pushed out to customers with collision flags.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenLogPushModal()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-400" /> Log Rep Push Record
            </button>
            <button
              onClick={onOpenNewCampaign}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-all"
            >
              <Flame className="w-4 h-4 text-amber-300" /> Launch Multi-Customer Campaign
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
          <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Total Push Records
            </span>
            <div className="text-xl font-extrabold text-slate-100 mt-0.5">{pushes.length}</div>
            <div className="text-[10px] text-blue-400 mt-0.5">{filteredPushes.length} in current filter</div>
          </div>

          <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Orders Won
            </span>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{totalWon} Orders</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">
              {pushes.length > 0 ? Math.round((totalWon / pushes.length) * 100) : 0}% Conversion
            </div>
          </div>

          <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Quoted / In Discussion
            </span>
            <div className="text-xl font-extrabold text-blue-400 mt-0.5">{totalQuoted} Active</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{totalSampled} Samples Delivered</div>
          </div>

          <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Cross-Rep Collisions
            </span>
            <div className="text-xl font-extrabold text-amber-400 mt-0.5">
              {collisionPushesSet.size} SKU-Customer Pairs
            </div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Tracked & synchronized</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer, material SKU, brand, salesman, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#12151a] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-[#12151a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="All">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#12151a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Pitch Made">Pitch Made</option>
            <option value="Sample Sent">Sample Sent</option>
            <option value="Quoted">Quoted</option>
            <option value="Under Negotiation">Under Negotiation</option>
            <option value="Ordered">Ordered (Won)</option>
            <option value="Declined - Has Stock">Declined - Has Stock</option>
            <option value="Declined - Price">Declined - Price</option>
            <option value="Follow-up Due">Follow-up Due</option>
          </select>

          {/* Salesman Filter */}
          <select
            value={selectedSalesman}
            onChange={(e) => setSelectedSalesman(e.target.value)}
            className="bg-[#12151a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="All">All Sales Reps</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Export CSV Button */}
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Push Logs Table */}
      <div className="bg-[#161a22] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#12151a] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-3.5 pl-5">Date</th>
                <th className="p-3.5">Customer & Category</th>
                <th className="p-3.5">Brand & Warehouse SKU</th>
                <th className="p-3.5">Sales Rep</th>
                <th className="p-3.5">Channel</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Price & Qty</th>
                <th className="p-3.5">Notes & Campaign</th>
                <th className="p-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredPushes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                    No push records match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPushes.map((push) => {
                  const pushKey = `${push.clientId}__${push.productId}`;
                  const hasCollision = collisionPushesSet.has(pushKey);
                  const formattedDate = new Date(push.pushedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={push.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Date */}
                      <td className="p-3.5 pl-5 text-slate-400 whitespace-nowrap">
                        <div className="font-mono text-[11px]">{formattedDate}</div>
                        {hasCollision && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 mt-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" /> Collision History
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-200">{push.clientName}</div>
                        <div className="text-[10px] text-slate-400">{push.clientCategory}</div>
                      </td>

                      {/* Brand & SKU */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100">{push.brandName}</span>
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {push.sku}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                          {push.productName}
                        </div>
                      </td>

                      {/* Sales Rep */}
                      <td className="p-3.5">
                        <div className="font-medium text-slate-200">{push.salesmanName}</div>
                      </td>

                      {/* Channel */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium">
                          {push.channel}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            push.status === 'Ordered'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : push.status === 'Quoted' || push.status === 'Under Negotiation'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : push.status === 'Sample Sent'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : push.status?.startsWith('Declined')
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {push.status}
                        </span>
                      </td>

                      {/* Price & Qty */}
                      <td className="p-3.5">
                        <div className="font-bold text-emerald-400">${push.priceOffered}</div>
                        <div className="text-[10px] text-slate-400">{push.qtyDiscussed} Units</div>
                      </td>

                      {/* Notes & Campaign */}
                      <td className="p-3.5 max-w-xs">
                        <div className="text-slate-300 line-clamp-2 text-[11px]">{push.notes}</div>
                        {push.campaignTitle && (
                          <div className="text-[10px] text-blue-400 font-semibold mt-0.5 truncate">
                            🎯 {push.campaignTitle}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenLogPushModal(push.clientId, push.productId)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                        >
                          Log Update
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
