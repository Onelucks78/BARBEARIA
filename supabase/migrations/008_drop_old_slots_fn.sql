-- =====================================================================
-- 008_drop_old_slots_fn.sql — Remove assinatura antiga (uuid)
-- A migração 007 só substituiu uma sobrecarga; a original com uuid
-- sobreviveu. Removemos ela pra evitar ambiguidade.
-- =====================================================================
drop function if exists public.get_available_slots(text, date, uuid, boolean);
