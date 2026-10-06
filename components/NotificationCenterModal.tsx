import React, { useState, useEffect } from 'react';
import { notificationService, AppNotification } from '../services/notificationService';
import { soundManager } from '../utils/soundNotification';
import { Bell, Volume2, VolumeX, CheckCircle, Trash2, X, Sparkles, ShoppingBag, DollarSign, AlertTriangle, Info, ExternalLink } from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isMuted, setIsMuted] = useState(soundManager.getIsMuted());
  const [permission, setPermission] = useState<NotificationPermission>(notificationService.getPermissionStatus());

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((list) => {
      setNotifications(list);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      notificationService.triggerNotification({
        title: '🔔 تم تفعيل التنبيهات بنجاح!',
        body: 'ستصلك إشعارات فورية عند وصول طلبات جديدة أو حركات مالية.',
        type: 'system'
      });
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
    if (!next) {
      soundManager.playNewOrderChime();
    }
  };

  const handleTestOrderSound = () => {
    soundManager.playNewOrderChime();
    notificationService.triggerNotification({
      title: '🛍️ أوردر تجريبي جديد! (#1099)',
      body: 'قام العميل أحمد محمد بطلب (2× كوتشي نايك) بقيمة 850 ج.م',
      type: 'order',
      amount: 850
    });
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingBag size={18} className="text-[#008060]" />;
      case 'partner':
      case 'treasury':
        return <DollarSign size={18} className="text-amber-600" />;
      case 'inventory':
        return <AlertTriangle size={18} className="text-rose-600" />;
      default:
        return <Info size={18} className="text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#008060]/10 text-[#008060] flex items-center justify-center font-black">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">مركز التنبيهات والإشعارات</h3>
              <p className="text-xs text-slate-500">إشعارات الأوردرات الفورية، سحب الأرباح، وحركات الخزينة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Settings Bar */}
        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                !isMuted 
                  ? 'bg-[#008060] text-white shadow-xs' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
              title={isMuted ? 'تفعيل صوت التنبيه' : 'كتم صوت التنبيه'}
            >
              {!isMuted ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{!isMuted ? 'صوت التنبيه مفعّل' : 'الصوت مكتوم'}</span>
            </button>

            <button
              onClick={handleTestOrderSound}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 transition-all cursor-pointer"
              title="تجربة صوت وصول أوردر جديد"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>تجربة رنة الأوردر</span>
            </button>
          </div>

          {permission !== 'granted' && (
            <button
              onClick={handleRequestPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all cursor-pointer shadow-xs"
            >
              <Bell size={13} />
              <span>تفعيل إشعارات الويندوز/الموبايل</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
              <Bell size={36} className="mx-auto opacity-30 text-slate-400" />
              <p className="text-xs font-bold">لا توجد إشعارات واردة حتى الآن</p>
              <p className="text-[11px] opacity-80">ستظهر هنا أحدث الأوردرات وحركات السحب والشحن لحظياً</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  notificationService.markAsRead(n.id);
                  if (n.link && onNavigateTab) {
                    onNavigateTab(n.link);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  !n.read 
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' 
                    : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-80 hover:opacity-100'
                }`}
              >
                <div className={`p-2 rounded-xl flex-shrink-0 ${
                  n.type === 'order' ? 'bg-emerald-100 dark:bg-emerald-950/50' : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  {getIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                      {new Date(n.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    {n.body}
                  </p>

                  {n.amount && (
                    <div className="text-[11px] font-black font-mono text-[#008060]">
                      القيمة: {n.amount.toLocaleString()} ج.م
                    </div>
                  )}
                </div>

                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#008060] flex-shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs font-bold text-slate-500">
            <button
              onClick={() => notificationService.markAllAsRead()}
              className="flex items-center gap-1.5 hover:text-[#008060] transition-colors cursor-pointer"
            >
              <CheckCircle size={14} />
              <span>تحديد الكل كمقروء</span>
            </button>

            <button
              onClick={() => notificationService.clearAll()}
              className="flex items-center gap-1.5 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span>مسح السجل</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
