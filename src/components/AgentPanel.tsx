import { apiFetch } from '../lib/api';
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2, X, MessageSquare, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'agent';
  text: string;
}

interface AgentPanelProps {
  bounds?: google.maps.LatLngBounds;
  customPath?: google.maps.LatLngLiteral[];
  onRefreshDB?: () => void;
  isHidden?: boolean;
}

const DEFAULT_WELCOME: Message = {
  role: 'agent', 
  text: "Hi! I'm your AI Prospecting Co-Pilot. I can help you search for specific companies in your selected area and automatically save them to your Pipeline CRM. How can I help?"
};

export function AgentPanel({ bounds, customPath, onRefreshDB, isHidden = false }: AgentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem('agent_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [DEFAULT_WELCOME];
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem('agent_chat_history', JSON.stringify(messages));
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    const newMessages = [...messages, { role: 'user', text: userMsg } as Message];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      let currentBounds = null;
      if (bounds) {
        currentBounds = {
          low: { latitude: bounds.getSouthWest().lat(), longitude: bounds.getSouthWest().lng() },
          high: { latitude: bounds.getNorthEast().lat(), longitude: bounds.getNorthEast().lng() }
        };
      }

      // Convert history for the backend
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role === 'agent' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const res = await apiFetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          history,
          currentBounds,
          currentPath: customPath
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reach agent');

      setMessages(prev => [...prev, { role: 'agent', text: data.text }]);
      if (onRefreshDB) {
        onRefreshDB();
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'agent', text: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isHidden) {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl transition-all hover:scale-105 z-50 flex items-center justify-center gap-2 group"
      >
        <Bot className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[120px] group-hover:ml-1 font-medium">
          Ask AI
        </span>
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 right-6 bg-[#161a22] border border-slate-700 shadow-2xl z-50 flex flex-col rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      style={{
        width: '400px',
        height: '600px',
        minWidth: '300px',
        minHeight: '400px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        resize: 'both'
      }}
    >
      <div className="p-3 border-b border-slate-800 bg-[#1a1d23] flex items-center justify-between cursor-move shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/20 rounded-lg">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-200 text-sm">AI Co-Pilot</h2>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-blue-400" />}
            </div>
            <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1a1d23] text-slate-300 border border-slate-700 rounded-tl-none'} text-sm leading-relaxed prose prose-invert prose-p:my-1 prose-a:text-blue-400 prose-ul:my-1 prose-li:my-0`}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#1a1d23] text-slate-300 border border-slate-700 rounded-tl-none text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              Thinking & executing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-slate-800 bg-[#1a1d23] shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Find EPCs and save them..."
            className="w-full bg-black/40 border border-slate-700 rounded-full pl-4 pr-12 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
