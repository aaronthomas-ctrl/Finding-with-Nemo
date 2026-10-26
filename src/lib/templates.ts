import { Settings } from '../db';

export function renderTemplate(
  template: string,
  data: { company?: string; contact_name?: string; product_line?: string; offer?: string }
): string {
  // If contact_name missing, use "there"
  const resolvedData = { ...data };
  if (!resolvedData.contact_name) {
    resolvedData.contact_name = "there";
  }

  // Split into sentences using a regex that captures the sentence and its trailing punctuation/whitespace
  // This helps us drop a whole sentence if it has an unresolved placeholder.
  const sentenceRegex = /([^.!?\n]+[.!?\n]*)/g;
  const sentences = template.match(sentenceRegex);

  if (!sentences) {
    return "";
  }

  let result = "";

  for (let sentence of sentences) {
    // Replace known placeholders first
    let replacedSentence = sentence.replace(/\{company\}/g, resolvedData.company || "{company}");
    replacedSentence = replacedSentence.replace(/\{contact_name\}/g, resolvedData.contact_name || "{contact_name}");
    replacedSentence = replacedSentence.replace(/\{offer\}/g, resolvedData.offer || "{offer}");
    replacedSentence = replacedSentence.replace(/\{product_line\}/g, resolvedData.product_line || "{product_line}");

    // Check if there are any unresolved placeholders left in this sentence
    if (replacedSentence.includes("{product_line}") || replacedSentence.includes("{offer}") || replacedSentence.match(/\{[^}]+\}/)) {
      // If product_line or offer is missing and the placeholder is still there, drop this sentence
      continue;
    }

    result += replacedSentence;
  }

  return result.trim();
}
