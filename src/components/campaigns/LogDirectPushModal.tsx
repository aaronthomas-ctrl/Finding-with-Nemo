import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, UserCheck, Package, Calendar, DollarSign, MessageSquare, Plus } from 'lucide-react';
import { Brand, WarehouseProduct, Salesman, PushStatus, PushChannel } from '../../types/stockist';
import { Client } from '../../db';
import { checkProductPushCollision, logDirectStockPush, quickAddNewCustomer } from '../../lib/stockData';

interface LogDirectPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPushLogged: () => void;
  clients: Client[];
  products: WarehouseProduct[];
  brands: Brand[];
  salesmen: Salesman[];
  preselectedClientId?: string;
  preselectedProductId?: string;
}

export function LogDirectPushModal({
  isOpen,
  onClose,
  onPushLogged,
  clients,
  products,
  brands,
  salesmen,
  preselectedClientId,
  preselectedProductId,
}: LogDirectPushModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || (clients[0]?.id || ''));
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    preselectedProductId
      ? products.find((p) => p.id === preselectedProductId)?.brandId || brands[0]?.id || ''
      : brands[0]?.id || ''
  );
  const [selectedProductId, setSelectedProductId] = useState<string>(
    preselectedProductId || products.find((p) => p.brandId === selectedBrandId)?.id || products[0]?.id || ''
  );
  const [salesmanName, setSalesmanName] = useState<string>(salesmen[0]?.name || 'Marcus Vance');
  const [pushedDate, setPushedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<PushStatus>('Pitch Made');
  const [channel, setChannel] = useState<PushChannel>('WhatsApp');
  const [priceOffered, setPriceOffered] = useState<number>(() => {
    const p = products.find((pr) => pr.id === (preselectedProductId || products[0]?.id));
    return p?.suggestedPushPrice || p?.listPrice || 0;
  });
  const [qtyDiscussed, setQtyDiscussed] = useState<number>(() => {
    const p = products.find((pr) => pr.id === (preselectedProductId || products[0]?.id));
    return p?.moq || 1;
  });
  const [notes, setNotes] = useState<string>('');

  // Inline Add New Client State
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCategory, setNewClientCategory] = useState('Steel Fabricator');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('Dubai, UAE');

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentClient = clients.find((c) => c.id === selectedClientId);

  // Check collision for this client + product
  const collision = selectedClientId && selectedProductId ? checkProductPushCollision(selectedClientId, selectedProductId) : null;

  const handleBrandChange = (brandId: string) => {
    setSelectedBrandId(brandId);
    const firstProd = products.find((p) => p.brandId === brandId);
    if (firstProd) {
      setSelectedProductId(firstProd.id);
      setPriceOffered(firstProd.suggestedPushPrice);
      setQtyDiscussed(firstProd.moq);
    }
  };

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setPriceOffered(prod.suggestedPushPrice);
      setQtyDiscussed(prod.moq);
    }
  };

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      const created = await quickAddNewCustomer({
        name: newClientName.trim(),
        category: newClientCategory,
        contactName: newClientContact || 'Procurement Lead',
        contactRole: 'Manager',
        phone: newClientPhone,
        email: newClientEmail,
        address: newClientAddress,
      });
      setSelectedClientId(created.id);
      setShowAddClient(false);
      // reset
      setNewClientName('');
      setNewClientContact('');
      setNewClientPhone('');
    } catch (err) {
      console.error('Failed to create client:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedProductId || !currentProduct || !currentClient) return;

    logDirectStockPush({
      clientId: currentClient.id,
      clientName: currentClient.name,
      clientCategory: currentClient.category || 'Other',
      productId: currentProduct.id,
      productName: currentProduct.name,
      brandId: currentProduct.brandId,
      brandName: currentProduct.brandName,
      sku: currentProduct.sku,
      salesmanName,
      pushedAt: new Date(pushedDate),
      status,
      priceOffered: Number(priceOffered),
      qtyDiscussed: Number(qtyDiscussed),
      channel,
      notes: notes || `Direct salesman push by ${salesmanName} via ${channel}. Status: ${status}`,
    });

    onPushLogged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#12151a] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#161a22] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Package className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-slate-100">Log Past or Direct Salesman Push</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Record an offline or individual rep pitch for warehouse inventory to ensure complete cross-team collision tracking.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {/* Target Customer Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                1. Target Customer
              </label>
              <button
                type="button"
                onClick={() => setShowAddClient(!showAddClient)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddClient ? 'Select Existing Client' : '+ List as New Customer'}
              </button>
            </div>

            {showAddClient ? (
              <div className="p-4 bg-slate-900/90 border border-blue-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" /> Add & Select New Customer
                  </h4>
                  <span className="text-[11px] text-slate-400">Will be saved to client registry</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Company Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Emirates Heavy Industries LLC"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Customer Category</label>
                    <select
                      value={newClientCategory}
                      onChange={(e) => setNewClientCategory(e.target.value)}
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Steel Fabricator">Steel Fabricator</option>
                      <option value="EPC Contractor">EPC Contractor</option>
                      <option value="Marine/Shipbuilding">Marine/Shipbuilding</option>
                      <option value="Oilfield & Petrochemical Services">Oilfield & Petrochemical Services</option>
                      <option value="Electromechanical">Electromechanical</option>
                      <option value="MEP">MEP</option>
                      <option value="Welding Trade">Welding Trade</option>
                      <option value="Distributor">Distributor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Eng. Tariq Mansoor"
                      value={newClientContact}
                      onChange={(e) => setNewClientContact(e.target.value)}
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Mobile / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="+971 50 123 4567"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleCreateNewClient}
                    disabled={!newClientName.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Save & Pinpoint Customer
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.category} • Tier {c.tier || 2})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Brand & Warehouse Material Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 block">
                2. Brand
              </label>
              <select
                value={selectedBrandId}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 block">
                3. Warehouse Material / Accessory SKU
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {products
                  .filter((p) => p.brandId === selectedBrandId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name.substring(0, 45)}... ({p.availableQty} {p.unit} in stock)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Product Quick Info Card */}
          {currentProduct && (
            <div className="p-3.5 bg-[#161a22] rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-blue-400 font-mono font-medium">{currentProduct.sku}</span>
                <p className="text-slate-200 font-medium mt-0.5">{currentProduct.name}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Location: <span className="text-slate-300">{currentProduct.warehouseLocation}</span> • Stock Available:{' '}
                  <span className="text-emerald-400 font-semibold">{currentProduct.availableQty} {currentProduct.unit}</span>
                </p>
              </div>
              <div className="text-right shrink-0 pl-3">
                <span className="text-slate-400 line-through">${currentProduct.listPrice}</span>
                <p className="text-emerald-400 font-bold text-sm">${currentProduct.suggestedPushPrice}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {currentProduct.discountPercent}% Off
                </span>
              </div>
            </div>
          )}

          {/* Collision Warning Banner */}
          {collision && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-300 flex items-center gap-1.5">
                  Collision History Found ({collision.daysAgo} days ago)
                </h4>
                <p className="text-amber-200/90 mt-1">
                  Salesman <strong className="text-white">{collision.previousSalesman}</strong> already pitched this SKU to{' '}
                  <strong className="text-white">{currentClient?.name}</strong> with status:{' '}
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                    {collision.previousStatus}
                  </span>
                  {collision.priceOffered && ` @ $${collision.priceOffered}`}.
                </p>
                <p className="text-amber-300/70 text-[11px] mt-1 italic">"{collision.previousNotes}"</p>
              </div>
            </div>
          )}

          {/* Salesman & Push Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Salesman</label>
              <select
                value={salesmanName}
                onChange={(e) => setSalesmanName(e.target.value)}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {salesmen.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Date Pushed</label>
              <div className="relative">
                <input
                  type="date"
                  value={pushedDate}
                  onChange={(e) => setPushedDate(e.target.value)}
                  className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Channel Used</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as PushChannel)}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Call">Phone Call</option>
                <option value="Visit">In-Person Yard Visit</option>
                <option value="Meeting">Formal Meeting</option>
              </select>
            </div>
          </div>

          {/* Status & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Pitch Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PushStatus)}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="Pitch Made">Pitch Made</option>
                <option value="Sample Sent">Sample / Demo Sent</option>
                <option value="Quoted">Quotation Delivered</option>
                <option value="Under Negotiation">Under Negotiation</option>
                <option value="Ordered">Ordered / PO Received</option>
                <option value="Declined - Has Stock">Declined (Has Existing Stock)</option>
                <option value="Declined - Price">Declined (Price High)</option>
                <option value="Follow-up Due">Follow-up Due</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Price Offered ($)</label>
              <input
                type="number"
                step="0.01"
                value={priceOffered}
                onChange={(e) => setPriceOffered(Number(e.target.value))}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Quantity Discussed</label>
              <input
                type="number"
                min="1"
                value={qtyDiscussed}
                onChange={(e) => setQtyDiscussed(Number(e.target.value))}
                className="w-full bg-[#161a22] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Outcome Notes & Follow-up Details
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Delivered sample box to QA welding supervisor. Test results expected Monday; client asked for quote on 40 cartons."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#161a22] border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#161a22] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {collision ? (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Will update push collision registry
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fresh push record will be tracked
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" /> Save Push Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
