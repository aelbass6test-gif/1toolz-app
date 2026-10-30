-- Store-scoped policies for operational tables. The membership helper validates auth.uid() against the canonical membership table.

DROP POLICY IF EXISTS "call_scripts members select" ON public.call_scripts;
CREATE POLICY "call_scripts members select" ON public.call_scripts FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "call_scripts members insert" ON public.call_scripts;
CREATE POLICY "call_scripts members insert" ON public.call_scripts FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "call_scripts members update" ON public.call_scripts;
CREATE POLICY "call_scripts members update" ON public.call_scripts FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "call_scripts members delete" ON public.call_scripts;
CREATE POLICY "call_scripts members delete" ON public.call_scripts FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "customer_transactions members select" ON public.customer_transactions;
CREATE POLICY "customer_transactions members select" ON public.customer_transactions FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "customer_transactions members insert" ON public.customer_transactions;
CREATE POLICY "customer_transactions members insert" ON public.customer_transactions FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "customer_transactions members update" ON public.customer_transactions;
CREATE POLICY "customer_transactions members update" ON public.customer_transactions FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "customer_transactions members delete" ON public.customer_transactions;
CREATE POLICY "customer_transactions members delete" ON public.customer_transactions FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "inventory_audits members select" ON public.inventory_audits;
CREATE POLICY "inventory_audits members select" ON public.inventory_audits FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "inventory_audits members insert" ON public.inventory_audits;
CREATE POLICY "inventory_audits members insert" ON public.inventory_audits FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "inventory_audits members update" ON public.inventory_audits;
CREATE POLICY "inventory_audits members update" ON public.inventory_audits FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "inventory_audits members delete" ON public.inventory_audits;
CREATE POLICY "inventory_audits members delete" ON public.inventory_audits FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "order_returns members select" ON public.order_returns;
CREATE POLICY "order_returns members select" ON public.order_returns FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "order_returns members insert" ON public.order_returns;
CREATE POLICY "order_returns members insert" ON public.order_returns FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "order_returns members update" ON public.order_returns;
CREATE POLICY "order_returns members update" ON public.order_returns FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "order_returns members delete" ON public.order_returns;
CREATE POLICY "order_returns members delete" ON public.order_returns FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "pos_sales members select" ON public.pos_sales;
CREATE POLICY "pos_sales members select" ON public.pos_sales FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "pos_sales members insert" ON public.pos_sales;
CREATE POLICY "pos_sales members insert" ON public.pos_sales FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "pos_sales members update" ON public.pos_sales;
CREATE POLICY "pos_sales members update" ON public.pos_sales FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "pos_sales members delete" ON public.pos_sales;
CREATE POLICY "pos_sales members delete" ON public.pos_sales FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "purchase_returns members select" ON public.purchase_returns;
CREATE POLICY "purchase_returns members select" ON public.purchase_returns FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "purchase_returns members insert" ON public.purchase_returns;
CREATE POLICY "purchase_returns members insert" ON public.purchase_returns FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "purchase_returns members update" ON public.purchase_returns;
CREATE POLICY "purchase_returns members update" ON public.purchase_returns FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "purchase_returns members delete" ON public.purchase_returns;
CREATE POLICY "purchase_returns members delete" ON public.purchase_returns FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "quotations members select" ON public.quotations;
CREATE POLICY "quotations members select" ON public.quotations FOR SELECT TO authenticated
USING (public.is_store_member(store_id));
DROP POLICY IF EXISTS "quotations members insert" ON public.quotations;
CREATE POLICY "quotations members insert" ON public.quotations FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(store_id));
DROP POLICY IF EXISTS "quotations members update" ON public.quotations;
CREATE POLICY "quotations members update" ON public.quotations FOR UPDATE TO authenticated
USING (public.is_store_member(store_id)) WITH CHECK (public.is_store_member(store_id));
DROP POLICY IF EXISTS "quotations members delete" ON public.quotations;
CREATE POLICY "quotations members delete" ON public.quotations FOR DELETE TO authenticated
USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS "shared_audits members select" ON public.shared_audits;
CREATE POLICY "shared_audits members select" ON public.shared_audits FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid)));
DROP POLICY IF EXISTS "shared_audits members insert" ON public.shared_audits;
CREATE POLICY "shared_audits members insert" ON public.shared_audits FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid)));
DROP POLICY IF EXISTS "shared_audits members update" ON public.shared_audits;
CREATE POLICY "shared_audits members update" ON public.shared_audits FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid)));
DROP POLICY IF EXISTS "shared_audits members delete" ON public.shared_audits;
CREATE POLICY "shared_audits members delete" ON public.shared_audits FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid)));

DROP POLICY IF EXISTS "stock_audit_requests members select" ON public.stock_audit_requests;
CREATE POLICY "stock_audit_requests members select" ON public.stock_audit_requests FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "stock_audit_requests members insert" ON public.stock_audit_requests;
CREATE POLICY "stock_audit_requests members insert" ON public.stock_audit_requests FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "stock_audit_requests members update" ON public.stock_audit_requests;
CREATE POLICY "stock_audit_requests members update" ON public.stock_audit_requests FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "stock_audit_requests members delete" ON public.stock_audit_requests;
CREATE POLICY "stock_audit_requests members delete" ON public.stock_audit_requests FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "stock_transfers members select" ON public.stock_transfers;
CREATE POLICY "stock_transfers members select" ON public.stock_transfers FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "stock_transfers members insert" ON public.stock_transfers;
CREATE POLICY "stock_transfers members insert" ON public.stock_transfers FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "stock_transfers members update" ON public.stock_transfers;
CREATE POLICY "stock_transfers members update" ON public.stock_transfers FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "stock_transfers members delete" ON public.stock_transfers;
CREATE POLICY "stock_transfers members delete" ON public.stock_transfers FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "supplier_transactions members select" ON public.supplier_transactions;
CREATE POLICY "supplier_transactions members select" ON public.supplier_transactions FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "supplier_transactions members insert" ON public.supplier_transactions;
CREATE POLICY "supplier_transactions members insert" ON public.supplier_transactions FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "supplier_transactions members update" ON public.supplier_transactions;
CREATE POLICY "supplier_transactions members update" ON public.supplier_transactions FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "supplier_transactions members delete" ON public.supplier_transactions;
CREATE POLICY "supplier_transactions members delete" ON public.supplier_transactions FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "whatsapp_templates members select" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates members select" ON public.whatsapp_templates FOR SELECT TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "whatsapp_templates members insert" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates members insert" ON public.whatsapp_templates FOR INSERT TO authenticated
WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "whatsapp_templates members update" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates members update" ON public.whatsapp_templates FOR UPDATE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId"))) WITH CHECK (public.is_store_member(COALESCE(store_id, storeid, "storeId")));
DROP POLICY IF EXISTS "whatsapp_templates members delete" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates members delete" ON public.whatsapp_templates FOR DELETE TO authenticated
USING (public.is_store_member(COALESCE(store_id, storeid, "storeId")));

DROP POLICY IF EXISTS "merchant_requests owners manage" ON public.merchant_requests;
CREATE POLICY "merchant_requests owners manage" ON public.merchant_requests FOR ALL TO authenticated
USING (public.is_store_owner("storeId")) WITH CHECK (public.is_store_owner("storeId"));

DROP POLICY IF EXISTS "partner_requests owners manage" ON public.partner_requests;
CREATE POLICY "partner_requests owners manage" ON public.partner_requests FOR ALL TO authenticated
USING (public.is_store_owner("storeId")) WITH CHECK (public.is_store_owner("storeId"));

DROP POLICY IF EXISTS "withdrawal_requests owners manage" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests owners manage" ON public.withdrawal_requests FOR ALL TO authenticated
USING (public.is_store_owner(COALESCE(store_id, storeid))) WITH CHECK (public.is_store_owner(COALESCE(store_id, storeid)));

-- Payment rows are readable only by a store owner; all writes stay server-side.
DROP POLICY IF EXISTS "moneyhash payments owners read" ON public.moneyhash_payments;
CREATE POLICY "moneyhash payments owners read" ON public.moneyhash_payments
FOR SELECT TO authenticated USING (public.is_store_owner(store_id));
