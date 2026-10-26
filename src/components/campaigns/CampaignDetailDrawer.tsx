import { apiFetch } from '../../lib/api';
import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Users,
  ShieldAlert,
  Edit3,
  Calendar,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Building,
  Check
} from 'lucide-react';
import { StockCampaign, CampaignClientTarget, PushChannel } from '../../types/stockist';
import { updateCampaignTargetStatus } from '../../lib/stockData';
import { Sparkles, Loader2 } from 'lucide-react';
import { db } from '../../db';

interface CampaignDetailDrawerProps {
  campaign: StockCampaign | null;
  isOpen: boolean;
  onClose: () => void;
  onCampaignUpdated: () => void;
}

export function CampaignDetailDrawer({
  campaign,
  isOpen,
  onClose,
  onCampaignUpdated,
}: CampaignDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'targets' | 'templates' | 'analytics'>('targets');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [personalizingId, setPersonalizingId] = useState<string | null>(null);

  // Target interaction modal state
  const [activeTargetForNote, setActiveTargetForNote] = useState<CampaignClientTarget | null>(null);
  const [noteStatus, setNoteStatus] = useState<string>('Contacted');
  const [noteText, setNoteText] = useState<string>('');
  const [orderedQty, setOrderedQty] = useState<number>(campaign?.moq || 10);
  const [revenueWon, setRevenueWon] = useState<number>((campaign?.moq || 10) * (campaign?.offerPrice || 0));

  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isBulkPersonalizing, setIsBulkPersonalizing] = useState(false);

  if (!isOpen || !campaign) return null;

  const targets = campaign.targets || [];

  const filteredTargets = targets.filter((t) => {
    const matchStatus = filterStatus === 'All' || t.status === filterStatus;
    const matchSearch =
      !searchTerm.trim() ||
      t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assignedSalesman.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.clientCategory && t.clientCategory.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const handleSelectAllFiltered = () => {
    if (selectedTargetIds.length === filteredTargets.length) {
      setSelectedTargetIds([]);
    } else {
      setSelectedTargetIds(filteredTargets.map(t => t.clientId));
    }
  };

  const toggleTargetSelection = (clientId: string) => {
    setSelectedTargetIds(prev => prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]);
  };

  const handleBulkPersonalize = async () => {
    setIsBulkPersonalizing(true);
    for (const id of selectedTargetIds) {
      const target = targets.find(t => t.clientId === id);
      if (target && !target.personalizedPitchWhatsApp) {
        await handlePersonalizePitch(target);
      }
    }
    setIsBulkPersonalizing(false);
    setSelectedTargetIds([]);
  };

  const handleBulkWhatsApp = () => {
    // Collect contacts to potentially open a single mailto or wa.me, but wa.me doesn't support multiple numbers well.
    // We will just mark them as contacted.
    selectedTargetIds.forEach(id => {
      const target = targets.find(t => t.clientId === id);
      if (target) {
        if (target.status === 'Pending') {
           updateCampaignTargetStatus(campaign.id, target.clientId, 'Contacted', {
             channelUsed: 'WhatsApp',
             notes: `Bulk pitch dispatched via WhatsApp by ${target.assignedSalesman}. ${target.personalizationContext ? '[AI Personalized]' : ''}`
           });
        }
      }
    });
    alert(`Marked ${selectedTargetIds.length} targets as Contacted via WhatsApp.\n(In a live environment, this would trigger the WhatsApp Business API).`);
    onCampaignUpdated();
    setSelectedTargetIds([]);
  };

  const handleBulkEmail = () => {
    // We could do a bulk mailto link with BCCs
    const emails = selectedTargetIds.map(id => targets.find(t => t.clientId === id)?.email).filter(e => e).join(',');
    if (emails) {
       const subject = campaign.title;
       const body = "Please see our latest stock clearance offer."; // Generic fallback for bulk email
       window.open(`mailto:?bcc=${emails}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    }

    selectedTargetIds.forEach(id => {
      const target = targets.find(t => t.clientId === id);
      if (target && target.status === 'Pending') {
         updateCampaignTargetStatus(campaign.id, target.clientId, 'Contacted', {
           channelUsed: 'Email',
           notes: `Bulk quotation sent via Email by ${target.assignedSalesman}.`
         });
      }
    });
    onCampaignUpdated();
    setSelectedTargetIds([]);
  };

  const handleStatusChange = (target: CampaignClientTarget, newStatus: any) => {
    if (newStatus === 'Ordered') {
      setActiveTargetForNote(target);
      setNoteStatus('Ordered');
      setOrderedQty(campaign.moq);
      setRevenueWon(campaign.moq * campaign.offerPrice);
      return;
    }

    updateCampaignTargetStatus(campaign.id, target.clientId, newStatus);
    onCampaignUpdated();
  };

  const handleSaveTargetNote = () => {
    if (!activeTargetForNote) return;

    updateCampaignTargetStatus(campaign.id, activeTargetForNote.clientId, noteStatus as any, {
      notes: noteText,
      quantityOrdered: noteStatus === 'Ordered' ? Number(orderedQty) : undefined,
      revenueWon: noteStatus === 'Ordered' ? Number(revenueWon) : undefined,
    });

    setActiveTargetForNote(null);
    setNoteText('');
    onCampaignUpdated();
  };

  const handlePersonalizePitch = async (target: CampaignClientTarget) => {
    setPersonalizingId(target.clientId);
    try {
      // 1. Fetch real structured history
      const enquiries = await db.enquiries.toArray();
      const clientEnquiries = enquiries.filter(e => e.clientId === target.clientId);
      
      const leads = await db.leads.toArray();
      const clientLeads = leads.filter(l => l.clientId === target.clientId);
      
      const history = [
        ...clientEnquiries.map(e => ({ date: e.date, productLine: e.productLine, quantity: e.quantity, outcome: e.outcome })),
        ...clientLeads.map(l => ({ date: l.date, productLine: l.productLine, quantity: 1, outcome: l.stage }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      // 2. Call personalization endpoint
      const response = await apiFetch('/api/personalize-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: target.contactName || 'Valued Customer',
          company: target.clientName,
          salesmanName: target.assignedSalesman || 'Sales Specialist',
          brandName: campaign.brandName,
          productName: campaign.productName,
          offerPrice: campaign.offerPrice,
          moq: campaign.moq,
          baseWhatsApp: campaign.pitchTemplateWhatsApp,
          baseEmail: campaign.pitchTemplateEmail,
          enquiryHistory: history
        })
      });

      if (!response.ok) throw new Error("Failed to personalize");
      const data = await response.json();

      // 3. Save to target status
      updateCampaignTargetStatus(campaign.id, target.clientId, target.status, {
         // Hack to inject these new fields since updateCampaignTargetStatus doesn't explicitly accept them
         // We will just directly mutate the target in memory for this prototype if needed, but wait, I can edit updateCampaignTargetStatus 
      });
      target.personalizedPitchWhatsApp = data.whatsApp;
      target.personalizedPitchEmail = data.email;
      target.personalizationContext = data.contextUsed || (history.length > 0 ? `Based on ${history.length} past enquiries` : 'Generic Template Fallback');
      
      // Update local storage explicitly
      const campaigns = JSON.parse(localStorage.getItem('stockist_campaigns') || '[]');
      const cIdx = campaigns.findIndex((c: any) => c.id === campaign.id);
      if (cIdx !== -1) {
         const tIdx = campaigns[cIdx].targets.findIndex((t: any) => t.clientId === target.clientId);
         if (tIdx !== -1) {
            campaigns[cIdx].targets[tIdx].personalizedPitchWhatsApp = data.whatsApp;
            campaigns[cIdx].targets[tIdx].personalizedPitchEmail = data.email;
            campaigns[cIdx].targets[tIdx].personalizationContext = target.personalizationContext;
            localStorage.setItem('stockist_campaigns', JSON.stringify(campaigns));
         }
      }
      onCampaignUpdated();
    } catch (error) {
      console.error(error);
      alert("Personalization failed.");
    } finally {
      setPersonalizingId(null);
    }
  };

  const handleLaunchWhatsApp = (target: CampaignClientTarget) => {
    let text = target.personalizedPitchWhatsApp || campaign.pitchTemplateWhatsApp || '';
    if (!target.personalizedPitchWhatsApp) {
      text = text.replace(/{contact_name}/g, target.contactName || 'Valued Customer');
      text = text.replace(/{company}/g, target.clientName);
      text = text.replace(/{salesman_name}/g, target.assignedSalesman || 'Sales Specialist');
    }

    const cleanPhone = (target.phone || '').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    // Auto mark as Contacted if still Pending
    if (target.status === 'Pending') {
      updateCampaignTargetStatus(campaign.id, target.clientId, 'Contacted', {
        channelUsed: 'WhatsApp',
        notes: `Pitch dispatched via WhatsApp by ${target.assignedSalesman}. ${target.personalizationContext ? '[AI Personalized]' : ''}`,
      });
      onCampaignUpdated();
    }
  };

  const handleLaunchEmail = (target: CampaignClientTarget) => {
    let body = target.personalizedPitchEmail || campaign.pitchTemplateEmail || '';
    if (!target.personalizedPitchEmail) {
      body = body.replace(/{contact_name}/g, target.contactName || 'Valued Customer');
      body = body.replace(/{company}/g, target.clientName);
      body = body.replace(/{salesman_name}/g, target.assignedSalesman || 'Sales Specialist');
    }

    let subject = campaign.title;
    const url = `mailto:${target.email || ''}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');

    if (target.status === 'Pending') {
      updateCampaignTargetStatus(campaign.id, target.clientId, 'Contacted', {
        channelUsed: 'Email',
        notes: `Quotation sent via Email by ${target.assignedSalesman}. ${target.personalizationContext ? '[AI Personalized]' : ''}`,
      });
      onCampaignUpdated();
    }
  };

  const conversionRate =
    targets.length > 0
      ? Math.round(((campaign.metrics?.orderedCount || 0) / targets.length) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#12151a] border-l border-slate-800 w-full max-w-3xl h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-[#161a22] shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold uppercase tracking-wider">
                  {campaign.brandName} • {campaign.materialCategory}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    campaign.status === 'Active'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {campaign.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100 mt-1.5">{campaign.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{campaign.productName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800">
            <div className="p-2.5 bg-[#12151a] rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-medium">Total Targets</span>
              <div className="text-base font-bold text-slate-200 mt-0.5">
                {campaign.metrics?.totalTargets || targets.length}
              </div>
              <div className="text-[10px] text-blue-400 mt-0.5">
                {campaign.metrics?.contactedCount || 0} Contacted
              </div>
            </div>
            <div className="p-2.5 bg-[#12151a] rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-medium">Push Price</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                ${campaign.offerPrice}
              </div>
              <div className="text-[10px] text-slate-400 line-through">
                List: ${campaign.regularPrice}
              </div>
            </div>
            <div className="p-2.5 bg-[#12151a] rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-medium">Orders Won</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                {campaign.metrics?.orderedCount || 0} ({conversionRate}%)
              </div>
              <div className="text-[10px] text-slate-400">
                {campaign.metrics?.quotedCount || 0} Quoted
              </div>
            </div>
            <div className="p-2.5 bg-[#12151a] rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-medium">Revenue Won</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                ${(campaign.metrics?.totalRevenueWon || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">
                {campaign.metrics?.stockPushedQty || 0} Pushed
              </div>
            </div>
          </div>

          {/* Drawer Tabs */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab('targets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'targets'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Target Customers ({targets.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'templates'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pitch Templates & Scripts
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {activeTab === 'targets' && (
            <div className="space-y-4">
              {/* Target Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Filter customer or rep..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#161a22] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {['All', 'Pending', 'Contacted', 'Sample Sent', 'Quoted', 'Ordered', 'Declined'].map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors ${
                          filterStatus === st
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#161a22] text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Bulk Actions Bar */}
              <div className="flex items-center justify-between p-3 bg-[#12151a] border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAllFiltered}
                    className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    {selectedTargetIds.length === filteredTargets.length && filteredTargets.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-[11px] text-slate-500">
                    {selectedTargetIds.length} selected
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkPersonalize}
                    disabled={selectedTargetIds.length === 0 || isBulkPersonalizing}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isBulkPersonalizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Bulk Personalize
                  </button>
                  <button
                    onClick={handleBulkWhatsApp}
                    disabled={selectedTargetIds.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Bulk WhatsApp
                  </button>
                  <button
                    onClick={handleBulkEmail}
                    disabled={selectedTargetIds.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" /> Bulk Email
                  </button>
                </div>
              </div>

              {/* Targets List */}
              <div className="space-y-3">
                {filteredTargets.map((target) => {
                  const isSelected = selectedTargetIds.includes(target.clientId);
                  return (
                    <div
                      key={target.clientId}
                      className={`p-4 bg-[#161a22] rounded-xl border space-y-3 transition-colors ${
                        isSelected ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTargetSelection(target.clientId)}
                            className="mt-1 w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-slate-900 bg-slate-800"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-100">{target.clientName}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {target.clientCategory}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                                Tier {target.tier || 2}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                              <span>
                                Contact: <strong className="text-slate-200">{target.contactName}</strong> ({target.contactRole || 'Procurement'})
                              </span>
                              <span>
                                Rep: <strong className="text-blue-400">{target.assignedSalesman}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Dropdown */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <select
                            value={target.status}
                            onChange={(e) => handleStatusChange(target, e.target.value)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-bold border focus:outline-none ${
                              target.status === 'Ordered'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : target.status === 'Quoted'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : target.status === 'Sample Sent'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : target.status === 'Contacted'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : target.status === 'Declined'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Sample Sent">Sample Sent</option>
                            <option value="Quoted">Quoted</option>
                            <option value="Ordered">Ordered / Won</option>
                            <option value="Declined">Declined</option>
                          </select>
                        </div>
                      </div>

                      {/* Collision / Previous rep push warning */}
                      {target.collisionInfo?.hasCollision && (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-center gap-2 text-[11px] text-amber-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            Cross-Rep Collision: Pitched {target.collisionInfo.daysAgo}d ago by{' '}
                            <strong>{target.collisionInfo.previousSalesman}</strong> ({target.collisionInfo.previousStatus})
                          </span>
                        </div>
                      )}

                      {/* Notes / Order details */}
                      {target.notes && (
                        <div className="text-[11px] text-slate-400 bg-[#12151a] p-2 rounded-lg border border-slate-800/80">
                          <span className="text-slate-500 font-semibold">Latest Note:</span> {target.notes}
                        </div>
                      )}

                      {/* AI Personalization Audit Tag */}
                      {target.personalizationContext && (
                        <div className="text-[10px] text-blue-400 flex items-center gap-1 mt-1 bg-blue-900/20 px-2 py-0.5 rounded w-fit border border-blue-800/30">
                          <Sparkles className="w-3 h-3" /> Based on: {target.personalizationContext}
                        </div>
                      )}

                      {/* Action Bar (WhatsApp, Email, Log Note) */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-2">
                        <div className="text-[11px] text-slate-500">
                          {target.phone ? target.phone : 'No phone listed'}
                        </div>
                        <div className="flex items-center gap-2">
                          {!target.personalizedPitchWhatsApp && (
                            <button
                              type="button"
                              onClick={() => handlePersonalizePitch(target)}
                              disabled={personalizingId === target.clientId}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              {personalizingId === target.clientId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                              Personalize Pitch
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleLaunchWhatsApp(target)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Pitch WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLaunchEmail(target)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" /> Email Quote
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTargetForNote(target);
                              setNoteStatus(target.status);
                              setNoteText(target.notes || '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Log Interaction
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" /> WhatsApp Message Template
                  </h4>
                  <span className="text-[10px] text-slate-500">Auto-injects {`{contact_name}`}, {`{company}`}</span>
                </div>
                <div className="p-3 bg-[#12151a] rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {campaign.pitchTemplateWhatsApp}
                </div>
              </div>

              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> Email Template
                </h4>
                <div className="p-3 bg-[#12151a] rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {campaign.pitchTemplateEmail}
                </div>
              </div>

              <div className="p-4 bg-[#161a22] rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Phone className="w-4 h-4" /> Phone Pitch & Objection Script
                </h4>
                <div className="p-3 bg-[#12151a] rounded-lg border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                  {campaign.pitchCallScript}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal for logging notes & order conversion */}
        {activeTargetForNote && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#161a22] border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-100">
                  Update Outcome: {activeTargetForNote.clientName}
                </h4>
                <button onClick={() => setActiveTargetForNote(null)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">New Status</label>
                <select
                  value={noteStatus}
                  onChange={(e) => setNoteStatus(e.target.value)}
                  className="w-full bg-[#12151a] border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="Contacted">Contacted (WhatsApp/Call)</option>
                  <option value="Sample Sent">Sample / Demo Delivered</option>
                  <option value="Quoted">Formal Quotation Delivered</option>
                  <option value="Ordered">Ordered / PO Received (Won)</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>

              {noteStatus === 'Ordered' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div>
                    <label className="text-[11px] text-emerald-300 font-semibold mb-1 block">Quantity Ordered</label>
                    <input
                      type="number"
                      value={orderedQty}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        setOrderedQty(q);
                        setRevenueWon(q * campaign.offerPrice);
                      }}
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg p-1.5 text-xs text-slate-100 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-emerald-300 font-semibold mb-1 block">Revenue ($)</label>
                    <input
                      type="number"
                      value={revenueWon}
                      onChange={(e) => setRevenueWon(Number(e.target.value))}
                      className="w-full bg-[#12151a] border border-slate-700 rounded-lg p-1.5 text-xs text-emerald-400 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">Interaction Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Spoke with yard manager. PO expected next Tuesday."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full bg-[#12151a] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTargetForNote(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTargetNote}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Save Outcome
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
