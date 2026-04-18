import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseUserClient } from '@/lib/supabaseServer';

const TABLE_NAME = 'game_reports';
const REPORT_TYPES = new Set(['Game not loading', 'Bug Report', 'DMCA', 'Other']);

function toReportErrorResponse(errorMessage: string) {
  if (errorMessage.includes(`Could not find the table 'public.${TABLE_NAME}'`)) {
    return NextResponse.json(
      {
        error: `Supabase table public.${TABLE_NAME} is missing. Run supabase/reports.sql in your Supabase SQL editor, then try again.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: errorMessage }, { status: 500 });
}

async function getOptionalAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!accessToken) {
    return { user: null };
  }

  try {
    const supabase = getSupabaseUserClient(accessToken);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { user: null };
    }

    return { user: data.user };
  } catch {
    return { user: null };
  }
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const gameName = typeof body?.gameName === 'string' ? body.gameName.trim() : '';
  const gameId = typeof body?.gameId === 'number' ? body.gameId : Number(body?.gameId);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (!REPORT_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid report type.' }, { status: 400 });
  }

  if (!gameName || !Number.isFinite(gameId)) {
    return NextResponse.json({ error: 'Missing game information.' }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
  }

  const { user } = await getOptionalAuthenticatedUser(request);
  const username =
    typeof user?.user_metadata?.username === 'string' && user.user_metadata.username.trim()
      ? user.user_metadata.username.trim()
      : null;
  const ipAddress = getRequestIp(request);

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from(TABLE_NAME).insert({
      report_type: type,
      game_id: gameId,
      game_name: gameName,
      description,
      reporter_user_id: user?.id ?? null,
      reporter_email: user?.email ?? null,
      reporter_username: username,
      reporter_ip: ipAddress,
      has_account: Boolean(user),
      created_at: new Date().toISOString(),
    });

    if (error) {
      return toReportErrorResponse(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not submit report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
