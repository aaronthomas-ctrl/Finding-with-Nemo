import React from 'react';
import { useLiveQuery } from '../db';
import { db, Client } from '../db';
import { renderTemplate } from '../lib/templates';
import { v4 as uuidv4 } from 'uuid';

export async function executeOutreach(
  client: Client,
  channel: 'WhatsApp' | 'Email' | 'LinkedIn',
  purpose: 'firstOutreach' | 'followUp' | 'campaign',
  productLine?: string,
  offerDetails?: string
) {
  const settings = await db.settings.get('default');
  if (!settings) throw new Error("Settings not found");

  const templateSet = settings.templates[purpose];
  
  const contact = client.contacts && client.contacts.length > 0 ? client.contacts.find(c => c.mobile) || client.contacts[0] : null;
  const contactName = contact?.name;
  
  const templateData = {
    company: client.name,
    contact_name: contactName,
    product_line: productLine,
    offer: offerDetails
  };

  let summary = "";

  if (channel === 'WhatsApp') {
    const mobile = contact?.mobile ? contact.mobile.replace(/\D/g, '') : null;
    if (!mobile) throw new Error("No mobile saved");
    
    const text = renderTemplate(templateSet.WhatsApp, templateData);
    summary = text.substring(0, 80);
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(text)}`, '_blank');
  } else if (channel === 'Email') {
    const email = contact?.email || '';
    if (!email) throw new Error("No email saved");
    
    const subject = renderTemplate(templateSet.EmailSubject, templateData);
    const body = renderTemplate(templateSet.EmailBody, templateData);
    summary = subject.substring(0, 80);
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  } else if (channel === 'LinkedIn') {
    const text = renderTemplate(templateSet.LinkedIn, templateData);
    summary = text.substring(0, 80);
    window.open(`https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(client.name)}`, '_blank');
    // Ideally we'd copy the text to clipboard here, or just open their linkedin page if we had it.
    // For now we'll just copy it to clipboard if supported.
    navigator.clipboard.writeText(text).catch(() => {});
  }

  await db.interactions.add({
    id: uuidv4(),
    clientId: client.id,
    timestamp: new Date(),
    channel,
    summary: `${channel}: ${summary}...`
  });
}
