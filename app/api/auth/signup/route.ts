import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getCodeValidationMessage,
  getUsernameValidationMessage,
  normalizeUsername,
  usernameToEmail,
} from '@/lib/supabaseAuth';

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase server credentials are missing.' },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const username = normalizeUsername(typeof body?.username === 'string' ? body.username : '');
  const code = typeof body?.code === 'string' ? body.code : '';

  const usernameError = getUsernameValidationMessage(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const codeError = getCodeValidationMessage(code);
  if (codeError) {
    return NextResponse.json({ error: codeError }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = usernameToEmail(username);

  const { data: createdUserData, error } = await supabase.auth.admin.createUser({
    email,
    password: code,
    email_confirm: true,
    user_metadata: {
      username,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes('already') || message.includes('exists') ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (!createdUserData?.user) {
    return NextResponse.json(
      { error: 'Account was created, but the profile record could not be initialized.' },
      { status: 500 },
    );
  }

  const { error: profileError } = await supabase.from('user_profiles').upsert({
    user_id: createdUserData.user.id,
    username,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
