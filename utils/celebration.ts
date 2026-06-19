import confetti from 'canvas-confetti';
import { Settings } from '../types';

export type CelebrationEvent = 
  | 'create_order'       // إنشاء طلب جديد
  | 'edit_order'         // تعديل طلب قائم
  | 'pos_sale'           // بيع مباشر عبر الكاشير (POS)
  | 'add_product'        // إضافة منتج جديد لجرد المتجر
  | 'delete_product'     // حذف منتج
  | 'wallet_withdraw'    // طلب سحب رصيد من المحفظة
  | 'save_settings';     // حفظ الإعدادات بنجاح

export const triggerCelebration = (event: CelebrationEvent, settings?: Settings) => {
  if (!settings) return;
  
  // دمج الإعدادات الافتراضية إذا لم تكن موجودة
  const config = settings.confettiSettings || {
    particleCount: 150,
    gravity: 1.0,
    spread: 80,
    theme: 'rainbow',
    enabledEvents: ['create_order', 'pos_sale', 'add_product', 'save_settings'], // افتراضياً نفعل الأساسيات
    soundVolume: 0.5,
    enableSound: true
  };

  const enabledEvents = config.enabledEvents || [];
  if (!enabledEvents.includes(event)) return;

  const particleCount = config.particleCount || 150;
  const gravity = config.gravity || 1.0;
  const spread = config.spread || 80;
  const theme = config.theme || 'rainbow';

  // تشغيل الصوت إذا كان مفعلاً
  if (config.enableSound) {
    const soundMap = {
      standard: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
      cash: 'https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      trumpet: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
      fireworks: 'https://assets.mixkit.co/active_storage/sfx/619/619-preview.mp3'
    };

    let soundUrl = soundMap[config.soundType || 'standard'] || soundMap.standard;
    
    // تخصيص أصوات لبعض الأحداث إذا لم يتم تحديد نوع معين أو كأولوية برمجية
    if (event === 'wallet_withdraw') {
      soundUrl = soundMap.cash;
    } else if (event === 'save_settings' && !config.soundType) {
      soundUrl = soundMap.success;
    } else if (theme === 'fireworks' && (config.soundType === 'standard' || !config.soundType)) {
      soundUrl = soundMap.fireworks;
    }

    try {
      const audio = new Audio(soundUrl);
      audio.volume = config.soundVolume ?? 0.5;
      audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  }

  if (theme === 'rainbow') {
    confetti({
      particleCount,
      gravity,
      spread,
      origin: { y: 0.6 }
    });
  } else if (theme === 'gold') {
    confetti({
      particleCount: Math.min(particleCount * 1.5, 300),
      gravity: gravity * 0.9,
      spread: spread + 10,
      colors: ['#fbbf24', '#f59e0b', '#d97706', '#fef08a'],
      origin: { y: 0.5 }
    });
  } else if (theme === 'fireworks') {
    const end = Date.now() + 2 * 1000;
    const interval = setInterval(() => {
      if (Date.now() > end) return clearInterval(interval);
      confetti({
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.5 + 0.1 }
      });
    }, 250);
  }
};
