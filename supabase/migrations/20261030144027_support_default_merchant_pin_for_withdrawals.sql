create or replace function public.submit_merchant_withdrawal_request(
  p_store_id text,
  p_merchant_id text,
  p_passcode text,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_merchant jsonb;
  v_balance numeric;
  v_pending numeric;
  v_amount numeric;
  v_id text;
  v_created_at text;
begin
  if coalesce(p_store_id, '') = '' or coalesce(p_merchant_id, '') = '' or coalesce(p_passcode, '') = '' then
    raise exception 'بيانات التحقق غير مكتملة';
  end if;
  select s.settings into v_settings from public.stores_data s where s.id = p_store_id for update;
  if not found then raise exception 'المتجر غير موجود'; end if;

  select candidate.value into v_merchant
  from (
    select value from jsonb_array_elements(case when jsonb_typeof(v_settings->'suppliers') = 'array' then v_settings->'suppliers' else '[]'::jsonb end)
    union all
    select value from jsonb_each(case when jsonb_typeof(v_settings->'suppliers') = 'object' then v_settings->'suppliers' else '{}'::jsonb end)
    union all
    select value from jsonb_array_elements(case when jsonb_typeof(v_settings->'partners') = 'array' then v_settings->'partners' else '[]'::jsonb end)
    union all
    select value from jsonb_each(case when jsonb_typeof(v_settings->'partners') = 'object' then v_settings->'partners' else '{}'::jsonb end)
  ) candidate
  where candidate.value->>'id' = p_merchant_id
  limit 1;

  if v_merchant is null or coalesce(nullif(v_merchant->>'passcode', ''), '0000') <> p_passcode then
    raise exception 'بيانات دخول الموكل غير صحيحة';
  end if;

  v_amount := round(coalesce((p_request->>'amount')::numeric, 0), 2);
  if v_amount <= 0 then raise exception 'مبلغ السحب غير صحيح'; end if;

  select coalesce(sum(mr.amount), 0) into v_pending
  from public.merchant_requests mr
  where mr."storeId" = p_store_id and mr."merchantId" = p_merchant_id
    and mr.status = 'pending' and (mr.type = 'withdrawal' or mr.type is null);

  v_balance := greatest(0, coalesce((v_merchant->>'balance')::numeric, 0));
  if v_amount > greatest(0, v_balance - v_pending) then
    raise exception 'المبلغ المطلوب أكبر من الرصيد المتاح بعد حجز الطلبات المعلقة';
  end if;

  v_id := 'REQ-M-' || replace(gen_random_uuid()::text, '-', '');
  v_created_at := coalesce(p_request->>'createdAt', now()::text);
  insert into public.merchant_requests (
    id, "storeId", type, "typeArabic", amount, notes, date, status, "createdAt",
    "merchantId", "merchantName", "payoutMethod", "payoutAccount", details
  ) values (
    v_id, p_store_id, 'withdrawal', coalesce(p_request->>'typeArabic', 'طلب سحب مستحقات'),
    v_amount, coalesce(p_request->>'notes', ''), coalesce(p_request->>'date', now()::text),
    'pending', v_created_at, p_merchant_id, coalesce(v_merchant->>'name', ''),
    nullif(p_request->>'payoutMethod', ''), nullif(p_request->>'payoutAccount', ''),
    jsonb_build_object(
      'transferFee', coalesce((p_request->>'transferFee')::numeric, 0),
      'netAmount', coalesce((p_request->>'netAmount')::numeric, v_amount),
      'payoutFrequency', p_request->>'payoutFrequency',
      'isMerchantRequest', true
    )
  );
  return jsonb_build_object('success', true, 'id', v_id, 'amount', v_amount, 'status', 'pending');
end;
$$;
revoke all on function public.submit_merchant_withdrawal_request(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.submit_merchant_withdrawal_request(text,text,text,jsonb) to service_role;
