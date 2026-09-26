import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, CheckCircle2, AlertCircle, RefreshCw, Search, Check } from 'lucide-react';
import { bostaService, BostaCity, BostaDistrict } from '../utils/bostaService';

interface BostaAddressValidatorProps {
  selectedCity?: string;
  selectedDistrictId?: string;
  onSelectAddress: (data: {
    cityId?: string;
    cityNameAr?: string;
    cityName?: string;
    zoneId?: string;
    zoneNameAr?: string;
    zoneName?: string;
    districtId?: string;
    districtNameAr?: string;
    districtName?: string;
    formattedAddress?: string;
  }) => void;
  className?: string;
}

const isRealBostaId = (value?: string) => Boolean(
  value && /^[A-Za-z0-9_-]{6,}$/.test(value) && !/^(?:loc|dist|city_fallback|gov_fallback)_/i.test(value)
);

const normalizeArabic = (str: string = '') => {
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .trim();
};

const COMPREHENSIVE_EGYPTIAN_DISTRICTS: BostaDistrict[] = [
  // كفر الشيخ
  { _id: "dist_baltim", districtId: "dist_baltim", districtNameAr: "بلطيم", districtName: "Baltim", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_kafr_sheikh", districtId: "dist_kafr_sheikh", districtNameAr: "كفر الشيخ (المدينة)", districtName: "Kafr El Sheikh City", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_desouk", districtId: "dist_desouk", districtNameAr: "دسوق", districtName: "Desouk", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_foua", districtId: "dist_foua", districtNameAr: "فوة", districtName: "Foua", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_metoubes", districtId: "dist_metoubes", districtNameAr: "مطوبس", districtName: "Metoubes", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_sidi_salem", districtId: "dist_sidi_salem", districtNameAr: "سيدي سالم", districtName: "Sidi Salem", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_biela", districtId: "dist_biela", districtNameAr: "بيلا", districtName: "Biela", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_hamoul", districtId: "dist_hamoul", districtNameAr: "الحامول", districtName: "El Hamoul", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_qallin", districtId: "dist_qallin", districtNameAr: "قلين", districtName: "Qallin", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },
  { _id: "dist_ryad", districtId: "dist_ryad", districtNameAr: "الرياض", districtName: "El Ryad", zoneNameAr: "كفر الشيخ", zoneName: "Kafr El Sheikh", cityId: "kafr_el_sheikh" },

  // القاهرة
  { _id: "dist_tagamoa1", districtId: "dist_tagamoa1", districtNameAr: "التجمع الأول", districtName: "First Settlement", zoneNameAr: "القاهرة الجديدة", zoneName: "New Cairo", cityId: "cairo" },
  { _id: "dist_tagamoa5", districtId: "dist_tagamoa5", districtNameAr: "التجمع الخامس", districtName: "Fifth Settlement", zoneNameAr: "القاهرة الجديدة", zoneName: "New Cairo", cityId: "cairo" },
  { _id: "dist_rehab", districtId: "dist_rehab", districtNameAr: "الرحاب", districtName: "El Rehab", zoneNameAr: "القاهرة الجديدة", zoneName: "New Cairo", cityId: "cairo" },
  { _id: "dist_madinaty", districtId: "dist_madinaty", districtNameAr: "مدينتي", districtName: "Madinaty", zoneNameAr: "القاهرة الجديدة", zoneName: "New Cairo", cityId: "cairo" },
  { _id: "dist_shorouk", districtId: "dist_shorouk", districtNameAr: "الشروق", districtName: "El Shorouk", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_badr", districtId: "dist_badr", districtNameAr: "بدر", districtName: "Badr City", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_obour", districtId: "dist_obour", districtNameAr: "العبور", districtName: "El Obour", zoneNameAr: "القليوبية / القاهرة", zoneName: "Obour", cityId: "cairo" },
  { _id: "dist_nasr_city", districtId: "dist_nasr_city", districtNameAr: "مدينة نصر", districtName: "Nasr City", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_heliopolis", districtId: "dist_heliopolis", districtNameAr: "مصر الجديدة", districtName: "Heliopolis", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_maadi", districtId: "dist_maadi", districtNameAr: "المعادي", districtName: "Maadi", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_helwan", districtId: "dist_helwan", districtNameAr: "حلوان", districtName: "Helwan", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_mokattam", districtId: "dist_mokattam", districtNameAr: "المقطم", districtName: "Mokattam", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_zamalek", districtId: "dist_zamalek", districtNameAr: "الزمالك", districtName: "Zamalek", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_downtown", districtId: "dist_downtown", districtNameAr: "وسط البلد", districtName: "Downtown", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },
  { _id: "dist_shoubra", districtId: "dist_shoubra", districtNameAr: "شبرا", districtName: "Shoubra", zoneNameAr: "القاهرة", zoneName: "Cairo", cityId: "cairo" },

  // الجيزة
  { _id: "dist_october", districtId: "dist_october", districtNameAr: "6 أكتوبر", districtName: "6th of October", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_zayed", districtId: "dist_zayed", districtNameAr: "الشيخ زايد", districtName: "Sheikh Zayed", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_dokki", districtId: "dist_dokki", districtNameAr: "الدقي", districtName: "Dokki", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_mohandessin", districtId: "dist_mohandessin", districtNameAr: "المهندسين", districtName: "Mohandessin", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_haram", districtId: "dist_haram", districtNameAr: "الهرم", districtName: "Haram", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_faisal", districtId: "dist_faisal", districtNameAr: "فيصل", districtName: "Faisal", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_agouza", districtId: "dist_agouza", districtNameAr: "العجوزة", districtName: "Agouza", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },
  { _id: "dist_imbaba", districtId: "dist_imbaba", districtNameAr: "إمبابة", districtName: "Imbaba", zoneNameAr: "الجيزة", zoneName: "Giza", cityId: "giza" },

  // الإسكندرية
  { _id: "dist_smouha", districtId: "dist_smouha", districtNameAr: "سموحة", districtName: "Smouha", zoneNameAr: "الإسكندرية", zoneName: "Alexandria", cityId: "alex" },
  { _id: "dist_miami", districtId: "dist_miami", districtNameAr: "ميامي", districtName: "Miami", zoneNameAr: "الإسكندرية", zoneName: "Alexandria", cityId: "alex" },
  { _id: "dist_agami", districtId: "dist_agami", districtNameAr: "العجمي", districtName: "Agami", zoneNameAr: "الإسكندرية", zoneName: "Alexandria", cityId: "alex" },
  { _id: "dist_montazah", districtId: "dist_montazah", districtNameAr: "المنتزه", districtName: "Montazah", zoneNameAr: "الإسكندرية", zoneName: "Alexandria", cityId: "alex" },
  { _id: "dist_moharam_bek", districtId: "dist_moharam_bek", districtNameAr: "محرم بك", districtName: "Moharam Bek", zoneNameAr: "الإسكندرية", zoneName: "Alexandria", cityId: "alex" },
  { _id: "dist_borg_arab", districtId: "dist_borg_arab", districtNameAr: "برج العرب", districtName: "Borg El Arab", zoneNameAr: "الإسكندرية", zoneName: "Alexandria", cityId: "alex" },

  // الغربية
  { _id: "dist_tanta", districtId: "dist_tanta", districtNameAr: "طنطا", districtName: "Tanta", zoneNameAr: "الغربية", zoneName: "Gharbia", cityId: "gharbia" },
  { _id: "dist_mahalla", districtId: "dist_mahalla", districtNameAr: "المحلة الكبرى", districtName: "El Mahalla El Kubra", zoneNameAr: "الغربية", zoneName: "Gharbia", cityId: "gharbia" },
  { _id: "dist_zefta", districtId: "dist_zefta", districtNameAr: "زفتى", districtName: "Zefta", zoneNameAr: "الغربية", zoneName: "Gharbia", cityId: "gharbia" },
  { _id: "dist_zayat", districtId: "dist_zayat", districtNameAr: "كفر الزيات", districtName: "Kafr El Zayat", zoneNameAr: "الغربية", zoneName: "Gharbia", cityId: "gharbia" },

  // الدقهلية
  { _id: "dist_mansoura", districtId: "dist_mansoura", districtNameAr: "المنصورة", districtName: "Mansoura", zoneNameAr: "الدقهلية", zoneName: "Dakahlia", cityId: "dakahlia" },
  { _id: "dist_talkha", districtId: "dist_talkha", districtNameAr: "طلخا", districtName: "Talkha", zoneNameAr: "الدقهلية", zoneName: "Dakahlia", cityId: "dakahlia" },
  { _id: "dist_mit_ghamr", districtId: "dist_mit_ghamr", districtNameAr: "ميت غمر", districtName: "Mit Ghamr", zoneNameAr: "الدقهلية", zoneName: "Dakahlia", cityId: "dakahlia" },

  // الشرقية
  { _id: "dist_zagazig", districtId: "dist_zagazig", districtNameAr: "الزقازيق", districtName: "Zagazig", zoneNameAr: "الشرقية", zoneName: "Sharqia", cityId: "sharqia" },
  { _id: "dist_10th_ramadan", districtId: "dist_10th_ramadan", districtNameAr: "العاشر من رمضان", districtName: "10th of Ramadan", zoneNameAr: "الشرقية", zoneName: "Sharqia", cityId: "sharqia" },
  { _id: "dist_belbeis", districtId: "dist_belbeis", districtNameAr: "بلبيس", districtName: "Belbeis", zoneNameAr: "الشرقية", zoneName: "Sharqia", cityId: "sharqia" },

  // القليوبية
  { _id: "dist_banha", districtId: "dist_banha", districtNameAr: "بنها", districtName: "Banha", zoneNameAr: "القليوبية", zoneName: "Qalyubia", cityId: "qalyubia" },
  { _id: "dist_shoubra_kheima", districtId: "dist_shoubra_kheima", districtNameAr: "شبرا الخيمة", districtName: "Shoubra El Kheima", zoneNameAr: "القليوبية", zoneName: "Qalyubia", cityId: "qalyubia" },
  { _id: "dist_qalyoub", districtId: "dist_qalyoub", districtNameAr: "قليوب", districtName: "Qalyoub", zoneNameAr: "القليوبية", zoneName: "Qalyubia", cityId: "qalyubia" },

  // المنوفية
  { _id: "dist_shebin_koum", districtId: "dist_shebin_koum", districtNameAr: "شبين الكوم", districtName: "Shebin El Koum", zoneNameAr: "المنوفية", zoneName: "Monufia", cityId: "monufia" },
  { _id: "dist_quesna", districtId: "dist_quesna", districtNameAr: "قويسنا", districtName: "Quesna", zoneNameAr: "المنوفية", zoneName: "Monufia", cityId: "monufia" },
  { _id: "dist_ashmoun", districtId: "dist_ashmoun", districtNameAr: "أشمون", districtName: "Ashmoun", zoneNameAr: "المنوفية", zoneName: "Monufia", cityId: "monufia" },

  // البحيرة
  { _id: "dist_damanhour", districtId: "dist_damanhour", districtNameAr: "دمنهور", districtName: "Damanhour", zoneNameAr: "البحيرة", zoneName: "Beheira", cityId: "beheira" },
  { _id: "dist_kafr_dawar", districtId: "dist_kafr_dawar", districtNameAr: "كفر الدوار", districtName: "Kafr El Dawar", zoneNameAr: "البحيرة", zoneName: "Beheira", cityId: "beheira" },

  // دمياط
  { _id: "dist_damietta_city", districtId: "dist_damietta_city", districtNameAr: "دمياط (المدينة)", districtName: "Damietta City", zoneNameAr: "دمياط", zoneName: "Damietta", cityId: "damietta" },
  { _id: "dist_ras_el_bar", districtId: "dist_ras_el_bar", districtNameAr: "رأس البر", districtName: "Ras El Bar", zoneNameAr: "دمياط", zoneName: "Damietta", cityId: "damietta" },
  { _id: "dist_new_damietta", districtId: "dist_new_damietta", districtNameAr: "دمياط الجديدة", districtName: "New Damietta", zoneNameAr: "دمياط", zoneName: "Damietta", cityId: "damietta" },

  // القناة
  { _id: "dist_port_said_city", districtId: "dist_port_said_city", districtNameAr: "بورسعيد", districtName: "Port Said", zoneNameAr: "بورسعيد", zoneName: "Port Said", cityId: "port-said" },
  { _id: "dist_ismailia_city", districtId: "dist_ismailia_city", districtNameAr: "الإسماعيلية", districtName: "Ismailia", zoneNameAr: "الإسماعيلية", zoneName: "Ismailia", cityId: "ismailia" },
  { _id: "dist_suez_city", districtId: "dist_suez_city", districtNameAr: "السويس", districtName: "Suez", zoneNameAr: "السويس", zoneName: "Suez", cityId: "suez" },

  // الصعيد
  { _id: "dist_fayoum_city", districtId: "dist_fayoum_city", districtNameAr: "الفيوم", districtName: "Fayoum", zoneNameAr: "الفيوم", zoneName: "Fayoum", cityId: "fayoum" },
  { _id: "dist_beni_suef_city", districtId: "dist_beni_suef_city", districtNameAr: "بني سويف", districtName: "Beni Suef", zoneNameAr: "بني سويف", zoneName: "Beni Suef", cityId: "beni-suef" },
  { _id: "dist_minya_city", districtId: "dist_minya_city", districtNameAr: "المنيا", districtName: "Minya", zoneNameAr: "المنيا", zoneName: "Minya", cityId: "minya" },
  { _id: "dist_asyut_city", districtId: "dist_asyut_city", districtNameAr: "أسيوط", districtName: "Asyut", zoneNameAr: "أسيوط", zoneName: "Asyut", cityId: "asyut" },
  { _id: "dist_sohag_city", districtId: "dist_sohag_city", districtNameAr: "سوهاج", districtName: "Sohag", zoneNameAr: "سوهاج", zoneName: "Sohag", cityId: "sohag" },
  { _id: "dist_qena_city", districtId: "dist_qena_city", districtNameAr: "قنا", districtName: "Qena", zoneNameAr: "قنا", zoneName: "Qena", cityId: "qena" },
  { _id: "dist_luxor_city", districtId: "dist_luxor_city", districtNameAr: "الأقصر", districtName: "Luxor", zoneNameAr: "الأقصر", zoneName: "Luxor", cityId: "luxor" },
  { _id: "dist_aswan_city", districtId: "dist_aswan_city", districtNameAr: "أسوان", districtName: "Aswan", zoneNameAr: "أسوان", zoneName: "Aswan", cityId: "aswan" },
  { _id: "dist_hurghada", districtId: "dist_hurghada", districtNameAr: "الغردقة", districtName: "Hurghada", zoneNameAr: "البحر الأحمر", zoneName: "Red Sea", cityId: "red-sea" },
  { _id: "dist_sharm", districtId: "dist_sharm", districtNameAr: "شرم الشيخ", districtName: "Sharm El Sheikh", zoneNameAr: "جنوب سيناء", zoneName: "South Sinai", cityId: "south-sinai" },
  { _id: "dist_matrouh_city", districtId: "dist_matrouh_city", districtNameAr: "مرسى مطروح", districtName: "Marsa Matrouh", zoneNameAr: "مطروح", zoneName: "Matrouh", cityId: "matrouh" }
];

export const BostaAddressValidator: React.FC<BostaAddressValidatorProps> = ({
  selectedCity = '',
  selectedDistrictId = '',
  onSelectAddress,
  className = '',
}) => {
  const [cities, setCities] = useState<BostaCity[]>([]);
  const [districts, setDistricts] = useState<BostaDistrict[]>(COMPREHENSIVE_EGYPTIAN_DISTRICTS);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCityId, setActiveCityId] = useState<string>('');
  const [activeDistrictId, setActiveDistrictId] = useState<string>(selectedDistrictId);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Cities & Districts from Bosta API
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      bostaService.getCities(),
      bostaService.getDistricts()
    ]).then(([cityRes, districtRes]) => {
      if (!isMounted) return;
      if (cityRes.success && Array.isArray(cityRes.list) && cityRes.list.length > 0) {
        setCities(cityRes.list);
      }
      if (districtRes.success && Array.isArray(districtRes.data) && districtRes.data.length > 0) {
        // Never mix synthetic fallback IDs with live Bosta IDs. The fallback
        // list is only safe for display when Bosta is unavailable.
        setDistricts(districtRes.data);
      }
    }).catch(err => console.error('[BOSTA-ADDRESS-VALIDATOR-ERROR]', err))
      .finally(() => { if (isMounted) setIsLoading(false); });

    return () => { isMounted = false; };
  }, []);

  // Filter districts for selected city or query
  const filteredDistricts = useMemo(() => {
    if (!searchQuery.trim()) return districts.slice(0, 30);
    const qNorm = normalizeArabic(searchQuery);

    return districts.filter(d => {
      const nameAr = normalizeArabic(d.districtNameAr || d.nameAr || d.districtName || d.name || '');
      const nameEn = normalizeArabic(d.districtName || d.name || '');
      const zoneAr = normalizeArabic(d.zoneNameAr || d.zoneName || d.cityNameAr || d.cityName || '');
      const zoneEn = normalizeArabic(d.zoneName || d.cityName || '');

      return nameAr.includes(qNorm) || nameEn.includes(qNorm) || zoneAr.includes(qNorm) || zoneEn.includes(qNorm);
    }).slice(0, 50);
  }, [districts, searchQuery]);

  // Handle Selection
  const handleSelectDistrict = (dist: BostaDistrict & Record<string, any>) => {
    const districtId = isRealBostaId(dist.districtId || dist._id) ? (dist.districtId || dist._id) : '';
    const zoneId = isRealBostaId(dist.zoneId) ? dist.zoneId : '';
    const cityId = isRealBostaId(dist.cityId) ? dist.cityId : '';
    setActiveDistrictId(districtId);
    const districtName = dist.districtNameAr || dist.nameAr || dist.districtName || dist.name || '';
    const zoneName = dist.zoneNameAr || dist.zoneName || dist.cityNameAr || dist.cityName || '';
    const parts = [districtName, zoneName].filter(Boolean);
    const formattedAddress = parts.join(' - ');

    onSelectAddress({
      cityId,
      cityNameAr: dist.cityOtherName || dist.cityNameAr || dist.cityName || '',
      cityName: dist.cityName || '',
      zoneId,
      zoneNameAr: dist.zoneNameAr || dist.zoneName || '',
      zoneName: dist.zoneName || '',
      districtId,
      districtNameAr: districtName,
      districtName: dist.districtName || dist.name || districtName,
      formattedAddress
    });
  };

  return (
    <div className={`p-4 sm:p-5 bg-gradient-to-br from-slate-50/90 via-indigo-50/20 to-slate-50/90 dark:from-slate-800/80 dark:via-indigo-950/20 dark:to-slate-800/80 rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 text-right space-y-3.5 shadow-xs ${className}`} dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 font-black text-xs">
          <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <MapPin size={15} />
          </div>
          <span>مُطابق الأحياء السكنية المعتمد لشركات الشحن (Bosta District Matcher)</span>
        </div>
        {isLoading && <RefreshCw size={13} className="animate-spin text-slate-400" />}
      </div>

      <div className="relative">
        <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن اسم الحي، المنطقة، أو التجمع..." 
          className="w-full pr-10 pl-3 py-2.5 text-xs bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold dark:text-white transition-all"
        />
      </div>

      {/* Suggested verified districts */}
      <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
        {filteredDistricts.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3 font-medium">لا توجد أحياء مطابقة للبحث</p>
        ) : (
          filteredDistricts.map((dist: any, idx) => {
            const isSelected = activeDistrictId === (dist._id || dist.districtId);
            const mainLabel = dist.districtNameAr || dist.nameAr || dist.districtName || dist.name;
            const subLabel = dist.zoneNameAr || dist.zoneName || dist.cityNameAr || dist.cityName;

            return (
              <button
                key={dist._id || idx}
                type="button"
                onClick={() => handleSelectDistrict(dist)}
                className={`w-full text-right p-2.5 text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/25' 
                    : 'bg-white dark:bg-slate-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{mainLabel}</span>
                  {subLabel && subLabel !== mainLabel && <span className="text-[10px] opacity-75 font-mono">({subLabel})</span>}
                </div>
                {isSelected && <Check size={14} />}
              </button>
            );
          })
        )}
      </div>

      {activeDistrictId && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-black shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>تم توثيق الحي السكني المعتمد لدى بوسطة بنجاح للتوصيل الفوري الدقيق.</span>
        </div>
      )}
    </div>
  );
};

export default BostaAddressValidator;
