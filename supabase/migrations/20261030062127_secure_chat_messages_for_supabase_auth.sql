-- Chat messages are store-private. The recipient may be "general" or a
-- phone associated with a Supabase identity that is a member of the same store.
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_receiver_id_fkey;

REVOKE ALL ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.chat_messages_id_seq TO authenticated;

DROP POLICY IF EXISTS "Public Access Chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Store members read relevant chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Store members send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Message participants update own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Message senders delete own messages" ON public.chat_messages;

CREATE POLICY "Store members read relevant chat messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  public.is_store_member(store_id)
  AND (
    receiver_id = 'general'
    OR receiver_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR sender_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Store members send chat messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  public.is_store_member(store_id)
  AND sender_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
  AND (
    receiver_id = 'general'
    OR EXISTS (
      SELECT 1
      FROM public.store_memberships m
      JOIN public.user_profiles recipient ON recipient.user_id = m.user_id
      WHERE m.store_id = chat_messages.store_id
        AND recipient.phone = chat_messages.receiver_id
    )
  )
);

CREATE POLICY "Message participants update own messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (
  public.is_store_member(store_id)
  AND (
    sender_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR receiver_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
  )
)
WITH CHECK (
  public.is_store_member(store_id)
  AND (
    sender_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR receiver_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Message senders delete own messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (
  public.is_store_member(store_id)
  AND sender_id = (SELECT p.phone FROM public.user_profiles p WHERE p.user_id = (SELECT auth.uid()))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END;
$$;