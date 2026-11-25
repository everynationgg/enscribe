import { ChangeItModifierType } from './types.js';

export interface ChangeItModifierDefinition {
  type: ChangeItModifierType;
  name: string;
  shortLabel: string;
  description: string;
  targetKind: 'self' | 'opponent';
  durationMs: number | null;
  charges: number | null;
  cooldownMs: number;
  accentColor: string;
}

export const MODIFIER_CATALOG: Record<ChangeItModifierType, ChangeItModifierDefinition> = {
  letter_lock: {
    type: 'letter_lock',
    name: 'Letter Lock',
    shortLabel: 'Lock',
    description: 'Locks 1 safe letter position for 12s while keeping a valid path.',
    targetKind: 'opponent',
    durationMs: 12000,
    charges: null,
    cooldownMs: 10000,
    accentColor: '#f59e0b',
  },
  double_shift: {
    type: 'double_shift',
    name: 'Double Shift',
    shortLabel: '2x Shift',
    description: 'Allows changing up to 2 letters in a single valid word transformation.',
    targetKind: 'self',
    durationMs: 20000,
    charges: 1,
    cooldownMs: 14000,
    accentColor: '#22d3ee',
  },
  frozen_letter: {
    type: 'frozen_letter',
    name: 'Frozen Letter',
    shortLabel: 'Freeze',
    description: 'Freezes a safe letter slot on an opponent for 10s without softlocking.',
    targetKind: 'opponent',
    durationMs: 10000,
    charges: null,
    cooldownMs: 12000,
    accentColor: '#38bdf8',
  },
  pathfinder: {
    type: 'pathfinder',
    name: 'Pathfinder',
    shortLabel: 'Path',
    description: 'Reveals 1 valid next word along an optimal path from your current state.',
    targetKind: 'self',
    durationMs: null,
    charges: 1,
    cooldownMs: 12000,
    accentColor: '#10b981',
  },
  reroute: {
    type: 'reroute',
    name: 'Reroute',
    shortLabel: 'Reroute',
    description: 'Switches target to an equivalent-distance reachable word.',
    targetKind: 'opponent',
    durationMs: null,
    charges: 1,
    cooldownMs: 16000,
    accentColor: '#c084fc',
  },
};

export const SABOTAGE_BALANCE_CONFIG = {
  movesPerCharge: 2,
  maxHeldModifiers: 2,
  maxActiveDisruptionsPerTarget: 1,
  disruptionImmunityAfterExpireMs: 5000,
  survivalBonusSeconds: 15,
  survivalMaxRemainingSeconds: 90,
  survivalInitialSeconds: 60,
};

export const SABOTAGE_MODIFIER_POOL: ChangeItModifierType[] = [
  'double_shift',
  'pathfinder',
  'frozen_letter',
  'letter_lock',
  'reroute',
];
