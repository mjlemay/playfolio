import { NextResponse } from 'next/server';

/**
 * NextResponse.json with `cache-control: no-store`.
 * Session-scoped endpoints must never be cached by a proxy or the browser —
 * one player's payload handed to the next would be a data leak.
 * An explicit `headers` entry in `init` still wins.
 */
export function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init?.headers ?? {}) },
  });
}
