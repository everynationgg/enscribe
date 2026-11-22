import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Clock,
  Eye,
  Globe,
  Layers,
  Lightbulb,
  Link2,
  Lock,
  Pencil,
  Type,
  Users,
} from 'lucide-react';
import { PuzzleSource, RoomRules } from '../../shared/types';
import { FantasyPageHeader } from '../components/FantasyPageHeader';
import {
  GearBadgeIcon,
  GoldCrownIcon,
  HouseRoomIcon,
  PuzzleBadgeIcon,
} from '../components/GameIcons';
import { GameSettingRow } from '../components/GameSettingRow';
import { GradientButton } from '../components/GradientButton';

interface CreateRoomScreenProps {
  onBack: () => void;
  onCancel: () => void;
  onCreateRoom: (params: {
    name: string;
    isPublic: boolean;
    rules: Partial<RoomRules>;
  }) => Promise<void>;
}

type RoomTypeKey = 'classic' | 'speed_race' | 'custom';
type RoomThemeKey = 'arch' | 'crystals' | 'castle' | 'island';

const THEME_SEQUENCE: RoomThemeKey[] = ['arch', 'crystals', 'castle', 'island'];
const PLAYER_STEPS = [2, 3, 4, 6];
const CHAIN_STEPS = [4, 5, 6, 8];
const TIMER_STEPS = [0, 15, 20, 30, 45, 60];

export const CreateRoomScreen: React.FC<CreateRoomScreenProps> = ({
  onBack,
  onCancel,
  onCreateRoom,
}) => {
  const [roomName, setRoomName] = useState('Word Chain Hangout');
  const [themeKey, setThemeKey] = useState<RoomThemeKey>('arch');
  const [roomType, setRoomType] = useState<RoomTypeKey>('classic');
  const [isPublic, setIsPublic] = useState(true);

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [chainLength, setChainLength] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [puzzleSource, setPuzzleSource] = useState<PuzzleSource>('saved_templates');
  const [wordLengthVisible, setWordLengthVisible] = useState(true);
  const [autoHintEnabled, setAutoHintEnabled] = useState(true);
  const [fullChainVisible, setFullChainVisible] = useState(true);

  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const cycleTheme = () => {
    const nextIdx = (THEME_SEQUENCE.indexOf(themeKey) + 1) % THEME_SEQUENCE.length;
    setThemeKey(THEME_SEQUENCE[nextIdx]);
  };

  const selectRoomType = (next: RoomTypeKey) => {
    setRoomType(next);
    if (next === 'speed_race') {
      setPuzzleSource('curated_db');
    } else if (next === 'custom') {
      setPuzzleSource('custom_create');
    } else {
      setPuzzleSource('saved_templates');
    }
  };

  const playerIdx = PLAYER_STEPS.indexOf(maxPlayers);
  const chainIdx = CHAIN_STEPS.indexOf(chainLength);
  const timerIdx = TIMER_STEPS.indexOf(timerSeconds);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const cleanName = roomName.trim().slice(0, 36);
    if (cleanName.length < 2) {
      setNameError('Enter a room name with at least 2 characters.');
      return;
    }
    setNameError(null);
    setCreating(true);
    try {
      await onCreateRoom({
        name: cleanName,
        isPublic,
        rules: {
          mode: roomType === 'speed_race' ? 'speed_race' : 'classic',
          maxPlayers,
          chainLength,
          timerEnabled: timerSeconds > 0,
          timePerWordSeconds: timerSeconds > 0 ? timerSeconds : 30,
          puzzleSource,
          wordLengthVisible,
          autoRevealAfterAttempts: autoHintEnabled ? 2 : 0,
          autoRevealAfterFailedTurns: autoHintEnabled ? 2 : 0,
          chainVisibility: fullChainVisible ? 'full_chain' : 'progressive',
          difficultyPreset:
            roomType === 'speed_race'
              ? 'competitive'
              : roomType === 'custom'
                ? 'custom'
                : 'casual',
          theme: themeKey,
        },
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <form className="ens-fantasy-page ens-subpage-shell" onSubmit={handleSubmit}>
      <div className="ens-sky-sparkles" aria-hidden="true" />

      <FantasyPageHeader
        title="Create Room"
        subtitle="Set up your own game room and invite others to play!"
        icon={<HouseRoomIcon size={30} color="#FFFFFF" />}
        backdropSrc="/art/header-fantasy.png"
        onBack={onBack}
      />

      <div className="ens-subpage-scroll">
        <div className="ens-subpage-inner">
          <div className="ens-create-panel">
            {/* Room Identity: Thumbnail + Name */}
            <div className="ens-create-identity">
              <button
                type="button"
                className="ens-create-thumb-btn"
                onClick={cycleTheme}
                aria-label="Change room artwork thumbnail"
                title="Tap to switch room backdrop art"
              >
                <img
                  src={`/art/room-${themeKey}.png`}
                  alt="Room artwork"
                  className="ens-create-thumb-img"
                />
                <span className="ens-thumb-edit-badge">
                  <Pencil size={12} strokeWidth={2.6} />
                </span>
              </button>

              <div className="ens-create-name-col">
                <label htmlFor="ens-create-room-name" className="ens-create-field-label">
                  Room Name
                </label>
                <div className="ens-create-name-input-wrap">
                  <input
                    id="ens-create-room-name"
                    type="text"
                    value={roomName}
                    onChange={(e) => {
                      setRoomName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    maxLength={36}
                    placeholder="Word Chain Hangout"
                    className="ens-create-name-input"
                  />
                  <Pencil size={15} className="ens-create-name-pencil" aria-hidden="true" />
                </div>
                {nameError && <div className="ens-create-error">{nameError}</div>}
              </div>
            </div>

            {/* Room Type Segmented Pills */}
            <div className="ens-create-section">
              <div className="ens-create-field-label">Room Type</div>
              <div className="ens-create-pill-grid">
                <button
                  type="button"
                  className={`ens-choice-pill ${roomType === 'classic' ? 'is-selected' : ''}`}
                  onClick={() => selectRoomType('classic')}
                >
                  <GoldCrownIcon size={16} />
                  <span>Classic</span>
                </button>
                <button
                  type="button"
                  className={`ens-choice-pill ${roomType === 'speed_race' ? 'is-selected' : ''}`}
                  onClick={() => selectRoomType('speed_race')}
                >
                  <PuzzleBadgeIcon size={16} />
                  <span>Speed</span>
                </button>
                <button
                  type="button"
                  className={`ens-choice-pill ${roomType === 'custom' ? 'is-selected' : ''}`}
                  onClick={() => selectRoomType('custom')}
                >
                  <GearBadgeIcon size={16} />
                  <span>Custom</span>
                </button>
              </div>
            </div>

            {/* Visibility Segmented Pills */}
            <div className="ens-create-section">
              <div className="ens-create-field-label">Visibility</div>
              <div className="ens-create-pill-grid">
                <button
                  type="button"
                  className={`ens-choice-pill is-tall ${isPublic ? 'is-selected' : ''}`}
                  onClick={() => setIsPublic(true)}
                >
                  <Globe size={16} strokeWidth={2.3} />
                  <span className="ens-choice-stack">
                    <span>Public</span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled
                  className="ens-choice-pill is-tall is-disabled"
                  title="Unlisted link-only rooms are not yet supported by the server"
                >
                  <Link2 size={15} strokeWidth={2.3} />
                  <span className="ens-choice-stack">
                    <span>Unlisted</span>
                    <small>Coming soon</small>
                  </span>
                </button>

                <button
                  type="button"
                  className={`ens-choice-pill is-tall ${!isPublic ? 'is-selected' : ''}`}
                  onClick={() => setIsPublic(false)}
                >
                  <Lock size={15} strokeWidth={2.3} />
                  <span className="ens-choice-stack">
                    <span>Private</span>
                    <small>Code only</small>
                  </span>
                </button>
              </div>
            </div>

            {/* Game Settings Card */}
            <div className="ens-settings-card">
              <div className="ens-settings-header">Game Settings</div>
              <div className="ens-settings-list">
                <GameSettingRow
                  icon={<Users size={17} />}
                  label="Max Players"
                  control={{
                    type: 'stepper',
                    valueLabel: String(maxPlayers),
                    canDecrement: playerIdx > 0,
                    canIncrement: playerIdx < PLAYER_STEPS.length - 1,
                    onDecrement: () => setMaxPlayers(PLAYER_STEPS[Math.max(0, playerIdx - 1)]),
                    onIncrement: () =>
                      setMaxPlayers(PLAYER_STEPS[Math.min(PLAYER_STEPS.length - 1, playerIdx + 1)]),
                  }}
                />

                <GameSettingRow
                  icon={<Layers size={17} />}
                  label="Chain Words"
                  control={{
                    type: 'stepper',
                    valueLabel: String(chainLength),
                    canDecrement: chainIdx > 0,
                    canIncrement: chainIdx < CHAIN_STEPS.length - 1,
                    onDecrement: () => setChainLength(CHAIN_STEPS[Math.max(0, chainIdx - 1)]),
                    onIncrement: () =>
                      setChainLength(CHAIN_STEPS[Math.min(CHAIN_STEPS.length - 1, chainIdx + 1)]),
                  }}
                />

                <GameSettingRow
                  icon={<Clock size={17} />}
                  label="Turn Time"
                  control={{
                    type: 'stepper',
                    valueLabel: timerSeconds === 0 ? 'Off' : `${timerSeconds} sec`,
                    canDecrement: timerIdx > 0,
                    canIncrement: timerIdx < TIMER_STEPS.length - 1,
                    onDecrement: () => setTimerSeconds(TIMER_STEPS[Math.max(0, timerIdx - 1)]),
                    onIncrement: () =>
                      setTimerSeconds(TIMER_STEPS[Math.min(TIMER_STEPS.length - 1, timerIdx + 1)]),
                  }}
                />

                <GameSettingRow
                  icon={<BookOpen size={17} />}
                  label="Puzzle Source"
                  control={{
                    type: 'select',
                    value: puzzleSource,
                    options: [
                      { value: 'saved_templates', label: 'Saved Templates' },
                      { value: 'curated_db', label: 'Curated Chains' },
                      { value: 'custom_create', label: 'Custom Chain' },
                    ],
                    onChange: (val) => setPuzzleSource(val as PuzzleSource),
                  }}
                />

                <GameSettingRow
                  icon={<Type size={17} />}
                  label="Show Word Lengths"
                  control={{
                    type: 'toggle',
                    checked: wordLengthVisible,
                    onChange: setWordLengthVisible,
                  }}
                />

                <GameSettingRow
                  icon={<Lightbulb size={17} />}
                  label="Auto-Hint Letters"
                  control={{
                    type: 'toggle',
                    checked: autoHintEnabled,
                    onChange: setAutoHintEnabled,
                  }}
                />

                <GameSettingRow
                  icon={<Eye size={17} />}
                  label="Full Chain Visible"
                  control={{
                    type: 'toggle',
                    checked: fullChainVisible,
                    onChange: setFullChainVisible,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Capsule Bar */}
      <div className="ens-sticky-cta-bar is-dual">
        <GradientButton variant="lavender" size="lg" onClick={onCancel}>
          Cancel
        </GradientButton>

        <GradientButton
          type="submit"
          variant="purple"
          size="lg"
          loading={creating}
          leftIcon={<Check size={19} strokeWidth={3} />}
        >
          {creating ? 'Creating...' : 'Create Room'}
        </GradientButton>
      </div>
    </form>
  );
};
