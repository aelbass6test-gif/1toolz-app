
import React, { useState } from 'react';
import { ActivityLog } from '../types';
import { Search, History, User, Clock, ShieldCheck } from 'lucide-react';

interface ActivityLogsPageProps {
  logs: ActivityLog[];
}

const ActivityLogsPage: React.FC<ActivityLogsPageProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl"><History size={28} /></div>
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">سجل نشاط الموظفين</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">تتبع كافة الإجراءات والتعديلات التي تتم في متجرك.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="بحث في السجل..." 
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 dark:text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-wider">
                    <tr>
                        <th className="px-6 py-4">الموظف</th>
                        <th className="px-6 py-4">الإجراء</th>
                        <th className="px-6 py-4">التفاصيل</th>
                        <th className="px-6 py-4">التوقيت</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLogs.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-12 text-slate-400">لا يوجد نشاط مسجل حتى الآن.</td></tr>
                    ) : (
                        filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <User size={14} className="text-slate-400"/>
                                        <span className="font-bold text-slate-800 dark:text-white">{log.user}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs font-bold">
                                        <ShieldCheck size={12}/> {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                    {log.details}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                    <div className="flex items-center gap-1">
                                        <Clock size={12}/> {log.date}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogsPage;
