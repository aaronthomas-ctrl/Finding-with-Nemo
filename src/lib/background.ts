import { db } from '../db';

export async function runBackgroundJobs() {
  try {
    const clients = await db.clients.toArray();
    const interactions = await db.interactions.toArray();
    const now = new Date();
  
    for (const client of clients) {
      const clientInteractions = interactions
        .filter(i => i.clientId === client.id)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
      let retryFlag = false;
      
      if (clientInteractions.length > 0) {
        const lastInteraction = clientInteractions[0];
        const isOutreach = ['WhatsApp', 'Email', 'LinkedIn'].includes(lastInteraction.channel);
        const daysSince = (now.getTime() - lastInteraction.timestamp.getTime()) / (1000 * 3600 * 24);
        
        if (isOutreach && daysSince >= 3) {
          retryFlag = true;
        }
      }
  
      if (client.retryFlag !== retryFlag) {
        await db.clients.update(client.id, { retryFlag, updatedAt: new Date() });
      }
    }
  } catch (error) {
    console.error("Failed to run background jobs:", error);
  }
}
