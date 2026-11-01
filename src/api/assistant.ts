import { apiFetch } from './client';
import type { AssistantMessageInput, AssistantMessageResponse } from './types';

export async function sendAssistantMessage(input: AssistantMessageInput) {
  return (await apiFetch<AssistantMessageResponse>('/assistant/messages', {
    method: 'POST',
    body: input,
  })).data;
}
