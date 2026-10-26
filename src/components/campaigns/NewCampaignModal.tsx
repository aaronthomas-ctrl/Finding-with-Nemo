import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Users,
  Package,
  Layers,
  Search,
  ArrowRight,
  ArrowLeft,
  Calendar,
  DollarSign,
  Send,
  Plus,
  Info,
  Check,
  AlertTriangle,
  Building,
  Phone,
  Mail,
  UserCheck,
  Flame,
  Clock
} from 'lucide-react';
import {
  Brand,
  WarehouseProduct,
  Salesman,
  StockPushLog,
  StockCampaign,
  CampaignClientTarget,
  PushChannel,
} from '../../types/stockist';
import { Client } from '../../db';
import {
  DEFAULT_CUSTOMER_CATEGORIES,
  DEFAULT_MATERIAL_CATEGORIES,
  checkProductPushCollision,
  createAndLaunchCampaign,
  quickAddNewCustomer,
} from '../../lib/stockData';

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: (campaign: StockCampaign) => void;
  clients: Client[];
  products: WarehouseProduct[];
  brands: Brand[];
  salesmen: Salesman[];
  pushes: StockPushLog[];
  preselectedProduct?: WarehouseProduct | null;
}

export function NewCampaignModal({
  isOpen,
  onClose,
  onCampaignCreated,
  clients,
  products,
  brands,
  salesmen,
  pushes,
  preselectedProduct,
}: NewCampaignModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(preselectedProduct ? 2 : 1);

  // Step 1: Category Selecting
  const [selectedCustomerCategory, setSelectedCustomerCategory] = useState<string>('All');
  const [selectedTiers, setSelectedTiers] = useState<number[]>([1, 2, 3, 4]);
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState<string>(
    preselectedProduct?.materialCategory || 'All'
  );

  // Step 2: Brand & Product Selecting
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    preselectedProduct?.brandId || brands[0]?.id || ''
  );
  const [selectedProductId, setSelectedProductId] = useState<string>(
    preselectedProduct?.id || products.find((p) => p.brandId === (brands[0]?.id || ''))?.id || products[0]?.id || ''
  );
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [campaignGoal, setCampaignGoal] = useState<string>('');
  const [offerPrice, setOfferPrice] = useState<number>(preselectedProduct?.suggestedPushPrice || 0);
  const [moq, setMoq] = useState<number>(preselectedProduct?.moq || 5);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]
  );

  // Step 3: Customer Pinpoint Search & Selection
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showAddClientInline, setShowAddClientInline] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCategory, setNewClientCategory] = useState('Steel Fabricator');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('Dubai Industrial City, Dubai, UAE');

  // Step 4: Outreach Pitch & Salesman Assignment
  const [assignedSalesmen, setAssignedSalesmen] = useState<string[]>([salesmen[0]?.name || 'Marcus Vance']);
  const [pitchWhatsApp, setPitchWhatsApp] = useState<string>('');
  const [pitchEmail, setPitchEmail] = useState<string>('');
  const [pitchEmailSubject, setPitchEmailSubject] = useState<string>('');
  const [pitchCallScript, setPitchCallScript] = useState<string>('');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);

  const currentProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );
  const currentBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId]
  );

  // Filter clients based on Step 1 criteria
  const eligibleClientsRaw = useMemo(() => {
    return clients.filter((c) => {
      const matchCat =
        selectedCustomerCategory === 'All' || c.category === selectedCustomerCategory;
      const matchTier = selectedTiers.includes(c.tier || 2);
      const matchSearch =
        !customerSearch.trim() ||
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.address || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.category || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.contacts || []).some((ct) => ct.name.toLowerCase().includes(customerSearch.toLowerCase()));

      return matchCat && matchTier && matchSearch;
    });
  }, [clients, selectedCustomerCategory, selectedTiers, customerSearch]);

  const { eligibleClients, excludedTier1Clients } = useMemo(() => {
    const finalEligible = [];
    const excluded = [];
    
    const currentProductLine = currentBrand && currentProduct ? `${currentBrand.name} ${currentProduct.name}`.toLowerCase() : '';
    const brandNameLower = currentBrand ? currentBrand.name.toLowerCase() : '';
    
    for (const c of eligibleClientsRaw) {
      if (c.tier === 1 && c.tier1) {
        const status = c.tier1.allocationStatus;
        const isRestricted = status === 'Allocated — Other Distributor' || status === 'Allocated — Brand Direct';
        
        let hasOverlap = true;
        if (c.tier1.allocatedProductLines && c.tier1.allocatedProductLines.length > 0) {
          hasOverlap = c.tier1.allocatedProductLines.some(line => {
             const lineLower = line.toLowerCase();
             return currentProductLine.includes(lineLower) || lineLower.includes(currentProductLine) || (brandNameLower && lineLower.includes(brandNameLower));
          });
        }
        
        if (isRestricted && hasOverlap) {
          excluded.push(c);
          continue; // EXCLUDE!
        }
      }
      finalEligible.push(c);
    }
    
    return { eligibleClients: finalEligible, excludedTier1Clients: excluded };
  }, [eligibleClientsRaw, currentBrand, currentProduct]);

  // Check collision for each client with the selected product
  const clientCollisionMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof checkProductPushCollision>>();
    if (!selectedProductId) return map;
    for (const c of clients) {
      const col = checkProductPushCollision(c.id, selectedProductId, pushes);
      if (col) map.set(c.id, col);
    }
    return map;
  }, [clients, selectedProductId, pushes]);

  // Update default pricing & title when product changes
  const handleSelectProduct = (prod: WarehouseProduct) => {
    setSelectedProductId(prod.id);
    setSelectedBrandId(prod.brandId);
    setOfferPrice(prod.suggestedPushPrice);
    setMoq(prod.moq);
    setCampaignTitle(`${prod.brandName} ${prod.sku} Stock Push & Clearance Campaign`);
    setCampaignGoal(`Push warehouse inventory of ${prod.name} (${prod.availableQty} ${prod.unit} available) at ${prod.discountPercent}% clearance discount.`);
    generateDefaultPitches(prod, brands.find((b) => b.id === prod.brandId));
  };

  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    const brandProducts = products.filter((p) => p.brandId === brandId);
    if (brandProducts.length > 0) {
      handleSelectProduct(brandProducts[0]);
    }
  };

  const generateDefaultPitches = (prod: WarehouseProduct, brand?: Brand) => {
    const brandName = brand?.name || prod.brandName;
    setPitchWhatsApp(
      `Hi {contact_name}, this is {salesman_name} from Gulf Stockist. We have an exclusive warehouse allocation on original *${brandName} ${prod.name}* (SKU: ${prod.sku}) at a special promotional rate of *$${prod.suggestedPushPrice}* (${prod.discountPercent}% off list price) ready for immediate dispatch from our Dubai warehouse. How many ${prod.unit} can we reserve for {company} this week?`
    );
    setPitchEmailSubject(`Special Warehouse Stock Allocation: ${brandName} ${prod.sku} for {company}`);
    setPitchEmail(
      `Dear {contact_name},\n\nWe are currently offering an exclusive warehouse stock allocation on genuine ${brandName} ${prod.name} at a special push price of $${prod.suggestedPushPrice} per ${prod.unit} (${prod.discountPercent}% below standard list price).\n\nKey Specifications:\n- SKU: ${prod.sku}\n- Specification: ${prod.specification}\n- Minimum Order Quantity: ${prod.moq} ${prod.unit}\n- Ex-Stock Warehouse: ${prod.warehouseLocation}, Same-day dispatch available\n\nPlease let us know if we can prepare a formal quotation or dispatch sample units to your yard.\n\nBest regards,\n{salesman_name}\nTechnical Sales & Distribution Hub`
    );
    setPitchCallScript(
      `Hook: "Hello Eng. {contact_name}, calling from Gulf Stockist regarding your upcoming fabrication and consumables requirements at {company}. We have a special warehouse allocation of ${brandName} ${prod.sku} at $${prod.suggestedPushPrice} per ${prod.unit}."\n\nObjection Handling:\n- "We already have stock": Highlight that our warehouse batch has immediate same-day delivery with full mill test certificates and 100% price guarantee.\n\nClosing: "Can I lock in ${prod.moq * 2} ${prod.unit} on today's delivery schedule for your team?"`
    );
  };

  const handleGenerateAIPitch = async () => {
    if (!currentProduct) return;
    setIsGeneratingPitch(true);
    try {
      const res = await fetch('/api/generate-campaign-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: currentProduct.brandName,
          productName: currentProduct.name,
          sku: currentProduct.sku,
          category: currentProduct.materialCategory,
          offerPrice,
          regularPrice: currentProduct.listPrice,
          discountPercent: currentProduct.discountPercent,
          moq,
          targetCategories:
            selectedCustomerCategory === 'All'
              ? currentProduct.targetCustomerCategories
              : [selectedCustomerCategory],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.whatsApp) setPitchWhatsApp(data.whatsApp);
        if (data.email) setPitchEmail(data.email);
        if (data.emailSubject) setPitchEmailSubject(data.emailSubject);
        if (data.callScript) setPitchCallScript(data.callScript);
      }
    } catch (err) {
      console.error('Error generating AI pitch:', err);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const handleInlineAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      const created = await quickAddNewCustomer({
        name: newClientName.trim(),
        category: newClientCategory,
        contactName: newClientContact || 'Procurement Contact',
        contactRole: 'Manager',
        phone: newClientPhone,
        email: newClientEmail,
        address: newClientAddress,
      });

      // Auto-select this newly created client
      setSelectedClientIds((prev) => [...prev, created.id]);
      setShowAddClientInline(false);
      setNewClientName('');
      setNewClientContact('');
      setNewClientPhone('');
    } catch (err) {
      console.error('Failed to create customer:', err);
    }
  };

  // Quick Select Toggles
  const handleSelectAllEligible = () => {
    setSelectedClientIds(eligibleClients.map((c) => c.id));
  };

  const handleSelectCollisionFree = () => {
    const freeIds = eligibleClients
      .filter((c) => !clientCollisionMap.has(c.id))
      .map((c) => c.id);
    setSelectedClientIds(freeIds);
  };

  const handleClearSelection = () => {
    setSelectedClientIds([]);
  };

  const toggleClientSelection = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSalesman = (name: string) => {
    setAssignedSalesmen((prev) =>
      prev.includes(name)
        ? prev.length > 1
          ? prev.filter((n) => n !== name)
          : prev
        : [...prev, name]
    );
  };

  // Launch the campaign
  const handleLaunchCampaign = () => {
    if (!currentProduct || !currentBrand || selectedClientIds.length === 0) return;

    // Safety check immediately before sending: exclude any selected clients that are Tier 1 restricted
    const currentProductLine = `${currentBrand.name} ${currentProduct.name}`.toLowerCase();
    const brandNameLower = currentBrand.name.toLowerCase();
    
    const finalSafeClientIds = selectedClientIds.filter(clientId => {
      const client = clients.find(c => c.id === clientId);
      if (!client) return false;
      
      if (client.tier === 1 && client.tier1) {
        const status = client.tier1.allocationStatus;
        if (status === 'Allocated — Other Distributor' || status === 'Allocated — Brand Direct') {
          let hasOverlap = true;
          if (client.tier1.allocatedProductLines && client.tier1.allocatedProductLines.length > 0) {
            hasOverlap = client.tier1.allocatedProductLines.some(line => {
               const lineLower = line.toLowerCase();
               return currentProductLine.includes(lineLower) || lineLower.includes(currentProductLine) || lineLower.includes(brandNameLower);
            });
          }
          if (hasOverlap) return false; // EXCLUDE!
        }
      }
      return true;
    });

    if (finalSafeClientIds.length === 0) {
      alert("All selected clients were excluded due to Tier 1 allocation restrictions.");
      return;
    }

    const targets: CampaignClientTarget[] = finalSafeClientIds.map((clientId, idx) => {
      const client = clients.find((c) => c.id === clientId);
      const contact = client?.contacts?.[0];
      const assignedRep =
        assignedSalesmen[idx % assignedSalesmen.length] || assignedSalesmen[0] || 'Marcus Vance';
      const col = clientCollisionMap.get(clientId);

      return {
        id: `target-${Date.now()}-${idx}`,
        campaignId: '',
        clientId,
        clientName: client?.name || 'Customer',
        clientCategory: client?.category || 'Other',
        tier: client?.tier || 2,
        contactName: contact?.name || 'Procurement Head',
        contactRole: contact?.role || 'Manager',
        phone: contact?.mobile || client?.phone || '',
        email: contact?.email || '',
        address: client?.address || '',
        assignedSalesman: assignedRep,
        status: 'Pending',
        priceOffered: Number(offerPrice),
        quantityDiscussed: Number(moq),
        notes: `Pitched via Campaign: ${campaignTitle}`,
        collisionInfo: col || undefined,
      };
    });

    const launched = createAndLaunchCampaign({
      title: campaignTitle || `${currentBrand.name} ${currentProduct.sku} Stock Push`,
      goal: campaignGoal || `Push warehouse inventory of ${currentProduct.name}`,
      targetCustomerCategories:
        selectedCustomerCategory === 'All'
          ? currentProduct.targetCustomerCategories
          : [selectedCustomerCategory],
      brandId: currentBrand.id,
      brandName: currentBrand.name,
      productId: currentProduct.id,
      productName: currentProduct.name,
      sku: currentProduct.sku,
      materialCategory: currentProduct.materialCategory,
      offerPrice: Number(offerPrice),
      regularPrice: Number(currentProduct.listPrice),
      discountPercent: Number(currentProduct.discountPercent),
      moq: Number(moq),
      status: 'Active',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      assignedSalesmen,
      pitchTemplateWhatsApp: pitchWhatsApp,
      pitchTemplateEmail: pitchEmail,
      pitchCallScript: pitchCallScript,
      targetClientIds: selectedClientIds,
      targets,
      metrics: {
        totalTargets: targets.length,
        contactedCount: 0,
        samplesSentCount: 0,
        quotedCount: 0,
        orderedCount: 0,
        declinedCount: 0,
        totalRevenueWon: 0,
        stockPushedQty: targets.length * moq,
      },
    });

    onCampaignCreated(launched);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#12151a] border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Top Header & Multi-Step Bar */}
        <div className="p-5 border-b border-slate-800 bg-[#161a22] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Flame className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-bold text-slate-100">
                  Launch Stock Push Campaign (Multi-Brand Workflow)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Push warehouse inventory of selected brands to targeted customer categories with automatic salesman collision protection.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Navigation */}
          <div className="grid grid-cols-5 gap-2 mt-4 pt-3 border-t border-slate-800/80">
            {[
              { num: 1, label: 'Target Category', icon: Layers },
              { num: 2, label: 'Brand & SKU', icon: Package },
              { num: 3, label: 'Select Customers', icon: Users },
              { num: 4, label: 'Pitch & Salesmen', icon: MessageSquareIcon },
              { num: 5, label: 'Review & Launch', icon: Send },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (step.num < currentStep || (step.num === 2 && currentProduct)) {
                      setCurrentStep(step.num);
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                      : isPast
                      ? 'bg-slate-800/80 text-blue-400 font-medium hover:bg-slate-800'
                      : 'bg-slate-900/60 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                      isActive
                        ? 'bg-white text-blue-600 font-bold'
                        : isPast
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isPast ? <Check className="w-3 h-3" /> : step.num}
                  </span>
                  <span className="truncate hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body Step Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* STEP 1: Category Selecting */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" /> Step 1: Select Target Customer Industry & Material Category
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Choose which market segment you are pushing warehouse materials to.
                </p>
              </div>

              {/* Customer Industry Categories Grid */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 block">
                  Target Customer Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerCategory('All')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      selectedCustomerCategory === 'All'
                        ? 'bg-blue-600/15 border-blue-500 text-blue-300 ring-1 ring-blue-500'
                        : 'bg-[#161a22] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold">All Industries</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {clients.length} Total Customers in CRM
                    </div>
                  </button>
                  {DEFAULT_CUSTOMER_CATEGORIES.map((cat) => {
                    const count = clients.filter((c) => c.category === cat).length;
                    const isSelected = selectedCustomerCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCustomerCategory(cat)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-blue-300 ring-1 ring-blue-500'
                            : 'bg-[#161a22] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold truncate">{cat}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{count} Customers</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Client Tiers Filter */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 block">
                  Customer Tiers
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { tier: 1, label: 'Tier 1 (Enterprise / Mega Yards)' },
                    { tier: 2, label: 'Tier 2 (Mid-Scale Fabricators)' },
                    { tier: 3, label: 'Tier 3 (Specialist Contractors)' },
                    { tier: 4, label: 'Tier 4 (General Trade)' },
                  ].map((t) => {
                    const isChecked = selectedTiers.includes(t.tier);
                    return (
                      <button
                        key={t.tier}
                        type="button"
                        onClick={() => {
                          setSelectedTiers((prev) =>
                            prev.includes(t.tier)
                              ? prev.length > 1
                                ? prev.filter((x) => x !== t.tier)
                                : prev
                              : [...prev, t.tier]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          isChecked
                            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-[#161a22] border-slate-800 text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Material Category Focus */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 block">
                  Warehouse Material Category Focus
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMaterialCategory('All')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      selectedMaterialCategory === 'All'
                        ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                        : 'bg-[#161a22] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Warehouse Materials
                  </button>
                  {DEFAULT_MATERIAL_CATEGORIES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMaterialCategory(m)}
                      className={`p-2.5 rounded-xl border text-left text-xs truncate transition-all ${
                        selectedMaterialCategory === m
                          ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                          : 'bg-[#161a22] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Matching Summary Banner */}
              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Target Audience Pool</span>
                  <div className="text-base font-bold text-slate-100">
                    {eligibleClients.length} Potential Customers Match Your Filter
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
                >
                  Continue to Brand & SKU Selection <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Brand & Product / Accessory Selecting */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" /> Step 2: Select Brand & Warehouse Stock Material / Accessory
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the brand and the exact warehouse SKU to push with custom campaign pricing.
                </p>
              </div>

              {/* Brand Selector Cards */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 block">
                  Select Brand
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {brands.map((b) => {
                    const isSelected = selectedBrandId === b.id;
                    const brandProductsCount = products.filter((p) => p.brandId === b.id).length;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBrand(b.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-blue-200 ring-1 ring-blue-500'
                            : 'bg-[#161a22] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-100">{b.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {b.country}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2">
                          {brandProductsCount} Warehouse SKUs
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warehouse Products for Selected Brand */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 block">
                  Select Warehouse SKU / Accessory ({currentBrand?.name})
                </label>
                <div className="space-y-2.5">
                  {products
                    .filter((p) => p.brandId === selectedBrandId)
                    .map((p) => {
                      const isSelected = selectedProductId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                              : 'bg-[#161a22] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                  {p.sku}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                  {p.materialCategory}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    p.inventoryStatus === 'Overstock Push'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : p.inventoryStatus === 'Fast Mover'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-blue-500/20 text-blue-400'
                                  }`}
                                >
                                  {p.inventoryStatus}
                                </span>
                              </div>
                              <h5 className="text-sm font-semibold text-slate-100 mt-1.5">{p.name}</h5>
                              <p className="text-xs text-slate-400 mt-0.5">{p.specification}</p>
                              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                                <span>
                                  Location: <strong className="text-slate-300">{p.warehouseLocation}</strong>
                                </span>
                                <span>
                                  Available Stock:{' '}
                                  <strong className="text-emerald-400 font-bold">
                                    {p.availableQty} {p.unit}
                                  </strong>
                                </span>
                                <span>
                                  MOQ: <strong className="text-slate-300">{p.moq} {p.unit}</strong>
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                              <span className="text-xs text-slate-400 line-through">${p.listPrice}</span>
                              <div className="text-lg font-extrabold text-emerald-400">
                                ${p.suggestedPushPrice}
                              </div>
                              <span className="text-[10px] text-emerald-400 font-medium">
                                {p.discountPercent}% Clearance Discount
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Campaign Terms Editor */}
              {currentProduct && (
                <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-4">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Campaign Commercial Terms
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Promotional Offer Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(Number(e.target.value))}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Min Order Qty (MOQ)</label>
                      <input
                        type="number"
                        value={moq}
                        onChange={(e) => setMoq(Number(e.target.value))}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Launch Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Campaign Expiry</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Campaign Title</label>
                    <input
                      type="text"
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      placeholder="e.g. Q3 ESAB 48.04 Overstock Warehouse Clearance"
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Customer Pinpoint Search, Pinpoint Selection & Inline New Customer Creation */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> Step 3: Pinpoint & Select Target Customers
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review rep collision history to avoid duplicate pitches, or onboard a new customer directly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddClientInline(!showAddClientInline)}
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                >
                  <Plus className="w-4 h-4" /> {showAddClientInline ? 'Hide Form' : 'List as New Customer'}
                </button>
              </div>

              {/* Inline Add New Customer Drawer */}
              {showAddClientInline && (
                <div className="p-4 bg-slate-900 border border-blue-500/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" /> Quick Customer Onboarding (Instant Campaign Enrollment)
                    </h5>
                    <span className="text-[11px] text-slate-400">Saves to CRM database</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Company Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Arab Heavy Industries PJSC"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Industry Category</label>
                      <select
                        value={newClientCategory}
                        onChange={(e) => setNewClientCategory(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      >
                        {DEFAULT_CUSTOMER_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Contact Person</label>
                      <input
                        type="text"
                        placeholder="e.g. Eng. Tariq Mansoor"
                        value={newClientContact}
                        onChange={(e) => setNewClientContact(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Mobile / WhatsApp</label>
                      <input
                        type="text"
                        placeholder="+971 50 123 4567"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Email</label>
                      <input
                        type="email"
                        placeholder="procurement@client.ae"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">Yard / Site Address</label>
                      <input
                        type="text"
                        placeholder="Jebel Ali, Dubai, UAE"
                        value={newClientAddress}
                        onChange={(e) => setNewClientAddress(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleInlineAddCustomer}
                      disabled={!newClientName.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Save & Select Customer
                    </button>
                  </div>
                </div>
              )}

              {/* Pinpoint Search & Filter Bar */}
              {excludedTier1Clients.length > 0 && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex flex-col gap-2 mb-2">
                  <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
                    <ShieldAlert className="w-4 h-4" /> {excludedTier1Clients.length} clients excluded — Tier 1 / allocation restricted
                  </div>
                  <div className="text-[11px] text-red-300/80 pl-6 leading-relaxed">
                    {excludedTier1Clients.map(c => c.name).join(', ')} cannot be targeted because they are strictly allocated to another distributor or direct brand deal for this product line. You must override allocation on their client profile to include them.
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Pinpoint customer by company name, contact, phone, location..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-[#161a22] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Bulk Selection Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectAllEligible}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                  >
                    Select All ({eligibleClients.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectCollisionFree}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 hover:bg-emerald-900/60 text-xs text-emerald-300 font-medium transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Collision-Free Only
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Customer List with Live Collision Warning Indicators */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {eligibleClients.length === 0 ? (
                  <div className="p-8 text-center bg-[#161a22] rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No customers match the current filter or search criteria.
                  </div>
                ) : (
                  eligibleClients.map((client) => {
                    const isSelected = selectedClientIds.includes(client.id);
                    const collision = clientCollisionMap.get(client.id);
                    const contact = client.contacts?.[0];

                    return (
                      <div
                        key={client.id}
                        onClick={() => toggleClientSelection(client.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500/50'
                            : 'bg-[#161a22] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="pt-0.5 shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </div>

                        {/* Customer Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-100">{client.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                              {client.category}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                              Tier {client.tier || 2}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-1">
                            {contact && (
                              <span>
                                Contact: <strong className="text-slate-300">{contact.name}</strong> ({contact.role || 'Procurement'})
                              </span>
                            )}
                            {contact?.mobile && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-500" /> {contact.mobile}
                              </span>
                            )}
                            <span className="truncate">{client.address}</span>
                          </div>

                          {/* Collision Warning Indicator Badge */}
                          {collision ? (
                            <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-300">
                              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                              <div className="truncate">
                                <strong>Pushed {collision.daysAgo} days ago</strong> by{' '}
                                <span className="font-semibold text-white">{collision.previousSalesman}</span> (Status:{' '}
                                <span className="underline">{collision.previousStatus}</span>
                                {collision.priceOffered ? ` @ $${collision.priceOffered}` : ''})
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>No previous salesman push for this SKU — Clean prospect</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selection Counter Bar */}
              <div className="p-3.5 bg-[#161a22] rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  Selected <strong className="text-blue-400 font-bold">{selectedClientIds.length}</strong> of{' '}
                  {eligibleClients.length} matching customers.
                </div>
                <div className="text-slate-400">
                  Total Push Volume:{' '}
                  <strong className="text-emerald-400 font-semibold">
                    {selectedClientIds.length * moq} {currentProduct?.unit}
                  </strong>{' '}
                  (Est. ${selectedClientIds.length * moq * offerPrice})
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Pitch & Salesmen Assignment */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <MessageSquareIcon className="w-4 h-4 text-blue-400" /> Step 4: Outreach Templates & Sales Rep Assignment
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Assign sales engineers and customize channel pitch scripts for WhatsApp, Email, and Phone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAIPitch}
                  disabled={isGeneratingPitch}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingPitch ? 'AI Crafting Pitch...' : 'AI Re-Generate Pitch'}
                </button>
              </div>

              {/* Salesmen Assignment Checkboxes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 block">
                  Assign Sales Reps to Execute Campaign
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {salesmen.map((s) => {
                    const isAssigned = assignedSalesmen.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSalesman(s.name)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          isAssigned
                            ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/50 text-slate-100'
                            : 'bg-[#161a22] border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${s.avatarColor}`}
                        >
                          {s.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-slate-100 truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{s.role}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp Pitch Editor */}
              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> WhatsApp Outreach Script (1-Click Instant Pitch)
                  </label>
                  <span className="text-[10px] text-slate-500">Supports *bold* formatting</span>
                </div>
                <textarea
                  rows={4}
                  value={pitchWhatsApp}
                  onChange={(e) => setPitchWhatsApp(e.target.value)}
                  className="w-full bg-[#12151a] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none custom-scrollbar font-mono leading-relaxed"
                />
              </div>

              {/* Email Pitch Editor */}
              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Formal Email Quotation & Pitch
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Email Subject Line"
                  value={pitchEmailSubject}
                  onChange={(e) => setPitchEmailSubject(e.target.value)}
                  className="w-full bg-[#12151a] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-semibold focus:border-blue-500 focus:outline-none"
                />
                <textarea
                  rows={5}
                  value={pitchEmail}
                  onChange={(e) => setPitchEmail(e.target.value)}
                  className="w-full bg-[#12151a] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none custom-scrollbar font-mono leading-relaxed"
                />
              </div>

              {/* Phone Call Script */}
              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Sales Rep Phone Call Script & Objection Handling
                </label>
                <textarea
                  rows={3}
                  value={pitchCallScript}
                  onChange={(e) => setPitchCallScript(e.target.value)}
                  className="w-full bg-[#12151a] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none custom-scrollbar font-mono"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Review & Launch */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" /> Step 5: Final Review & Multitude Launch
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm campaign parameters before rolling out to sales team execution boards.
                </p>
              </div>

              {/* Campaign Summary Card */}
              <div className="p-5 bg-[#161a22] rounded-2xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold uppercase tracking-wider">
                      Stock Push Campaign
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 mt-1">{campaignTitle}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{campaignGoal}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Target Reach</span>
                    <div className="text-2xl font-extrabold text-blue-400">
                      {selectedClientIds.length} Customers
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[11px]">Brand & SKU</span>
                    <p className="font-bold text-slate-200 mt-0.5">{currentBrand?.name}</p>
                    <p className="text-[11px] text-blue-400 font-mono">{currentProduct?.sku}</p>
                  </div>
                  <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[11px]">Push Offer Price</span>
                    <p className="font-bold text-emerald-400 mt-0.5">${offerPrice} / {currentProduct?.unit}</p>
                    <p className="text-[11px] text-slate-400 line-through">List: ${currentProduct?.listPrice}</p>
                  </div>
                  <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[11px]">Warehouse Stock</span>
                    <p className="font-bold text-slate-200 mt-0.5">{currentProduct?.availableQty} {currentProduct?.unit} Available</p>
                    <p className="text-[11px] text-slate-400">Rack: {currentProduct?.warehouseLocation}</p>
                  </div>
                  <div className="p-3 bg-[#12151a] rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[11px]">Assigned Sales Reps</span>
                    <p className="font-bold text-slate-200 mt-0.5">{assignedSalesmen.length} Reps</p>
                    <p className="text-[11px] text-slate-400 truncate">{assignedSalesmen.join(', ')}</p>
                  </div>
                </div>

                {/* Targeted Customers List Preview */}
                <div>
                  <h5 className="text-xs font-semibold text-slate-300 mb-2">
                    Target Customers Enrolled ({selectedClientIds.length})
                  </h5>
                  <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-1.5">
                    {selectedClientIds.map((id, index) => {
                      const client = clients.find((c) => c.id === id);
                      const rep = assignedSalesmen[index % assignedSalesmen.length];
                      return (
                        <div
                          key={id}
                          className="p-2.5 bg-[#12151a] rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Building className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium text-slate-200">{client?.name}</span>
                            <span className="text-[10px] text-slate-500">({client?.category})</span>
                          </div>
                          <div className="text-[11px] text-blue-400 font-medium">
                            Rep: {rep}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-[#161a22] flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
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

            {currentStep < 5 ? (
              <button
                type="button"
                disabled={
                  (currentStep === 2 && !currentProduct) ||
                  (currentStep === 3 && selectedClientIds.length === 0)
                }
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-all"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLaunchCampaign}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all animate-pulse"
              >
                <Send className="w-4 h-4" /> Launch Campaign for {selectedClientIds.length} Customers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageSquareIcon(props: any) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
