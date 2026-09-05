import { Order, Settings, WhatsAppConfig } from '../types';

/**
 * خدمة الواتساب لإرسال الرسائل التلقائية
 */
export const whatsappService = {
  /**
   * استبدال المتغيرات في نص القالب
   */
  formatMessage(template: string, order: Order, settings: Settings, buttons?: string[], footer?: string, activeStoreName?: string): string {
    const storeName = activeStoreName || 
                      (settings as any)?.storeName || 
                      (settings as any)?.general?.storeName || 
                      (settings as any)?.name || 
                      (order as any)?.storeName || 
                      'متجرنا';
                      
    const totalPriceValue = order.totalPrice || (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
    const currency = (settings as any)?.currency || 'ج.م';
    
    const ord = order as any;

    // Calculate flexship / rejection fee from order, company settings or general settings
    const compFees = (ord.shippingCompany && settings?.companySpecificFees) 
      ? (settings.companySpecificFees as any)[ord.shippingCompany] 
      : undefined;
    const defaultFlexShipSetting = compFees?.flexShipFee ?? (settings as any)?.flexShipFee ?? 150;
    
    let flexShipAmount = 0;
    if (ord.flexShipFee !== undefined && ord.flexShipFee !== null && ord.flexShipFee !== '' && !isNaN(Number(ord.flexShipFee)) && Number(ord.flexShipFee) > 0) {
      flexShipAmount = Number(ord.flexShipFee);
    } else if (ord.enableFlexShip) {
      flexShipAmount = Number(defaultFlexShipSetting || 150);
    } else if (ord.shippingFee !== undefined && ord.shippingFee !== null && Number(ord.shippingFee) > 0) {
      flexShipAmount = Number(ord.shippingFee);
    } else {
      flexShipAmount = Number(defaultFlexShipSetting || 150);
    }
    
    // Format products list with clear quantities and variants
    let productsList = '';
    if (ord.items && Array.isArray(ord.items) && ord.items.length > 0) {
      productsList = ord.items.map((item: any) => {
        const name = item.name || item.productName || item.title || 'منتج';
        const qty = item.quantity || item.qty || item.count || 1;
        const variants = [item.variant, item.color, item.size, item.selectedVariant].filter(Boolean).join(' - ');
        return `▫️ ${name} (الكمية: ${qty})${variants ? ` [${variants}]` : ''}`;
      }).join('\n');
    } else if (ord.productName) {
      const qty = ord.quantity || 1;
      const variant = ord.variant ? ` [${ord.variant}]` : '';
      productsList = `▫️ ${ord.productName} (الكمية: ${qty})${variant}`;
    } else {
      productsList = '▫️ منتجات الطلب';
    }

    const replacePlaceholders = (text: string): string => {
      if (!text) return '';
      return text
        // New format placeholders
        .replace(/{customerName}/g, ord.customerName || 'عزيزي العميل')
        .replace(/{orderNumber}/g, ord.orderNumber || '')
        .replace(/{totalPrice}/g, totalPriceValue.toString())
        .replace(/{total}/g, totalPriceValue.toString())
        .replace(/{currency}/g, currency)
        .replace(/{storeName}/g, storeName)
        .replace(/{products}/g, productsList)
        .replace(/{items}/g, productsList)
        .replace(/{productName}/g, productsList)
        .replace(/{flexShipFee}/g, flexShipAmount.toString())
        .replace(/{flexShip}/g, flexShipAmount.toString())
        .replace(/{shippingRefusalFee}/g, flexShipAmount.toString())
        .replace(/{rejectionFee}/g, flexShipAmount.toString())
        .replace(/{nonDeliveryFee}/g, flexShipAmount.toString())
        .replace(/{shippingFee}/g, (ord.shippingFee !== undefined && ord.shippingFee !== null ? ord.shippingFee : flexShipAmount).toString())
        .replace(/{trackingUrl}/g, ord.trackingUrl || 'سيتم إرساله قريباً')
        .replace(/{trackingNumber}/g, ord.trackingNumber || ord.waybillNumber || ord.bostaTrackingNumber || 'قيد الإصدار')
        .replace(/{shippingCompany}/g, ord.shippingCompany || 'شركة الشحن')
        .replace(/{status}/g, ord.status?.replace(/_/g, ' ') || '')
        .replace(/{address}/g, ord.customerAddress || 'العنوان المسجل')
        .replace(/{city}/g, ord.customerCity || ord.city || ord.governorate || '')
        .replace(/{governorate}/g, ord.governorate || ord.customerCity || '')
        .replace(/{notes}/g, ord.notes || '')
        
        // Legacy format placeholders (for backward compatibility)
        .replace(/\[اسم العميل\]/g, ord.customerName || 'عزيزي العميل')
        .replace(/\[اسم المنتج\]/g, productsList)
        .replace(/\[المنتجات\]/g, productsList)
        .replace(/\[اسم المتجر\]/g, storeName)
        .replace(/\[رقم الطلب\]/g, ord.orderNumber || '')
        .replace(/\[السعر الإجمالي\]/g, totalPriceValue.toString())
        .replace(/\[الإجمالي\]/g, totalPriceValue.toString())
        .replace(/\[مبلغ الفليكس شيب\]/g, flexShipAmount.toString())
        .replace(/\[الفليكس شيب\]/g, flexShipAmount.toString())
        .replace(/\[فليكس شيب\]/g, flexShipAmount.toString())
        .replace(/\[رسوم عدم الاستلام\]/g, flexShipAmount.toString())
        .replace(/\[مصاريف الشحن في حالة عدم الاستلام\]/g, flexShipAmount.toString())
        .replace(/\[مصاريف الشحن\]/g, (ord.shippingFee !== undefined && ord.shippingFee !== null ? ord.shippingFee : flexShipAmount).toString())
        .replace(/\[العنوان\]/g, ord.customerAddress || '')
        .replace(/\[المحافظة\]/g, ord.governorate || '')
        .replace(/\[المدينة\]/g, ord.customerCity || '')
        .replace(/\[رقم التتبع\]/g, ord.trackingUrl || '')
        .replace(/\[شركة الشحن\]/g, ord.shippingCompany || '');
    };
    
    let message = replacePlaceholders(template);

    // If products placeholder wasn't in template and this is a confirmation message, append products summary
    if (!template.includes('{products}') && !template.includes('{items}') && !template.includes('{productName}') && !template.includes('[اسم المنتج]') && !template.includes('[المنتجات]')) {
      if (template.includes('تأكيد') || template.includes('استلمنا طلبك') || template.includes('طلب جديد')) {
        message += `\n\n🛍️ *المنتجات المطلوبة:*\n${productsList}`;
      }
    }

    // If non-delivery / flexship notice wasn't explicitly mentioned and this is a confirmation message, append notice
    if (template.includes('تأكيد') || template.includes('استلمنا طلبك') || template.includes('طلب جديد')) {
      if (!template.includes('عدم الاستلام') && !template.includes('رفض الاستلام') && !template.includes('{flexShipFee}') && !template.includes('[مبلغ الفليكس شيب]')) {
        message += `\n\n⚠️ *تنبيه:* في حالة عدم الاستلام عند وصول المندوب يتم سداد مصاريف الشحن (${flexShipAmount} ${currency}).`;
      }
    }

    if (footer) {
      const formattedFooter = replacePlaceholders(footer);
      message += `\n\n📌 ${formattedFooter}`;
    }

    if (buttons && buttons.length > 0) {
      message += `\n\n🔘 *الخيارات المتاحة:*`;
      buttons.forEach((btn, idx) => {
        const formattedBtn = replacePlaceholders(btn);
        message += `\n${idx + 1}️⃣ ${formattedBtn}`;
      });
    }

    return message;
  },

  /**
   * إرسال الرسالة عبر الـ API الداخلي (Proxy)
   */
  async sendMessage(phone: string, message: string, config: WhatsAppConfig, buttons?: string[], footer?: string, storeName?: string): Promise<{ success: boolean; error?: string }> {
    if (!config || !config.isActive) {
      return { success: false, error: 'خدمة الواتساب غير مفعلة' };
    }

    try {
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
        cleanPhone = '2' + cleanPhone;
      }

      const activeStoreName = storeName || (config as any)?.storeName || 'متجرنا';
      const cleanFooter = footer 
        ? footer.replace(/{storeName}/g, activeStoreName).replace(/\[اسم المتجر\]/g, activeStoreName) 
        : undefined;
      const cleanButtons = buttons && Array.isArray(buttons) 
        ? buttons.map(b => typeof b === 'string' ? b.replace(/{storeName}/g, activeStoreName).replace(/\[اسم المتجر\]/g, activeStoreName) : b)
        : undefined;

      // If direct web mode is selected, open WhatsApp Web directly without external API
      if (config.providerType === 'direct_web') {
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        return { success: true };
      }

      let data: any = null;
      let usedDirectMeta = false;

      try {
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: cleanPhone,
            body: message,
            buttons: cleanButtons,
            footer: cleanFooter,
            config: {
              ...config,
              storeName: activeStoreName
            }
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await response.json();
        }
      } catch (proxyErr) {
        console.warn('Proxy send failed, checking direct fallback:', proxyErr);
      }

      // Direct Meta Cloud Fallback if proxy failed or returned HTML
      if (!data && config.providerType === 'meta_cloud') {
        const phoneId = (config.phoneNumberId || config.instanceId || '').trim();
        const token = (config.accessToken || config.token || '').trim();
        if (phoneId && token) {
          usedDirectMeta = true;
          let metaPayload: any;

          if (config.metaTemplateName && config.metaTemplateName.trim()) {
            metaPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'template',
              template: {
                name: config.metaTemplateName.trim(),
                language: {
                  code: config.metaTemplateLanguage?.trim() || 'ar'
                }
              }
            };
          } else if (cleanButtons && Array.isArray(cleanButtons) && cleanButtons.length > 0 && cleanButtons.length <= 3) {
            metaPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: message },
                footer: cleanFooter ? { text: cleanFooter } : undefined,
                action: {
                  buttons: cleanButtons.map((b: any, idx: number) => {
                    const title = (typeof b === 'string' ? b : (b.text || b.title || `زر ${idx + 1}`)).trim().substring(0, 20);
                    const id = (typeof b === 'object' && b.id ? b.id : `btn_${idx + 1}`).substring(0, 256);
                    return { type: 'reply', reply: { id, title } };
                  })
                }
              }
            };
          } else {
            let fullText = message;
            if (cleanFooter) fullText += `\n\n📌 ${cleanFooter}`;
            if (cleanButtons && cleanButtons.length > 0) {
              fullText += `\n\n🔘 الخيارات:\n` + cleanButtons.map((b: any, i: number) => `${i + 1}. ${typeof b === 'string' ? b : (b.text || b.title || '')}`).join('\n');
            }
            metaPayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: { body: fullText }
            };
          }

          const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(metaPayload)
          });
          data = await metaRes.json();
          if (metaRes.ok && data.messages) {
            return { success: true };
          } else {
            const errStr = data.error?.message || 'فشل الإرسال عبر Meta Cloud API';
            throw new Error(errStr);
          }
        }
      }

      if (!data) {
        throw new Error('تعذر الوصول إلى خادم الإرسال (رد غير صالح)');
      }

      if (data.sent === false || data.success === false || data.error) {
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
