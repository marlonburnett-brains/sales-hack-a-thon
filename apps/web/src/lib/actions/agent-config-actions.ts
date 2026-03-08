"use server";

import {
  listAgentConfigs,
  getAgentConfig,
  getAgentConfigVersions,
  saveDraftPrompt,
  publishAgentConfig,
  discardDraft,
  rollbackAgentConfig,
  saveBaselineDraft,
  publishBaseline,
} from "@/lib/api-client";
import type {
  AgentConfigListItem,
  AgentConfigDetail,
  AgentConfigVersionItem,
} from "@/lib/api-client";

export type { AgentConfigListItem, AgentConfigDetail, AgentConfigVersionItem };

export async function getAgentConfigsAction(): Promise<AgentConfigListItem[]> {
  return listAgentConfigs();
}

export async function getAgentConfigAction(
  agentId: string,
): Promise<AgentConfigDetail> {
  return getAgentConfig(agentId);
}

export async function getAgentConfigVersionsAction(
  agentId: string,
): Promise<AgentConfigVersionItem[]> {
  return getAgentConfigVersions(agentId);
}

export async function saveDraftAction(
  agentId: string,
  data: { rolePrompt: string; userId?: string; expectedVersion?: number },
): Promise<unknown> {
  return saveDraftPrompt(agentId, data);
}

export async function publishAction(
  agentId: string,
  data: { changeSummary?: string; userId?: string },
): Promise<unknown> {
  return publishAgentConfig(agentId, data);
}

export async function discardDraftAction(
  agentId: string,
): Promise<{ success: boolean }> {
  return discardDraft(agentId);
}

export async function rollbackAction(
  agentId: string,
  data: { targetVersion: number; userId?: string },
): Promise<unknown> {
  return rollbackAgentConfig(agentId, data);
}

export async function saveBaselineDraftAction(data: {
  baselinePrompt: string;
  userId?: string;
}): Promise<unknown> {
  return saveBaselineDraft(data);
}

export async function publishBaselineAction(data: {
  changeSummary?: string;
  userId?: string;
}): Promise<{ agentsUpdated: number }> {
  return publishBaseline(data);
}
