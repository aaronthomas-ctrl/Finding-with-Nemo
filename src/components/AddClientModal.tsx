import { useCategories } from '../lib/profile';
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { db, Client } from '../db';
import { v4 as uuidv4 } from 'uuid';

interface AddClientModalProps {
  onClose: () => void;
}

export function AddClientModal({ onClose }: AddClientModalProps) {
  const categoryOptions = useCategories();
  const [formData, setFormData] = useState({
    name: '',
    category: 'Other',
    phone: '',
    website: '',
    address: '',
    backgroundBlurb: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const newClient: Client = {
      id: uuidv4(),
      name: formData.name,
      address: formData.address,
      lat: null,
      lng: null,
      phone: formData.phone,
      website: formData.website,
      backgroundBlurb: formData.backgroundBlurb,
      category: formData.category as any,
      tier: 3,
      status: "New",
      whatTheyDo: formData.backgroundBlurb,
      contacts: [],
      nextFollowUpDate: null,
      retryFlag: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      tier1: {
        isWatch: false,
        region: "",
        primarySiteAddress: "",
        justification: "",
        territoryStatus: "Open",
        allocatedTo: "",
        allocatedProductLines: []
      }
    };

    try {
      await db.clients.add(newClient);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to add client.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#12151a] border border-slate-700 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold text-slate-100">Add Client</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="add-client-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Company Name *</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Website</label>
              <input 
                type="url" 
                value={formData.website}
                onChange={e => setFormData({...formData, website: e.target.value})}
                className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Address</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Background / What they do</label>
              <textarea 
                rows={3}
                value={formData.backgroundBlurb}
                onChange={e => setFormData({...formData, backgroundBlurb: e.target.value})}
                className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
              ></textarea>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-[#12151a] flex justify-end gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="add-client-form"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Save Client
          </button>
        </div>
      </div>
    </div>
  );
}
