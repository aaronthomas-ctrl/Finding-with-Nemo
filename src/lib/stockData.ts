import {
  Brand,
  WarehouseProduct,
  StockPushLog,
  StockCampaign,
  Salesman,
  CampaignClientTarget,
  CollisionRecord,
  PushStatus,
  PushChannel,
} from '../types/stockist';
import { db, Client } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_SALESMEN: Salesman[] = [
  {
    id: 'sales-1',
    name: 'Marcus Vance',
    role: 'Senior Technical Sales Eng (Welding & Fabrication)',
    phone: '+971 50 123 4567',
    email: 'marcus.vance@stockist-gulf.com',
    avatarColor: 'bg-emerald-600',
    activePushesCount: 14,
    totalRevenueGenerated: 284000,
  },
  {
    id: 'sales-2',
    name: 'Sarah Al-Mansoor',
    role: 'Key Account Manager (Marine & Offshore Yards)',
    phone: '+971 52 987 6543',
    email: 'sarah.mansoor@stockist-gulf.com',
    avatarColor: 'bg-indigo-600',
    activePushesCount: 19,
    totalRevenueGenerated: 412000,
  },
  {
    id: 'sales-3',
    name: 'David Chen',
    role: 'Consumables & Surface Prep Specialist',
    phone: '+971 55 456 7890',
    email: 'david.chen@stockist-gulf.com',
    avatarColor: 'bg-amber-600',
    activePushesCount: 11,
    totalRevenueGenerated: 198500,
  },
  {
    id: 'sales-4',
    name: 'Tariq Mahmoud',
    role: 'EPC & Structural Fastening Lead',
    phone: '+971 54 321 0987',
    email: 'tariq.mahmoud@stockist-gulf.com',
    avatarColor: 'bg-rose-600',
    activePushesCount: 8,
    totalRevenueGenerated: 345000,
  },
  {
    id: 'sales-5',
    name: 'Alex Rivera',
    role: 'Heavy Machinery & Chemical Systems Rep',
    phone: '+971 56 654 3210',
    email: 'alex.rivera@stockist-gulf.com',
    avatarColor: 'bg-cyan-600',
    activePushesCount: 12,
    totalRevenueGenerated: 220000,
  },
];

export const DEFAULT_CUSTOMER_CATEGORIES = [
  'EPC Contractor',
  'Steel Fabricator',
  'Oilfield & Petrochemical Services',
  'Electromechanical',
  'MEP',
  'Marine/Shipbuilding',
  'Welding Trade',
  'Distributor',
  'Trader',
  'Heavy Infrastructure',
  'Manufacturing/OEM',
  'Other',
];

export const DEFAULT_MATERIAL_CATEGORIES = [
  'Welding & Cutting Machines',
  'Consumables & Filler Metals',
  'Abrasives & Surface Treatment',
  'Industrial Chemicals & Pickling',
  'Fasteners & Chemical Anchors',
  'Power Tools & Heavy Machinery',
  'PPE & Plant Safety Gear',
  'Gas Regulators & Torches',
  'Submersible Sludge Pumps',
  'NDT Inspection Aerosols',
];

export const DEFAULT_BRANDS: Brand[] = [
  {
    id: 'brand-esab',
    name: 'ESAB',
    logoBadge: 'ESAB',
    country: 'Sweden / Global',
    categories: ['Consumables & Filler Metals', 'Welding & Cutting Machines', 'PPE & Plant Safety Gear'],
    description: 'World-renowned manufacturer of high-deposition welding electrodes, solid & cored wires, and heavy arc equipment.',
    specialties: ['OK 48.04 Low Hydrogen', 'Shield-Bright Flux Cored', 'Warrior 500i Inverters'],
    stockItemCount: 18,
  },
  {
    id: 'brand-3m',
    name: '3M Industrial',
    logoBadge: '3M',
    country: 'USA',
    categories: ['Abrasives & Surface Treatment', 'PPE & Plant Safety Gear'],
    description: 'Precision-shaped grain ceramic abrasives, Cubitron II flap & fibre discs, and Speedglas safety gear.',
    specialties: ['Cubitron II 984F', 'Speedglas 9100XX', 'Scotch-Brite Surface Conditioning'],
    stockItemCount: 14,
  },
  {
    id: 'brand-callington',
    name: 'Callington',
    logoBadge: 'CALL',
    country: 'Australia',
    categories: ['Industrial Chemicals & Pickling', 'NDT Inspection Aerosols'],
    description: 'Global leader in stainless steel pickling gels, weld cleaning pastes, anti-spatter fluids, and NDT chemicals.',
    specialties: ['S-Weld Clean Paste', 'Dubl-Chek NDT Kits', 'Spatter-Release Aerosol'],
    stockItemCount: 9,
  },
  {
    id: 'brand-bosch',
    name: 'Bosch Industrial',
    logoBadge: 'BOSCH',
    country: 'Germany',
    categories: ['Power Tools & Heavy Machinery', 'Abrasives & Surface Treatment'],
    description: 'Heavy duty German-engineered 9-inch angle grinders, rotary hammers, magnetic core drills, and carbide accessories.',
    specialties: ['GWS 24-230 Heavy Grinder', 'GBH 8-45 Rotary Hammer', 'Expert Diamond Blades'],
    stockItemCount: 12,
  },
  {
    id: 'brand-ewm',
    name: 'EWM',
    logoBadge: 'EWM',
    country: 'Germany',
    categories: ['Welding & Cutting Machines'],
    description: 'High-end German welding technology, microprocessor-controlled TIG/MIG multiprocess pulse power sources.',
    specialties: ['Tetrix 300 Smart TIG', 'Titan XQ 400 Pulsed MIG', 'Microplasma Systems'],
    stockItemCount: 6,
  },
  {
    id: 'brand-hilti',
    name: 'Hilti',
    logoBadge: 'HILTI',
    country: 'Liechtenstein',
    categories: ['Fasteners & Chemical Anchors', 'Power Tools & Heavy Machinery'],
    description: 'Premium structural fastening systems, chemical injectables for rebar dowelling, and direct fastening.',
    specialties: ['HIT-RE 500 V4 Epoxy', 'HST3 Heavy Anchors', 'TE 70-ATC Combihammer'],
    stockItemCount: 10,
  },
  {
    id: 'brand-victor',
    name: 'Victor Gas Equipment',
    logoBadge: 'VICTOR',
    country: 'USA',
    categories: ['Gas Regulators & Torches'],
    description: 'Extreme-durability two-stage heavy gas pressure regulators, oxy-fuel machine cutting torches, and nozzles.',
    specialties: ['VTS-450 Regulators', 'CA 2460 Cutting Attachments', 'Heavy Cutting Nozzles'],
    stockItemCount: 8,
  },
  {
    id: 'brand-grindex',
    name: 'Grindex',
    logoBadge: 'GRINDEX',
    country: 'Sweden',
    categories: ['Submersible Sludge Pumps'],
    description: 'Heavy submersible drainage and sludge pumps designed for harsh shipyard drydocks and oilfield sumps.',
    specialties: ['Mini 2.2kW Sludge Pump', 'Matador Dewatering 18kW', 'AirValve Run-Dry Protection'],
    stockItemCount: 5,
  },
];

export const DEFAULT_WAREHOUSE_PRODUCTS: WarehouseProduct[] = [
  {
    id: 'prod-esab-4804',
    sku: 'ESAB-OK-4804-32',
    name: 'ESAB OK 48.04 E7018 High-Yield Heavy Duty Electrodes (3.2mm x 350mm)',
    brandId: 'brand-esab',
    brandName: 'ESAB',
    materialCategory: 'Consumables & Filler Metals',
    specification: 'AWS A5.1: E7018-1 H4R, Vacuum Pac 4.2kg, All-position low hydrogen electrode',
    unit: 'Carton (4.2kg)',
    warehouseStockQty: 460,
    reservedQty: 40,
    availableQty: 420,
    warehouseLocation: 'Bay A-04, Rack 2',
    batchNumber: 'LOT-ESAB-2026-08',
    listPrice: 48.5,
    suggestedPushPrice: 38.2,
    discountPercent: 21,
    moq: 10,
    targetCustomerCategories: ['Steel Fabricator', 'EPC Contractor', 'Marine/Shipbuilding', 'Oilfield & Petrochemical Services'],
    inventoryStatus: 'Overstock Push',
    keySellingPoints: [
      'High Charpy V-notch toughness down to -46°C',
      'VacuumPac eliminates pre-heating and baking requirement on site',
      'Very smooth arc with easy slag detachability for structural code work',
    ],
    packagingDetails: '3 Vacuum packs per master carton (12.6kg total)',
  },
  {
    id: 'prod-3m-cubitron',
    sku: '3M-CUB-984F-125',
    name: '3M Cubitron II Fibre Disc 984F (125mm x 22mm, 36+ Grit Ceramic Grain)',
    brandId: 'brand-3m',
    brandName: '3M Industrial',
    materialCategory: 'Abrasives & Surface Treatment',
    specification: 'Precision-Shaped Grain (PSG), Grinding aid top coat for cool cut on stainless & carbon steel',
    unit: 'Box (25 pcs)',
    warehouseStockQty: 1950,
    reservedQty: 150,
    availableQty: 1800,
    warehouseLocation: 'Bay B-12, Bin 4',
    batchNumber: 'LOT-3M-984F-88',
    listPrice: 85.0,
    suggestedPushPrice: 64.0,
    discountPercent: 25,
    moq: 4,
    targetCustomerCategories: ['Steel Fabricator', 'Marine/Shipbuilding', 'Welding Trade', 'Manufacturing/OEM'],
    inventoryStatus: 'Fast Mover',
    keySellingPoints: [
      'Cuts 2x faster than standard aluminum oxide discs with half the operator pressure',
      'Significantly cooler running reduces heat tinting on stainless assemblies',
      'Longer life reduces disc change-outs in heavy fabrication yards',
    ],
    packagingDetails: '25 discs per inner box, 100 discs per master carton',
  },
  {
    id: 'prod-callington-sweld',
    sku: 'CALL-S-WELD-20KG',
    name: 'Callington S-Weld Clean Stainless Steel Pickling Paste (20Kg Drum)',
    brandId: 'brand-callington',
    brandName: 'Callington',
    materialCategory: 'Industrial Chemicals & Pickling',
    specification: 'Hydrofluoric/Nitric chemical pickling paste for removing black oxide scale and heat tint from weld zones',
    unit: 'Drum (20Kg)',
    warehouseStockQty: 72,
    reservedQty: 7,
    availableQty: 65,
    warehouseLocation: 'Yard Chem-01, Hazmat Bay',
    batchNumber: 'LOT-CALL-SW-042',
    listPrice: 220.0,
    suggestedPushPrice: 175.0,
    discountPercent: 20,
    moq: 2,
    targetCustomerCategories: ['Oilfield & Petrochemical Services', 'MEP', 'Marine/Shipbuilding', 'Steel Fabricator'],
    inventoryStatus: 'Overstock Push',
    keySellingPoints: [
      'Fast-acting formulation cleans duplex, 316L, and 304L stainless in 15-30 mins',
      'Thixotropic gel clings securely to vertical and overhead welds without running',
      'Passivates corrosion-resistant chromium oxide layer compliant with ASTM A380',
    ],
    packagingDetails: 'Heavy duty UN-approved HDPE drum with safety seal',
  },
  {
    id: 'prod-bosch-gws24',
    sku: 'BOSCH-GWS-24-230',
    name: 'Bosch Professional 2400W 9" Heavy Angle Grinder (GWS 24-230 LVI Vibration Control)',
    brandId: 'brand-bosch',
    brandName: 'Bosch Industrial',
    materialCategory: 'Power Tools & Heavy Machinery',
    specification: '2400W Champion motor, 6500 RPM, KickBack Stop, Soft Start, Restart Protection, M14 spindle',
    unit: 'Unit (Boxed)',
    warehouseStockQty: 54,
    reservedQty: 6,
    availableQty: 48,
    warehouseLocation: 'Bay D-08, Shelf 1',
    batchNumber: 'LOT-BOSCH-GWS-01',
    listPrice: 195.0,
    suggestedPushPrice: 155.0,
    discountPercent: 20,
    moq: 2,
    targetCustomerCategories: ['EPC Contractor', 'Steel Fabricator', 'Electromechanical', 'Heavy Infrastructure'],
    inventoryStatus: 'Clearance',
    keySellingPoints: [
      'Vibration Control main and auxiliary handle reduces fatigue up to 50%',
      'Armoured coils protect motor from sharp grinding dust in harsh steel shops',
      'KickBack Stop sensor automatically shuts tool down if disc jams',
    ],
    packagingDetails: 'Heavy retail carton including protective guard, flange, two-hole spanner',
  },
  {
    id: 'prod-ewm-tetrix',
    sku: 'EWM-TETRIX-300',
    name: 'EWM Tetrix 300 Smart 2.0 TIG DC Inverter System (Water-Cooled Package)',
    brandId: 'brand-ewm',
    brandName: 'EWM',
    materialCategory: 'Welding & Cutting Machines',
    specification: '300A @ 40% DC, 230A @ 100%, 3-phase 400V, Pulsed TIG up to 15kHz, activArc technology, Cool 50 water cooler',
    unit: 'Complete Set',
    warehouseStockQty: 9,
    reservedQty: 1,
    availableQty: 8,
    warehouseLocation: 'High Bay Showroom-02',
    batchNumber: 'LOT-EWM-TX300',
    listPrice: 4250.0,
    suggestedPushPrice: 3650.0,
    discountPercent: 14,
    moq: 1,
    targetCustomerCategories: ['Oilfield & Petrochemical Services', 'Marine/Shipbuilding', 'EPC Contractor'],
    inventoryStatus: 'New Brand',
    keySellingPoints: [
      'German microprocessor precision with reproducible digital parameters',
      'activArc dynamically focuses arc cone for deeper penetration with low heat input',
      'Includes 8m water-cooled TIG torch and heavy ground cable',
    ],
    packagingDetails: 'Heavy palletized crate with trolley, gas hose, regulator, and cooler unit',
  },
  {
    id: 'prod-hilti-hitre500',
    sku: 'HILTI-HIT-RE500',
    name: 'Hilti HIT-RE 500 V4 Ultimate Epoxy Anchor Adhesive (500ml Foil Pack)',
    brandId: 'brand-hilti',
    brandName: 'Hilti',
    materialCategory: 'Fasteners & Chemical Anchors',
    specification: 'Slow-cure slow-shrink epoxy mortar approved for seismic C1/C2 and diamond-cored holes',
    unit: 'Foil Pack (500ml)',
    warehouseStockQty: 390,
    reservedQty: 40,
    availableQty: 350,
    warehouseLocation: 'Rack E-03, Bin 8',
    batchNumber: 'LOT-HILTI-RE-99',
    listPrice: 38.0,
    suggestedPushPrice: 29.5,
    discountPercent: 22,
    moq: 20,
    targetCustomerCategories: ['EPC Contractor', 'MEP', 'Electromechanical', 'Heavy Infrastructure'],
    inventoryStatus: 'Fast Mover',
    keySellingPoints: [
      'ICC-ES and ETA approval for rebar dowelling and heavy equipment anchor studs',
      'Suitable for water-saturated concrete and underwater core drill installations',
      '100-year service design life certification',
    ],
    packagingDetails: 'Box of 20 foil packs with 20 static mixer nozzles',
  },
  {
    id: 'prod-victor-vts450',
    sku: 'VIC-VTS-450-OXY',
    name: 'Victor Heavy Duty Two-Stage Oxygen Cutting Regulator (VTS-450-125-540)',
    brandId: 'brand-victor',
    brandName: 'Victor Gas Equipment',
    materialCategory: 'Gas Regulators & Torches',
    specification: 'Forged brass body, stainless steel diaphragm, delivery range 5-125 PSIG, inlet 3000 PSIG',
    unit: 'Pcs',
    warehouseStockQty: 110,
    reservedQty: 15,
    availableQty: 95,
    warehouseLocation: 'Rack C-07, Bin 2',
    batchNumber: 'LOT-VIC-VTS-12',
    listPrice: 145.0,
    suggestedPushPrice: 115.0,
    discountPercent: 21,
    moq: 5,
    targetCustomerCategories: ['Steel Fabricator', 'Marine/Shipbuilding', 'Welding Trade'],
    inventoryStatus: 'Standard Stock',
    keySellingPoints: [
      'Two-stage design maintains precise constant outlet pressure from full cylinder down to empty',
      'Heavy-duty forged brass cap for extreme shipyard duty without pressure drift',
      'High-capacity flow suited for heavy mechanized 300mm steel plate cutting',
    ],
    packagingDetails: 'Individual retail presentation box with calibration certificate',
  },
  {
    id: 'prod-grindex-mini',
    sku: 'GRIN-MINI-2KW',
    name: 'Grindex Mini Submersible Sludge & Dewatering Drainage Pump 2.2kW (3-Phase 400V)',
    brandId: 'brand-grindex',
    brandName: 'Grindex',
    materialCategory: 'Submersible Sludge Pumps',
    specification: '2.2kW motor, 500 l/min max flow, 20m head, pass solids up to 32mm, polyurethane SMART lining',
    unit: 'Unit',
    warehouseStockQty: 16,
    reservedQty: 2,
    availableQty: 14,
    warehouseLocation: 'Heavy Yard Bay-05',
    batchNumber: 'LOT-GRIN-MINI-04',
    listPrice: 1850.0,
    suggestedPushPrice: 1490.0,
    discountPercent: 19,
    moq: 1,
    targetCustomerCategories: ['EPC Contractor', 'Marine/Shipbuilding', 'Oilfield & Petrochemical Services'],
    inventoryStatus: 'Overstock Push',
    keySellingPoints: [
      'Patented AirValve cooling allows pump to run completely dry without overheating',
      'Hard-Iron™ impeller resists abrasive sand, weld grit, and shipyard silt',
      'Phase-sequence supervision prevents reverse rotation damage',
    ],
    packagingDetails: 'Heavy wooden export crate with 20m oil-resistant power cable',
  },
  {
    id: 'prod-callington-ndt',
    sku: 'CALL-DUBL-NDT-SET',
    name: 'Callington Dubl-Chek Non-Destructive Testing Aerosol Inspection Kit (3-Can Set)',
    brandId: 'brand-callington',
    brandName: 'Callington',
    materialCategory: 'NDT Inspection Aerosols',
    specification: 'Visible Red Dye Penetrant (DP-50), Non-Aqueous Developer (D-100), Solvent Remover (DR-60)',
    unit: '3-Can Set (400ml each)',
    warehouseStockQty: 280,
    reservedQty: 40,
    availableQty: 240,
    warehouseLocation: 'Bay Chem-03, Rack 1',
    batchNumber: 'LOT-CALL-NDT-2026',
    listPrice: 42.0,
    suggestedPushPrice: 32.0,
    discountPercent: 24,
    moq: 12,
    targetCustomerCategories: ['Oilfield & Petrochemical Services', 'EPC Contractor', 'Marine/Shipbuilding', 'Steel Fabricator'],
    inventoryStatus: 'Fast Mover',
    keySellingPoints: [
      'Meets ASME Section V, ASTM E165, and MIL-I-25135 Level 2 sensitivity standards',
      'Ultra-sharp vivid red indication reveals micro surface cracks and porosity in weld seams',
      'Fast drying white developer with zero halogen/sulfur contamination on nuclear/cryo piping',
    ],
    packagingDetails: 'Shrink-wrapped set of 3 aerosol cans, master carton contains 12 sets (36 cans)',
  },
  {
    id: 'prod-3m-speedglas',
    sku: '3M-SPEEDGLAS-9100',
    name: '3M Speedglas 9100XX Auto-Darkening Welding Helmet with SideWindows',
    brandId: 'brand-3m',
    brandName: '3M Industrial',
    materialCategory: 'PPE & Plant Safety Gear',
    specification: 'Extra large 73 x 107 mm viewing area, variable dark shades 5, 8, 9-13, delay & sensitivity adjustment',
    unit: 'Unit',
    warehouseStockQty: 38,
    reservedQty: 6,
    availableQty: 32,
    warehouseLocation: 'Bay Safety-01, Shelf 3',
    batchNumber: 'LOT-3M-SG-9100',
    listPrice: 410.0,
    suggestedPushPrice: 340.0,
    discountPercent: 17,
    moq: 2,
    targetCustomerCategories: ['Welding Trade', 'Steel Fabricator', 'Oilfield & Petrochemical Services', 'Marine/Shipbuilding'],
    inventoryStatus: 'Standard Stock',
    keySellingPoints: [
      'Natural Color technology provides outstanding clarity and realistic color perception',
      'Patented exhaust vents breathe out exhaled air, preventing shield fogging in hot UAE summers',
      'SideWindows shade 5 filters widen field of peripheral vision',
    ],
    packagingDetails: 'Complete box with storage bag, bandana, and starter replacement lenses',
  },
];

export const DEFAULT_CLIENTS_SEEDED: Partial<Client>[] = [
  {
    id: 'client-al-shirawi',
    name: 'Al Shirawi Equipment Co. LLC',
    address: 'Street 12, Dubai Industrial City (DIC), Dubai, UAE',
    lat: 24.8621,
    lng: 55.0742,
    phone: '+971 4 883 4567',
    website: 'https://alshirawi.com',
    backgroundBlurb: 'Major UAE steel fabricator, heavy structural steelwork, pressure vessels, and tipper bodies.',
    category: 'Steel Fabricator',
    tier: 1,
    status: 'Pursuing',
    whatTheyDo: 'Fabrication of heavy architectural steel, cement plant ducting, storage tanks, and tippers.',
    contacts: [
      { name: 'Eng. Rajesh Sharma', role: 'Procurement & Yard Manager', mobile: '+971 50 442 8192', email: 'rajesh.sharma@alshirawi.ae' },
      { name: 'Khaled Mansoor', role: 'QA/QC Welding Inspector', mobile: '+971 55 119 2834', email: 'khaled.m@alshirawi.ae' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 3),
    retryFlag: false,
    createdAt: new Date('2026-06-10'),
    updatedAt: new Date('2026-08-08'),
  },
  {
    id: 'client-lamprell',
    name: 'Lamprell Energy Ltd',
    address: 'Hamriyah Free Zone, Phase 1, Sharjah, UAE',
    lat: 25.4851,
    lng: 55.4892,
    phone: '+971 6 517 7777',
    website: 'https://lamprell.com',
    backgroundBlurb: 'Tier 1 offshore fabrication contractor specializing in wind turbine foundations, jack-up rigs, and offshore EPC.',
    category: 'Marine/Shipbuilding',
    tier: 1,
    status: 'Pursuing',
    whatTheyDo: 'Offshore oil & gas structures, deepwater jacket fabrication, and renewable transition substations.',
    contacts: [
      { name: 'Stephen Bradley', role: 'Supply Chain Director', mobile: '+971 52 883 1920', email: 'sbradley@lamprell.com' },
      { name: 'Vikram Nair', role: 'Chief Welding Engineer', mobile: '+971 50 991 2281', email: 'vnair@lamprell.com' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 2),
    retryFlag: false,
    createdAt: new Date('2026-05-15'),
    updatedAt: new Date('2026-08-10'),
  },
  {
    id: 'client-drydocks',
    name: 'Drydocks World Dubai',
    address: 'Port Rashid, Dubai Maritime City, Dubai, UAE',
    lat: 25.2652,
    lng: 55.2814,
    phone: '+971 4 345 0626',
    website: 'https://drydocks.gov.ae',
    backgroundBlurb: 'Largest ship repair and conversion yard in the Middle East with 4 mega drydocks and FPSO conversion bays.',
    category: 'Marine/Shipbuilding',
    tier: 1,
    status: 'Won',
    whatTheyDo: 'Mega tanker hull repairs, FPSO module fabrication, structural piping, and abrasive surface preparation.',
    contacts: [
      { name: 'Mohamed Al Marzouqi', role: 'Material Procurement Lead', mobile: '+971 50 771 9922', email: 'm.marzouqi@drydocks.gov.ae' },
      { name: 'Ivan Petrov', role: 'Surface Prep & Coating Supt.', mobile: '+971 54 228 1190', email: 'ivan.p@drydocks.gov.ae' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 14),
    retryFlag: false,
    createdAt: new Date('2026-04-12'),
    updatedAt: new Date('2026-08-02'),
  },
  {
    id: 'client-petrofac',
    name: 'Petrofac International Ltd',
    address: 'Al Majaz Waterfront Towers, Corniche St, Sharjah, UAE',
    lat: 25.3341,
    lng: 55.3852,
    phone: '+971 6 574 3333',
    website: 'https://petrofac.com',
    backgroundBlurb: 'International EPC provider for oil, gas, refining, and petrochemical pipeline infrastructure.',
    category: 'Oilfield & Petrochemical Services',
    tier: 1,
    status: 'Quoted',
    whatTheyDo: 'Refinery revamp, gas processing stations, high-pressure piping installation, and civil anchor works.',
    contacts: [
      { name: 'Dr. Tariq Al-Nuaimi', role: 'Project Procurement Head', mobile: '+971 50 334 5511', email: 'tariq.nuaimi@petrofac.com' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 5),
    retryFlag: false,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-08-11'),
  },
  {
    id: 'client-gulf-piping',
    name: 'Gulf Piping Company WLL (GPC)',
    address: 'Plot 41-45, ICAD 1, Mussafah, Abu Dhabi, UAE',
    lat: 24.3211,
    lng: 54.4982,
    phone: '+971 2 550 0000',
    website: 'https://gulfpiping.com',
    backgroundBlurb: 'Major offshore structural module and heavy piping spool fabricator in Abu Dhabi.',
    category: 'Steel Fabricator',
    tier: 2,
    status: 'Pursuing',
    whatTheyDo: 'Heavy pipe rack fabrication, offshore manifolds, pressure vessels, and duplex alloy welding.',
    contacts: [
      { name: 'Binu Varghese', role: 'Commercial Purchases Manager', mobile: '+971 55 667 8901', email: 'bvarghese@gulfpiping.com' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 4),
    retryFlag: false,
    createdAt: new Date('2026-06-20'),
    updatedAt: new Date('2026-08-07'),
  },
  {
    id: 'client-eversendai',
    name: 'Eversendai Engineering LLC',
    address: 'Al Quoz Industrial Area 4, Dubai, UAE',
    lat: 25.1292,
    lng: 55.2281,
    phone: '+971 4 347 1888',
    website: 'https://eversendai.com',
    backgroundBlurb: 'Structural steel giant responsible for high-rise towers, airport concourses, and stadiums across MENA.',
    category: 'Steel Fabricator',
    tier: 1,
    status: 'Pursuing',
    whatTheyDo: 'Architectural steel, heavy connection fabrication, high-strength bolting, and on-site welding.',
    contacts: [
      { name: 'Anand Kumar', role: 'Central Purchasing Head', mobile: '+971 50 662 1198', email: 'anand.kumar@eversendai.com' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 6),
    retryFlag: false,
    createdAt: new Date('2026-05-18'),
    updatedAt: new Date('2026-08-05'),
  },
  {
    id: 'client-dutco',
    name: 'Dutco Balfour Beatty LLC',
    address: 'Jebel Ali Industrial Area 1, Dubai, UAE',
    lat: 24.9981,
    lng: 55.1322,
    phone: '+971 4 880 1234',
    website: 'https://dutco.com',
    backgroundBlurb: 'Leading civil engineering, infrastructure, and heavy plant contractor in the UAE.',
    category: 'EPC Contractor',
    tier: 2,
    status: 'New',
    whatTheyDo: 'Tunnels, airport infrastructure, bridges, marine jetties, and heavy plant equipment maintenance.',
    contacts: [
      { name: 'Colin Macintyre', role: 'Plant & Equipment Manager', mobile: '+971 52 441 9920', email: 'cmacintyre@dbb.ae' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 7),
    retryFlag: false,
    createdAt: new Date('2026-07-02'),
    updatedAt: new Date('2026-08-01'),
  },
  {
    id: 'client-mcdermott',
    name: 'McDermott Middle East Inc',
    address: 'South Zone, Jebel Ali Free Zone (JAFZA), Dubai, UAE',
    lat: 24.9651,
    lng: 55.0881,
    phone: '+971 4 883 8000',
    website: 'https://mcdermott.com',
    backgroundBlurb: 'Premier offshore engineering, subsea pipelay, and mega topside module fabrication contractor.',
    category: 'Oilfield & Petrochemical Services',
    tier: 1,
    status: 'Pursuing',
    whatTheyDo: 'Subsea pipelines, offshore drilling platforms, deepwater manifolds, and heavy automated welding.',
    contacts: [
      { name: 'David Wilson', role: 'Subcontract & Consumables Manager', mobile: '+971 50 119 4433', email: 'dwilson@mcdermott.com' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 4),
    retryFlag: false,
    createdAt: new Date('2026-04-25'),
    updatedAt: new Date('2026-08-09'),
  },
  {
    id: 'client-apex-marine',
    name: 'Apex Marine & Offshore Services',
    address: 'Al Mina Road, Industrial Area 1, Sharjah, UAE',
    lat: 25.3611,
    lng: 55.3912,
    phone: '+971 6 532 9988',
    website: 'https://apexmarinegulf.com',
    backgroundBlurb: 'Boutique tugboat, barge, and workboat conversion yard with fast turnaround machining facilities.',
    category: 'Marine/Shipbuilding',
    tier: 3,
    status: 'New',
    whatTheyDo: 'Barge deck repairs, shaft alignment, stainless propeller shaft welding, and bilge pump overhauls.',
    contacts: [
      { name: 'Captain Salim Al Zaabi', role: 'Managing Partner', mobile: '+971 55 901 8822', email: 'salim@apexmarinegulf.com' },
    ],
    nextFollowUpDate: null,
    retryFlag: false,
    createdAt: new Date('2026-07-20'),
    updatedAt: new Date('2026-08-01'),
  },
  {
    id: 'client-star-fab',
    name: 'Star Fabrication & Welding Works',
    address: 'New Industrial Area, Jurf 2, Ajman, UAE',
    lat: 25.4291,
    lng: 55.5182,
    phone: '+971 6 743 1122',
    website: 'https://starfabajman.ae',
    backgroundBlurb: 'Fast-paced custom steel welding shop handling architectural railings, staircases, and truck bodies.',
    category: 'Welding Trade',
    tier: 3,
    status: 'Pursuing',
    whatTheyDo: 'MIG/TIG custom steel and aluminium jobbing, stainless kitchen fabrication, and wrought iron works.',
    contacts: [
      { name: 'Mustafa Siddiqui', role: 'Workshop Supervisor', mobile: '+971 50 882 3311', email: 'mustafa@starfabajman.ae' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 2),
    retryFlag: false,
    createdAt: new Date('2026-07-15'),
    updatedAt: new Date('2026-08-04'),
  },
  {
    id: 'client-npcc',
    name: 'National Petroleum Construction Co. (NPCC)',
    address: 'Mussafah Industrial City, Abu Dhabi, UAE',
    lat: 24.3412,
    lng: 54.5122,
    phone: '+971 2 554 9000',
    website: 'https://npcc.ae',
    backgroundBlurb: 'World-class EPC giant in Abu Dhabi with massive 1.3 million sq meter marine yard.',
    category: 'EPC Contractor',
    tier: 1,
    status: 'Pursuing',
    whatTheyDo: 'Offshore oil platforms, subsea trunklines, storage tank farms, and automated SAW welding.',
    contacts: [
      { name: 'Humaid Al Shamsi', role: 'Senior Vendor Management Specialist', mobile: '+971 50 229 0011', email: 'h.shamsi@npcc.ae' },
    ],
    nextFollowUpDate: new Date(Date.now() + 86400000 * 5),
    retryFlag: false,
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-08-11'),
  },
  {
    id: 'client-habtoor-mep',
    name: 'Al Habtoor MEP Engineering',
    address: 'Al Habtoor Business Tower, Dubai Marina, Dubai, UAE',
    lat: 25.0851,
    lng: 55.1432,
    phone: '+971 4 399 5000',
    website: 'https://habtoor.com',
    backgroundBlurb: 'Large electromechanical contractor executing luxury hotel, commercial tower, and hospital MEP.',
    category: 'MEP',
    tier: 2,
    status: 'New',
    whatTheyDo: 'Chilled water piping, HVAC ductwork, fire suppression networks, and structural anchors.',
    contacts: [
      { name: 'Nader Boutros', role: 'Head of Mechanical Procurement', mobile: '+971 52 778 2244', email: 'nboutros@habtoormep.ae' },
    ],
    nextFollowUpDate: null,
    retryFlag: false,
    createdAt: new Date('2026-07-18'),
    updatedAt: new Date('2026-08-02'),
  },
];

export const DEFAULT_STOCK_PUSHES: StockPushLog[] = [];

export const DEFAULT_CAMPAIGNS: StockCampaign[] = [];

// Helper functions for Local Storage & DB synchronization
const STORAGE_KEYS = {
  PRODUCTS: 'stockist_warehouse_products',
  BRANDS: 'stockist_brands',
  PUSHES: 'stockist_push_history_v2',
  CAMPAIGNS: 'stockist_campaigns_v2',
  SALESMEN: 'stockist_salesmen',
  INITIALIZED: 'stockist_data_v3_initialized',
};

export function initializeStockistStore() {
  if (typeof window === 'undefined') return;

  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!isInitialized) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_WAREHOUSE_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(DEFAULT_BRANDS));
    localStorage.setItem(STORAGE_KEYS.PUSHES, JSON.stringify(DEFAULT_STOCK_PUSHES));
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(DEFAULT_CAMPAIGNS));
    localStorage.setItem(STORAGE_KEYS.SALESMEN, JSON.stringify(DEFAULT_SALESMEN));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

    // Seed default clients into DB if DB is empty
    db.clients.toArray().then((existing: Client[]) => {
      if (!existing || existing.length === 0) {
        for (const client of DEFAULT_CLIENTS_SEEDED) {
          db.clients.put({
            ...client,
            tier: client.tier || 2,
            status: client.status || 'New',
            contacts: client.contacts || [],
            createdAt: client.createdAt || new Date(),
            updatedAt: client.updatedAt || new Date(),
          }).catch(console.error);
        }
      }
    }).catch(console.error);
  }
}

export function getLocalWarehouseProducts(): WarehouseProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return raw ? JSON.parse(raw) : DEFAULT_WAREHOUSE_PRODUCTS;
  } catch (e) {
    return DEFAULT_WAREHOUSE_PRODUCTS;
  }
}

export function saveLocalWarehouseProducts(products: WarehouseProduct[]) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

export function getLocalBrands(): Brand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BRANDS);
    return raw ? JSON.parse(raw) : DEFAULT_BRANDS;
  } catch (e) {
    return DEFAULT_BRANDS;
  }
}

export function getLocalSalesmen(): Salesman[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SALESMEN);
    return raw ? JSON.parse(raw) : DEFAULT_SALESMEN;
  } catch (e) {
    return DEFAULT_SALESMEN;
  }
}

export function getLocalStockPushes(): StockPushLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PUSHES);
    if (!raw) return DEFAULT_STOCK_PUSHES;
    const parsed = JSON.parse(raw);
    return parsed.map((p: any) => ({
      ...p,
      pushedAt: new Date(p.pushedAt),
      createdAt: new Date(p.createdAt || p.pushedAt),
      updatedAt: new Date(p.updatedAt || p.pushedAt),
    }));
  } catch (e) {
    return DEFAULT_STOCK_PUSHES;
  }
}

export function saveLocalStockPushes(pushes: StockPushLog[]) {
  localStorage.setItem(STORAGE_KEYS.PUSHES, JSON.stringify(pushes));
}

export function getLocalCampaigns(): StockCampaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
    if (!raw) return DEFAULT_CAMPAIGNS;
    const parsed = JSON.parse(raw);
    return parsed.map((c: any) => ({
      ...c,
      startDate: new Date(c.startDate),
      endDate: new Date(c.endDate),
      createdAt: new Date(c.createdAt || c.startDate),
      updatedAt: new Date(c.updatedAt || c.startDate),
      targets: (c.targets || []).map((t: any) => ({
        ...t,
        lastContactedAt: t.lastContactedAt ? new Date(t.lastContactedAt) : undefined,
      })),
    }));
  } catch (e) {
    return DEFAULT_CAMPAIGNS;
  }
}

export function saveLocalCampaigns(campaigns: StockCampaign[]) {
  localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
}

/**
 * Check if a product or brand has already been pushed to a customer by any salesman
 */
export function checkProductPushCollision(
  clientId: string,
  productId: string,
  pushesList?: StockPushLog[]
): CollisionRecord | null {
  const pushes = pushesList || getLocalStockPushes();
  const match = pushes.find((p) => p.clientId === clientId && p.productId === productId);

  if (!match) return null;

  const pushDate = new Date(match.pushedAt);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - pushDate.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    hasCollision: true,
    previousSalesman: match.salesmanName,
    pushedAt: pushDate,
    previousStatus: match.status,
    previousNotes: match.notes || 'Pitched previously',
    priceOffered: match.priceOffered,
    daysAgo: diffDays,
  };
}

/**
 * Log a direct offline / individual salesman push
 */
export function logDirectStockPush(params: {
  clientId: string;
  clientName: string;
  clientCategory: string;
  productId: string;
  productName: string;
  brandId: string;
  brandName: string;
  sku: string;
  salesmanName: string;
  pushedAt: Date;
  status: PushStatus;
  priceOffered: number;
  qtyDiscussed: number;
  channel: PushChannel;
  notes: string;
  campaignId?: string;
  campaignTitle?: string;
}): StockPushLog {
  const pushes = getLocalStockPushes();
  const newPush: StockPushLog = {
    id: uuidv4(),
    ...params,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updatedPushes = [newPush, ...pushes];
  saveLocalStockPushes(updatedPushes);

  // Also log interaction in DB for unified timeline
  db.interactions.add({
    id: uuidv4(),
    clientId: params.clientId,
    timestamp: params.pushedAt,
    channel: params.channel,
    summary: `[Stock Push by ${params.salesmanName}] ${params.brandName} ${params.productName} (${params.sku}) - Status: ${params.status} @ $${params.priceOffered}. Notes: ${params.notes.substring(0, 100)}`,
  }).catch(console.error);

  return newPush;
}

/**
 * Create and launch a new multitude campaign pushing an item to multiple clients
 */
export function createAndLaunchCampaign(newCampaignData: Omit<StockCampaign, 'id' | 'createdAt' | 'updatedAt'>): StockCampaign {
  const campaigns = getLocalCampaigns();
  const pushes = getLocalStockPushes();

  const campaignId = uuidv4();
  const now = new Date();

  const fullCampaign: StockCampaign = {
    ...newCampaignData,
    id: campaignId,
    createdAt: now,
    updatedAt: now,
  };

  // Add all target clients to the push tracking registry
  const newPushes: StockPushLog[] = newCampaignData.targets.map((t) => ({
    id: uuidv4(),
    clientId: t.clientId,
    clientName: t.clientName,
    clientCategory: t.clientCategory,
    productId: newCampaignData.productId,
    productName: newCampaignData.productName,
    brandId: newCampaignData.brandId,
    brandName: newCampaignData.brandName,
    sku: newCampaignData.sku,
    salesmanName: t.assignedSalesman || newCampaignData.assignedSalesmen[0] || 'Sales Rep',
    pushedAt: now,
    status: t.status === 'Ordered' ? 'Ordered' : t.status === 'Quoted' ? 'Quoted' : t.status === 'Sample Sent' ? 'Sample Sent' : t.status === 'Contacted' ? 'Pitch Made' : 'Pitch Made',
    priceOffered: t.priceOffered || newCampaignData.offerPrice,
    qtyDiscussed: t.quantityDiscussed || newCampaignData.moq,
    channel: t.channelUsed || 'WhatsApp',
    notes: `Campaign Push: "${newCampaignData.title}". ${t.notes || ''}`.trim(),
    campaignId: campaignId,
    campaignTitle: newCampaignData.title,
    createdAt: now,
    updatedAt: now,
  }));

  saveLocalStockPushes([...newPushes, ...pushes]);
  saveLocalCampaigns([fullCampaign, ...campaigns]);

  // Log in DB campaigns table
  db.campaigns.put({
    id: campaignId,
    title: fullCampaign.title,
    description: fullCampaign.goal,
    productLines: [fullCampaign.brandName, fullCampaign.productName],
    offerDetails: `Push Price: $${fullCampaign.offerPrice} (${fullCampaign.discountPercent}% off), MOQ: ${fullCampaign.moq}`,
    validFrom: fullCampaign.startDate,
    validTo: fullCampaign.endDate,
    targetClientIds: fullCampaign.targetClientIds,
  }).catch(console.error);

  return fullCampaign;
}

/**
 * Update a specific target client state inside a campaign
 */
export function updateCampaignTargetStatus(
  campaignId: string,
  targetClientId: string,
  newStatus: 'Pending' | 'Contacted' | 'Sample Sent' | 'Quoted' | 'Ordered' | 'Declined',
  extra?: {
    channelUsed?: PushChannel;
    notes?: string;
    quantityOrdered?: number;
    revenueWon?: number;
  }
): StockCampaign | null {
  const campaigns = getLocalCampaigns();
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;

  const target = campaign.targets.find((t) => t.clientId === targetClientId);
  if (!target) return null;

  target.status = newStatus;
  target.lastContactedAt = new Date();
  if (extra?.channelUsed) target.channelUsed = extra.channelUsed;
  if (extra?.notes) target.notes = extra.notes;
  if (extra?.quantityOrdered) target.quantityOrdered = extra.quantityOrdered;
  if (extra?.revenueWon) target.revenueWon = extra.revenueWon;

  // Pipeline Auto-Generation
  if (newStatus === 'Quoted' || newStatus === 'Ordered') {
    const outcome = newStatus === 'Ordered' ? 'Won' : 'Pending';
    const productLine = `${campaign.brandName} ${campaign.productName}`;
    const qty = extra?.quantityOrdered || campaign.moq;
    const note = `Auto-generated from Campaign: ${campaign.title}${extra?.notes ? ' - ' + extra.notes : ''}`;
    
    // Find existing to dedupe (idempotent update)
    db.enquiries.toArray().then((enquiries) => {
      const existing = enquiries.find(e => 
        e.clientId === targetClientId && 
        e.productLine === productLine &&
        e.itemDescription?.includes(campaign.title)
      );

      if (existing) {
        db.enquiries.put({ ...existing, outcome, quantity: qty, note }).catch(console.error);
      } else {
        db.enquiries.add({
          id: uuidv4(),
          clientId: targetClientId,
          date: new Date(),
          productLine,
          itemDescription: `Campaign Target: ${campaign.title}`,
          quantity: qty,
          department: 'Procurement',
          outcome,
          note
        }).catch(console.error);
      }
    }).catch(console.error);
  }

  // Recalculate metrics
  const total = campaign.targets.length;
  const contacted = campaign.targets.filter((t) => t.status !== 'Pending').length;
  const samples = campaign.targets.filter((t) => t.status === 'Sample Sent').length;
  const quoted = campaign.targets.filter((t) => t.status === 'Quoted').length;
  const ordered = campaign.targets.filter((t) => t.status === 'Ordered').length;
  const declined = campaign.targets.filter((t) => t.status === 'Declined').length;
  const revWon = campaign.targets.reduce((acc, t) => acc + (t.revenueWon || (t.status === 'Ordered' ? (t.quantityOrdered || campaign.moq) * campaign.offerPrice : 0)), 0);
  const stockQty = campaign.targets.reduce((acc, t) => acc + (t.quantityOrdered || (t.status === 'Ordered' ? campaign.moq : 0)), 0);

  campaign.metrics = {
    totalTargets: total,
    contactedCount: contacted,
    samplesSentCount: samples,
    quotedCount: quoted,
    orderedCount: ordered,
    declinedCount: declined,
    totalRevenueWon: revWon,
    stockPushedQty: stockQty,
  };

  campaign.updatedAt = new Date();

  saveLocalCampaigns(campaigns);

  // Update corresponding push log
  const pushes = getLocalStockPushes();
  const matchingPush = pushes.find((p) => p.campaignId === campaignId && p.clientId === targetClientId);
  if (matchingPush) {
    matchingPush.status =
      newStatus === 'Ordered'
        ? 'Ordered'
        : newStatus === 'Quoted'
        ? 'Quoted'
        : newStatus === 'Sample Sent'
        ? 'Sample Sent'
        : newStatus === 'Declined'
        ? 'Declined - Price'
        : 'Pitch Made';
    if (extra?.notes) matchingPush.notes = extra.notes;
    if (extra?.channelUsed) matchingPush.channel = extra.channelUsed;
    matchingPush.updatedAt = new Date();
    saveLocalStockPushes(pushes);
  }

  return campaign;
}

/**
 * Quick inline customer onboarding during campaign creation or prospecting
 */
export async function quickAddNewCustomer(data: {
  name: string;
  category: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  address: string;
  tier?: number;
  whatTheyDo?: string;
}): Promise<Client> {
  const newClient: Client = {
    id: uuidv4(),
    name: data.name,
    address: data.address || 'UAE Industrial Zone',
    lat: null,
    lng: null,
    phone: data.phone || '',
    website: '',
    backgroundBlurb: data.whatTheyDo || `${data.category} company operating in the UAE.`,
    category: data.category as any,
    tier: (data.tier as any) || 3,
    status: 'New',
    whatTheyDo: data.whatTheyDo || data.category,
    contacts: [
      {
        name: data.contactName || 'Lead Contact',
        role: data.contactRole || 'Manager',
        mobile: data.phone || '',
        email: data.email || '',
      },
    ],
    nextFollowUpDate: null,
    retryFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    tier1: {
      isWatch: false,
      emirate: '',
      primarySiteAddress: data.address || '',
      justification: '',
      allocationStatus: 'Open',
      allocatedTo: '',
      allocatedProductLines: [],
    },
  };

  await db.clients.put(newClient);
  return newClient;
}
