import { REGISTERED_GAMES } from '../../shared/gameRegistry.js';
import { GameModuleDescriptor } from '../../shared/types.js';

export const GAME_REGISTRY: GameModuleDescriptor[] = REGISTERED_GAMES;

export function getRegisteredGames(): GameModuleDescriptor[] {
  return GAME_REGISTRY;
}
