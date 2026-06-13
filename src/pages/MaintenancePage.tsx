import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  User,
  Phone,
  Package,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Settings as SettingsIcon,
  DollarSign,
  TrendingUp,
  Inbox,
  ClipboardList
} from 'lucide-react';
import { db } from '../../services/firebaseClient';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { MaintenanceRequest } from '../../types';
import MaintenanceForm from '../../components/maintenance/MaintenanceForm';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MaintenancePageProps {
  currentStoreId: string;
  settings: any;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ currentStoreId, settings }) => {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentStoreId) return;

    const q = query(
      collection(db, 'maintenance_requests'),
      where('storeId', '==', currentStoreId),
      orderBy('receivedDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MaintenanceRequest[];
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentStoreId]);

  const stats = useMemo(() => {
    const total = requests.length;
    const active = requests.filter(r => !['delivered', 'cancelled'].includes(r.status)).length;
    const ready = requests.filter(r => r.status === 'ready').length;
    const totalRevenue = requests.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    
    return { total, active, ready, totalRevenue };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = 
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.customerPhone.includes(searchTerm) ||
        r.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.orderNumber?.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const handleSave = async (data: Partial<MaintenanceRequest>) => {
    try {
      if (editingRequest?.id) {
        await updateDoc(doc(db, 'maintenance_requests', editingRequest.id), {
            ...data,
            updatedAt: new Date().toISOString()
        });
      } else {
        const orderNumber = `MNT-${Math.floor(1000 + Math.random() * 9000)}`;
        await addDoc(collection(db, 'maintenance_requests'), {
          ...data,
          storeId: currentStoreId,
          orderNumber,
          createdAt: new Date().toISOString(),
          receivedDate: data.receivedDate || new Date().toISOString().split('T')[0]
        });
      }
      setIsFormOpen(false);
      setEditingRequest(null);
    } catch (error) {
      console.error('Error saving maintenance request:', error);
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const performDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'maintenance_requests', deleteId));
    } catch (error) {
      console.error('Error deleting request:', error);
    }
    setDeleteId(null);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'received': return { label: 'تم إنشاء طلب', color: 'bg-slate-100 text-slate-600', icon: <Inbox size={14} /> };
      case 'inspecting': return { label: 'قيد الفحص', color: 'bg-blue-100 text-blue-600', icon: <Search size={14} /> };
      case 'waiting_for_parts': return { label: 'انتظار قطع غيار', color: 'bg-amber-100 text-amber-600', icon: <SettingsIcon size={14} /> };
      case 'in_repair': return { label: 'قيد الإصلاح', color: 'bg-indigo-100 text-indigo-600', icon: <Wrench size={14} /> };
      case 'ready': return { label: 'جاهز للاستلام', color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle2 size={14} /> };
      case 'delivered': return { label: 'تم التسليم', color: 'bg-emerald-600 text-white', icon: <Package size={14} /> };
      case 'cancelled': return { label: 'ملغي', color: 'bg-red-100 text-red-600', icon: <AlertCircle size={14} /> };
      default: return { label: status, color: 'bg-slate-100', icon: null };
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto" dir="rtl">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-2">
             <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-600/20">
                <Wrench size={28} />
             </div>
             <div>
                <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">مركز الصيانة والدعم</h1>
                <p className="text-slate-500 font-bold">إدارة دورة صيانة المنتجات وتكاليف قطع الغيار</p>
             </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingRequest(null);
            setIsFormOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black flex items-center gap-3 shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={24} />
          <span>فتح طلب صيانة جديد</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'إجمالي الطلبات', value: stats.total, icon: <ClipboardList />, color: 'blue' },
          { label: 'طلبات نشطة', value: stats.active, icon: <Clock />, color: 'amber' },
          { label: 'جاهز للاستلام', value: stats.ready, icon: <CheckCircle2 />, color: 'emerald' },
          { label: 'إجمالي الحصيلة', value: `${stats.totalRevenue.toLocaleString()} ج.م`, icon: <TrendingUp />, color: 'indigo' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all"
          >
            <div className={`w-14 h-14 bg-${stat.color}-100 dark:bg-${stat.color}-500/10 text-${stat.color}-600 rounded-2xl flex items-center justify-center mb-6`}>
              {React.cloneElement(stat.icon as React.ReactElement<any>, { size: 28 })}
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-slate-800 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم العميل، الهاتف، أو رقم الطلب..."
            className="w-full pr-14 pl-6 py-5 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none shadow-sm font-bold text-lg transition-all"
          />
        </div>
        <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-[2rem] overflow-x-auto no-scrollbar">
          {['all', 'received', 'inspecting', 'waiting_for_parts', 'in_repair', 'ready', 'delivered'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-6 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              {status === 'all' ? 'الكل' : getStatusInfo(status).label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode='popLayout'>
          {filteredRequests.map((request) => (
            <motion.div
              key={request.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 flex flex-col lg:flex-row items-center gap-8 group hover:shadow-lg transition-all"
            >
              {/* Status & Priority Wrapper */}
              <div className="flex flex-col items-center gap-3 w-full lg:w-32 shrink-0">
                <div className={`w-full py-3 rounded-2xl flex flex-col items-center justify-center gap-1 ${getStatusInfo(request.status).color}`}>
                   {getStatusInfo(request.status).icon}
                   <span className="text-[10px] font-black uppercase">{getStatusInfo(request.status).label}</span>
                </div>
                <div className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${
                  request.priority === 'urgent' ? 'bg-red-100 text-red-600' : 
                  request.priority === 'high' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {request.priority === 'urgent' ? 'طارئ' : request.priority === 'high' ? 'عالي' : 'عادي'}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 w-full text-right">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-[10px] font-black px-2.5 py-1 rounded-lg">#{request.orderNumber}</span>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">{request.itemDescription}</h3>
                      </div>
                      <p className="text-slate-500 font-bold flex items-center gap-2">
                        <User size={14} />
                        {request.customerName}
                        <span className="text-slate-300 mx-2">|</span>
                        <Phone size={14} />
                        {request.customerPhone}
                      </p>
                   </div>
                   <div className="text-left">
                      <p className="text-2xl font-black text-slate-800 dark:text-white">{request.totalCost} ج.م</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي التكلفة</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                   <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">تاريخ الاستلام</p>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{request.receivedDate}</p>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">قطع الغيار</p>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{(request.parts?.length || 0)} قطع</p>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">قيمة المنتج (تأمين)</p>
                      <p className="font-bold text-sm text-amber-600">{request.itemValue ? `${request.itemValue} ج.م` : '—'}</p>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الفني</p>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{request.technicianName || '—'}</p>
                   </div>
                   <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100/50 dark:border-emerald-500/10">
                      <p className="text-[10px] font-black text-emerald-600/60 uppercase mb-1">صافي الربح</p>
                      <p className="font-black text-sm text-emerald-600">{(request.totalCost || 0) - (request.parts?.reduce((sum, p) => sum + p.cost, 0) || 0) - (request.laborCost || 0)} ج.م</p>
                   </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex lg:flex-col gap-2 w-full lg:w-auto">
                <button
                  onClick={() => {
                    setEditingRequest(request);
                    setIsFormOpen(true);
                  }}
                  className="flex-1 lg:flex-none p-4 bg-slate-100 dark:bg-slate-800 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  onClick={() => setDeleteId(request.id)}
                  className="flex-1 lg:flex-none p-4 bg-slate-100 dark:bg-slate-800 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
          {filteredRequests.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-32 flex flex-col items-center justify-center text-slate-400"
            >
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Inbox size={48} />
              </div>
              <h3 className="text-xl font-black">لا توجد طلبات صيانة</h3>
              <p className="font-bold">ابدأ بإضافة أول عطل اليوم</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Overlay for Form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsFormOpen(false)}
            />
            <div className="relative w-full max-w-4xl max-h-full overflow-y-auto no-scrollbar">
              <MaintenanceForm
                initialData={editingRequest || {}}
                onSubmit={handleSave}
                onCancel={() => setIsFormOpen(false)}
                settings={settings}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!!deleteId && (
          <ConfirmationModal
            isOpen={true}
            message="هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
            onConfirm={performDelete}
            onCancel={() => setDeleteId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MaintenancePage;
