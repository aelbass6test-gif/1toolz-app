import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, User, Users, ChevronLeft, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserType, ChatMessage, Employee } from '../types';
import { getSupabaseClient } from '../services/supabaseClient';

interface FloatingChatProps {
    currentUser: UserType | null;
    storeOwner: UserType | null;
    activeStoreId: string | null;
    employees: Employee[];
    onlineUsers: Record<string, { lastSeen: number }>;
}

export interface FloatingChatHandles {
    toggle: () => void;
}


const FloatingChat = React.forwardRef<FloatingChatHandles, FloatingChatProps>(({ currentUser, storeOwner, activeStoreId, employees, onlineUsers }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChat, setActiveChat] = useState<{ id: string, name: string, icon: React.ReactElement } | null>(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const chatBodyRef = useRef<HTMLDivElement>(null);

    const formatLastSeen = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'متصل الآن';
        if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
        return 'غير متصل';
    };

    const contacts = useMemo(() => {
        const c: { id: string, name: string, icon: React.ReactElement, isOnline: boolean, lastSeen: string }[] = [];
        if (storeOwner) {
            const isOnline = !!onlineUsers[storeOwner.phone];
            c.push({ 
                id: storeOwner.phone, 
                name: 'المدير', 
                icon: <User size={20} />, 
                isOnline,
                lastSeen: isOnline ? 'متصل الآن' : formatLastSeen(onlineUsers[storeOwner.phone]?.lastSeen || 0)
            });
        }
        employees.forEach(emp => {
            if (currentUser && emp.email !== currentUser.email) {
                const isOnline = !!onlineUsers[emp.phone || emp.id];
                c.push({ 
                    id: emp.phone || emp.id, 
                    name: emp.name, 
                    icon: <User size={20} />, 
                    isOnline,
                    lastSeen: isOnline ? 'متصل الآن' : formatLastSeen(onlineUsers[emp.phone || emp.id]?.lastSeen || 0)
                });
            }
        });
        c.push({ id: 'team', name: 'فريق العمل', icon: <Users size={20} />, isOnline: true, lastSeen: 'متاح دائماً' });
        return c;
    }, [storeOwner, employees, currentUser, onlineUsers]);

    React.useImperativeHandle(ref, () => ({
        toggle: () => setIsOpen(p => !p)
    }));

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (!activeChat || !currentUser || !activeStoreId) {
            setMessages([]);
            return;
        }
        const supabase = getSupabaseClient();
        if (!supabase) {
            setMessages([]);
            return;
        }

        let disposed = false;
        const loadMessages = async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('created_at', { ascending: true });
            if (error) {
                console.error('[FloatingChat] Supabase load error:', error);
                return;
            }
            if (disposed) return;
            const allMsgs = (data || []).map((row: any) => ({
                id: String(row.id),
                store_id: row.store_id || row.storeId || '',
                sender_id: row.sender_id || row.senderId || '',
                receiver_id: row.receiver_id || row.receiverId || '',
                content: row.content || '',
                is_read: row.is_read ?? row.isRead ?? false,
                is_file: row.isFile ?? false,
                created_at: row.created_at || row.createdAt || new Date().toISOString()
            } as ChatMessage));
            const filtered = allMsgs.filter(msg => activeChat.id === 'team'
                ? msg.receiver_id === 'general'
                : ((msg.sender_id === currentUser.phone && msg.receiver_id === activeChat.id)
                    || (msg.sender_id === activeChat.id && msg.receiver_id === currentUser.phone)));
            setMessages(filtered);

            const unread = filtered.filter(msg => msg.receiver_id === currentUser.phone && !msg.is_read);
            if (unread.length) {
                const ids = unread.map(msg => Number(msg.id)).filter(Number.isFinite);
                if (ids.length) {
                    const { error: readError } = await supabase
                        .from('chat_messages')
                        .update({ is_read: true, isRead: true })
                        .in('id', ids)
                        .eq('store_id', activeStoreId)
                        .eq('receiver_id', currentUser.phone);
                    if (readError) console.warn('[FloatingChat] Mark-read failed:', readError);
                }
            }
        };

        void loadMessages();
        const channel = supabase
            .channel(`chat-${activeStoreId}-${activeChat.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_messages',
                filter: `store_id=eq.${activeStoreId}`
            }, () => { void loadMessages(); })
            .subscribe();
        return () => {
            disposed = true;
            void supabase.removeChannel(channel);
        };
    }, [activeChat, currentUser, activeStoreId]);

    const handleSendMessage = async () => {
        if (!message.trim() || !activeChat || !currentUser || !activeStoreId) return;
        const content = message.trim();
        const supabase = getSupabaseClient();
        if (!supabase) return;
        setMessage('');
        const receiverId = activeChat.id === 'team' ? 'general' : activeChat.id;
        const { error } = await supabase.from('chat_messages').insert([{
            store_id: activeStoreId,
            storeId: activeStoreId,
            sender_id: currentUser.phone,
            senderId: currentUser.phone,
            receiver_id: receiverId,
            receiverId,
            content,
            is_read: false,
            isRead: false,
            isFile: false,
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString()
        }]);
        if (error) {
            console.error('Error sending message:', error);
            setMessage(content);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !activeChat || !currentUser || !activeStoreId) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Url = event.target?.result as string;
            if (!base64Url) return;
            const supabase = getSupabaseClient();
            if (!supabase) return;
            const receiverId = activeChat.id === 'team' ? 'general' : activeChat.id;
            const now = new Date().toISOString();
            const { error } = await supabase.from('chat_messages').insert([{
                store_id: activeStoreId,
                storeId: activeStoreId,
                sender_id: currentUser.phone,
                senderId: currentUser.phone,
                receiver_id: receiverId,
                receiverId,
                content: base64Url,
                is_read: false,
                isRead: false,
                isFile: true,
                created_at: now,
                createdAt: now
            }]);
            if (error) console.error('Error sending file message:', error);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };


    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-6 left-6 z-50 w-80 h-[450px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-right"
                    >
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                {activeChat && (
                                    <button onClick={() => setActiveChat(null)} className="p-1 text-slate-500 hover:text-slate-800"><ChevronLeft size={20}/></button>
                                )}
                                <h3 className="font-bold text-slate-800 dark:text-white">
                                    {activeChat ? activeChat.name : 'دردشة الفريق'}
                                </h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-500 hover:text-red-500"><X size={20}/></button>
                        </div>
                        
                        {!activeChat ? (
                            <div className="flex-1 p-2 overflow-y-auto">
                                {contacts.map(contact => (
                                    <button key={contact.id} onClick={() => setActiveChat(contact)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right">
                                        <div className="relative">
                                            <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">{contact.icon}</div>
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${contact.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                        </div>
                                        <div className="flex-1 text-right">
                                            <div className="font-bold text-slate-700 dark:text-slate-200">{contact.name}</div>
                                            <div className={`text-xs ${contact.isOnline ? 'text-emerald-500' : 'text-slate-500'}`}>{contact.lastSeen}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div ref={chatBodyRef} className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-50 dark:bg-slate-950/50">
                                    {messages.map((msg, index) => (
                                        <div key={msg.id || index} className={`flex items-end gap-2 ${msg.sender_id === currentUser?.phone ? 'justify-end' : 'justify-start'}`}>
                                            {msg.sender_id !== currentUser?.phone && <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 flex-shrink-0">{activeChat.icon}</div>}
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender_id === currentUser?.phone ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-bl-none'}`}>
                                                {msg.is_file ? (
                                                    <a href={msg.content} target="_blank" rel="noopener noreferrer" className="underline font-medium text-indigo-500 hover:text-indigo-600">عرض الملف</a>
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-slate-900">
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-600">
                                        <Paperclip size={18} />
                                    </button>
                                    <input 
                                        type="text" 
                                        placeholder="اكتب رسالتك..."
                                        className="flex-1 bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                    />
                                    <button onClick={handleSendMessage} className="p-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-400" disabled={!message.trim()}>
                                        <Send size={18} />
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
});

FloatingChat.displayName = 'FloatingChat';
export default FloatingChat;
