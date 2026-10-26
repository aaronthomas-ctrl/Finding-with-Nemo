import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Flame,
  Plus,
  ShieldCheck,
  Building,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Brand, WarehouseProduct } from '../../types/stockist';

interface WarehouseStockBrowserProps {
  products: WarehouseProduct[];
  brands: Brand[];
  onStartCampaignForProduct: (product: WarehouseProduct) => void;
  onLogPushForProduct: (product: WarehouseProduct) => void;
}

export function WarehouseStockBrowser({
  products,
  brands,
  onStartCampaignForProduct,
  onLogPushForProduct,
}: WarehouseStockBrowserProps) {
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchBrand = selectedBrand === 'All' || p.brandId === selectedBrand || p.brandName === selectedBrand;
      const matchCat = selectedCategory === 'All' || p.materialCategory === selectedCategory;
      const matchStatus = selectedStatus === 'All' || p.inventoryStatus === selectedStatus;
      const matchSearch =
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.specification.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.warehouseLocation.toLowerCase().includes(searchTerm.toLowerCase());

      return matchBrand && matchCat && matchStatus && matchSearch;
    });
  }, [products, selectedBrand, selectedCategory, selectedStatus, searchTerm]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-5 bg-[#161a22] rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <Package className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                Warehouse Brand Inventory & Stock Push Opportunities
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active warehouse stockist items across ESAB, 3M, Callington, Bosch, EWM, Hilti, Victor, and Grindex ready for campaign distribution.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{products.length}</span> Total Warehouse SKUs Available
          </div>
        </div>

        {/* Brand Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setSelectedBrand('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
              selectedBrand === 'All'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-[#12151a] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Brands ({products.length})
          </button>
          {brands.map((b) => {
            const count = products.filter((p) => p.brandId === b.id).length;
            const isSelected = selectedBrand === b.id || selectedBrand === b.name;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBrand(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-[#12151a] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{b.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search warehouse stock by SKU, product name, specification, rack..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#12151a] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#12151a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="All">All Inventory Types</option>
            <option value="Overstock Push">Overstock Push</option>
            <option value="Fast Mover">Fast Mover</option>
            <option value="Clearance">Clearance</option>
            <option value="New Brand">New Brand</option>
            <option value="Standard Stock">Standard Stock</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => {
          return (
            <div
              key={product.id}
              className="p-5 bg-[#161a22] rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-100">{product.brandName}</span>
                      <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {product.sku}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          product.inventoryStatus === 'Overstock Push'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : product.inventoryStatus === 'Fast Mover'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : product.inventoryStatus === 'Clearance'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {product.inventoryStatus}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mt-2 leading-snug">
                      {product.name}
                    </h3>
                  </div>

                  {/* Pricing Box */}
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 line-through">${product.listPrice}</span>
                    <div className="text-lg font-extrabold text-emerald-400">
                      ${product.suggestedPushPrice}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                      {product.discountPercent}% Discount
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2">{product.specification}</p>

                {/* Warehouse Location & Stock Numbers */}
                <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 bg-[#12151a] rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Location</span>
                    <strong className="text-slate-300 text-[11px] truncate block">
                      {product.warehouseLocation}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Available Stock</span>
                    <strong className="text-emerald-400 text-[11px] font-bold block">
                      {product.availableQty} {product.unit}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Batch Number</span>
                    <strong className="text-slate-300 font-mono text-[10px] block truncate">
                      {product.batchNumber}
                    </strong>
                  </div>
                </div>

                {/* Target Customer Categories */}
                <div className="mt-3">
                  <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                    Recommended Target Industries:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {product.targetCustomerCategories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/60"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => onLogPushForProduct(product)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Log Rep Push
                </button>
                <button
                  type="button"
                  onClick={() => onStartCampaignForProduct(product)}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-300" /> Start Push Campaign <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
