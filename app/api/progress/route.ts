import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseUserClient } from '@/lib/supabaseServer';

const TABLE_NAME = 'user_game_progress';

function toProgressErrorResponse(errorMessage: string) {
  if (errorMessage.includes(`Could not find the table 'public.${TABLE_NAME}'`)) {
    return NextResponse.json(
      {
        error: `Supabase table public.${TABLE_NAME} is missing. Run supabase/game_progress.sql in your Supabase SQL editor, then try again.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: errorMessage }, { status: 500 });
}

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!accessToken) {
    return { error: NextResponse.json({ error: 'Missing access token.' }, { status: 401 }) };
  }

  try {
    const supabase = getSupabaseUserClient(accessToken);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { error: NextResponse.json({ error: 'Invalid session.' }, { status: 401 }) };
    }

    return { user: data.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.';
    return { error: NextResponse.json({ error: message }, { status: 500 }) };
  }
}

export async function GET(request: Request) {
  const authResult = await getAuthenticatedUser(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('progress_json, synced_at')
      .eq('user_id', authResult.user.id)
      .maybeSingle();

    if (error) {
      return toProgressErrorResponse(error.message);
    }

    return NextResponse.json({
      progress: data?.progress_json ?? null,
      syncedAt: data?.synced_at ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load progress.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authResult = await getAuthenticatedUser(request);
  if (authResult.error) {
    return authResult.error;
  }

  const body = await request.json().catch(() => null);
  const progress = typeof body?.progress === 'string' ? body.progress : null;

  if (!progress) {
    return NextResponse.json({ error: 'Missing progress payload.' }, { status: 400 });
  }

  try {
    const progressJson = JSON.parse(progress);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(
        {
          user_id: authResult.user.id,
          progress_json: progressJson,
          synced_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      )
      .select('synced_at')
      .single();

    if (error) {
      return toProgressErrorResponse(error.message);
    }

    return NextResponse.json({ syncedAt: data.synced_at });
  } catch {
    return NextResponse.json({ error: 'Progress payload must be valid JSON.' }, { status: 400 });
  }
}
