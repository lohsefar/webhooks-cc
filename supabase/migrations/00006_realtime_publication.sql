do $$
begin
  alter publication supabase_realtime add table public.users;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.endpoints;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.requests;
exception
  when duplicate_object then null;
end
$$;
