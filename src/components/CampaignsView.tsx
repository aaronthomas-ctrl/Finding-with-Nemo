import React, { useState, useEffect } from 'react';
import {
  Flame,
  Plus,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  ShieldAlert,
  BarChart3,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  Tag,
  Building,
  Calendar,
  Send,
  Edit3
} from 'lucide-react';
import {
  Brand,
  WarehouseProduct,
  StockPushLog,
  StockCampaign,
  Salesman,
} from '../types/stockist';
import { Client, db } from '../db';
import {
  getLocalBrands,
  getLocalWarehouseProducts,
  getLocalStockPushes,
  getLocalCampaigns,
  getLocalSalesmen,
  initializeStockistStore,
} from '../lib/stockData';
import { NewCampaignModal } from './campaigns/NewCampaignModal';
import { LogDirectPushModal } from './campaigns/LogDirectPushModal';
import { CampaignDetailDrawer } from './campaigns/CampaignDetailDrawer';
import { GlobalPushLedgerView } from './campaigns/GlobalPushLedgerView';
import { WarehouseStockBrowser } from './campaigns/WarehouseStockBrowser';

export function CampaignsView() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'ledger' | 'warehouse'>('campaigns');

  // Core Data State
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [pushes, setPushes] = useState<StockPushLog[]>([]);
  const [campaigns, setCampaigns] = useState<StockCampaign[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Modals & Drawers State
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isLogPushOpen, setIsLogPushOpen] = useState(false);
  const [selectedCampaignForDrawer, setSelectedCampaignForDrawer] = useState<StockCampaign | null>(null);
  const [preselectedProductForCampaign, setPreselectedProductForCampaign] = useState<WarehouseProduct | null>(null);
  const [logPushPreselectedClient, setLogPushPreselectedClient] = useState<string | undefined>();
  const [logPushPreselectedProduct, setLogPushPreselectedProduct] = useState<string | undefined>();

  // Filter for campaigns tab
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'All' | 'Active' | 'Completed' | 'Draft'>('All');

  const reloadData = () => {
    initializeStockistStore();
    setBrands(getLocalBrands());
    setProducts(getLocalWarehouseProducts());
    setPushes(getLocalStockPushes());
    setCampaigns(getLocalCampaigns());
    setSalesmen(getLocalSalesmen());

    db.clients.toArray().then((cls) => {
      setClients(cls || []);
    }).catch(console.error);
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleCampaignCreated = (newCamp: StockCampaign) => {
    reloadData();
    setSelectedCampaignForDrawer(newCamp);
  };

  const handlePushLogged = () => {
    reloadData();
  };

  const handleStartCampaignFromProduct = (product: WarehouseProduct) => {
    setPreselectedProductForCampaign(product);
    setIsNewCampaignOpen(true);
  };

  const handleLogPushFromProduct = (product: WarehouseProduct) => {
    setLogPushPreselectedProduct(product.id);
    setIsLogPushOpen(true);
  };

  // High-Level Summary Calculations
  const activeCampaignsCount = campaigns.filter((c) => c.status === 'Active').length;
  const totalMaterialsPushed = pushes.length;
  const totalRevenueWon = campaigns.reduce(
    (acc, c) => acc + (c.metrics?.totalRevenueWon || 0),
    0
  );
  const totalOrdersWon = pushes.filter((p) => p.status === 'Ordered').length;

  const filteredCampaigns = campaigns.filter((c) => {
    const matchStatus = campaignStatusFilter === 'All' || c.status === campaignStatusFilter;
    const matchSearch =
      !campaignSearch.trim() ||
      c.title.toLowerCase().includes(campaignSearch.toLowerCase()) ||
      c.brandName.toLowerCase().includes(campaignSearch.toLowerCase()) ||
      c.productName.toLowerCase().includes(campaignSearch.toLowerCase()) ||
      c.sku.toLowerCase().includes(campaignSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0f12] text-slate-100 overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
              <Flame className="w-5 h-5 text-amber-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">
                Multi-Brand Stock Push Campaign Hub
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Strategic warehouse inventory push system: Target industry categories, select brand SKUs, avoid rep collisions, and track multi-client campaigns.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setLogPushPreselectedClient(undefined);
              setLogPushPreselectedProduct(undefined);
              setIsLogPushOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-blue-400" /> Log Rep Push Record
          </button>

          <button
            type="button"
            onClick={() => {
              setPreselectedProductForCampaign(null);
              setIsNewCampaignOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Flame className="w-4 h-4 text-amber-300" /> Launch Multi-Customer Campaign
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-[#161a22] rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
            <Flame className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 mt-2">
            {activeCampaignsCount} <span className="text-xs font-normal text-slate-400">Running</span>
          </div>
          <div className="text-[11px] text-blue-400 mt-1 font-medium">
            {campaigns.length} Total Campaigns Created
          </div>
        </div>

        <div className="p-4 bg-[#161a22] rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Material Pushes</span>
            <Package className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 mt-2">
            {totalMaterialsPushed} <span className="text-xs font-normal text-slate-400">Records</span>
          </div>
          <div className="text-[11px] text-purple-400 mt-1 font-medium">
            Across {brands.length} Warehouse Brands
          </div>
        </div>

        <div className="p-4 bg-[#161a22] rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Orders Won</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-2">
            {totalOrdersWon} <span className="text-xs font-normal text-slate-400">POs</span>
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 font-medium">
            {totalMaterialsPushed > 0 ? Math.round((totalOrdersWon / totalMaterialsPushed) * 100) : 0}% Conversion Rate
          </div>
        </div>

        <div className="p-4 bg-[#161a22] rounded-2xl border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Revenue Won</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2">
            ${totalRevenueWon.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            From clearance push initiatives
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'campaigns'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Flame className="w-4 h-4" /> Active & Past Campaigns ({campaigns.length})
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" /> Push History & Collision Ledger ({pushes.length})
        </button>

        <button
          onClick={() => setActiveTab('warehouse')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'warehouse'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-4 h-4" /> Warehouse Stockist Inventory ({products.length} SKUs)
        </button>
      </div>

      {/* TAB 1: Campaigns Execution Hub */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search campaigns by title, brand, SKU, product..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="w-full bg-[#12151a] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['All', 'Active', 'Completed', 'Draft'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setCampaignStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                    campaignStatusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#12151a] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Campaigns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCampaigns.length === 0 ? (
              <div className="col-span-2 p-12 text-center bg-[#161a22] rounded-2xl border border-slate-800 space-y-3">
                <Flame className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">No campaigns found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No stock push campaigns match your search. Launch a new campaign to push warehouse materials to target customer categories.
                </p>
                <button
                  onClick={() => setIsNewCampaignOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20"
                >
                  + Launch New Campaign
                </button>
              </div>
            ) : (
              filteredCampaigns.map((camp) => {
                const targets = camp.targets || [];
                const contactedCount = camp.metrics?.contactedCount || targets.filter((t) => t.status !== 'Pending').length;
                const progressPct = targets.length > 0 ? Math.round((contactedCount / targets.length) * 100) : 0;
                const wonCount = camp.metrics?.orderedCount || targets.filter((t) => t.status === 'Ordered').length;

                return (
                  <div
                    key={camp.id}
                    onClick={() => setSelectedCampaignForDrawer(camp)}
                    className="p-5 bg-[#161a22] rounded-2xl border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all shadow-lg flex flex-col justify-between space-y-4 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded">
                              {camp.brandName}
                            </span>
                            <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              {camp.sku}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                camp.status === 'Active'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {camp.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-100 mt-2 group-hover:text-blue-400 transition-colors">
                            {camp.title}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {camp.goal}
                          </p>
                        </div>

                        {/* Price Tag */}
                        <div className="text-right shrink-0">
                          <span className="text-xs text-slate-500 line-through">${camp.regularPrice}</span>
                          <div className="text-base font-extrabold text-emerald-400">
                            ${camp.offerPrice}
                          </div>
                          <span className="text-[10px] text-emerald-400 font-medium">
                            {camp.discountPercent}% Off
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            Target Reach: <strong className="text-slate-200">{contactedCount}/{targets.length} Contacted</strong>
                          </span>
                          <span className="text-blue-400 font-bold">{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Targeted Categories Chips */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {camp.targetCustomerCategories.map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-[#12151a] text-slate-400 border border-slate-800"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Strip */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-slate-400">
                        <span>
                          Won: <strong className="text-emerald-400 font-bold">{wonCount} Orders</strong>
                        </span>
                        <span>
                          Rev: <strong className="text-amber-400 font-bold">${(camp.metrics?.totalRevenueWon || 0).toLocaleString()}</strong>
                        </span>
                      </div>
                      <span className="text-blue-400 font-semibold flex items-center gap-1 text-[11px] group-hover:translate-x-0.5 transition-transform">
                        Open Campaign Board <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Push History & Collision Ledger */}
      {activeTab === 'ledger' && (
        <GlobalPushLedgerView
          pushes={pushes}
          clients={clients}
          brands={brands}
          products={products}
          salesmen={salesmen}
          onOpenLogPushModal={(cId, pId) => {
            setLogPushPreselectedClient(cId);
            setLogPushPreselectedProduct(pId);
            setIsLogPushOpen(true);
          }}
          onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
        />
      )}

      {/* TAB 3: Warehouse Stockist Inventory */}
      {activeTab === 'warehouse' && (
        <WarehouseStockBrowser
          products={products}
          brands={brands}
          onStartCampaignForProduct={handleStartCampaignFromProduct}
          onLogPushForProduct={handleLogPushFromProduct}
        />
      )}

      {/* Modals & Drawers */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => {
          setIsNewCampaignOpen(false);
          setPreselectedProductForCampaign(null);
        }}
        onCampaignCreated={handleCampaignCreated}
        clients={clients}
        products={products}
        brands={brands}
        salesmen={salesmen}
        pushes={pushes}
        preselectedProduct={preselectedProductForCampaign}
      />

      <LogDirectPushModal
        isOpen={isLogPushOpen}
        onClose={() => setIsLogPushOpen(false)}
        onPushLogged={handlePushLogged}
        clients={clients}
        products={products}
        brands={brands}
        salesmen={salesmen}
        preselectedClientId={logPushPreselectedClient}
        preselectedProductId={logPushPreselectedProduct}
      />

      <CampaignDetailDrawer
        campaign={selectedCampaignForDrawer}
        isOpen={!!selectedCampaignForDrawer}
        onClose={() => setSelectedCampaignForDrawer(null)}
        onCampaignUpdated={() => {
          reloadData();
          if (selectedCampaignForDrawer) {
            const updated = getLocalCampaigns().find((c) => c.id === selectedCampaignForDrawer.id);
            if (updated) setSelectedCampaignForDrawer(updated);
          }
        }}
      />
    </div>
  );
}
