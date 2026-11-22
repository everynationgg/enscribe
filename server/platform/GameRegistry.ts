import { GameModuleDescriptor } from '../../shared/types.js';

export const GAME_REGISTRY: GameModuleDescriptor[] = [
  {
    id: 'chain_clash',
    name: 'Chain Clash',
    tagline: 'Race to solve connected word chains against rivals.',
    supportedModes: ['classic', 'speed_race', 'solo', 'ranked'],
    minPlayers: 1,
    maxPlayers: 6,
  },
];

export function getRegisteredGames(): GameModuleDescriptor[] {
  return GAME_REGISTRY;
}
