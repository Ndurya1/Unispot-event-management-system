import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Minus, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Message = { from: 'assistant' | 'user'; text: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: 'assistant', text: "Hi! I'm the UniSpot Assistant. How can I help you?" },
  ]);
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

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const asksAvailability = /great hall|available|12 april|venue/i.test(text);
    setMessages((current) => [
      ...current,
      { from: 'user', text },
      {
        from: 'assistant',
        text: asksAvailability
          ? 'The Great Hall is shown as available on 12 April in this demo. Would you like to prepare the booking details? Nothing will be submitted without your review and confirmation.'
          : 'I can help you explore campus events and venues. Tell me what you are looking for, or ask whether the Great Hall is available on 12 April.',
      },
    ]);
    setShowActions(asksAvailability);
    setDraft('');
  };

  const prepareBooking = () => {
    setMessages((current) => [...current, { from: 'assistant', text: 'I’ll open a draft booking for you to review. This demo does not submit a real reservation.' }]);
    setShowActions(false);
    setOpen(false);
    navigate('/booking/new?venue=great-hall');
  };

  return (
    <>
      {!open && <button ref={launcherRef} className="chat-launcher" type="button" aria-label="Open UniSpot Assistant" onClick={() => setOpen(true)}><Bot size={23} /><span>Ask UniSpot</span></button>}
      {open && (
        <section className="chat-panel" role="region" aria-labelledby="assistant-title">
          <header className="chat-header">
            <span className="chat-avatar"><Bot size={20} /></span>
            <div><strong id="assistant-title">UniSpot Assistant</strong><small>Always here to help</small></div>
            <button className="chat-window-action" type="button" aria-label="Minimize chat" onClick={closeChat}><Minus size={17} /></button>
            <button className="chat-window-action" type="button" aria-label="Close chat" onClick={closeChat}><X size={17} /></button>
          </header>
          <div className="chat-messages" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => <div className={`chat-message chat-message--${message.from}`} key={`${message.from}-${index}`}>{message.text}</div>)}
            {showActions && <div className="chat-quick-actions"><button type="button" className="button button--primary button--small" onClick={prepareBooking}>Yes, please</button><button type="button" className="button button--soft button--small" onClick={() => { setShowActions(false); setOpen(false); navigate('/venues'); }}>Choose another venue</button></div>}
          </div>
          <form className="chat-compose" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chat-message">Type a message</label>
            <input ref={messageInputRef} id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message..." />
            <button className="chat-send" type="submit" aria-label="Send message"><Send size={17} /></button>
          </form>
        </section>
      )}
    </>
  );
}
