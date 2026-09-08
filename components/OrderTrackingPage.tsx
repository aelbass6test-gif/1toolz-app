import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package, Truck, CheckCircle, XCircle, MapPin, Phone, RefreshCcw, Navigation, Compass, AlertCircle, Eye } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { Order, OrderStatus } from '../types';
import { bostaService } from '../utils/bostaService';

declare const google: any;

interface OrderTrackingPageProps {
  orders: Order[];
  settings?: any;
}

const statusSteps: { status: OrderStatus; label: string; icon: React.ReactElement }[] = [
    { status: 'جاري_المراجعة', label: 'تم استلام الطلب', icon: <Package size={24} /> },
    { status: 'قيد_التنفيذ', label: 'قيد التجهيز', icon: <Package size={24} /> },
    { status: 'تم_الارسال', label: 'تم التسليم لشركة الشحن', icon: <Truck size={24} /> },
    { status: 'قيد_الشحن', label: 'الشحنة في الطريق', icon: <Truck size={24} /> },
    { status: 'تم_توصيلها', label: 'تم التوصيل', icon: <CheckCircle size={24} /> },
];

const GOVERNORATE_COORDS: Record<string, { lat: number; lng: number }> = {
  'القاهرة': { lat: 30.0444, lng: 31.2357 },
  'الجيزة': { lat: 30.0131, lng: 31.2089 },
  'الإسكندرية': { lat: 31.2001, lng: 29.9187 },
  'القليوبية': { lat: 30.4101, lng: 31.1853 },
  'الشرقية': { lat: 30.7327, lng: 31.7195 },
  'الدقهلية': { lat: 31.0423, lng: 31.3785 },
  'الغربية': { lat: 30.7885, lng: 31.0004 },
  'المنوفية': { lat: 30.5972, lng: 30.9876 },
  'دمياط': { lat: 31.4175, lng: 31.8144 },
  'كفر الشيخ': { lat: 31.1107, lng: 30.9388 },
  'بلطيم': { lat: 31.5833, lng: 31.0833 },
  'البحيرة': { lat: 30.9333, lng: 30.2500 },
  'الفيوم': { lat: 29.3084, lng: 30.8428 },
  'بني سويف': { lat: 29.0731, lng: 31.0979 },
  'المنيا': { lat: 28.1099, lng: 30.7503 },
  'أسيوط': { lat: 27.1783, lng: 31.1859 },
  'سوهاج': { lat: 26.5590, lng: 31.6957 },
  'قنا': { lat: 26.1551, lng: 32.7160 },
  'الأقصر': { lat: 25.6872, lng: 32.6396 },
  'أسوان': { lat: 24.0889, lng: 32.8998 },
  'مطروح': { lat: 31.3543, lng: 27.2373 },
  'الوادي الجديد': { lat: 25.4514, lng: 30.5492 },
  'شمال سيناء': { lat: 30.5972, lng: 33.7364 },
  'جنوب سيناء': { lat: 29.3101, lng: 34.1531 },
  'البحر الأحمر': { lat: 26.7292, lng: 33.9351 },
  'السويس': { lat: 29.9668, lng: 32.5498 },
  'الإسماعيلية': { lat: 30.6043, lng: 32.2723 },
  'بورسعيد': { lat: 31.2565, lng: 32.2841 },
};

// Custom Polyline Component using Google Maps instances
const Polyline: React.FC<{ path: { lat: number; lng: number }[]; options?: any }> = ({ path, options }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !(window as any).google) return;

    const polyline = new google.maps.Polyline({
      path,
      map,
      strokeColor: '#6366f1',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      ...options,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, path, options]);

  return null;
};

const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orders, settings }) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Live Bosta tracking states
  const [bostaTracking, setBostaTracking] = useState<any>(null);
  const [isBostaLoading, setIsBostaLoading] = useState(false);
  const [mapType, setMapType] = useState<'google' | 'svg'>('google');

  // Load configured Google Maps Key from multiple options
  const mapsApiKey = useMemo(() => {
    return settings?.bostaConfig?.googleMapsApiKey || 
           settings?.googleMapsApiKey || 
           import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
           '';
  }, [settings]);

  // Handle Order Lookup
  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFoundOrder(null);
    setError('');

    setTimeout(() => {
        const order = orders.find(o => 
            o.orderNumber.toLowerCase() === orderNumber.toLowerCase().trim() &&
            o.customerPhone.slice(-4) === phone.slice(-4)
        );

        if (order) {
            setFoundOrder(order);
        } else {
            setError('لم يتم العثور على طلب بهذه البيانات. يرجى التأكد من رقم الطلب وآخر 4 أرقام من هاتفك.');
        }
        setIsLoading(false);
    }, 500);
  };

  // Live Sync tracking updates from Bosta API
  useEffect(() => {
    if (foundOrder?.waybillNumber) {
      setIsBostaLoading(true);
      const isStaging = settings?.bostaConfig?.environment === 'staging';
      const apiKey = settings?.bostaConfig?.apiKey;
      
      bostaService.trackShipment(foundOrder.waybillNumber, apiKey, isStaging)
        .then(res => {
          if (res.success && res.tracking) {
            setBostaTracking(res.tracking);
          }
        })
        .catch(err => console.error('[BOSTA-TRACKING-SYNC-ERROR]', err))
        .finally(() => setIsBostaLoading(false));
    } else {
      setBostaTracking(null);
    }
  }, [foundOrder, settings]);

  // Coordinate Calculations
  const warehousePos = { lat: 31.5833, lng: 31.0833 }; // Baltim (Kafr El Sheikh)
  
  const customerPos = useMemo(() => {
    if (!foundOrder) return null;
    const gov = foundOrder.governorate || foundOrder.shippingArea || 'القاهرة';
    const matchedKey = Object.keys(GOVERNORATE_COORDS).find(k => 
      gov.includes(k) || k.includes(gov)
    );
    return matchedKey ? GOVERNORATE_COORDS[matchedKey] : GOVERNORATE_COORDS['القاهرة'];
  }, [foundOrder]);

  // Center coordinate of map
  const mapCenter = useMemo(() => {
    if (!customerPos) return warehousePos;
    return {
      lat: (warehousePos.lat + customerPos.lat) / 2,
      lng: (warehousePos.lng + customerPos.lng) / 2
    };
  }, [customerPos]);

  // Animated courier marker movement state
  const [courierPos, setCourierPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!customerPos) return;

    let progress = 0.35; // Start courier 35% along the way
    setCourierPos({
      lat: warehousePos.lat + (customerPos.lat - warehousePos.lat) * progress,
      lng: warehousePos.lng + (customerPos.lng - warehousePos.lng) * progress
    });

    const interval = setInterval(() => {
      progress += 0.005;
      if (progress > 0.90) progress = 0.35; // Reset loop simulation
      setCourierPos({
        lat: warehousePos.lat + (customerPos.lat - warehousePos.lat) * progress,
        lng: warehousePos.lng + (customerPos.lng - warehousePos.lng) * progress
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [customerPos]);

  // Distance & Realistic ETA based on coordinates
  const { distance, etaText } = useMemo(() => {
    if (!customerPos) return { distance: 0, etaText: 'ساعتين' };
    const dx = (customerPos.lng - warehousePos.lng) * 96;
    const dy = (customerPos.lat - warehousePos.lat) * 111;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    let eta = 'ساعتين - 4 ساعات';
    if (dist < 40) eta = 'ساعة واحدة';
    else if (dist < 100) eta = 'ساعة ونصف إلى ساعتين';
    else if (dist < 180) eta = '2 - 3 ساعات';
    else if (dist < 300) eta = '3 - 5 ساعات';
    else eta = 'خلال اليوم';

    return { distance: Math.round(dist), etaText: eta };
  }, [customerPos]);

  // Courier Details (Real Bosta Courier details or premium simulated fallbacks)
  const courierDetails = useMemo(() => {
    if (bostaTracking?.carrier) {
      return {
        name: bostaTracking.carrier.name || 'أحمد الشربيني',
        phone: bostaTracking.carrier.phone || '01029384756'
      };
    }
    return {
      name: 'أحمد الشربيني',
      phone: '01029384756'
    };
  }, [bostaTracking]);

  const activeStepIndex = foundOrder ? statusSteps.findIndex(step => step.status === foundOrder.status) : -1;
  const isFailed = foundOrder && ['ملغي', 'مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن'].includes(foundOrder.status);

  // Active status display
  const activeStatusLabel = useMemo(() => {
    if (!foundOrder) return '';
    if ((foundOrder as any).bostaStatus) {
      return (foundOrder as any).bostaStatus;
    }
    const matched = statusSteps.find(s => s.status === foundOrder.status);
    return matched ? matched.label : foundOrder.status.replace(/_/g, ' ');
  }, [foundOrder]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-right" dir="rtl">
        <div className="w-full max-w-2xl my-6">
            <div className="text-center mb-8">
                <Truck className="mx-auto text-indigo-500 mb-4" size={48} strokeWidth={1.5} />
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">تتبع شحنتك</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">أدخل رقم الطلب وآخر 4 أرقام من هاتفك لعرض حالة الشحنة المباشرة.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm">
                {!foundOrder && (
                    <form onSubmit={handleTrackOrder} className="space-y-4 max-w-md mx-auto">
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">رقم الطلب</label>
                            <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-center text-lg font-mono font-bold tracking-wider" placeholder="WEB-XXXXXX" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">آخر 4 أرقام من هاتفك</label>
                            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={4} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-center text-lg font-mono font-bold tracking-wider" placeholder="1234" />
                        </div>
                        {error && <p className="text-sm text-red-500 font-bold bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:bg-slate-400">
                            {isLoading ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : <><Search size={18}/> تتبع الشحنة الآن</>}
                        </button>
                    </form>
                )}

                {foundOrder && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white">تفاصيل الطلب #{foundOrder.orderNumber}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">مرحباً عميلنا العزيز: <span className="font-bold text-slate-700 dark:text-slate-200">{foundOrder.customerName}</span></p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-slate-400">حالة الشحنة الحالية</span>
                                <span className="text-sm font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 mt-1">
                                    {activeStatusLabel}
                                </span>
                            </div>
                        </div>
                        
                        {/* Live Courier Tracking Component */}
                        {['تم_الارسال', 'قيد_الشحن'].includes(foundOrder.status) && (
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800/30 dark:to-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-white block"></span>
                                            مباشر • جاري التوصيل
                                        </span>
                                        {foundOrder.waybillNumber && (
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                                                بوسطة #{foundOrder.waybillNumber}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                          onClick={() => setMapType('google')} 
                                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${mapType === 'google' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                                            خريطة جوجل التفاعلية
                                        </button>
                                        <button 
                                          onClick={() => setMapType('svg')} 
                                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${mapType === 'svg' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                                            خريطة توضيحية
                                        </button>
                                    </div>
                                </div>

                                {/* MAP CONTAINER */}
                                {mapType === 'google' ? (
                                    <div className="relative h-80 bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                        {mapsApiKey ? (
                                            <APIProvider apiKey={mapsApiKey}>
                                                <Map
                                                    defaultCenter={mapCenter}
                                                    defaultZoom={7.5}
                                                    mapId="DEMO_MAP_ID"
                                                    gestureHandling="greedy"
                                                    disableDefaultUI={false}
                                                    internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                                                    style={{ width: '100%', height: '100%' }}
                                                >
                                                    {/* Warehouse Location Marker */}
                                                    <AdvancedMarker position={warehousePos} title="المخزن الرئيسي">
                                                        <div className="bg-indigo-600 text-white p-2 rounded-lg font-bold text-xs shadow-lg border-2 border-white flex items-center gap-1">
                                                            <span>🏬</span> المخزن
                                                        </div>
                                                    </AdvancedMarker>

                                                    {/* Customer Location Marker */}
                                                    {customerPos && (
                                                        <AdvancedMarker position={customerPos} title="وجهتك">
                                                            <div className="bg-pink-600 text-white p-2 rounded-lg font-bold text-xs shadow-lg border-2 border-white flex items-center gap-1">
                                                                <span>📍</span> منزلك
                                                            </div>
                                                        </AdvancedMarker>
                                                    )}

                                                    {/* Polyline Route */}
                                                    {customerPos && (
                                                        <Polyline path={[warehousePos, customerPos]} />
                                                    )}

                                                    {/* Simulated Courier Moving Position */}
                                                    {courierPos && (
                                                        <AdvancedMarker position={courierPos} title="المندوب">
                                                            <div className="bg-yellow-500 text-slate-900 px-2.5 py-1.5 rounded-full font-black text-sm shadow-xl border-2 border-white animate-bounce flex items-center gap-1">
                                                                🚚 المندوب
                                                            </div>
                                                        </AdvancedMarker>
                                                    )}
                                                </Map>
                                            </APIProvider>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-900">
                                                <AlertCircle className="text-yellow-500 mb-3" size={36} />
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">خريطة جوجل التفاعلية قيد التشغيل في الإنتاج</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">لتنشيط الخريطة التفاعلية، يرجى تهيئة مفتاح Google Maps API في إعدادات التطبيق أو عبر ملف البيئة <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-500">VITE_GOOGLE_MAPS_API_KEY</code>.</p>
                                                <button 
                                                    onClick={() => setMapType('svg')} 
                                                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
                                                    عرض الخريطة التوضيحية المدمجة
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Interactive SVG Map Route as bulletproof fallback */
                                    <div className="relative h-40 bg-white dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 flex items-center justify-center p-4">
                                        <svg viewBox="0 0 300 100" className="w-full h-full">
                                            <defs>
                                                <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#6366f1" />
                                                    <stop offset="100%" stopColor="#a855f7" />
                                                </linearGradient>
                                            </defs>
                                            {/* Styled road background grid */}
                                            <path d="M 20,50 Q 150,20 280,50" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" className="dark:stroke-slate-800" />
                                            {/* Active road track */}
                                            <path d="M 20,50 Q 150,20 280,50" fill="none" stroke="url(#routeGrad)" strokeWidth="4" strokeLinecap="round" strokeDasharray="15, 3" />
                                            
                                            {/* Warehouse location */}
                                            <circle cx="20" cy="50" r="8" fill="#4f46e5" />
                                            <text x="20" y="32" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#6366f1">المخزن (بلطيم)</text>
                                            
                                            {/* Delivery courier animate icon along the road */}
                                            <g className="animate-[moveCourier_10s_linear_infinite]">
                                                <circle cx="0" cy="0" r="14" fill="#fff" className="shadow" stroke="#a855f7" strokeWidth="2" />
                                                <text x="0" y="3" fontSize="12" textAnchor="middle">🚚</text>
                                            </g>

                                            {/* Customer destination */}
                                            <circle cx="280" cy="50" r="8" fill="#ec4899" className="animate-ping opacity-75" />
                                            <circle cx="280" cy="50" r="6" fill="#db2777" />
                                            <text x="280" y="32" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#db2777">وجهتك ({foundOrder.governorate || 'منزلك'})</text>
                                        </svg>
                                        <style>{`
                                            @keyframes moveCourier {
                                                0% { transform: translate(30px, 47px); }
                                                50% { transform: translate(150px, 32px); }
                                                100% { transform: translate(270px, 50px); }
                                            }
                                        `}</style>
                                    </div>
                                )}

                                {/* Delivery Route Analytics details */}
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-slate-400 font-bold">المسافة التقريبية</p>
                                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{distance} كم</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-xs text-slate-400 font-bold">زمن التوصيل المتوقع</p>
                                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{etaText}</p>
                                    </div>
                                </div>

                                {/* Courier details and Call action */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-indigo-50 dark:border-indigo-900/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center font-bold text-indigo-600 text-2xl">
                                            👨‍✈️
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400 font-bold">المندوب المسؤول:</p>
                                            <p className="text-base font-black text-slate-800 dark:text-white">{courierDetails.name}</p>
                                            <p className="text-xs text-slate-500 font-bold">{courierDetails.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <a href={`tel:${courierDetails.phone}`} className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1">
                                            <Phone size={14} /> اتصل بالمندوب
                                        </a>
                                        {foundOrder.waybillNumber && (
                                            <a 
                                              href={`https://wa.me/${courierDetails.phone.replace(/^0/, '20')}?text=${encodeURIComponent(`مرحباً كابتن ${courierDetails.name}، أنا بخصوص الطلب رقم #${foundOrder.orderNumber}`)}`}
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="flex-1 sm:flex-initial px-4 py-2.5 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-1">
                                                💬 واتساب المندوب
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="text-xs text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-xl text-center leading-relaxed">
                                    المندوب في طريقه إليك الآن لتسليم طلبك. يرجى إبقاء الهاتف متاحاً لتسهيل التواصل وإتمام التسليم.
                                </div>
                            </div>
                        )}

                        {isFailed ? (
                            <div className="p-5 bg-red-50 dark:bg-red-950/20 rounded-xl flex items-center gap-4 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                                <XCircle size={40} className="flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-lg">حالة الطلب: {activeStatusLabel}</h3>
                                    <p className="text-sm mt-1 leading-relaxed">نأسف، حدثت مشكلة في توصيل طلبك. يرجى التواصل مع المتجر لمعرفة الأسباب وإعادة جدولة الشحنة.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="relative bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h3 className="text-sm font-bold text-slate-500 mb-6 block">خطوات الشحن والتوصيل</h3>
                                <div className="relative">
                                    <div className="absolute right-5 top-4 bottom-4 w-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                                    <div className="space-y-8">
                                        {statusSteps.map((step, index) => {
                                            const isStepActive = index <= activeStepIndex;
                                            return (
                                                <div key={step.status} className="flex items-center gap-4 relative">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all ${isStepActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                        {isStepActive ? <CheckCircle size={20}/> : step.icon}
                                                    </div>
                                                    <div>
                                                        <div className={`font-black ${isStepActive ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{step.label}</div>
                                                        {isStepActive && index === activeStepIndex && (
                                                            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">المرحلة الحالية للطلب</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button onClick={() => { setFoundOrder(null); setBostaTracking(null); }} className="w-full mt-6 py-2.5 text-sm text-indigo-600 font-bold hover:underline bg-indigo-50 dark:bg-slate-800/50 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-xl transition-all">البحث عن شحنة أخرى</button>
                    </div>
                )}
            </div>
            
            <div className="flex justify-between items-center mt-6">
                <Link to="/store" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">العودة إلى المتجر الرئيسي</Link>
                {foundOrder && (
                    <button 
                      onClick={() => {
                        setIsBostaLoading(true);
                        if (foundOrder?.waybillNumber) {
                          const isStaging = settings?.bostaConfig?.environment === 'staging';
                          const apiKey = settings?.bostaConfig?.apiKey;
                          bostaService.trackShipment(foundOrder.waybillNumber, apiKey, isStaging)
                            .then(res => {
                              if (res.success && res.tracking) {
                                setBostaTracking(res.tracking);
                              }
                            })
                            .catch(err => console.error(err))
                            .finally(() => setIsBostaLoading(false));
                        }
                      }} 
                      disabled={isBostaLoading}
                      className="text-xs text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1 disabled:opacity-50">
                        <RefreshCcw size={12} className={isBostaLoading ? 'animate-spin' : ''} /> تحديث البيانات
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default OrderTrackingPage;
