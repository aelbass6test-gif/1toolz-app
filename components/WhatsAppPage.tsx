
import React, { useMemo, useState } from 'react';
import { Order } from '../types';
import { Search, MessageSquare, Send, ArrowRight, Phone, CornerUpLeft, QrCode } from 'lucide-react';

interface Customer {
    id: string;
    name: string;
    phone: string;
    lastContact: string; 
}

const WhatsAppPage = ({ orders }: { orders: Order[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeChat, setActiveChat] = useState<Customer | null>(null);
    const [message, setMessage] = useState('');
    const [showChatView, setShowChatView] = useState(false); // For mobile responsiveness

    const customers = useMemo(() => {
        const customerMap = new Map<string, Customer>();
        orders.forEach(order => {
            const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
            if (cleanPhone) {
                 const existing = customerMap.get(cleanPhone);
                 if (!existing || new Date(order.date) > new Date(existing.lastContact)) {
                    customerMap.set(cleanPhone, {
                        id: cleanPhone,
                        name: order.customerName,
                        phone: order.customerPhone,
                        lastContact: order.date,
                    });
                 }
            }
        });
        return Array.from(customerMap.values()).sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime());
    }, [orders]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm)
        );
    }, [customers, searchTerm]);
    
    const handleSelectChat = (customer: Customer) => {
        setActiveChat(customer);
        setShowChatView(true);
    };

    const handleSendMessage = () => {
        if (!message.trim() || !activeChat) return;
        
        let phone = activeChat.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = '20' + phone.substring(1);
        } else if (phone.length === 10 && !phone.startsWith('0')) {
            phone = '20' + phone;
        }
    
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        setMessage('');
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><MessageSquare size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">واتساب</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">تواصل مباشرة مع عملائك عبر واتساب من هنا.</p>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden min-h-[600px]">
                {/* Customer List */}
                <div className={`w-full md:w-1/3 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full transition-all duration-300 ${showChatView && 'hidden md:flex'}`}>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                        <div className="relative">
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="بحث عن عميل..." className="w-full pr-10 pl-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border-transparent focus:ring-2 focus:ring-emerald-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                            <button key={customer.id} onClick={() => handleSelectChat(customer)} className={`w-full text-right p-4 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 ${activeChat?.id === customer.id ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm">
                                    {customer.name.substring(0, 2)}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{customer.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{customer.phone}</p>
                                </div>
                                <span className="text-xs text-slate-400">{new Date(customer.lastContact).toLocaleDateString('ar-EG')}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className={`w-full md:w-2/3 flex flex-col h-full transition-all duration-300 ${!showChatView && 'hidden md:flex'}`}>
                    {activeChat ? (
                        <>
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
                                <button onClick={() => setShowChatView(false)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowRight size={20}/></button>
                                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm">
                                    {activeChat.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{activeChat.name}</h3>
                                    <p className="text-xs text-emerald-500 flex items-center gap-1"><Phone size={10}/> {activeChat.phone}</p>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-6 flex items-center justify-center bg-slate-50 dark:bg-slate-800/30">
                                <div className="text-center text-slate-400">
                                    <MessageSquare size={48} className="mx-auto mb-4" />
                                    <p className="font-bold text-sm">لا يتم حفظ سجل المحادثات هنا.</p>
                                    <p className="text-xs mt-1">اكتب رسالتك بالأسفل لإرسالها مباشرة عبر واتساب.</p>
                                </div>
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
                                <textarea placeholder={`إرسال رسالة إلى ${activeChat.name}...`} className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg resize-none outline-none focus:ring-2 focus:ring-emerald-500" rows={1} value={message} onChange={e => setMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}></textarea>
                                <button onClick={handleSendMessage} className="p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400" disabled={!message.trim()}>
                                    <Send size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 hidden md:flex items-center justify-center text-center text-slate-400 p-8">
                            <div>
                                <MessageSquare size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">حدد محادثة للبدء</h3>
                                <p className="text-sm mt-2">اختر عميلاً من القائمة على اليمين لكتابة رسالة.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WhatsAppPage;
