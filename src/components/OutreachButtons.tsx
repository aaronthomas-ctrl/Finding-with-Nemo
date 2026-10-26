import React, { useState } from 'react';
import { MessageCircle, Mail, Linkedin, ChevronDown } from 'lucide-react';
import { Client } from '../db';
import { executeOutreach } from '../lib/outreach';

interface OutreachButtonsProps {
  client: Client;
  defaultPurpose?: 'firstOutreach' | 'followUp' | 'campaign';
  productLine?: string;
  onActionComplete?: () => void;
  className?: string;
}

export function OutreachButtons({ 
  client, 
  defaultPurpose = 'firstOutreach', 
  productLine,
  onActionComplete,
  className = ""
}: OutreachButtonsProps) {
  const [purpose, setPurpose] = useState(defaultPurpose);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contact = client.contacts && client.contacts.length > 0 ? client.contacts.find(c => c.mobile) || client.contacts[0] : null;
  const hasMobile = !!contact?.mobile;
  const hasEmail = !!contact?.email;

  const handleAction = async (e: React.MouseEvent, channel: 'WhatsApp' | 'Email' | 'LinkedIn') => {
    e.stopPropagation();
    setError(null);
    try {
      await executeOutreach(client, channel, purpose, productLine);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className={`flex items-center gap-2 relative ${className}`}>
      {error && (
        <div className="absolute -top-8 left-0 right-0 text-center text-xs text-red-400 bg-red-500/10 border border-red-500/20 py-1 px-2 rounded">
          {error}
        </div>
      )}
      
      <div className="relative">
        <button 
          onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
          className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
        >
          {purpose === 'firstOutreach' ? 'First Touch' : purpose === 'followUp' ? 'Follow-up' : 'Campaign'}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showDropdown && (
          <div className="absolute top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 overflow-hidden w-32">
            <button 
              onClick={(e) => { e.stopPropagation(); setPurpose('firstOutreach'); setShowDropdown(false); }}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-700 ${purpose === 'firstOutreach' ? 'text-blue-400' : 'text-slate-300'}`}
            >
              First Touch
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setPurpose('followUp'); setShowDropdown(false); }}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-700 ${purpose === 'followUp' ? 'text-blue-400' : 'text-slate-300'}`}
            >
              Follow-up
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setPurpose('campaign'); setShowDropdown(false); }}
              className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-700 ${purpose === 'campaign' ? 'text-blue-400' : 'text-slate-300'}`}
            >
              Campaign
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={(e) => handleAction(e, 'WhatsApp')}
        disabled={!hasMobile}
        className={`p-2 rounded-lg transition-colors border ${hasMobile ? 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border-[#25D366]/20' : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'}`}
        title={hasMobile ? "WhatsApp" : "No mobile saved"}
      >
        <MessageCircle className="w-4 h-4" />
      </button>
      <button 
        onClick={(e) => handleAction(e, 'Email')}
        disabled={!hasEmail}
        className={`p-2 rounded-lg transition-colors border ${hasEmail ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20' : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'}`}
        title={hasEmail ? "Email" : "No email saved"}
      >
        <Mail className="w-4 h-4" />
      </button>
      <button 
        onClick={(e) => handleAction(e, 'LinkedIn')}
        className="p-2 bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20 rounded-lg transition-colors border border-[#0077b5]/20"
        title="LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
      </button>
    </div>
  );
}
