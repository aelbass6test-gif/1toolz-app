import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600 dark:text-red-400" size={40} />
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">عذراً، حدث خطأ غير متوقع</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              واجه التطبيق مشكلة تقنية. لقد تم تسجيل الخطأ وسنعمل على إصلاحه قريباً.
            </p>

            <div className="space-y-3">
              <button 
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
              >
                <RefreshCcw size={20} />
                إعادة المحاولة
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95"
              >
                <RefreshCcw size={20} />
                تحديث الصفحة
              </button>
              
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95"
              >
                <Home size={20} />
                العودة للرئيسية
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 text-right overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </p>
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
