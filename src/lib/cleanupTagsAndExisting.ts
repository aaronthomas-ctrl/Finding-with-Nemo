import { db, supabase } from '../db';

export async function cleanupCustomerTagsAndExisting() {
  const hasRun = sessionStorage.getItem('has_cleaned_existing_customers_v1');
  if (hasRun) return;

  try {
    const clients = await db.clients.toArray();
    const existingIds: string[] = [];
    const clientsWithCustomerTags: { id: string; tags: string[] }[] = [];

    for (const c of clients) {
      const isExistingStatus = (
        c.status?.toLowerCase() === 'existing customer' ||
        c.status?.toLowerCase() === 'existing account' ||
        c.status?.toLowerCase().includes('existing') ||
        c.metadata?.isExistingCustomer === true ||
        c.tags?.some((t: string) => t.toLowerCase() === 'existing customer')
      );

      if (isExistingStatus) {
        existingIds.push(c.id);
        continue;
      }

      if (c.tags && c.tags.some((t: string) => t.toLowerCase().startsWith('customer:'))) {
        const cleaned = c.tags.filter((t: string) => !t.toLowerCase().startsWith('customer:'));
        clientsWithCustomerTags.push({ id: c.id, tags: cleaned });
      }
    }

    if (existingIds.length > 0) {
      for (let i = 0; i < existingIds.length; i += 100) {
        const chunk = existingIds.slice(i, i + 100);
        await supabase.from('clients').delete().in('id', chunk);
      }
    }

    if (clientsWithCustomerTags.length > 0) {
      for (const item of clientsWithCustomerTags) {
        await supabase.from('clients').update({ tags: item.tags }).eq('id', item.id);
      }
    }

    sessionStorage.setItem('has_cleaned_existing_customers_v1', 'true');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}
