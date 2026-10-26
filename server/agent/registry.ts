import type { ToolDef } from './types';
import { searchPlaces, drawSearchArea, saveCompanies, saveSearchZone } from './tools/places';
import { suggestSearchTags, applySearchTags, autoTagBatch } from './tools/tags';
import { findNearbySavedClients, getClient, whatsDueToday, updateClient, logInteraction, setFollowUp, addLead } from './tools/clients';
import { planRoute } from './tools/routing';
import { researchCompany, recallMemories } from './tools/research';
import { createWatcher } from './tools/watch';
import { checkClaimTool, extractProjects, addProject, predictNextNeed } from './tools/insight';

export const TOOLS: ToolDef[] = [
  suggestSearchTags, applySearchTags,
  searchPlaces, drawSearchArea, saveCompanies, saveSearchZone,
  findNearbySavedClients, getClient, whatsDueToday,
  autoTagBatch, updateClient, logInteraction, setFollowUp, addLead,
  planRoute, researchCompany, recallMemories, createWatcher,
  checkClaimTool, extractProjects, addProject, predictNextNeed,
];

export const byName = new Map(TOOLS.map((t) => [t.name, t]));

export const toolSpecs = TOOLS.map((t) => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
}));
