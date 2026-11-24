import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from './api';

export type ShareableGameId = 'chainit' | 'gridit' | 'guessit' | 'twistit';

export interface PendingRoomInvite {
  game: ShareableGameId;
  code: string;
}

export const GAME_DISPLAY_NAMES: Record<ShareableGameId, string> = {
  chainit: 'ChainIt',
  gridit: 'GridIt',
  guessit: 'GuessIt',
  twistit: 'TwistIt',
};

export function getShareOrigin(): string {
  const configured = ((import.meta as any).env?.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  if (
    !Capacitor.isNativePlatform() &&
    typeof window !== 'undefined' &&
    /^https?:\/\//i.test(window.location.origin)
  ) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return (API_BASE_URL || 'https://enscribe-game.fly.dev').replace(/\/+$/, '');
}

export function buildRoomShareUrl(game: ShareableGameId, code: string): string {
  const cleanCode = code.trim().toUpperCase();
  return `${getShareOrigin()}/?game=${encodeURIComponent(game)}&code=${encodeURIComponent(cleanCode)}`;
}

export function parseRoomInviteFromUrl(search?: string): PendingRoomInvite | null {
  try {
    const rawSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    if (!rawSearch) return null;
    const params = new URLSearchParams(rawSearch);
    const rawGame = (params.get('game') || '').trim().toLowerCase();
    const rawCode = (params.get('code') || '').trim().toUpperCase();
    if (!rawCode) return null;

    let game: ShareableGameId | null = null;
    if (rawGame === 'chainit' || rawGame === 'chain_clash') {
      game = 'chainit';
    } else if (rawGame === 'gridit') {
      game = 'gridit';
    } else if (rawGame === 'guessit') {
      game = 'guessit';
    } else if (rawGame === 'twistit') {
      game = 'twistit';
    }
    if (!game) return null;

    return { game, code: rawCode };
  } catch {
    return null;
  }
}

export function clearRoomInviteFromUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('game') && !url.searchParams.has('code')) return;
    url.searchParams.delete('game');
    url.searchParams.delete('code');
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(null, '', nextUrl);
  } catch {
    // ignore URL cleanup failures
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
