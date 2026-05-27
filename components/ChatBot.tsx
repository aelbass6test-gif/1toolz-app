
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Clipboard, BrainCircuit } from 'lucide-react';
import { chatWithAI } from '../services/geminiService';
import { Settings, Order } from '../types';

interface Message {
  id: string;
  text: string;
  sender: 'ai' | 'user';
}

interface ChatBotProps {
  settings: Settings;
  orders: Order[];
}

// Reusable ToggleButton component
interface ToggleButtonProps {
  active: boolean;
  onToggle: () => void;
}
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      active ? 'bg-indigo-600 focus:ring-indigo-500' : 'bg-slate-300 dark:bg-slate-700 focus:ring-slate-500'
    }`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        active ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);


const ChatBot: React.FC<ChatBotProps> = ({ settings, orders }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `أهلاً بك! أنا مساعدك الذكي ومحلل البيانات. يمكنك الآن سؤالي عن تفاصيل أي طلب، تلخيص أداء عميل معين، أو حسابات الأرباح بناءً على بياناتك الحية.`,
      sender: 'ai'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const aiResponse = await chatWithAI(input, settings, orders, useThinkingMode);
    const aiMessage: Message = { id: (Date.now() + 1).toString(), text: aiResponse, sender: 'ai' };
    
    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('تم النسخ إلى الحافظة');
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-200px)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Bot size={20} />
            </div>
            <div>
            <h3 className="font-bold text-slate-800 dark:text-white">المساعد المصري الذكي</h3>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">متصل • يحلل بياناتك الآن</p>
            </div>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-900 rounded-lg">
           <span className={`px-2 text-xs font-bold transition-colors ${!useThinkingMode ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>الوضع السريع</span>
            <ToggleButton active={useThinkingMode} onToggle={() => setUseThinkingMode(!useThinkingMode)} />
           <span className={`px-2 text-xs font-bold flex items-center gap-1 transition-colors ${useThinkingMode ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
             <BrainCircuit size={14}/> التفكير العميق
           </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/50">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex gap-3 max-w-[85%] ${m.sender === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className={`p-2 rounded-lg h-fit mt-1 ${m.sender === 'user' ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : useThinkingMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                {m.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${
                m.sender === 'user' 
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tr-none border border-slate-200 dark:border-slate-700' 
                  : useThinkingMode ? 'bg-indigo-600 text-white rounded-tl-none' : 'bg-blue-600 text-white rounded-tl-none'
              }`}>
                {m.text.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                ))}
                
                {m.sender === 'ai' && m.text.includes('|') && (
                  <button 
                    onClick={() => copyToClipboard(m.text)}
                    className="absolute -right-10 top-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="نسخ السطر"
                  >
                    <Clipboard size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-end">
            <div className={`flex gap-3 items-center p-3 rounded-2xl rounded-tl-none ${useThinkingMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-medium italic">{useThinkingMode ? 'أفكر بعمق...' : 'بيفكر...'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-700 transition-all text-slate-900 dark:text-white"
            placeholder={useThinkingMode ? 'مثال: لخص لي أداء العميل "أحمد محمد"' : 'اسألني أي سؤال عن طلباتك...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            disabled={isLoading || !input.trim()}
            onClick={handleSend}
            className={`p-3 rounded-xl transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-800 shadow-lg ${useThinkingMode ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none'} text-white`}
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
          {useThinkingMode ? 'وضع التفكير العميق قد يستغرق وقتاً أطول للردود الدقيقة والمعقدة.' : 'المساعد يستخدم الذكاء الاصطناعي لمساعدتك في العمليات الحسابية والصياغة.'}
        </p>
      </div>
    </div>
  );
};

export default ChatBot;
