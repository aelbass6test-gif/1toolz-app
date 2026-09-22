import { getSupabaseClient, getLocal } from "./databaseService";

export async function sendAdminAlert(
  storeId: string,
  eventType: 'newOrder' | 'orderDelivered' | 'orderReturned' | 'apiKeyError' | 'webhookFailure' | 'lowStock',
  messageContent: string
) {
  try {
    let storeSettings: any = null;
    const targetStoreId = storeId || "main_store";

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from("stores_data").select("settings").eq("id", targetStoreId).maybeSingle();
      if (data?.settings) {
        storeSettings = data.settings;
      }
    }

    if (!storeSettings) {
      const localStore = await getLocal(targetStoreId);
      if (localStore?.settings) {
        storeSettings = localStore.settings;
      }
    }

    if (!storeSettings) {
      const globalLocal = await getLocal("global");
      if (globalLocal) {
        storeSettings = globalLocal;
      }
    }

    if (!storeSettings || !storeSettings.adminAlerts) return;

    const alertsConfig = storeSettings.adminAlerts;
    
    if (!alertsConfig.enabled) return;
    if (!alertsConfig.events || !alertsConfig.events[eventType]) return;

    const storeName = storeSettings.storeName || "متجري";
    const header = `🔔 *إشعار إدارة المتجر:* ${storeName}\n\n`;
    const fullMessage = header + messageContent;

    // 1. Send via Telegram
    if (alertsConfig.telegramEnabled && alertsConfig.telegramBotToken && alertsConfig.telegramChatId) {
      await fetch(`https://api.telegram.org/bot${alertsConfig.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: alertsConfig.telegramChatId,
          text: fullMessage,
          parse_mode: 'Markdown'
        })
      }).catch(e => console.error("[ADMIN-ALERTS] Telegram dispatch error:", e));
    }

    // 2. Send via WhatsApp (if configured globally for WhatsApp)
    if (alertsConfig.whatsappEnabled && alertsConfig.whatsappAdminNumbers && alertsConfig.whatsappAdminNumbers.length > 0) {
      const waCfg = storeSettings.whatsappConfig;
      if (waCfg && waCfg.isActive) {
        for (const rawPhone of alertsConfig.whatsappAdminNumbers) {
          let cleanPhone = String(rawPhone).replace(/\D/g, "");
          if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
            cleanPhone = "2" + cleanPhone;
          }
          
          if (waCfg.providerType === "meta_cloud") {
            const phoneNumberId = waCfg.phoneNumberId || waCfg.instanceId;
            const accessToken = waCfg.accessToken || waCfg.token;
            if (phoneNumberId && accessToken) {
              await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: cleanPhone,
                  type: "text",
                  text: { preview_url: true, body: fullMessage }
                })
              }).catch(e => console.error("[ADMIN-ALERTS] WhatsApp (Meta) dispatch error:", e));
            }
          } else if (waCfg.apiUrl && waCfg.token) {
            let finalApiUrl = (waCfg.apiUrl || "").trim();
            if (!finalApiUrl.startsWith("http")) finalApiUrl = "https://" + finalApiUrl;
            if (finalApiUrl.includes("api.ultramsg.com") && !finalApiUrl.includes("/messages/")) {
              if (!finalApiUrl.endsWith("/")) finalApiUrl += "/";
              finalApiUrl += "messages/chat";
            }
            await fetch(finalApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: waCfg.token,
                to: cleanPhone,
                body: fullMessage,
                priority: 10
              })
            }).catch(e => console.error("[ADMIN-ALERTS] WhatsApp (API) dispatch error:", e));
          }
        }
      }
    }
  } catch (error) {
    console.error("[ADMIN-ALERTS] Error sending alert:", error);
  }
}
