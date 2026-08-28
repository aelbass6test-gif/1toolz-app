import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home, Sparkles, Copy, Check } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  copied: boolean;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    copied: false,
    isChunkError: false
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, isChunkError: false });
  };

  private handleHardReload = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }
    window.location.reload();
  };

  private copyErrorDetails = () => {
    if (!this.state.error) return;
    const text = `Error: ${this.state.error.message}\nStack: ${this.state.error.stack || 'N/A'}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public static getDerivedStateFromError(error: Error): State {
    const msg = (error.message || '').toLowerCase();
    const isChunk = 
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('err_content_decoding_failed') ||
      msg.includes('failed to load module script') ||
      msg.includes('error loading dynamically imported module');

    return { 
      hasError: true, 
      error,
      copied: false,
      isChunkError: isChunk
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);

    // Auto reload once if it's a chunk loading / deployment mismatch error
    const msg = (error.message || '').toLowerCase();
    if (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('err_content_decoding_failed')
    ) {
      const lastReload = parseInt(sessionStorage.getItem('last_errorboundary_reload') || '0', 10);
      const now = Date.now();
      if (now - lastReload > 15000) {
        sessionStorage.setItem('last_errorboundary_reload', now.toString());
        setTimeout(() => {
          this.handleHardReload();
        }, 300);
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      const { isChunkError, error, copied } = this.state;

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isChunkError ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              {isChunkError ? <Sparkles size={38} /> : <AlertTriangle size={38} />}
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
              {isChunkError ? 'تحديث جديد للنظام' : 'عذراً، حدث خطأ غير متوقع'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
              {isChunkError 
                ? 'تم نشر تحديث جديد بالمتجر. يرجى تحديث الصفحة لتحميل أحدث الملفات والميزات فوراً.'
                : 'واجه التطبيق مشكلة تقنية أثناء تحميل البيانات. يمكنك إعادة المحاولة أو تحديث الصفحة.'}
            </p>

            <div className="space-y-3">
              <button 
                onClick={this.handleHardReload}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                <RefreshCcw size={18} />
                تحديث الصفحة والتحميل الفوري
              </button>
              
              {!isChunkError && (
                <button 
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 px-6 rounded-2xl transition-all active:scale-95 cursor-pointer"
                >
                  <RefreshCcw size={16} />
                  إعادة المحاولة
                </button>
              )}
              
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-3 px-6 rounded-2xl transition-all active:scale-95 cursor-pointer"
              >
                <Home size={16} />
                العودة للرئيسية
              </button>
            </div>

            {error && (
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400">تفاصيل المشكلة التقنية:</span>
                  <button 
                    onClick={this.copyErrorDetails}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copied ? 'تم النسخ' : 'نسخ الخطأ'}
                  </button>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-left overflow-auto max-h-32 border border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all whitespace-pre-wrap">
                    {error.message || error.toString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
