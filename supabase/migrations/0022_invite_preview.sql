-- ---------------------------------------------------------------------------
-- preview_invitation(token): lets the invite landing page greet the invitee by
-- family name and pre-fill (and lock) the email the invite was sent to BEFORE
-- they have an account. Possessing the token already implies they hold the
-- invite link, so returning the destination family name + intended email is
-- safe and removes the #1 source of confusion (wrong email / "create vs login").
-- Returns nothing for invalid / expired / already-accepted tokens.
-- ---------------------------------------------------------------------------
create or replace function preview_invitation(p_token text)
returns table(email text, family_name text, intended_role text)
language sql security definer set search_path = public stable as $$
  select i.email,
         coalesce(nullif(f.name, ''), 'their family') as family_name,
         i.intended_role::text
  from invitations i
  join families f on f.id = i.family_id
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function preview_invitation(text) from public;
grant execute on function preview_invitation(text) to anon, authenticated;
