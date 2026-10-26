import { useCategories } from '../lib/profile';
import { apiFetch } from '../lib/api';
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, 
  Play, Pause, Square, MapPin, Building2, Check, ArrowRight, 
  RefreshCw, Download, Layers, ShieldCheck, ChevronRight, Tag, Phone, Info
} from 'lucide-react';
import { CompanyResult, PolygonZone } from '../types';
import { db, Client } from '../db';
import { pointInPolygon } from '../lib/geo';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

interface CustomerExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedZones: PolygonZone[];
  onSitesDiscovered: (sites: CompanyResult[]) => void;
  onRefreshZones?: () => void;
}

export interface CustomerUploadItem {
  companyName: string;
  tag1?: string;
  tag2?: string;
  phone1?: string;
  phone2?: string;
}

interface ProcessedCustomerLog {
  companyName: string;
  tag1?: string;
  tag2?: string;
  phone1?: string;
  phone2?: string;
  status: 'pending' | 'searching' | 'found' | 'not_found' | 'error';
  sitesCount: number;
  sites: Array<{
    id: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    region: string;
    matchedZone?: string;
    googleMapsUri?: string;
    phone?: string;
  }>;
  message?: string;
}

function resolveCategory(tag1: string | undefined, tag2: string | undefined, categories: string[]): string {
  const match = (t?: string) => t ? categories.find((c) => c.toLowerCase() === t.trim().toLowerCase()) : undefined;
  return match(tag1) || match(tag2) || 'Other';
}


export function CustomerExcelUploadModal({
  isOpen,
  onClose,
  savedZones,
  onSitesDiscovered,
  onRefreshZones
}: CustomerExcelUploadModalProps) {
  const orgCategories = useCategories();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload & Parsing state
  const [fileName, setFileName] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [colName, setColName] = useState<string>('');
  const [colTag1, setColTag1] = useState<string>('');
  const [colTag2, setColTag2] = useState<string>('');
  const [colPhone1, setColPhone1] = useState<string>('');
  const [colPhone2, setColPhone2] = useState<string>('');

  const [customerItems, setCustomerItems] = useState<CustomerUploadItem[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<ProcessedCustomerLog[]>([]);

  // Statistics
  const [stats, setStats] = useState({
    totalCustomers: 0,
    processedCustomers: 0,
    totalSitesFound: 0,
    sitesInZones: 0,
    regionsCount: {} as Record<string, number>
  });

  const [isComplete, setIsComplete] = useState(false);

  if (!isOpen) return null;

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const orgCategories = useCategories();
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });
      
      if (!jsonData || jsonData.length === 0) {
        throw new Error("The selected file contains no readable data.");
      }

      // First row as headers
      const headers = (jsonData[0] || []).map((h: any, idx: number) => {
        const val = String(h || '').trim();
        return val || `Column ${idx + 1}`;
      });
      const rows = jsonData.slice(1);

      if (headers.length === 0) {
        throw new Error("Could not detect column headers in the first row.");
      }

      setColumns(headers);

      // Auto-detect columns
      const nameKeywords = ['company', 'customer', 'client', 'account', 'name', 'business', 'enterprise'];
      const tag1Keywords = ['tag 1', 'tag1', 'tag', 'category', 'industry', 'type'];
      const tag2Keywords = ['tag 2', 'tag2', 'secondary tag', 'status', 'tier', 'group'];
      const phone1Keywords = ['phone 1', 'phone1', 'phone', 'mobile 1', 'mobile', 'tel', 'contact number'];
      const phone2Keywords = ['phone 2', 'phone2', 'alt phone', 'mobile 2', 'telephone 2', 'secondary phone'];

      let detectedName = headers.find(h => nameKeywords.some(k => h.toLowerCase().includes(k))) || headers[0] || '';
      let detectedTag1 = headers.find(h => h !== detectedName && tag1Keywords.some(k => h.toLowerCase().includes(k))) || (headers.length > 1 ? headers[1] : '(None)');
      let detectedTag2 = headers.find(h => h !== detectedName && h !== detectedTag1 && tag2Keywords.some(k => h.toLowerCase().includes(k))) || (headers.length > 2 ? headers[2] : '(None)');
      let detectedPhone1 = headers.find(h => h !== detectedName && h !== detectedTag1 && h !== detectedTag2 && phone1Keywords.some(k => h.toLowerCase().includes(k))) || (headers.length > 3 ? headers[3] : '(None)');
      let detectedPhone2 = headers.find(h => h !== detectedName && h !== detectedTag1 && h !== detectedTag2 && h !== detectedPhone1 && phone2Keywords.some(k => h.toLowerCase().includes(k))) || (headers.length > 4 ? headers[4] : '(None)');

      setColName(detectedName);
      setColTag1(detectedTag1);
      setColTag2(detectedTag2);
      setColPhone1(detectedPhone1);
      setColPhone2(detectedPhone2);

      extractCustomerItems(headers, rows, detectedName, detectedTag1, detectedTag2, detectedPhone1, detectedPhone2);
      setRawRows(rows);
    } catch (err: any) {
      console.error("Excel parse error:", err);
      setParseError(err?.message || "Failed to parse Excel file.");
    } finally {
      setIsParsing(false);
    }
  };

  const extractCustomerItems = (
    headers: string[],
    rows: any[],
    nameCol: string,
    tag1Col: string,
    tag2Col: string,
    phone1Col: string,
    phone2Col: string
  ) => {
    const nameIdx = headers.indexOf(nameCol);
    const tag1Idx = tag1Col && tag1Col !== '(None)' ? headers.indexOf(tag1Col) : -1;
    const tag2Idx = tag2Col && tag2Col !== '(None)' ? headers.indexOf(tag2Col) : -1;
    const phone1Idx = phone1Col && phone1Col !== '(None)' ? headers.indexOf(phone1Col) : -1;
    const phone2Idx = phone2Col && phone2Col !== '(None)' ? headers.indexOf(phone2Col) : -1;

    if (nameIdx === -1) return;

    const items: CustomerUploadItem[] = [];
    const seen = new Set<string>();

    rows.forEach(r => {
      const rawName = r[nameIdx];
      const name = rawName ? String(rawName).trim() : '';
      if (name.length > 1 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        const tag1 = tag1Idx !== -1 && r[tag1Idx] != null ? String(r[tag1Idx]).trim() : undefined;
        const tag2 = tag2Idx !== -1 && r[tag2Idx] != null ? String(r[tag2Idx]).trim() : undefined;
        const phone1 = phone1Idx !== -1 && r[phone1Idx] != null ? String(r[phone1Idx]).trim() : undefined;
        const phone2 = phone2Idx !== -1 && r[phone2Idx] != null ? String(r[phone2Idx]).trim() : undefined;

        items.push({
          companyName: name,
          tag1: tag1 || undefined,
          tag2: tag2 || undefined,
          phone1: phone1 || undefined,
          phone2: phone2 || undefined
        });
      }
    });

    setCustomerItems(items);
    setStats(prev => ({ ...prev, totalCustomers: items.length }));
  };

  const handleColumnMapChange = (
    type: 'name' | 'tag1' | 'tag2' | 'phone1' | 'phone2', 
    val: string
  ) => {
    const newName = type === 'name' ? val : colName;
    const newTag1 = type === 'tag1' ? val : colTag1;
    const newTag2 = type === 'tag2' ? val : colTag2;
    const newPhone1 = type === 'phone1' ? val : colPhone1;
    const newPhone2 = type === 'phone2' ? val : colPhone2;

    if (type === 'name') setColName(val);
    if (type === 'tag1') setColTag1(val);
    if (type === 'tag2') setColTag2(val);
    if (type === 'phone1') setColPhone1(val);
    if (type === 'phone2') setColPhone2(val);

    if (rawRows.length > 0 && columns.length > 0) {
      extractCustomerItems(columns, rawRows, newName, newTag1, newTag2, newPhone1, newPhone2);
    }
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Client Name': 'Example Cafe One', 'Tag 1': 'Cafe', 'Tag 2': 'Key account', 'Phone 1 (Optional)': '', 'Phone 2 (Optional)': '' },
      { 'Client Name': 'Example Bakery Two', 'Tag 1': 'Bakery', 'Tag 2': '', 'Phone 1 (Optional)': '', 'Phone 2 (Optional)': '' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "Customer_Upload_Template_With_Tags_and_Phones.xlsx");
  };

  // 1-by-1 Sequential Processing Workflow
  const startProcessing = async () => {
    if (customerItems.length === 0) return;

    setIsProcessing(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isStoppedRef.current = false;
    setIsComplete(false);

    // Initialize logs
    const initialLogs: ProcessedCustomerLog[] = customerItems.map(item => ({
      companyName: item.companyName,
      tag1: item.tag1,
      tag2: item.tag2,
      phone1: item.phone1,
      phone2: item.phone2,
      status: 'pending',
      sitesCount: 0,
      sites: []
    }));
    setLogs(initialLogs);

    let processedCount = 0;
    let totalSites = 0;
    let inZonesCount = 0;
    const regionTally: Record<string, number> = {};
    const discoveredCompaniesForMap: CompanyResult[] = [];

    for (let i = 0; i < customerItems.length; i++) {
      if (isStoppedRef.current) break;

      // Handle pause loop
      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 200));
        if (isStoppedRef.current) break;
      }
      if (isStoppedRef.current) break;

      const customerItem = customerItems[i];
      const customerName = customerItem.companyName;
      setCurrentIndex(i);

      // Determine valid category
      const resolvedCategory = resolveCategory(customerItem.tag1, customerItem.tag2, orgCategories);

      // Update log to searching
      setLogs(prev => prev.map((l, idx) => idx === i ? { ...l, status: 'searching' } : l));

      try {
        // Query customer lookup strictly by company name
        const res = await apiFetch("/api/customer-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: customerName.trim() })
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        const places: any[] = data.places || [];

        if (places.length === 0) {
          // If no physical Google Places site found, preserve customer in pipeline as unmapped!
          const unmappedId = uuidv4();
          const unmappedTags = Array.from(new Set([
            ...(customerItem.tag1 ? [customerItem.tag1] : []),
            ...(customerItem.tag2 ? [customerItem.tag2] : [])
          ]));

          const unmappedContacts = [];
          if (customerItem.phone1) {
            unmappedContacts.push({
              name: "Primary Contact",
              role: "Office / Direct",
              mobile: customerItem.phone1,
              email: ""
            });
          }
          if (customerItem.phone2) {
            unmappedContacts.push({
              name: "Secondary Contact",
              role: "Mobile / Alternate",
              mobile: customerItem.phone2,
              email: ""
            });
          }

          const unmappedClient: Client = {
            id: unmappedId,
            name: customerName,
            address: "Unmapped site",
            lat: null,
            lng: null,
            phone: customerItem.phone1 || customerItem.phone2 || '',
            website: '',
            backgroundBlurb: `Prospect uploaded from list. Tags: ${[customerItem.tag1, customerItem.tag2].filter(Boolean).join(', ') || 'None'}`,
            category: resolvedCategory,
            tier: 1,
            status: "New",
            whatTheyDo: `Customer account. Tags: ${[customerItem.tag1, customerItem.tag2].filter(Boolean).join(', ') || 'None'}.`,
            googleMapsLink: '',
            tags: unmappedTags,
            contacts: unmappedContacts,
            nextFollowUpDate: null,
            retryFlag: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              parentCustomerName: customerName,
              isExistingCustomer: false,
              uploadedTags: [customerItem.tag1, customerItem.tag2].filter(Boolean),
              tag1: customerItem.tag1 || null,
              tag2: customerItem.tag2 || null,
              phone1: customerItem.phone1 || null,
              phone2: customerItem.phone2 || null,
              originalCategory: customerItem.tag1 || resolvedCategory,
              unmapped: true
            },
            tier1: {
              isWatch: true,
              region: "Other",
              primarySiteAddress: "",
              justification: `Existing customer uploaded from list.`,
              territoryStatus: "Open",
              allocatedTo: "",
              allocatedProductLines: []
            }
          };

          try {
            await db.clients.add(unmappedClient);
          } catch (dbErr) {
            console.warn("Could not save unmapped client:", dbErr);
          }

          setLogs(prev => prev.map((l, idx) => idx === i ? {
            ...l,
            status: 'found',
            sitesCount: 1,
            message: 'Saved to Pipeline (Unmapped Site)',
            sites: [{
              id: unmappedId,
              name: customerName,
              address: '',
              lat: null,
              lng: null,
              region: 'Other',
              phone: customerItem.phone1 || customerItem.phone2
            }]
          } : l));
        } else {
          const sitesLog: ProcessedCustomerLog['sites'] = [];

          // Process each discovered site 1-by-1
          for (const p of places) {
            const lat = p.location?.latitude;
            const lng = p.location?.longitude;
            const placeAddress = p.address || "";
            const placeRegion = p.region || '';

            // Check against saved search areas (zones)
            let matchedZoneName: string | undefined;
            if (lat && lng && savedZones.length > 0) {
              const matched = savedZones.find(z => 
                z.path && pointInPolygon({ lat, lng }, z.path)
              );
              if (matched) {
                matchedZoneName = matched.name;
                inZonesCount++;
              }
            }

            // Tally regions
            regionTally[placeRegion] = (regionTally[placeRegion] || 0) + 1;
            totalSites++;

            sitesLog.push({
              id: p.id,
              name: p.name,
              address: placeAddress,
              lat,
              lng,
              region: placeRegion,
              matchedZone: matchedZoneName,
              googleMapsUri: p.googleMapsUri,
              phone: customerItem.phone1 || p.phone || customerItem.phone2
            });

            // Build tags combining uploaded tags, region, and zone
            const combinedTags = Array.from(new Set([
              ...(customerItem.tag1 ? [customerItem.tag1] : []),
              ...(customerItem.tag2 ? [customerItem.tag2] : []),
              `Region: ${placeRegion}`,
              ...(matchedZoneName ? [`Zone: ${matchedZoneName}`] : [])
            ]));

            // Build contacts with phone1, phone2, and place phone
            const contactsList = [];
            if (customerItem.phone1) {
              contactsList.push({
                name: "Primary Contact",
                role: "Office / Lead",
                mobile: customerItem.phone1,
                email: ""
              });
            }
            if (customerItem.phone2) {
              contactsList.push({
                name: "Secondary Contact",
                role: "Mobile / Alternate",
                mobile: customerItem.phone2,
                email: ""
              });
            }
            if (p.phone && p.phone !== customerItem.phone1 && p.phone !== customerItem.phone2) {
              contactsList.push({
                name: "Site Phone (Google Maps)",
                role: "Facility Direct",
                mobile: p.phone,
                email: ""
              });
            }

            // Primary phone preference: Phone 1 -> Google Places -> Phone 2
            const primaryPhone = customerItem.phone1 || p.phone || customerItem.phone2 || '';

            // Persist to Pipeline (db.clients)
            const clientRecord: Client = {
              id: uuidv4(),
              name: p.name,
              address: placeAddress,
              lat: lat || null,
              lng: lng || null,
              phone: primaryPhone,
              website: p.website || '',
              backgroundBlurb: p.summary || `Discovered site for customer "${customerName}" (${[customerItem.tag1, customerItem.tag2].filter(Boolean).join(', ') || 'Existing Account'})`,
              category: resolvedCategory,
              tier: 1,
              status: "New",
              whatTheyDo: `Site in ${placeRegion}. Tags: ${[customerItem.tag1, customerItem.tag2].filter(Boolean).join(', ') || 'None'}. Verified via Google Places.`,
              googleMapsLink: p.googleMapsUri || '',
              tags: combinedTags,
              contacts: contactsList,
              nextFollowUpDate: null,
              retryFlag: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                parentCustomerName: customerName,
                isExistingCustomer: false,
                uploadedTags: [customerItem.tag1, customerItem.tag2].filter(Boolean),
                tag1: customerItem.tag1 || null,
                tag2: customerItem.tag2 || null,
                phone1: customerItem.phone1 || null,
                phone2: customerItem.phone2 || null,
                originalCategory: customerItem.tag1 || resolvedCategory,
                matchedZone: matchedZoneName || null,
                googleMapsUri: p.googleMapsUri || null
              },
              tier1: {
                isWatch: true,
                region: placeRegion,
                primarySiteAddress: placeAddress,
                justification: `Existing customer uploaded from list. Location: ${placeRegion}${matchedZoneName ? ` (${matchedZoneName} Zone)` : ''}.`,
                territoryStatus: "Open",
                allocatedTo: "",
                allocatedProductLines: []
              }
            };

            // Save to DB
            try {
              await db.clients.add(clientRecord);
            } catch (dbErr) {
              console.warn("Could not add client to DB:", dbErr);
            }

            // Map pin object
            if (lat && lng) {
              const companyForMap: CompanyResult = {
                id: clientRecord.id,
                name: p.name,
                address: placeAddress,
                location: { latitude: lat, longitude: lng },
                category: resolvedCategory,
                phone: primaryPhone,
                website: p.website,
                status: "Existing Account",
                googleMapsUri: p.googleMapsUri,
                summary: p.summary,
                tier: 1,
                isSaved: true,
                isExistingCustomer: true,
                parentCustomerName: customerName,
                matchedZoneName,
                region: placeRegion,
                tags: clientRecord.tags
              };
              discoveredCompaniesForMap.push(companyForMap);
            }
          }

          // Real-time update map pins so user sees them populating
          if (discoveredCompaniesForMap.length > 0) {
            onSitesDiscovered([...discoveredCompaniesForMap]);
          }

          // Update log to found
          setLogs(prev => prev.map((l, idx) => idx === i ? {
            ...l,
            status: 'found',
            sitesCount: places.length,
            sites: sitesLog
          } : l));
        }

      } catch (err: any) {
        console.error(`Error searching customer "${customerName}":`, err);
        setLogs(prev => prev.map((l, idx) => idx === i ? {
          ...l,
          status: 'error',
          message: err?.message || 'Search failed'
        } : l));
      }

      processedCount++;
      setStats({
        totalCustomers: customerItems.length,
        processedCustomers: processedCount,
        totalSitesFound: totalSites,
        sitesInZones: inZonesCount,
        regionsCount: { ...regionTally }
      });

      // Polite delay between Google Places queries
      await new Promise(r => setTimeout(r, 600));
    }

    setIsProcessing(false);
    setIsComplete(true);
    if (onRefreshZones) onRefreshZones();
  };

  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      isPausedRef.current = false;
    } else {
      setIsPaused(true);
      isPausedRef.current = true;
    }
  };

  const handleStop = () => {
    isStoppedRef.current = true;
    setIsProcessing(false);
    setIsPaused(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#12151b] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-[#161a22] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Upload Existing Customer Excel List
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Tag + Phone Support
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload company list with Tag 1 & Tag 2, optional Phone 1 & Phone 2. Discovered branches are mapped and synced into Pipeline.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/60 transition-colors disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Upload View (Before Processing) */}
          {!isProcessing && !isComplete && (
            <div className="space-y-6">
              
              {/* Drag and Drop Zone */}
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 bg-[#151921]/60 hover:bg-[#151921] rounded-2xl p-7 text-center cursor-pointer transition-all duration-200 group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">
                  {fileName ? fileName : "Click to select or drag & drop customer Excel file"}
                </h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Supports .xlsx, .xls, and .csv files. Columns layout: <span className="text-emerald-400 font-medium">Company Name</span>, followed by <span className="text-blue-400 font-medium">Tag 1</span>, <span className="text-purple-400 font-medium">Tag 2</span>, and optional <span className="text-amber-400 font-medium">Phone 1 & Phone 2</span>.
                </p>
              </div>

              {/* Sample template & test action buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#161a22] border border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Excel Template
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                  {savedZones.length} Saved Search {savedZones.length === 1 ? 'Area' : 'Areas'} Active
                </span>
              </div>

              {/* Parse Error Display */}
              {parseError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Column Mapping & Preview */}
              {customerItems.length > 0 && (
                <div className="p-5 rounded-xl bg-[#151921] border border-slate-800 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Column Mapping</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Verify or choose which columns from your Excel file contain the client name, tags, and phone numbers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                    {/* Client Name */}
                    <div>
                      <label className="text-[11px] font-semibold text-emerald-400 block mb-1">
                        Client Name (Col 1) *
                      </label>
                      <select
                        value={colName}
                        onChange={e => handleColumnMapChange('name', e.target.value)}
                        className="w-full bg-[#1c222d] border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                      >
                        {columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tag 1 */}
                    <div>
                      <label className="text-[11px] font-semibold text-blue-400 block mb-1">
                        Tag 1 (Col 2)
                      </label>
                      <select
                        value={colTag1}
                        onChange={e => handleColumnMapChange('tag1', e.target.value)}
                        className="w-full bg-[#1c222d] border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
                      >
                        <option value="(None)">(None)</option>
                        {columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tag 2 */}
                    <div>
                      <label className="text-[11px] font-semibold text-purple-400 block mb-1">
                        Tag 2 (Col 3)
                      </label>
                      <select
                        value={colTag2}
                        onChange={e => handleColumnMapChange('tag2', e.target.value)}
                        className="w-full bg-[#1c222d] border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-purple-500"
                      >
                        <option value="(None)">(None)</option>
                        {columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Phone 1 */}
                    <div>
                      <label className="text-[11px] font-semibold text-amber-400 block mb-1">
                        Phone 1 (Optional)
                      </label>
                      <select
                        value={colPhone1}
                        onChange={e => handleColumnMapChange('phone1', e.target.value)}
                        className="w-full bg-[#1c222d] border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-amber-500"
                      >
                        <option value="(None)">(None)</option>
                        {columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Phone 2 */}
                    <div>
                      <label className="text-[11px] font-semibold text-amber-400 block mb-1">
                        Phone 2 (Optional)
                      </label>
                      <select
                        value={colPhone2}
                        onChange={e => handleColumnMapChange('phone2', e.target.value)}
                        className="w-full bg-[#1c222d] border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-amber-500"
                      >
                        <option value="(None)">(None)</option>
                        {columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Customer Preview Table */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300">
                        {customerItems.length} Customers Detected (Previewing first 5 rows)
                      </span>
                      <span className="text-[11px] text-emerald-400 font-medium">
                        Search query reduced strictly to company name
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#0e1117]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#141820] text-slate-400 border-b border-slate-800 text-[11px]">
                            <th className="py-2 px-3 font-semibold">#</th>
                            <th className="py-2 px-3 font-semibold text-emerald-300">Client Name</th>
                            <th className="py-2 px-3 font-semibold text-blue-300">Tag 1</th>
                            <th className="py-2 px-3 font-semibold text-purple-300">Tag 2</th>
                            <th className="py-2 px-3 font-semibold text-amber-300">Phone 1</th>
                            <th className="py-2 px-3 font-semibold text-amber-300">Phone 2</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {customerItems.slice(0, 5).map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                              <td className="py-2 px-3 font-medium text-slate-200">{item.companyName}</td>
                              <td className="py-2 px-3">
                                {item.tag1 ? (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 text-[10px]">
                                    {item.tag1}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">None</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {item.tag2 ? (
                                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20 text-[10px]">
                                    {item.tag2}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">None</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">
                                {item.phone1 || <span className="text-slate-600 italic font-sans">None</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">
                                {item.phone2 || <span className="text-slate-600 italic font-sans">None</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Saved Zones Notice */}
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-start gap-2">
                    <Layers className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                    <div>
                      <span className="font-semibold">Automatic Search Zone & Pipeline Inclusion:</span> If a discovered site falls inside any of your {savedZones.length} saved search areas, it will be automatically tagged and linked to that zone. All sites will be saved with your custom tags and phone numbers into the Pipeline under their region.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing or Completed View */}
          {(isProcessing || isComplete) && (
            <div className="space-y-6">
              
              {/* Progress Card */}
              <div className="p-5 rounded-xl bg-[#151921] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="text-sm font-semibold text-slate-200">
                      {isProcessing 
                        ? `Searching Customer ${currentIndex + 1} of ${customerItems.length}: "${customerItems[currentIndex]?.companyName}"` 
                        : "Batch Customer Search Complete!"}
                    </span>
                  </div>

                  {/* Controls */}
                  {isProcessing && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTogglePause}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5"
                      >
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        {isPaused ? "Resume" : "Pause"}
                      </button>
                      <button
                        onClick={handleStop}
                        className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-xs text-red-300 rounded-lg border border-red-500/30 flex items-center gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5" /> Stop
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${customerItems.length > 0 ? (stats.processedCustomers / customerItems.length) * 100 : 0}%` 
                    }}
                  />
                </div>

                {/* Real-time Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-[#0f1217] rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Searched</span>
                    <span className="text-lg font-bold text-slate-100">{stats.processedCustomers} / {stats.totalCustomers}</span>
                  </div>
                  <div className="p-3 bg-[#0f1217] rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Sites Located</span>
                    <span className="text-lg font-bold text-emerald-400">{stats.totalSitesFound}</span>
                  </div>
                  <div className="p-3 bg-[#0f1217] rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">In Saved Zones</span>
                    <span className="text-lg font-bold text-blue-400">{stats.sitesInZones}</span>
                  </div>
                  <div className="p-3 bg-[#0f1217] rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Regions</span>
                    <span className="text-xs font-semibold text-purple-300 truncate block mt-1">
                      {Object.keys(stats.regionsCount).length > 0 
                        ? Object.entries(stats.regionsCount).map(([e, c]) => `${e}: ${c}`).join(', ') 
                        : "Detecting..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Discovery Feed */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Search & Site Mapping Feed (1 by 1)
                </h3>

                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                  {logs.map((log, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-xl border transition-colors ${
                        log.status === 'searching' 
                          ? 'bg-blue-500/10 border-blue-500/40 animate-pulse'
                          : log.status === 'found'
                          ? 'bg-[#151921] border-slate-800'
                          : log.status === 'not_found'
                          ? 'bg-[#12151b] border-slate-800/60 opacity-70'
                          : 'bg-[#101318] border-slate-800/40 opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-200">
                            {idx + 1}. {log.companyName}
                          </span>
                          {log.tag1 && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
                              {log.tag1}
                            </span>
                          )}
                          {log.tag2 && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                              {log.tag2}
                            </span>
                          )}
                          {log.status === 'searching' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                              Searching Google Places...
                            </span>
                          )}
                          {log.status === 'found' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                              {log.sitesCount} {log.sitesCount === 1 ? 'Site' : 'Sites'} Located
                            </span>
                          )}
                        </div>

                        {log.sites.some(s => s.matchedZone) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Included in Saved Area
                          </span>
                        )}
                      </div>

                      {/* Discovered Sites Sublist */}
                      {log.sites.length > 0 && (
                        <div className="mt-2.5 space-y-1.5 pl-3 border-l-2 border-slate-700/50">
                          {log.sites.map(site => (
                            <div key={site.id} className="text-xs flex items-center justify-between gap-2 text-slate-300">
                              <div className="flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span className="font-medium text-slate-200 truncate">{site.name}</span>
                                <span className="text-slate-500 text-[11px] truncate">({site.address})</span>
                                {site.phone && (
                                  <span className="text-amber-300 text-[10px] flex items-center gap-0.5 font-mono">
                                    <Phone className="w-2.5 h-2.5" /> {site.phone}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {site.region}
                                </span>
                                {site.matchedZone && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    {site.matchedZone}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#151921] flex justify-between items-center">
          <div>
            {!isProcessing && !isComplete && customerItems.length > 0 && (
              <span className="text-xs text-slate-400">
                Ready to search <strong>{customerItems.length}</strong> customers 1-by-1
              </span>
            )}
            {isComplete && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> All customer sites processed and updated into map & pipeline
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isProcessing && !isComplete && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startProcessing}
                  disabled={customerItems.length === 0}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Search Customers (1 by 1)
                </button>
              </>
            )}

            {isComplete && (
              <>
                <button
                  onClick={() => {
                    setIsComplete(false);
                    setCustomerItems([]);
                    setFileName('');
                    setStats({ totalCustomers: 0, processedCustomers: 0, totalSitesFound: 0, sitesInZones: 0, regionsCount: {} });
                  }}
                  className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Upload Another File
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigate('/pipeline');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  View in Pipeline <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-lg shadow-emerald-900/30"
                >
                  View on Map
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
