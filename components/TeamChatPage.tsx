import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseClient';
import { collection, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User, Settings, ChatMessage, Employee } from '../types';
import { Send, User as UserIcon, MessageSquare, Paperclip } from 'lucide-react';

interface TeamChatPageProps {
  currentUser: User | null;
  activeStoreId: string | null;
  settings: Settings;
  users: User[];
}

const TeamChatPage: React.FC<TeamChatPageProps> = ({ currentUser, activeStoreId, settings, users }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeChat, setActiveChat] = useState<Employee | 'general' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const notificationSound = useRef(new Audio('https://actions.google.com/sounds/v1/notifications/beep_short.ogg'));

  useEffect(() => {
    // Filter out current user
    if (currentUser) {
      setEmployees(settings.employees.filter(e => e.email !== currentUser.email));
    }
  }, [settings.employees, currentUser]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!activeChat || !currentUser || !activeStoreId) {
      setMessages([]);
      return;
    }

    setLoading(true);

    // Set up standard query. We order by createdAt to get proper sequence.
    const q = query(
      collection(db, 'chat_messages'),
      where('storeId', '==', activeStoreId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          store_id: d.storeId || '',
          sender_id: d.senderId || '',
          receiver_id: d.receiverId || '',
          content: d.content || '',
          is_read: d.isRead || false,
          created_at: d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString() : new Date().toISOString()
        } as ChatMessage;
      });

      // Pure client-side grouping filter for security/simplicity to avoid complex compound Firestore index builds
      const filtered = allMsgs.filter(msg => {
        if (activeChat === 'general') {
          return msg.receiver_id === 'general';
        } else {
          return (
            (msg.sender_id === currentUser.phone && msg.receiver_id === activeChat.id) ||
            (msg.sender_id === activeChat.id && msg.receiver_id === currentUser.phone)
          );
        }
      });

      setMessages(filtered);
      setLoading(false);

      // Sound notification for incoming messages
      if (filtered.length > 0) {
        const lastMsg = filtered[filtered.length - 1];
        if (lastMsg.sender_id !== currentUser.phone) {
          notificationSound.current.play().catch(e => console.warn('Audio play blocked:', e));
        }
      }
    }, (error) => {
      console.error('Error listening to chat messages:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [activeChat, currentUser, activeStoreId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !currentUser || !activeStoreId) return;

    const content = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chat_messages'), {
        storeId: activeStoreId,
        senderId: currentUser.phone,
        receiverId: activeChat === 'general' ? 'general' : activeChat.id,
        content: content,
        createdAt: new Date()
      });
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(content); // Restore message
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-1/3 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">محادثات الموظفين</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button onClick={() => setActiveChat('general')} className={`w-full text-right p-4 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 ${activeChat === 'general' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold text-sm">
                <MessageSquare size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">دردشة الفريق العامة</h4>
              </div>
            </button>
            {employees.map(employee => (
              <button key={employee.id} onClick={() => setActiveChat(employee)} className={`w-full text-right p-4 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 ${activeChat !== 'general' && activeChat?.id === employee.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="relative">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm">
                    {employee.name.substring(0, 2)}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${employee.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">{employee.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{employee.status === 'active' ? 'متصل' : 'غير متصل'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Window */}
        <div className="w-2/3 flex flex-col h-full">
          {activeChat ? (
            <>
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold text-sm">
                  {activeChat === 'general' ? <MessageSquare size={20} /> : activeChat.name.substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">{activeChat === 'general' ? 'دردشة الفريق العامة' : activeChat.name}</h3>
                  <p className="text-xs text-emerald-500">متصل</p>
                </div>
              </div>

              <div ref={chatBodyRef} className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-100/50 dark:bg-slate-950">
                {loading ? <p>جاري تحميل الرسائل...</p> : messages.map((msg, index) => (
                  <div key={msg.id || index} className={`flex items-end gap-2 ${msg.sender_id === currentUser?.phone ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender_id !== currentUser?.phone && <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 flex-shrink-0"><UserIcon size={16}/></div>}
                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.sender_id === currentUser?.phone ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-bl-none shadow-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                <div className="relative">
                  <textarea
                    placeholder="اكتب رسالتك..."
                    className="w-full bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg p-3 pr-4 pl-12 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    rows={1}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  />
                  <button onClick={handleSendMessage} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-400" disabled={!newMessage.trim()}>
                    <Send size={16} />
                  </button>
                  <button className="absolute left-12 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">
                    <Paperclip size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-slate-400 p-8">
              <div>
                <MessageSquare size={48} className="mx-auto mb-4" />
                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">حدد محادثة للبدء</h3>
                <p className="text-sm mt-2">اختر موظفاً من القائمة على اليمين لعرض المحادثة.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamChatPage;
