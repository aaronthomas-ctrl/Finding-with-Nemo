import React, { useState } from 'react';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { X } from 'lucide-react';
import { CompanyResult } from '../types';

interface AddTier1ModalProps {
  company?: CompanyResult;
  onClose: () => void;
  onSuccess: (clientId: string) => void;
}

export function AddTier1Modal({ company, onClose, onSuccess }: AddTier1ModalProps) {
  const [name, setName] = useState(company?.name || '');
  const [emirate, setEmirate] = useState('');
  const [address, setAddress] = useState(company?.address || '');
  const [justification, setJustification] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const newId = uuidv4();
      await db.clients.add({
        id: newId,
        name: name,
        address: address,
        lat: company?.location?.latitude || 25.2048,
        lng: company?.location?.longitude || 55.2708,
        phone: company?.phone || '',
        website: company?.website || '',
        backgroundBlurb: company?.summary || '',
        category: "Other", // Can be refined later
        tier: 1, // Locked to 1
        status: "New",
        whatTheyDo: company?.summary || '',
        contacts: [],
        nextFollowUpDate: null,
        retryFlag: false,
        createdAt: now,
        updatedAt: now,
        tier1: {
          isWatch: true,
          emirate,
          primarySiteAddress: address,
          justification,
          allocationStatus: "Open",
          allocatedTo: "",
          allocatedProductLines: []
        }
      });
      onSuccess(newId);
    } catch (err) {
      console.error(err);
      alert('Failed to add to Tier 1 Watch');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d23] border border-slate-700 rounded-xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#111419]">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="text-amber-500 text-xl">🛡️</span> Add to Tier 1 Watch
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Company Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#111419] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Emirate / Region</label>
            <input
              required
              type="text"
              placeholder="e.g. Abu Dhabi"
              value={emirate}
              onChange={e => setEmirate(e.target.value)}
              className="w-full bg-[#111419] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Primary Site Address</label>
            <input
              required
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full bg-[#111419] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Tier 1 Justification</label>
            <textarea
              required
              rows={3}
              placeholder="Why does this account matter? e.g. multi-project ADNOC EPC, high consumable burn"
              value={justification}
              onChange={e => setJustification(e.target.value)}
              className="w-full bg-[#111419] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 text-sm font-medium rounded-lg transition-colors"
            >
              Save to Tier 1
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
