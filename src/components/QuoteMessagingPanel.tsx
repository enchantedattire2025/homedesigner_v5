import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, MessageSquare, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface QuoteMessage {
  id: string;
  quote_id: string;
  sender_role: 'customer' | 'designer';
  sender_id: string;
  message_body: string;
  read_by_customer: boolean;
  read_by_designer: boolean;
  created_at: string;
}

interface QuoteMessagingPanelProps {
  quoteId: string;
  role: 'customer' | 'designer';
  onClose: () => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const QuoteMessagingPanel: React.FC<QuoteMessagingPanelProps> = ({ quoteId, role, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('quote_messages')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setMessages(data || []);

      // Mark messages from the other party as read
      if (data && data.length > 0) {
        const hasUnread = data.some(
          (m) => (role === 'customer' ? m.sender_role === 'designer' && !m.read_by_customer : m.sender_role === 'customer' && !m.read_by_designer)
        );
        if (hasUnread) {
          await supabase.rpc('mark_quote_messages_read', { p_quote_id: quoteId, p_role: role });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [quoteId, role]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`quote-messages-${quoteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quote_messages', filter: `quote_id=eq.${quoteId}` },
        (payload) => {
          const newMsg = payload.new as QuoteMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Auto-mark messages from the other side as read since we're viewing
          if (newMsg.sender_role !== role) {
            supabase.rpc('mark_quote_messages_read', { p_quote_id: quoteId, p_role: role });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quoteId, role]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !user || sending) return;
    try {
      setSending(true);
      setError(null);
      const { error: insertError } = await supabase
        .from('quote_messages')
        .insert({
          quote_id: quoteId,
          sender_role: role,
          sender_id: user.id,
          message_body: draft.trim(),
        });

      if (insertError) throw insertError;
      setDraft('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-secondary-800">Quotation Messages</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close messages">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg flex items-start space-x-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No messages yet. Start the conversation by sending a message below.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_role === role;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 ${
                    isMine
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line break-words">{msg.message_body}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-100' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-5 py-4 border-t border-gray-200 bg-white">
        <div className="flex items-end space-x-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            disabled={sending}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="bg-primary-500 hover:bg-primary-600 text-white p-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Messages stay in-platform. Private contact details are only shared after payment confirmation.
        </p>
      </div>
    </div>
  );
};

export default QuoteMessagingPanel;
