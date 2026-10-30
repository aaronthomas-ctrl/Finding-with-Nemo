/**
 * Synthetic demo data for three unrelated businesses. Everything here is invented: no real clients, people,
 * phone numbers or companies. Place names are real so the map works; the businesses on them are not.
 * Facts only enter memory with a quote that appears word for word in their source text (the Evidence Gate).
 */
export type ClientRow = [name: string, category: string, tags: string[], tier: 1 | 2 | 3 | 4, status: string];
export interface Doc { title: string; url?: string; kind: 'user' | 'web' | 'voice_note'; text: string; clientName?: string; facts: Array<{ claim: string; quote: string }> }
export interface SeedOrg {
  id: string; name: string; country: string; region: string; phonePrefix: string;
  summary: string; offerings: string[]; targets: string[]; categories: string[];
  tierRules: Array<{ tier: 1 | 2 | 3 | 4; label: string; rule: string }>;
  tags: Array<{ name: string; description: string; keywords: string[]; color: string }>;
  products: string[]; presets: Array<{ name: string; lat: number; lng: number; radius_km: number }>;
  streets: string[]; clients: ClientRow[];
  docs: Doc[];
  projects: Array<{ name: string; site: string; stage: string; description: string; startsInDays: number | null; endsInDays: number | null; participants: Array<{ client: string; role: string }>; proposal?: { client: string; role: string; quote: string } }>;
  predictions: Array<{ client: string; need: string; inDays: number; confidence: number; reasoning: string }>;
  enquiryClients: Array<{ client: string; item: string; gapDays: number; count: number }>;
  leads: Array<{ client: string; title: string; value: number; stage: string }>;
  watchers: Array<{ kind: 'website' | 'news' | 'projects' | 'social'; target: string; client?: string; changedSummary?: string }>;
  campaign: { name: string; pitch: string; tag: string };
  voice: { client: string; language: string; original: string; english: string };
  zone: { name: string; tags: string[]; preset: number };
}

const doc = (d: Doc) => d;

export const ORGS: SeedOrg[] = [
  {
    id: '5eed0000-0000-4000-8000-00000000000a', name: 'Bean & Co Supplies', country: 'United Arab Emirates', region: 'Dubai', phonePrefix: '+971 4 555',
    summary: 'Wholesale supplier of oat milk, specialty coffee beans and espresso machines to independent cafes and bakeries.',
    offerings: ['Barista oat and plant-based milks', 'Specialty coffee beans', 'Espresso machines and servicing'],
    targets: ['Independent cafes', 'Bakeries with a coffee counter', 'Hotel and co-working lounges'],
    categories: ['Cafe', 'Bakery', 'Hotel lounge', 'Co-working space', 'Restaurant', 'Other'],
    tierRules: [
      { tier: 1, label: 'Best fit', rule: 'Independent specialty cafe serving plant-based drinks, ideally with more than one branch' },
      { tier: 2, label: 'Good fit', rule: 'Single-site cafe or bakery with a serious coffee counter' },
      { tier: 3, label: 'Possible', rule: 'Restaurant, hotel or co-working space where coffee is a side offer' },
      { tier: 4, label: 'Low priority', rule: 'Everything else' },
    ],
    tags: [
      { name: 'plant-based', description: 'Serves vegan or plant-based drinks and food', keywords: ['vegan', 'oat milk', 'plant-based'], color: '#22c55e' },
      { name: 'specialty-coffee', description: 'Single-origin or specialty coffee focus', keywords: ['single origin', 'specialty', 'roastery'], color: '#a16207' },
      { name: 'multi-branch', description: 'More than one location', keywords: ['second branch', 'branches', 'locations'], color: '#3b82f6' },
      { name: 'bakery-counter', description: 'Bakery with a coffee counter', keywords: ['bakery', 'pastry', 'sourdough'], color: '#f59e0b' },
      { name: 'new-opening', description: 'Opening soon or recently opened', keywords: ['opening', 'launch', 'new'], color: '#ec4899' },
      { name: 'hotel-lounge', description: 'Hotel or lounge coffee service', keywords: ['hotel', 'lounge'], color: '#8b5cf6' },
      { name: 'brunch', description: 'Brunch-led menu', keywords: ['brunch', 'all-day'], color: '#f97316' },
      { name: 'vegan-menu', description: 'Fully or mostly vegan menu', keywords: ['vegan'], color: '#16a34a' },
      { name: 'equipment-upgrade', description: 'Likely to replace espresso equipment', keywords: ['new machine', 'refit', 'upgrade'], color: '#06b6d4' },
      { name: 'high-footfall', description: 'Busy location with strong passing trade', keywords: ['walk', 'promenade', 'busy'], color: '#ef4444' },
    ],
    products: ['Barista oat milk (1L cartons)', 'Single-origin beans (1kg)', 'Two-group espresso machine', 'Machine servicing plan'],
    presets: [
      { name: 'Dubai Marina', lat: 25.0805, lng: 55.1403, radius_km: 3 },
      { name: 'Jumeirah Beach Residence', lat: 25.0780, lng: 55.1337, radius_km: 2 },
      { name: 'Business Bay', lat: 25.1850, lng: 55.2720, radius_km: 3 },
      { name: 'Downtown Dubai', lat: 25.1972, lng: 55.2744, radius_km: 3 },
    ],
    streets: ['Marina Walk', 'Bluewaters Promenade', 'Al Sufouh Road', 'Sheikh Zayed Road', 'The Walk', 'Marsa Plaza', 'Marina Mall Lane', 'Yacht Club Road'],
    clients: [
      ['Green Sprout Cafe', 'Cafe', ['plant-based', 'vegan-menu', 'multi-branch'], 1, 'Pursuing'], ['Blue Bean Roasters', 'Cafe', ['specialty-coffee', 'high-footfall'], 1, 'Quoted'],
      ['Marina Crumbs Bakery', 'Bakery', ['bakery-counter', 'plant-based'], 2, 'New'], ['Palm Leaf Cafe', 'Cafe', ['plant-based', 'brunch'], 2, 'Pursuing'],
      ['The Daily Grind JBR', 'Cafe', ['high-footfall', 'specialty-coffee'], 2, 'Won'], ['Oat & Honey', 'Cafe', ['plant-based', 'vegan-menu'], 1, 'Pursuing'],
      ['Sunrise Brunch House', 'Restaurant', ['brunch', 'high-footfall'], 3, 'New'], ['Harbour Lounge Hotel', 'Hotel lounge', ['hotel-lounge', 'equipment-upgrade'], 2, 'Quoted'],
      ['Skyline Co-Work Cafe', 'Co-working space', ['new-opening', 'specialty-coffee'], 3, 'New'], ['Kernel & Crust', 'Bakery', ['bakery-counter', 'specialty-coffee'], 2, 'Pursuing'],
      ['Tide Pool Espresso', 'Cafe', ['specialty-coffee', 'new-opening'], 2, 'New'], ['Cedar Street Deli', 'Restaurant', ['brunch'], 4, 'Parked'],
      ['Dune Coffee Co', 'Cafe', ['specialty-coffee', 'multi-branch'], 1, 'Lost'], ['Little Fig Bakery', 'Bakery', ['bakery-counter', 'vegan-menu'], 3, 'New'],
      ['Aqua Terrace Hotel', 'Hotel lounge', ['hotel-lounge', 'high-footfall'], 3, 'New'], ['Roast & Rise', 'Cafe', ['specialty-coffee', 'equipment-upgrade'], 2, 'Pursuing'],
      ['Mint Leaf Juice Bar', 'Cafe', ['plant-based', 'vegan-menu'], 3, 'New'], ['Anchor Point Cafe', 'Cafe', ['high-footfall'], 4, 'New'],
      ['The Pastry Lab', 'Bakery', ['bakery-counter', 'new-opening'], 2, 'New'], ['Coral Bay Co-Working', 'Co-working space', ['specialty-coffee'], 3, 'New'],
      ['Saffron & Steam', 'Restaurant', ['brunch', 'plant-based'], 3, 'New'], ['Beacon Street Coffee', 'Cafe', ['specialty-coffee', 'multi-branch'], 2, 'Quoted'],
      ['Willow & Wheat', 'Bakery', ['bakery-counter', 'plant-based'], 2, 'New'], ['Marina Walk Kiosk', 'Cafe', ['new-opening', 'high-footfall'], 3, 'New'],
    ],
    docs: [
      doc({
        title: 'Meeting notes: Green Sprout Cafe', kind: 'user', clientName: 'Green Sprout Cafe',
        text: 'Met the owner of Green Sprout Cafe on Tuesday. They plan to open a second branch at Marina Walk in January 2027. They currently buy oat milk from a national distributor and are unhappy with delivery delays. The owner asked for a quote for 200 cartons a week by Friday. They also want a servicing plan for two espresso machines.',
        facts: [
          { claim: 'Green Sprout Cafe plans to open a second branch at Marina Walk in January 2027.', quote: 'They plan to open a second branch at Marina Walk in January 2027' },
          { claim: 'Green Sprout Cafe is unhappy with delivery delays from its current oat milk distributor.', quote: 'are unhappy with delivery delays' },
          { claim: 'Green Sprout Cafe wants a quote for 200 cartons of oat milk a week.', quote: 'asked for a quote for 200 cartons a week by Friday' },
          { claim: 'Green Sprout Cafe wants a servicing plan for two espresso machines.', quote: 'want a servicing plan for two espresso machines' },
        ],
      }),
      doc({
        title: 'Local news: new cafes in the Marina', kind: 'web', url: 'https://news.example.test/marina-cafes',
        text: 'Dubai Marina is seeing a wave of independent cafe openings this winter. Tide Pool Espresso opens next month on the Bluewaters Promenade with a single-origin menu. Meanwhile Harbour Lounge Hotel has put its lobby coffee bar refit out to tender, with bids due in December. Industry observers say plant-based drinks now make up a third of orders at independent cafes.',
        facts: [
          { claim: 'Tide Pool Espresso opens next month on the Bluewaters Promenade with a single-origin menu.', quote: 'Tide Pool Espresso opens next month on the Bluewaters Promenade' },
          { claim: 'Harbour Lounge Hotel has put its lobby coffee bar refit out to tender with bids due in December.', quote: 'has put its lobby coffee bar refit out to tender, with bids due in December' },
          { claim: 'Plant-based drinks make up about a third of orders at independent cafes.', quote: 'plant-based drinks now make up a third of orders at independent cafes' },
        ],
      }),
      doc({
        title: 'Call summary: Blue Bean Roasters', kind: 'user', clientName: 'Blue Bean Roasters',
        text: 'Call with the buyer at Blue Bean Roasters. They roast on site and serve about 400 coffees a day. Their current espresso machine is eight years old and keeps tripping out. They want to compare two quotes before the end of November and prefer a supplier that offers a same-day service call.',
        facts: [
          { claim: 'Blue Bean Roasters serves about 400 coffees a day.', quote: 'serve about 400 coffees a day' },
          { claim: 'Blue Bean Roasters has an eight-year-old espresso machine that keeps tripping out.', quote: 'espresso machine is eight years old and keeps tripping out' },
          { claim: 'Blue Bean Roasters wants to compare two quotes before the end of November.', quote: 'compare two quotes before the end of November' },
        ],
      }),
    ],
    projects: [
      { name: 'Green Sprout Cafe second branch', site: 'Marina Walk', stage: 'construction', description: 'Second branch opening January 2027 with a full oat milk and espresso setup.', startsInDays: -40, endsInDays: 70, participants: [{ client: 'Green Sprout Cafe', role: 'owner' }] },
      { name: 'Harbour Lounge coffee bar refit', site: 'Harbour Lounge Hotel lobby', stage: 'tender', description: 'Lobby coffee bar refit out to tender, bids due December.', startsInDays: 30, endsInDays: 120, participants: [{ client: 'Harbour Lounge Hotel', role: 'owner' }], proposal: { client: 'Roast & Rise', role: 'bidder', quote: 'Roast & Rise has submitted a bid for the lobby coffee bar refit' } },
      { name: 'Bluewaters kiosk cluster', site: 'Bluewaters Promenade', stage: 'planning', description: 'Cluster of coffee kiosks planned along the promenade.', startsInDays: 90, endsInDays: 240, participants: [{ client: 'Tide Pool Espresso', role: 'operator' }] },
    ],
    predictions: [
      { client: 'Green Sprout Cafe', need: 'Oat milk supply for a second branch', inDays: 21, confidence: 0.78, reasoning: 'The second branch opens in January 2027 and the owner asked for a 200 carton weekly quote, so supply is needed before opening.' },
      { client: 'Blue Bean Roasters', need: 'Replacement espresso machine', inDays: 35, confidence: 0.64, reasoning: 'Their eight-year-old machine keeps tripping out and they are comparing quotes before the end of November.' },
    ],
    enquiryClients: [{ client: 'The Daily Grind JBR', item: 'Barista oat milk', gapDays: 30, count: 5 }, { client: 'Beacon Street Coffee', item: 'Single-origin beans', gapDays: 45, count: 4 }],
    leads: [
      { client: 'Green Sprout Cafe', title: 'Weekly oat milk supply, second branch', value: 18000, stage: 'quoted' },
      { client: 'Blue Bean Roasters', title: 'Two-group espresso machine', value: 9500, stage: 'new' },
      { client: 'Harbour Lounge Hotel', title: 'Lobby coffee bar refit', value: 32000, stage: 'quoted' },
    ],
    watchers: [
      { kind: 'news', target: 'new cafe openings in Dubai Marina', changedSummary: 'Two new cafe openings reported on the Bluewaters Promenade, including a single-origin concept that will need a milk supplier.' },
      { kind: 'projects', target: 'hotel coffee bar refit tender Dubai', changedSummary: 'A hotel lobby coffee bar refit tender was published with bids due in December.' },
    ],
    campaign: { name: 'Winter oat milk offer', pitch: 'Free delivery on the first two weekly orders of barista oat milk for new cafe customers.', tag: 'plant-based' },
    voice: { client: 'Green Sprout Cafe', language: 'ar', original: 'قابلت صاحب مقهى جرين سبراوت اليوم. يخططون لفتح فرع ثان في يناير ويريدون عرض سعر لحليب الشوفان قبل يوم الجمعة.', english: 'I met the owner of Green Sprout Cafe today. They plan to open a second branch in January and want a quote for oat milk by Friday.' },
    zone: { name: 'Marina cafe belt', tags: ['plant-based', 'specialty-coffee'], preset: 0 },
  },
  {
    id: '5eed0000-0000-4000-8000-00000000000b', name: 'SunHarbor Solar', country: 'United States', region: 'Texas', phonePrefix: '+1 512 555',
    summary: 'Designs and installs rooftop solar, battery storage and EV charging for commercial buildings, schools and farms around Austin.',
    offerings: ['Commercial rooftop solar', 'Battery storage', 'EV charger installation', 'Maintenance plans'],
    targets: ['Commercial building owners', 'Schools and school districts', 'Farms and ranches', 'Homeowner associations'],
    categories: ['Commercial building', 'School', 'Farm', 'HOA', 'Warehouse', 'Other'],
    tierRules: [
      { tier: 1, label: 'Best fit', rule: 'Large flat or south-facing roof, high daytime energy use, owns the building' },
      { tier: 2, label: 'Good fit', rule: 'Owner-occupied building with a medium roof or an upcoming expansion' },
      { tier: 3, label: 'Possible', rule: 'Leases the building or has a small roof' },
      { tier: 4, label: 'Low priority', rule: 'Everything else' },
    ],
    tags: [
      { name: 'large-roof', description: 'Large flat or low-slope roof', keywords: ['warehouse', 'flat roof', 'large roof'], color: '#f59e0b' },
      { name: 'high-energy-use', description: 'High daytime electricity use', keywords: ['cold storage', 'refrigeration', 'manufacturing'], color: '#ef4444' },
      { name: 'new-construction', description: 'Building under construction or planned', keywords: ['groundbreaking', 'new campus', 'construction'], color: '#3b82f6' },
      { name: 'ev-charger', description: 'Wants or needs EV charging', keywords: ['fleet', 'ev', 'charging'], color: '#22c55e' },
      { name: 'battery-ready', description: 'Backup power or outage concerns', keywords: ['backup', 'outage', 'resilience'], color: '#8b5cf6' },
      { name: 'municipal-tender', description: 'Public tender or district programme', keywords: ['tender', 'district', 'bond'], color: '#06b6d4' },
      { name: 'tax-credit-eligible', description: 'Likely to qualify for federal credits', keywords: ['tax credit', 'incentive'], color: '#84cc16' },
      { name: 'expansion', description: 'Growing or adding buildings', keywords: ['expansion', 'second site', 'new wing'], color: '#ec4899' },
      { name: 'agriculture', description: 'Farm or irrigation load', keywords: ['farm', 'irrigation', 'barn'], color: '#a16207' },
      { name: 'school-district', description: 'Public school sites', keywords: ['school', 'district'], color: '#f97316' },
    ],
    products: ['Commercial rooftop solar install', 'Battery storage system', 'EV charger installation', 'Annual maintenance plan'],
    presets: [
      { name: 'Downtown Austin', lat: 30.2672, lng: -97.7431, radius_km: 5 },
      { name: 'Round Rock', lat: 30.5083, lng: -97.6789, radius_km: 6 },
      { name: 'Pflugerville', lat: 30.4394, lng: -97.62, radius_km: 5 },
      { name: 'Georgetown', lat: 30.6333, lng: -97.6777, radius_km: 6 },
    ],
    streets: ['Industrial Blvd', 'Research Park Drive', 'Bluff Springs Road', 'Ranch Road 620', 'Parmer Lane', 'Metric Boulevard', 'Burnet Road', 'Cameron Road'],
    clients: [
      ['Lone Star Cold Storage', 'Warehouse', ['large-roof', 'high-energy-use'], 1, 'Pursuing'], ['Barton Creek Elementary', 'School', ['school-district', 'municipal-tender'], 2, 'Quoted'],
      ['Hill Country Dairy Farm', 'Farm', ['agriculture', 'battery-ready'], 2, 'New'], ['Pecan Grove HOA', 'HOA', ['tax-credit-eligible'], 3, 'New'],
      ['Capital City Logistics', 'Warehouse', ['large-roof', 'ev-charger'], 1, 'Pursuing'], ['Riverbend Medical Plaza', 'Commercial building', ['high-energy-use', 'battery-ready'], 2, 'Quoted'],
      ['Mesa Ridge Brewing', 'Commercial building', ['high-energy-use', 'expansion'], 2, 'Won'], ['Oak Hollow Middle School', 'School', ['school-district', 'municipal-tender'], 2, 'New'],
      ['Prairie Wind Ranch', 'Farm', ['agriculture'], 3, 'New'], ['Northline Self Storage', 'Warehouse', ['large-roof', 'new-construction'], 1, 'New'],
      ['Cedar Park Fitness Club', 'Commercial building', ['high-energy-use', 'ev-charger'], 3, 'New'], ['Bluebonnet Senior Living', 'Commercial building', ['battery-ready', 'expansion'], 2, 'Pursuing'],
      ['Sunset Valley Grocers', 'Commercial building', ['high-energy-use', 'large-roof'], 2, 'New'], ['Westlake Charter Academy', 'School', ['school-district', 'new-construction'], 2, 'New'],
      ['Windmill Orchard Farm', 'Farm', ['agriculture', 'tax-credit-eligible'], 3, 'Lost'], ['Greenway Distribution', 'Warehouse', ['large-roof', 'ev-charger', 'expansion'], 1, 'Quoted'],
      ['Live Oak Apartments HOA', 'HOA', ['tax-credit-eligible'], 3, 'New'], ['Tech Ridge Data Annex', 'Commercial building', ['high-energy-use', 'battery-ready'], 1, 'New'],
      ['Mockingbird Elementary', 'School', ['school-district'], 3, 'Parked'], ['Falcon Point Auto Group', 'Commercial building', ['ev-charger', 'large-roof'], 2, 'New'],
      ['Blackland Cotton Co-op', 'Farm', ['agriculture', 'high-energy-use'], 2, 'New'], ['Harvest Moon Bakery Plant', 'Warehouse', ['high-energy-use', 'large-roof'], 2, 'New'],
      ['Stonegate Office Park', 'Commercial building', ['new-construction', 'large-roof'], 2, 'New'], ['Trailhead Community Center', 'Commercial building', ['municipal-tender'], 3, 'New'],
    ],
    docs: [
      doc({
        title: 'Site visit notes: Lone Star Cold Storage', kind: 'user', clientName: 'Lone Star Cold Storage',
        text: 'Walked the roof at Lone Star Cold Storage with the facilities manager. The warehouse has about 90,000 square feet of flat roof in good condition. Refrigeration runs around the clock and the electricity bill averages 48,000 dollars a month. They want a proposal before their budget meeting on 15 November and asked about battery backup for outages.',
        facts: [
          { claim: 'Lone Star Cold Storage has about 90,000 square feet of flat roof in good condition.', quote: 'about 90,000 square feet of flat roof in good condition' },
          { claim: 'Lone Star Cold Storage pays about 48,000 dollars a month for electricity.', quote: 'electricity bill averages 48,000 dollars a month' },
          { claim: 'Lone Star Cold Storage wants a proposal before its 15 November budget meeting.', quote: 'proposal before their budget meeting on 15 November' },
          { claim: 'Lone Star Cold Storage asked about battery backup for outages.', quote: 'asked about battery backup for outages' },
        ],
      }),
      doc({
        title: 'District announcement: school solar programme', kind: 'web', url: 'https://district.example.test/solar-programme',
        text: 'The district board approved a bond to install rooftop solar at six campuses next year. Barton Creek Elementary and Oak Hollow Middle School are in the first group. Contractors may submit proposals until 30 November, and the district will prefer bidders who include a ten-year maintenance plan.',
        facts: [
          { claim: 'The school district approved a bond to install rooftop solar at six campuses next year.', quote: 'approved a bond to install rooftop solar at six campuses next year' },
          { claim: 'Barton Creek Elementary and Oak Hollow Middle School are in the first solar group.', quote: 'Barton Creek Elementary and Oak Hollow Middle School are in the first group' },
          { claim: 'Contractors may submit solar proposals to the district until 30 November.', quote: 'may submit proposals until 30 November' },
        ],
      }),
      doc({
        title: 'Call summary: Greenway Distribution', kind: 'user', clientName: 'Greenway Distribution',
        text: 'Spoke with the operations director at Greenway Distribution. They are adding a second warehouse in Pflugerville next spring and plan to electrify their delivery vans. They need roughly 40 chargers across both sites and want solar to offset the charging load.',
        facts: [
          { claim: 'Greenway Distribution is adding a second warehouse in Pflugerville next spring.', quote: 'adding a second warehouse in Pflugerville next spring' },
          { claim: 'Greenway Distribution needs roughly 40 EV chargers across both sites.', quote: 'need roughly 40 chargers across both sites' },
        ],
      }),
    ],
    projects: [
      { name: 'Lone Star roof and battery project', site: 'Lone Star Cold Storage, Parmer Lane', stage: 'design', description: 'Rooftop solar with battery backup for a cold storage warehouse.', startsInDays: 20, endsInDays: 140, participants: [{ client: 'Lone Star Cold Storage', role: 'owner' }] },
      { name: 'District solar programme, first group', site: 'Six school campuses', stage: 'tender', description: 'District bond for rooftop solar, proposals due 30 November.', startsInDays: 45, endsInDays: 300, participants: [{ client: 'Barton Creek Elementary', role: 'owner' }], proposal: { client: 'Oak Hollow Middle School', role: 'owner', quote: 'Oak Hollow Middle School are in the first group' } },
      { name: 'Greenway Pflugerville warehouse', site: 'Pflugerville', stage: 'planning', description: 'Second warehouse with fleet charging planned for next spring.', startsInDays: 110, endsInDays: 260, participants: [{ client: 'Greenway Distribution', role: 'owner' }] },
    ],
    predictions: [
      { client: 'Lone Star Cold Storage', need: 'Rooftop solar with battery backup', inDays: 28, confidence: 0.74, reasoning: 'A 90,000 sq ft roof, a 48,000 dollar monthly bill and a proposal deadline of 15 November point to a decision this quarter.' },
      { client: 'Greenway Distribution', need: 'EV chargers and solar for the new warehouse', inDays: 90, confidence: 0.58, reasoning: 'The Pflugerville warehouse opens next spring and about 40 chargers are planned across both sites.' },
    ],
    enquiryClients: [{ client: 'Mesa Ridge Brewing', item: 'Maintenance plan', gapDays: 90, count: 4 }, { client: 'Riverbend Medical Plaza', item: 'Battery storage', gapDays: 60, count: 3 }],
    leads: [
      { client: 'Lone Star Cold Storage', title: '90 kW rooftop solar with battery', value: 410000, stage: 'quoted' },
      { client: 'Barton Creek Elementary', title: 'District solar programme bid', value: 260000, stage: 'new' },
      { client: 'Greenway Distribution', title: 'EV chargers and solar, two sites', value: 185000, stage: 'new' },
    ],
    watchers: [
      { kind: 'news', target: 'Austin school district solar programme', changedSummary: 'The district extended its solar proposal deadline and added two campuses to the first group.' },
      { kind: 'projects', target: 'new warehouse construction Pflugerville Texas', changedSummary: 'A permit was filed for a new distribution warehouse in Pflugerville.' },
    ],
    campaign: { name: 'Q4 commercial roof assessments', pitch: 'Free roof and energy-use assessment for owner-occupied commercial buildings before year-end tax planning.', tag: 'large-roof' },
    voice: { client: 'Lone Star Cold Storage', language: 'es', original: 'Hoy hablé con el gerente de Lone Star Cold Storage. Quieren una propuesta antes del 15 de noviembre y preguntaron por baterías de respaldo.', english: 'Today I spoke with the manager of Lone Star Cold Storage. They want a proposal before 15 November and asked about backup batteries.' },
    zone: { name: 'North Austin industrial belt', tags: ['large-roof', 'high-energy-use'], preset: 2 },
  },
  {
    id: '5eed0000-0000-4000-8000-00000000000c', name: 'BrightSmile Dental Supply', country: 'United Kingdom', region: 'England', phonePrefix: '+44 161 555',
    summary: 'Supplies dental clinics in Greater Manchester with consumables, digital scanners, sterilisation equipment and treatment chairs.',
    offerings: ['Disposable consumables', 'Digital intraoral scanners', 'Sterilisation equipment', 'Treatment chairs'],
    targets: ['Private dental practices', 'Orthodontists', 'Dental chains', 'Dental laboratories'],
    categories: ['General practice', 'Orthodontist', 'Dental chain', 'Hygienist clinic', 'Dental lab', 'Other'],
    tierRules: [
      { tier: 1, label: 'Best fit', rule: 'Growing private practice or chain with several surgeries and a digital workflow' },
      { tier: 2, label: 'Good fit', rule: 'Established private practice with three or more surgeries' },
      { tier: 3, label: 'Possible', rule: 'Small practice or hygienist clinic' },
      { tier: 4, label: 'Low priority', rule: 'Everything else' },
    ],
    tags: [
      { name: 'new-clinic', description: 'Clinic opening or recently opened', keywords: ['opening', 'new clinic', 'grand opening'], color: '#ec4899' },
      { name: 'multi-chair', description: 'Three or more surgeries', keywords: ['surgeries', 'chairs'], color: '#3b82f6' },
      { name: 'orthodontics', description: 'Orthodontic focus', keywords: ['braces', 'aligners', 'orthodontic'], color: '#8b5cf6' },
      { name: 'cosmetic', description: 'Cosmetic dentistry', keywords: ['whitening', 'veneers', 'smile'], color: '#f59e0b' },
      { name: 'private-practice', description: 'Private, not NHS-only', keywords: ['private'], color: '#22c55e' },
      { name: 'digital-scanning', description: 'Uses or wants digital scanning', keywords: ['scanner', 'digital impressions'], color: '#06b6d4' },
      { name: 'expansion', description: 'Adding surgeries or sites', keywords: ['expansion', 'second site', 'extra surgery'], color: '#ef4444' },
      { name: 'nhs-contract', description: 'Holds NHS contract work', keywords: ['nhs'], color: '#84cc16' },
      { name: 'high-volume', description: 'High patient volume', keywords: ['busy', 'high volume'], color: '#f97316' },
    ],
    products: ['Disposable consumables bundle', 'Digital intraoral scanner', 'Steam sterilisation unit', 'Treatment chair'],
    presets: [
      { name: 'Manchester city centre', lat: 53.4808, lng: -2.2426, radius_km: 4 },
      { name: 'Salford Quays', lat: 53.4723, lng: -2.2935, radius_km: 3 },
      { name: 'Stockport', lat: 53.4106, lng: -2.1575, radius_km: 4 },
      { name: 'Altrincham', lat: 53.3876, lng: -2.3478, radius_km: 4 },
    ],
    streets: ['Oxford Road', 'Deansgate', 'Wilmslow Road', 'Chapel Street', 'Princess Road', 'Stockport Road', 'Ashley Road', 'Mauldeth Road'],
    clients: [
      ['Northern Quarter Dental', 'General practice', ['private-practice', 'multi-chair'], 2, 'Pursuing'], ['Salford Quays Smile Clinic', 'General practice', ['new-clinic', 'cosmetic'], 1, 'New'],
      ['Alder Orthodontics', 'Orthodontist', ['orthodontics', 'digital-scanning'], 1, 'Quoted'], ['Deansgate Dental Care', 'Dental chain', ['multi-chair', 'high-volume', 'expansion'], 1, 'Pursuing'],
      ['Stockport Family Dentistry', 'General practice', ['nhs-contract', 'high-volume'], 3, 'New'], ['Maple Grove Hygiene Studio', 'Hygienist clinic', ['private-practice'], 3, 'New'],
      ['Altrincham Smile Studio', 'General practice', ['cosmetic', 'private-practice'], 2, 'Won'], ['Piccadilly Dental Lab', 'Dental lab', ['digital-scanning'], 2, 'New'],
      ['Didsbury Dental Practice', 'General practice', ['multi-chair', 'private-practice'], 2, 'New'], ['Chorlton Orthodontic Centre', 'Orthodontist', ['orthodontics', 'expansion'], 2, 'Pursuing'],
      ['Ancoats Dental Hub', 'Dental chain', ['multi-chair', 'new-clinic'], 1, 'New'], ['Whitworth Park Dental', 'General practice', ['nhs-contract'], 4, 'Parked'],
      ['Hale Barns Cosmetic Dentistry', 'General practice', ['cosmetic', 'private-practice'], 2, 'New'], ['Levenshulme Dental Care', 'General practice', ['nhs-contract', 'high-volume'], 3, 'New'],
      ['Spinningfields Dental Group', 'Dental chain', ['multi-chair', 'high-volume'], 1, 'Quoted'], ['Heaton Moor Dental', 'General practice', ['private-practice'], 3, 'New'],
      ['Prestwich Smile Centre', 'General practice', ['cosmetic'], 3, 'Lost'], ['Eccles Dental Surgery', 'General practice', ['nhs-contract'], 4, 'New'],
      ['Sale Moor Orthodontics', 'Orthodontist', ['orthodontics'], 2, 'New'], ['Media City Dental', 'General practice', ['new-clinic', 'digital-scanning'], 2, 'New'],
      ['Bramhall Dental Studio', 'General practice', ['private-practice', 'multi-chair'], 2, 'New'], ['Urmston Dental Care', 'General practice', ['nhs-contract'], 3, 'New'],
      ['Withington Family Dental', 'General practice', ['high-volume'], 3, 'New'], ['Castlefield Dental Lab', 'Dental lab', ['digital-scanning', 'expansion'], 2, 'New'],
    ],
    docs: [
      doc({
        title: 'Meeting notes: Deansgate Dental Care', kind: 'user', clientName: 'Deansgate Dental Care',
        text: 'Met the practice manager at Deansgate Dental Care. They are adding three surgeries at their Spinningfields site in March and need to equip them. They want to standardise on one intraoral scanner across all five sites and asked for a demo in the second week of November. Their current steriliser is nine years old.',
        facts: [
          { claim: 'Deansgate Dental Care is adding three surgeries at its Spinningfields site in March.', quote: 'adding three surgeries at their Spinningfields site in March' },
          { claim: 'Deansgate Dental Care wants one intraoral scanner standard across all five sites.', quote: 'standardise on one intraoral scanner across all five sites' },
          { claim: 'Deansgate Dental Care asked for a scanner demo in the second week of November.', quote: 'asked for a demo in the second week of November' },
          { claim: 'Deansgate Dental Care has a nine-year-old steriliser.', quote: 'current steriliser is nine years old' },
        ],
      }),
      doc({
        title: 'Local news: clinic openings', kind: 'web', url: 'https://news.example.test/manchester-clinics',
        text: 'Ancoats Dental Hub will open six surgeries in a converted mill in January. The group says it will use digital impressions throughout. Elsewhere, Alder Orthodontics has announced a second site in Chorlton, with an opening planned for spring.',
        facts: [
          { claim: 'Ancoats Dental Hub will open six surgeries in a converted mill in January.', quote: 'will open six surgeries in a converted mill in January' },
          { claim: 'Ancoats Dental Hub will use digital impressions throughout.', quote: 'will use digital impressions throughout' },
          { claim: 'Alder Orthodontics has announced a second site in Chorlton opening in spring.', quote: 'announced a second site in Chorlton, with an opening planned for spring' },
        ],
      }),
      doc({
        title: 'Call summary: Alder Orthodontics', kind: 'user', clientName: 'Alder Orthodontics',
        text: 'Called the lead orthodontist at Alder Orthodontics. They treat about 60 aligner patients a month and want to move from impressions to scans. They are comparing two scanner suppliers and will decide by the end of the month.',
        facts: [
          { claim: 'Alder Orthodontics treats about 60 aligner patients a month.', quote: 'treat about 60 aligner patients a month' },
          { claim: 'Alder Orthodontics is comparing two scanner suppliers and will decide by the end of the month.', quote: 'comparing two scanner suppliers and will decide by the end of the month' },
        ],
      }),
    ],
    projects: [
      { name: 'Spinningfields three-surgery expansion', site: 'Spinningfields', stage: 'construction', description: 'Three new surgeries at the Deansgate Dental Care Spinningfields site, opening in March.', startsInDays: -20, endsInDays: 130, participants: [{ client: 'Deansgate Dental Care', role: 'owner' }] },
      { name: 'Ancoats mill clinic', site: 'Ancoats', stage: 'construction', description: 'Six-surgery clinic in a converted mill, opening in January.', startsInDays: -60, endsInDays: 70, participants: [{ client: 'Ancoats Dental Hub', role: 'owner' }], proposal: { client: 'Piccadilly Dental Lab', role: 'supplier', quote: 'Piccadilly Dental Lab will supply restorations to the new clinic' } },
      { name: 'Alder Chorlton second site', site: 'Chorlton', stage: 'planning', description: 'Second Alder Orthodontics site planned for spring.', startsInDays: 60, endsInDays: 200, participants: [{ client: 'Alder Orthodontics', role: 'owner' }, { client: 'Chorlton Orthodontic Centre', role: 'competitor nearby' }] },
    ],
    predictions: [
      { client: 'Deansgate Dental Care', need: 'Intraoral scanners and equipment for three new surgeries', inDays: 30, confidence: 0.8, reasoning: 'Three surgeries open in March and the practice wants a single scanner standard across five sites, with a demo requested for November.' },
      { client: 'Alder Orthodontics', need: 'Digital intraoral scanner', inDays: 20, confidence: 0.69, reasoning: 'They treat about 60 aligner patients a month, want to move to scans and decide by month end.' },
    ],
    enquiryClients: [{ client: 'Altrincham Smile Studio', item: 'Disposable consumables bundle', gapDays: 30, count: 6 }, { client: 'Northern Quarter Dental', item: 'Disposable consumables bundle', gapDays: 45, count: 4 }],
    leads: [
      { client: 'Deansgate Dental Care', title: 'Scanners and chairs for three surgeries', value: 96000, stage: 'quoted' },
      { client: 'Alder Orthodontics', title: 'Digital intraoral scanner', value: 24000, stage: 'quoted' },
      { client: 'Ancoats Dental Hub', title: 'Six-surgery fit-out supplies', value: 140000, stage: 'new' },
    ],
    watchers: [
      { kind: 'news', target: 'new dental clinic openings Greater Manchester', changedSummary: 'A converted mill clinic in Ancoats announced a January opening with six surgeries.' },
      { kind: 'projects', target: 'dental practice expansion Manchester planning', changedSummary: 'A planning application was filed for an extension to a dental practice in Chorlton.' },
    ],
    campaign: { name: 'Scanner demo week', pitch: 'Book a hands-on digital scanner demo in your own surgery during the second week of November.', tag: 'digital-scanning' },
    voice: { client: 'Deansgate Dental Care', language: 'hi', original: 'आज डीन्सगेट डेंटल केयर के प्रैक्टिस मैनेजर से मिला। वे मार्च में तीन नई सर्जरी जोड़ रहे हैं और नवंबर के दूसरे हफ्ते में स्कैनर का डेमो चाहते हैं।', english: 'Today I met the practice manager of Deansgate Dental Care. They are adding three new surgeries in March and want a scanner demo in the second week of November.' },
    zone: { name: 'Central Manchester practices', tags: ['multi-chair', 'digital-scanning'], preset: 0 },
  },
  {
    id: '5eed0000-0000-4000-8000-00000000000d', name: 'Steel Arc Welding Supplies', country: 'United Arab Emirates', region: 'Ras Al Khaimah', phonePrefix: '+971 7 555',
    summary: 'Supplies welding electrodes, flux-cored and TIG wire, shielding gas and weld consumables to steel fabricators, pipe spool shops and EPC contractors across the northern emirates.',
    offerings: ['Welding electrodes and filler wire', 'Shielding gas cylinders', 'Weld consumables for pressure and pipe work', 'Next-day site delivery and consumables planning'],
    targets: ['EPC contractors', 'Steel and structural fabricators', 'Pipe spool and pressure vessel shops', 'Shipyards and shutdown maintenance contractors'],
    categories: ['EPC contractor', 'Fabrication workshop', 'Pipe and spool shop', 'Shipyard', 'Maintenance contractor', 'Other'],
    tierRules: [
      { tier: 1, label: 'Best fit', rule: 'EPC contractor or large fabricator with a live project and high weekly consumables use' },
      { tier: 2, label: 'Good fit', rule: 'Fabrication workshop or pipe spool shop with steady orders' },
      { tier: 3, label: 'Possible', rule: 'Maintenance contractor or shipyard that welds occasionally' },
      { tier: 4, label: 'Low priority', rule: 'Everything else' },
    ],
    tags: [
      { name: 'epc-contractor', description: 'Engineering, procurement and construction contractor', keywords: ['EPC', 'contractor', 'engineering procurement construction'], color: '#3b82f6' },
      { name: 'steel-fabricator', description: 'Structural steel fabrication workshop', keywords: ['fabrication', 'structural steel', 'steel works'], color: '#a16207' },
      { name: 'pipe-spool', description: 'Pipe spool and pressure piping shop', keywords: ['pipe spool', 'piping', 'pressure vessel'], color: '#06b6d4' },
      { name: 'new-project', description: 'Won or tendering a new project', keywords: ['awarded', 'tender', 'new plant'], color: '#ec4899' },
      { name: 'high-consumables-use', description: 'Heavy weekly use of electrodes and wire', keywords: ['consumables', 'electrodes', 'wire'], color: '#ef4444' },
      { name: 'shipyard', description: 'Marine and shipyard welding', keywords: ['shipyard', 'marine', 'offshore'], color: '#8b5cf6' },
      { name: 'shutdown-maintenance', description: 'Plant shutdown and maintenance welding', keywords: ['shutdown', 'turnaround', 'maintenance'], color: '#22c55e' },
      { name: 'pressure-vessel', description: 'Pressure vessel and heat exchanger work', keywords: ['pressure vessel', 'ASME', 'heat exchanger'], color: '#f59e0b' },
    ],
    products: ['E7018 electrodes (5kg packs)', 'Flux-cored wire (15kg spool)', 'TIG filler wire (5kg)', 'Shielding gas cylinder (50L)'],
    presets: [
      { name: 'Ras Al Khaimah', lat: 25.7895, lng: 55.9432, radius_km: 12 },
      { name: 'Sharjah Industrial Area', lat: 25.3000, lng: 55.4300, radius_km: 6 },
      { name: 'Jebel Ali Free Zone', lat: 25.0050, lng: 55.0600, radius_km: 8 },
      { name: 'Mussafah Industrial Area', lat: 24.3500, lng: 54.4900, radius_km: 6 },
    ],
    streets: ['Al Jazeera Industrial Road', 'Al Hamra Industrial Zone', 'Street 12', 'Sheikh Mohammed Bin Zayed Road', 'Al Ghail Road', 'Industrial Area 4', 'Port Road', 'Street 18'],
    clients: [
      ['Qasr Meridian EPC', 'EPC contractor', ['epc-contractor', 'new-project', 'high-consumables-use'], 1, 'Pursuing'], ['Harbor Arc Engineering', 'EPC contractor', ['epc-contractor', 'shutdown-maintenance'], 1, 'Quoted'],
      ['Mirage Pipe and Weld Works', 'Pipe and spool shop', ['pipe-spool', 'high-consumables-use'], 1, 'Pursuing'], ['Falcon Ridge Fabrication', 'Fabrication workshop', ['steel-fabricator', 'high-consumables-use'], 1, 'Won'],
      ['Dunecrest Steel Works', 'Fabrication workshop', ['steel-fabricator', 'new-project'], 2, 'Pursuing'], ['Coralline Marine Yard', 'Shipyard', ['shipyard', 'steel-fabricator'], 2, 'New'],
      ['Northgate Process Contracting', 'EPC contractor', ['epc-contractor', 'pressure-vessel'], 2, 'New'], ['Sandline Structural', 'Fabrication workshop', ['steel-fabricator'], 2, 'Quoted'],
      ['Tidewater Pressure Systems', 'Fabrication workshop', ['pressure-vessel', 'pipe-spool'], 2, 'Pursuing'], ['Al Wadi Plant Services', 'Maintenance contractor', ['shutdown-maintenance'], 3, 'New'],
      ['Gulfstone Industrial Projects', 'EPC contractor', ['epc-contractor', 'new-project'], 2, 'New'], ['Ironbridge Metalworks', 'Fabrication workshop', ['steel-fabricator', 'high-consumables-use'], 2, 'Pursuing'],
      ['Saffron Spool Engineering', 'Pipe and spool shop', ['pipe-spool'], 3, 'New'], ['Basalt Heavy Fabrication', 'Fabrication workshop', ['steel-fabricator', 'pressure-vessel'], 2, 'New'],
      ['Reefpoint Offshore Services', 'Shipyard', ['shipyard', 'shutdown-maintenance'], 3, 'New'], ['Orion Gate Contracting', 'EPC contractor', ['epc-contractor'], 3, 'Parked'],
      ['Desert Line Welding Works', 'Fabrication workshop', ['steel-fabricator', 'high-consumables-use'], 2, 'Lost'], ['Anvil and Arc Industries', 'Fabrication workshop', ['steel-fabricator', 'new-project'], 3, 'New'],
    ],
    docs: [
      doc({
        title: 'Meeting notes: Qasr Meridian EPC', kind: 'user', clientName: 'Qasr Meridian EPC',
        text: 'Met the procurement head of Qasr Meridian EPC on Monday. They have been awarded a new gas processing package and start fabrication in January 2027. They currently buy E7018 electrodes from a trading house and complain about late deliveries. The procurement head asked for a quote for 400 packs a month by Thursday. They also want a shielding gas supply agreement for the site yard.',
        facts: [
          { claim: 'Qasr Meridian EPC has been awarded a new gas processing package.', quote: 'awarded a new gas processing package' },
          { claim: 'Qasr Meridian EPC starts fabrication in January 2027.', quote: 'start fabrication in January 2027' },
          { claim: 'Qasr Meridian EPC wants a quote for 400 packs of E7018 electrodes a month.', quote: 'asked for a quote for 400 packs a month by Thursday' },
          { claim: 'Qasr Meridian EPC complains about late deliveries from its current electrode supplier.', quote: 'complain about late deliveries' },
        ],
      }),
      doc({
        title: 'Local news: fabrication demand in the northern emirates', kind: 'web', url: 'https://news.example.test/northern-emirates-fabrication',
        text: 'Fabrication yards in Ras Al Khaimah report a busy winter. Harbor Arc Engineering has opened a tender for a plant shutdown package with bids due in December. Meanwhile Falcon Ridge Fabrication is adding a second pipe spool line. Industry observers say weld consumables now account for a fifth of fabrication material costs.',
        facts: [
          { claim: 'Harbor Arc Engineering has opened a tender for a plant shutdown package with bids due in December.', quote: 'has opened a tender for a plant shutdown package with bids due in December' },
          { claim: 'Falcon Ridge Fabrication is adding a second pipe spool line.', quote: 'is adding a second pipe spool line' },
          { claim: 'Weld consumables account for a fifth of fabrication material costs.', quote: 'weld consumables now account for a fifth of fabrication material costs' },
        ],
      }),
      doc({
        title: 'Call summary: Mirage Pipe and Weld Works', kind: 'user', clientName: 'Mirage Pipe and Weld Works',
        text: 'Call with the workshop manager at Mirage Pipe and Weld Works. They fabricate about 60 pipe spools a week. Their current flux-cored wire supplier keeps running short. They want to compare two quotes before the end of November and prefer a supplier that offers same-day delivery.',
        facts: [
          { claim: 'Mirage Pipe and Weld Works fabricates about 60 pipe spools a week.', quote: 'fabricate about 60 pipe spools a week' },
          { claim: 'Mirage Pipe and Weld Works has a flux-cored wire supplier that keeps running short.', quote: 'flux-cored wire supplier keeps running short' },
          { claim: 'Mirage Pipe and Weld Works wants to compare two quotes before the end of November.', quote: 'compare two quotes before the end of November' },
        ],
      }),
    ],
    projects: [
      { name: 'Qasr Meridian gas processing package', site: 'Ras Al Khaimah fabrication yard', stage: 'construction', description: 'Gas processing package, fabrication starts January 2027.', startsInDays: -20, endsInDays: 150, participants: [{ client: 'Qasr Meridian EPC', role: 'owner' }] },
      { name: 'Harbor Arc plant shutdown package', site: 'Process plant, Mussafah', stage: 'tender', description: 'Plant shutdown package out to tender, bids due December.', startsInDays: 30, endsInDays: 110, participants: [{ client: 'Harbor Arc Engineering', role: 'owner' }] },
    ],
    predictions: [
      { client: 'Qasr Meridian EPC', need: 'Monthly E7018 electrode supply for the new package', inDays: 21, confidence: 0.76, reasoning: 'Fabrication starts January 2027 and procurement asked for a 400 pack monthly quote, so supply is needed before the start.' },
    ],
    enquiryClients: [{ client: 'Falcon Ridge Fabrication', item: 'Flux-cored wire', gapDays: 30, count: 5 }, { client: 'Ironbridge Metalworks', item: 'Shielding gas cylinders', gapDays: 45, count: 4 }],
    leads: [
      { client: 'Qasr Meridian EPC', title: 'Monthly E7018 electrodes and shielding gas', value: 42000, stage: 'quoted' },
      { client: 'Mirage Pipe and Weld Works', title: 'Flux-cored wire, weekly supply', value: 18500, stage: 'new' },
      { client: 'Harbor Arc Engineering', title: 'Shutdown package consumables', value: 61000, stage: 'quoted' },
    ],
    watchers: [],
    campaign: { name: 'Winter consumables offer', pitch: 'Free next-day delivery on the first two monthly electrode orders for new fabrication and EPC customers.', tag: 'high-consumables-use' },
    voice: { client: 'Qasr Meridian EPC', language: 'hi', original: 'आज मैं कासर मेरिडियन ईपीसी के प्रोक्योरमेंट हेड से मिला। जनवरी में फैब्रिकेशन शुरू होगा और वे गुरुवार तक इलेक्ट्रोड का कोटेशन चाहते हैं।', english: 'Today I met the procurement head of Qasr Meridian EPC. Fabrication starts in January and they want an electrode quote by Thursday.' },
    zone: { name: 'RAK industrial belt', tags: ['steel-fabricator', 'epc-contractor'], preset: 0 },
  },
];
