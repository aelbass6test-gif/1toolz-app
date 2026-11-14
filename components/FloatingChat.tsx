import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, User, Users, ChevronLeft, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserType, ChatMessage, Employee } from '../types';
import { cfFetch, subscribePolling } from '../services/cloudflareClient';

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
    const lastNotifiedIdRef = useRef<string | null>(null);

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

        lastNotifiedIdRef.current = null;
        const storeKey = encodeURIComponent(activeStoreId);

        const unsubscribe = subscribePolling(
            () => cfFetch<{ success: boolean; messages: ChatMessage[] }>(`/api/db/chat/${storeKey}`),
            async (res) => {
                const allMsgs = Array.isArray(res?.messages) ? res.messages : [];
                const filtered = allMsgs.filter(msg => {
                    if (activeChat.id === 'team') {
                        return msg.receiver_id === 'general';
                    }
                    return (
                        (msg.sender_id === currentUser.phone && msg.receiver_id === activeChat.id) ||
                        (msg.sender_id === activeChat.id && msg.receiver_id === currentUser.phone)
                    );
                });

                setMessages(filtered);

                if (filtered.length > 0) {
                    const lastMsg = filtered[filtered.length - 1];
                    const msgIdStr = lastMsg.id ? String(lastMsg.id) : '';
                    if (
                        lastMsg.sender_id !== currentUser.phone &&
                        msgIdStr &&
                        lastNotifiedIdRef.current !== null &&
                        lastNotifiedIdRef.current !== msgIdStr &&
                        typeof Notification !== 'undefined' &&
                        Notification.permission === 'granted'
                    ) {
                        new Notification(`رسالة جديدة من ${activeChat.name}`, {
                            body: lastMsg.is_file ? 'الملف المرفق' : lastMsg.content,
                        });
                    }
                    if (msgIdStr) {
                        lastNotifiedIdRef.current = msgIdStr;
                    }
                }

                const unreadIds = filtered
                    .filter(m => m.receiver_id === currentUser.phone && !m.is_read && m.id)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    await cfFetch(`/api/db/chat/${storeKey}/mark-read`, {
                        method: 'POST',
                        body: JSON.stringify({
                            receiverId: currentUser.phone,
                            messageIds: unreadIds
                        })
                    }).catch(err => console.warn('Failed to mark read:', err));
                }
            },
            4000,
            (error) => {
                console.warn('[FloatingChat] Chat polling notice:', error?.message || error);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [activeChat, currentUser, activeStoreId]);

    const handleSendMessage = async () => {
        if (!message.trim() || !activeChat || !currentUser || !activeStoreId) return;

        const content = message;
        setMessage('');

        try {
            const res = await cfFetch<{ success: boolean; message: ChatMessage }>(
                `/api/db/chat/${encodeURIComponent(activeStoreId)}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        senderId: currentUser.phone,
                        receiverId: activeChat.id === 'team' ? 'general' : activeChat.id,
                        content,
                        isRead: false,
                        isFile: false
                    })
                }
            );
            if (res?.message) {
                setMessages(prev => prev.some(m => m.id === res.message.id) ? prev : [...prev, res.message]);
            }
        } catch (err) {
            console.error('Error sending message:', err);
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

            try {
                const res = await cfFetch<{ success: boolean; message: ChatMessage }>(
                    `/api/db/chat/${encodeURIComponent(activeStoreId)}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            senderId: currentUser.phone,
                            receiverId: activeChat.id === 'team' ? 'general' : activeChat.id,
                            content: base64Url,
                            isRead: false,
                            isFile: true
                        })
                    }
                );
                if (res?.message) {
                    setMessages(prev => prev.some(m => m.id === res.message.id) ? prev : [...prev, res.message]);
                }
            } catch (messageError) {
                console.error('Error sending file message:', messageError);
            }
        };
        reader.readAsDataURL(file);
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
