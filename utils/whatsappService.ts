import { Order, Settings, WhatsAppConfig } from '../types';

/**
 * خدمة الواتساب لإرسال الرسائل التلقائية
 */
export const whatsappService = {
  /**
   * استبدال المتغيرات في نص القالب
   */
  formatMessage(template: string, order: Order, settings: Settings, buttons?: string[], footer?: string): string {
    const storeName = (settings as any).storeName || 'متجرنا';
    const totalPriceValue = order.totalPrice || (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
    const productsList = order.items?.map((p: any) => `${p.name || p.productName} x${p.quantity || 1}`).join('\n') || '';
    
    let message = template
      // New format placeholders
      .replace(/{customerName}/g, order.customerName || '')
      .replace(/{orderNumber}/g, order.orderNumber || '')
      .replace(/{totalPrice}/g, totalPriceValue.toString())
      .replace(/{storeName}/g, storeName)
      .replace(/{trackingUrl}/g, order.trackingUrl || 'سيتم إرساله قريباً')
      .replace(/{shippingCompany}/g, order.shippingCompany || '')
      .replace(/{status}/g, order.status?.replace(/_/g, ' ') || '')
      .replace(/{address}/g, order.customerAddress || '')
      .replace(/{products}/g, productsList)
      .replace(/{notes}/g, order.notes || '')
      
      // Legacy format placeholders (for backward compatibility)
      .replace(/\[اسم العميل\]/g, order.customerName || '')
      .replace(/\[اسم المنتج\]/g, productsList)
      .replace(/\[اسم المتجر\]/g, storeName)
      .replace(/\[رقم الطلب\]/g, order.orderNumber || '')
      .replace(/\[السعر الإجمالي\]/g, totalPriceValue.toString())
      .replace(/\[رقم التتبع\]/g, order.trackingUrl || '')
      .replace(/\[شركة الشحن\]/g, order.shippingCompany || '');

    if (footer) {
      message += `\n\n📌 ${footer}`;
    }

    if (buttons && buttons.length > 0) {
      message += `\n\n🔘 *الخيارات المتاحة:*`;
      buttons.forEach((btn, idx) => {
        message += `\n${idx + 1}️⃣ ${btn}`;
      });
    }

    return message;
  },

  /**
   * إرسال الرسالة عبر الـ API الداخلي (Proxy)
   */
  async sendMessage(phone: string, message: string, config: WhatsAppConfig, buttons?: string[], footer?: string): Promise<{ success: boolean; error?: string }> {
    if (!config || !config.isActive) {
      return { success: false, error: 'خدمة الواتساب غير مفعلة' };
    }

    try {
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
        cleanPhone = '2' + cleanPhone;
      }

      // If direct web mode is selected, open WhatsApp Web directly without external API
      if (config.providerType === 'direct_web') {
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        return { success: true };
      }

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: cleanPhone,
          body: message,
          buttons: buttons,
          footer: footer,
          config: config
        }),
      });

      const data = await response.json();

      if (!response.ok || data.sent === false || data.success === false || data.error) {
        let errStr = 'فشل الإرسال عبر API الواتساب';
        const errObj = data.error || data.message;
        if (errObj) {
          if (typeof errObj === 'string') errStr = errObj;
          else if (errObj.message) errStr = errObj.message;
          else errStr = JSON.stringify(errObj);
        }
        throw new Error(errStr);
      }

      return { success: true };
    } catch (error: any) {
      console.error('WhatsApp Send Error:', error);
      return { success: false, error: error.message };
    }
  }
};
