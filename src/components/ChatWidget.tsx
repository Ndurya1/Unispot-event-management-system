import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Minus, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { sendAssistantMessage } from '../api/assistant';
import type { AssistantMessageResponse } from '../api/types';
import { useAuth } from '../auth/AuthProvider';

type Message = { from: 'assistant' | 'user'; text: string };
type PendingConfirmation = { conversationId: string; confirmationId: string };

function getPendingConfirmation(response: AssistantMessageResponse): PendingConfirmation | null {
  if (!response.pending_confirmation) return null;
  const pending = response.state.pending_confirmation;
  if (!pending || typeof pending !== 'object' || !('confirmation_id' in pending)) return null;
  const confirmationId = pending.confirmation_id;
  return typeof confirmationId === 'string'
    ? { conversationId: response.conversation_id, confirmationId }
    : null;
}

function responseText(response: AssistantMessageResponse) {
  const failures = response.tool_results
    .filter((result) => result.status === 'FAILED' && result.error)
    .map((result) => result.error)
    .join(' ');
  return failures ? `${response.response} ${failures}` : response.response;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { from: 'assistant', text: "Hi! I'm the UniSpot Assistant. How can I help you?" },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const restoreLauncherFocus = useRef(false);

  useEffect(() => {
    if (open) messageInputRef.current?.focus();
    else if (restoreLauncherFocus.current) {
      launcherRef.current?.focus();
      restoreLauncherFocus.current = false;
    }
  }, [open]);

  const closeChat = () => {
    restoreLauncherFocus.current = true;
    setOpen(false);
  };

  const appendResponse = (response: AssistantMessageResponse) => {
    setConversationId(response.conversation_id);
    setMessages((current) => [...current, { from: 'assistant', text: responseText(response) }]);
    setPendingConfirmation(getPendingConfirmation(response));
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    if (!isAuthenticated) {
      setMessages((current) => [...current, { from: 'assistant', text: 'Please log in before using assistant booking.' }]);
      navigate('/login');
      return;
    }
    setDraft('');
    setError('');
    setMessages((current) => [...current, { from: 'user', text }]);
    setIsSending(true);
    try {
      appendResponse(await sendAssistantMessage({ message: text, conversation_id: conversationId || undefined }));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The assistant is temporarily unavailable.');
    } finally {
      setIsSending(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation || isSending) return;
    setError('');
    setIsSending(true);
    try {
      appendResponse(await sendAssistantMessage({
        conversation_id: pendingConfirmation.conversationId,
        message: 'Confirm',
        confirmed: true,
        confirmation_id: pendingConfirmation.confirmationId,
      }));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The assistant confirmation failed.');
    } finally {
      setIsSending(false);
    }
  };

  const changePendingAction = () => {
    setPendingConfirmation(null);
    setMessages((current) => [...current, { from: 'assistant', text: 'Okay. Tell me what you would like to change.' }]);
  };

  return (
    <>
      {!open && <button ref={launcherRef} className="chat-launcher" type="button" aria-label="Open UniSpot Assistant" onClick={() => setOpen(true)}><Bot size={23} /><span>Ask UniSpot</span></button>}
      {open && (
        <section className="chat-panel" role="region" aria-labelledby="assistant-title">
          <header className="chat-header"><span className="chat-avatar"><Bot size={20} /></span><div><strong id="assistant-title">UniSpot Assistant</strong><small>Venue search and booking help</small></div><button className="chat-window-action" type="button" aria-label="Minimize chat" onClick={closeChat}><Minus size={17} /></button><button className="chat-window-action" type="button" aria-label="Close chat" onClick={closeChat}><X size={17} /></button></header>
          <div className="chat-messages" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => <div className={`chat-message chat-message--${message.from}`} key={`${message.from}-${index}`}>{message.text}</div>)}
            {pendingConfirmation && <div className="chat-quick-actions"><button type="button" className="button button--primary button--small" onClick={() => void confirmPendingAction()} disabled={isSending}>{isSending ? 'Confirming…' : 'Confirm action'}</button><button type="button" className="button button--soft button--small" onClick={changePendingAction} disabled={isSending}>Change request</button></div>}
            {isSending && <p className="form-status">Assistant is thinking…</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <form className="chat-compose" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-message">Type a message</label><input ref={messageInputRef} id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about venues or bookings…" disabled={isSending} /><button className="chat-send" type="submit" aria-label="Send message" disabled={isSending}><Send size={17} /></button></form>
        </section>
      )}
    </>
  );
}
