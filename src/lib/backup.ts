import { db } from '../db';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportClientsCsv() {
  const data = await db.clients.toArray();
  if (!data.length) return;
  
  // Find max targetBrands length to create dynamic headers
  let maxBrands = 0;
  data.forEach(client => {
    if (client.targetBrands && client.targetBrands.length > maxBrands) {
      maxBrands = client.targetBrands.length;
    }
  });

  const baseHeaders = ['id', 'name', 'category', 'tier', 'status', 'phone', 'website', 'address', 'nextFollowUpDate', 'createdAt', 'updatedAt'];
  const brandHeaders = [];
  for (let i = 1; i <= maxBrands; i++) {
    brandHeaders.push(`Target Brand ${i}`);
  }
  
  const allHeaders = [...baseHeaders, ...brandHeaders];
  const csv = [allHeaders.join(',')];

  for (const row of data) {
    const rowValues = baseHeaders.map(h => escapeCsv((row as any)[h]));
    
    // Fill in the brand columns
    for (let i = 0; i < maxBrands; i++) {
      if (row.targetBrands && row.targetBrands[i]) {
        rowValues.push(escapeCsv(row.targetBrands[i]));
      } else {
        rowValues.push('""'); // Empty column if brand doesn't exist for this index
      }
    }
    
    csv.push(rowValues.join(','));
  }

  downloadCsv('clients.csv', csv.join('\n'));
}

export async function exportEnquiriesCsv() {
  const data = await db.enquiries.toArray();
  if (!data.length) return;
  const headers = ['id', 'clientId', 'date', 'productLine', 'itemDescription', 'quantity', 'department', 'outcome'];
  const csv = [headers.join(',')];
  for (const row of data) {
    csv.push(headers.map(h => escapeCsv((row as any)[h])).join(','));
  }
  downloadCsv('enquiries.csv', csv.join('\n'));
}

export async function exportInteractionsCsv() {
  const data = await db.interactions.toArray();
  if (!data.length) return;
  const headers = ['id', 'clientId', 'timestamp', 'channel', 'summary'];
  const csv = [headers.join(',')];
  for (const row of data) {
    csv.push(headers.map(h => escapeCsv((row as any)[h])).join(','));
  }
  downloadCsv('interactions.csv', csv.join('\n'));
}

export async function exportCampaignsCsv() {
  const data = await db.campaigns.toArray();
  if (!data.length) return;
  const headers = ['id', 'title', 'description', 'productLines', 'offerDetails', 'validFrom', 'validTo'];
  const csv = [headers.join(',')];
  for (const row of data) {
    csv.push(headers.map(h => escapeCsv((row as any)[h])).join(','));
  }
  downloadCsv('campaigns.csv', csv.join('\n'));
}

export async function exportFullJson() {
  const clients = await db.clients.toArray();
  const leads = await db.leads.toArray();
  const enquiries = await db.enquiries.toArray();
  const interactions = await db.interactions.toArray();
  const campaigns = await db.campaigns.toArray();
  const settings = await db.settings.toArray();

  const data = { clients, leads, enquiries, interactions, campaigns, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'b2bsales_backup.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function importFullJson(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        
        if (data.clients) {
          for (const c of data.clients) {
            c.createdAt = new Date(c.createdAt);
            c.updatedAt = new Date(c.updatedAt);
            if (c.nextFollowUpDate) c.nextFollowUpDate = new Date(c.nextFollowUpDate);
            
            const existing = await db.clients.get(c.id);
            if (!existing || existing.updatedAt < c.updatedAt) {
              await db.clients.put(c);
            }
          }
        }

        if (data.leads) {
          for (const l of data.leads) {
            l.date = new Date(l.date);
            await db.leads.put(l);
          }
        }

        if (data.enquiries) {
          for (const enq of data.enquiries) {
            enq.date = new Date(enq.date);
            await db.enquiries.put(enq);
          }
        }

        if (data.interactions) {
          for (const i of data.interactions) {
            i.timestamp = new Date(i.timestamp);
            await db.interactions.put(i);
          }
        }

        if (data.campaigns) {
          for (const c of data.campaigns) {
            c.validFrom = new Date(c.validFrom);
            c.validTo = new Date(c.validTo);
            await db.campaigns.put(c);
          }
        }

        if (data.settings && data.settings.length > 0) {
          await db.settings.put(data.settings[0]);
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function clearAllData() {
  await db.clients.clear();
  await db.leads.clear();
  await db.enquiries.clear();
  await db.interactions.clear();
  await db.campaigns.clear();
  // Don't clear settings
}
