-- Atomically finalize a merchant withdrawal: request state, wallet, and ledger.
create or replace function public.apply_merchant_wallet_change(
  p_list jsonb,
  p_merchant_id text,
  p_new_balance numeric,
  p_transactions jsonb
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare v_result jsonb;
begin
  if jsonb_typeof(p_list) = 'array' then
    select coalesce(jsonb_agg(
      case when value->>'id' = p_merchant_id then
        jsonb_set(
          jsonb_set(value, '{balance}', to_jsonb(p_new_balance), true),
          '{transactions}',
          coalesce(p_transactions, '[]'::jsonb) || coalesce(value->'transactions', '[]'::jsonb),
          true
        )
      else value end
    ), '[]'::jsonb) into v_result
    from jsonb_array_elements(p_list);
    return v_result;
  elsif jsonb_typeof(p_list) = 'object' then
    select coalesce(jsonb_object_agg(key,
      case when value->>'id' = p_merchant_id then
        jsonb_set(
          jsonb_set(value, '{balance}', to_jsonb(p_new_balance), true),
          '{transactions}',
          coalesce(p_transactions, '[]'::jsonb) || coalesce(value->'transactions', '[]'::jsonb),
          true
        )
      else value end
    ), '{}'::jsonb) into v_result
    from jsonb_each(p_list);
    return v_result;
  end if;
  return coalesce(p_list, '[]'::jsonb);
end;
$$;

create or replace function public.complete_merchant_withdrawal(
  p_store_id text,
  p_request_id text,
  p_transfer_fee numeric default 0,
  p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.merchant_requests%rowtype;
  v_settings jsonb;
  v_merchant jsonb;
  v_merchant_id text;
  v_merchant_name text;
  v_amount numeric(14,2);
  v_fee numeric(14,2);
  v_new_balance numeric(14,2);
  v_reserved_other numeric(14,2);
  v_now timestamptz := now();
  v_tx_id text := 'mtx-' || replace(gen_random_uuid()::text, '-', '');
  v_fee_tx_id text := 'mtx-fee-' || replace(gen_random_uuid()::text, '-', '');
  v_net numeric(14,2);
  v_tx jsonb;
  v_fee_tx jsonb;
  v_tx_list jsonb;
  v_activity jsonb;
  v_suppliers jsonb;
  v_partners jsonb;
begin
  if coalesce(p_store_id, '') = '' or coalesce(p_request_id, '') = '' then
    raise exception 'بيانات الطلب غير مكتملة';
  end if;

  select * into v_request
  from public.merchant_requests
  where id = p_request_id and "storeId" = p_store_id
  for update;

  if not found then raise exception 'طلب السحب غير موجود'; end if;
  if v_request.status not in ('pending', 'processing') then
    raise exception 'تمت معالجة طلب السحب بالفعل';
  end if;
  if coalesce(v_request.type, 'withdrawal') <> 'withdrawal' then
    raise exception 'نوع الطلب ليس طلب سحب';
  end if;

  select settings into v_settings
  from public.stores_data
  where id = p_store_id
  for update;
  if not found then raise exception 'بيانات المتجر غير موجودة'; end if;

  v_merchant_id := v_request."merchantId";
  v_amount := round(coalesce(v_request.amount, 0), 2);
  v_fee := round(greatest(0, coalesce(p_transfer_fee, 0)), 2);
  if v_amount <= 0 or v_fee > v_amount then raise exception 'قيمة السحب أو الرسوم غير صحيحة'; end if;
  v_net := v_amount - v_fee;

  select candidate.value into v_merchant
  from (
    select value from jsonb_array_elements(
      case when jsonb_typeof(v_settings->'suppliers') = 'array' then v_settings->'suppliers' else '[]'::jsonb end
    )
    union all
    select value from jsonb_each(
      case when jsonb_typeof(v_settings->'suppliers') = 'object' then v_settings->'suppliers' else '{}'::jsonb end
    )
    union all
    select value from jsonb_array_elements(
      case when jsonb_typeof(v_settings->'partners') = 'array' then v_settings->'partners' else '[]'::jsonb end
    )
    union all
    select value from jsonb_each(
      case when jsonb_typeof(v_settings->'partners') = 'object' then v_settings->'partners' else '{}'::jsonb end
    )
  ) candidate
  where candidate.value->>'id' = v_merchant_id
  limit 1;

  if v_merchant is null then raise exception 'تعذر العثور على محفظة الموكل'; end if;
  v_merchant_name := coalesce(v_merchant->>'name', v_request."merchantName", 'الموكل');
  v_new_balance := round(coalesce((v_merchant->>'balance')::numeric, 0) - v_amount, 2);

  select coalesce(sum(amount), 0) into v_reserved_other
  from public.merchant_requests
  where "storeId" = p_store_id
    and "merchantId" = v_merchant_id
    and id <> p_request_id
    and status in ('pending', 'processing')
    and coalesce(type, 'withdrawal') = 'withdrawal';

  if v_new_balance < 0 or v_new_balance < v_reserved_other then
    raise exception 'الرصيد غير كافٍ بعد احتساب طلبات السحب المحجوزة الأخرى';
  end if;

  v_tx := jsonb_build_object(
    'id', v_tx_id,
    'merchantId', v_merchant_id,
    'merchantName', v_merchant_name,
    'type', 'withdrawal',
    'amount', -v_net,
    'date', v_now,
    'notes', 'اعتماد طلب سحب من بوابة الموكل (صافي التحويل - طلب #' || right(p_request_id, 6) || '): ' || coalesce(v_request.notes, ''),
    'balanceAfter', v_new_balance + v_fee,
    'referenceId', p_request_id
  );
  v_fee_tx := case when v_fee > 0 then jsonb_build_object(
    'id', v_fee_tx_id,
    'merchantId', v_merchant_id,
    'merchantName', v_merchant_name,
    'type', 'expense',
    'amount', -v_fee,
    'date', v_now,
    'notes', 'رسوم التحويل المالي لسحب المستحقات (طلب #' || right(p_request_id, 6) || ')',
    'balanceAfter', v_new_balance,
    'referenceId', p_request_id
  ) else null end;
  v_tx_list := case when v_fee > 0 then jsonb_build_array(v_fee_tx, v_tx) else jsonb_build_array(v_tx) end;

  v_suppliers := public.apply_merchant_wallet_change(
    coalesce(v_settings->'suppliers', '[]'::jsonb), v_merchant_id, v_new_balance, v_tx_list
  );
  v_partners := public.apply_merchant_wallet_change(
    coalesce(v_settings->'partners', '[]'::jsonb), v_merchant_id, v_new_balance, v_tx_list
  );
  if not exists (
    select 1 from (
      select value from jsonb_array_elements(case when jsonb_typeof(v_settings->'suppliers')='array' then v_settings->'suppliers' else '[]'::jsonb end)
      union all
      select value from jsonb_each(case when jsonb_typeof(v_settings->'suppliers')='object' then v_settings->'suppliers' else '{}'::jsonb end)
      union all
      select value from jsonb_array_elements(case when jsonb_typeof(v_settings->'partners')='array' then v_settings->'partners' else '[]'::jsonb end)
      union all
      select value from jsonb_each(case when jsonb_typeof(v_settings->'partners')='object' then v_settings->'partners' else '{}'::jsonb end)
    ) x where x.value->>'id' = v_merchant_id
  ) then raise exception 'تعذر تحديث بيانات محفظة الموكل'; end if;

  v_activity := jsonb_build_object(
    'id', 'log-' || replace(gen_random_uuid()::text, '-', ''),
    'user', 'الإدارة',
    'action', 'اعتماد طلب سحب موكل',
    'details', 'تم اعتماد طلب سحب للموكل ' || v_merchant_name || ' بمبلغ ' || v_amount || ' ج.م',
    'date', v_now,
    'timestamp', extract(epoch from v_now) * 1000
  );

  update public.stores_data
  set settings = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(v_settings, '{}'::jsonb),
        '{suppliers}', v_suppliers, true
      ),
      '{partners}', v_partners, true
    ),
    '{merchantTransactions}',
    jsonb_build_array(v_tx) || coalesce(v_settings->'merchantTransactions', '[]'::jsonb),
    true
  ) || jsonb_build_object(
    'activityLogs', jsonb_build_array(v_activity) || coalesce(v_settings->'activityLogs', '[]'::jsonb)
  ),
  updated_at = v_now
  where id = p_store_id;

  update public.merchant_requests
  set status = 'approved',
      updated_at = v_now,
      "approvedAt" = coalesce(nullif(p_meta->>'approvedAt',''), v_now::text),
      "approvedBy" = nullif(p_meta->>'approvedBy',''),
      "transferReference" = nullif(p_meta->>'transferReference',''),
      "receiptImage" = nullif(p_meta->>'receiptImage','')
  where id = p_request_id and "storeId" = p_store_id;

  return jsonb_build_object(
    'success', true, 'id', p_request_id, 'status', 'approved',
    'amount', v_amount, 'transferFee', v_fee, 'netAmount', v_net,
    'balanceAfter', v_new_balance
  );
end;
$$;

revoke all on function public.apply_merchant_wallet_change(jsonb,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.complete_merchant_withdrawal(text,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.complete_merchant_withdrawal(text,text,numeric,jsonb) to service_role;
