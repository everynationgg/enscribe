import { WordDefinitionMeaning, WordDefinitionResult } from '../../../shared/gridit/types';

export interface LoadedDictionary {
  language: string;
  words: Set<string>;
  prefixes: Set<string>;
  isFallback: boolean;
}

const FALLBACK_CORE_WORDS = [
  'ABLE', 'ACHE', 'ACORN', 'ACT', 'AGE', 'AIR', 'ALE', 'ALL', 'ALLY', 'AND', 'ANT',
  'ANY', 'APE', 'APEX', 'ARC', 'ARCH', 'AREA', 'ARE', 'ARM', 'ART', 'ASH', 'ASK',
  'ATE', 'AWE', 'AXE', 'BAD', 'BAG', 'BAKE', 'BALL', 'BAND', 'BANK', 'BARE', 'BARK',
  'BARN', 'BASE', 'BAT', 'BAY', 'BEAD', 'BEAM', 'BEAN', 'BEAR', 'BEAT', 'BED', 'BEE',
  'BEEN', 'BELL', 'BELT', 'BEND', 'BEST', 'BET', 'BID', 'BIG', 'BIKE', 'BIRD', 'BIT',
  'BITE', 'BLUE', 'BOAT', 'BODY', 'BOLD', 'BOLT', 'BOND', 'BONE', 'BOOK', 'BOOM', 'BOOT',
  'BORE', 'BORN', 'BOSS', 'BOTH', 'BOW', 'BOX', 'BOY', 'BRAIN', 'BRAVE', 'BREAD', 'BREAK',
  'BRICK', 'BRIGHT', 'BRING', 'BROAD', 'BROKE', 'BROWN', 'BRUSH', 'BUILD', 'BURN', 'BUS',
  'BUSH', 'BUSY', 'BUT', 'BUY', 'CAKE', 'CALL', 'CALM', 'CAME', 'CAMP', 'CAN', 'CAP',
  'CAPE', 'CAR', 'CARD', 'CARE', 'CART', 'CASE', 'CAST', 'CAT', 'CATCH', 'CAUSE', 'CAVE',
  'CHAIN', 'CHAIR', 'CHARM', 'CHASE', 'CHEAT', 'CHECK', 'CHEST', 'CHIEF', 'CHILD', 'CHILL',
  'CHIME', 'CHIP', 'CHOSE', 'CITY', 'CLAIM', 'CLAP', 'CLASH', 'CLASS', 'CLAW', 'CLAY',
  'CLEAN', 'CLEAR', 'CLIMB', 'CLIP', 'CLOCK', 'CLOSE', 'CLOUD', 'CLUB', 'CLUE', 'COAL',
  'COAST', 'COAT', 'CODE', 'COIN', 'COLD', 'COME', 'CONE', 'COOK', 'COOL', 'COPE', 'COPY',
  'CORD', 'CORE', 'CORN', 'COST', 'COULD', 'COUNT', 'COURT', 'COVER', 'CRAB', 'CRAFT',
  'CRANE', 'CRASH', 'CREAM', 'CREEK', 'CREST', 'CREW', 'CRISP', 'CROP', 'CROSS', 'CROWD',
  'CROWN', 'CRY', 'CUP', 'CURE', 'CURL', 'CUTE', 'CYCLE', 'DAILY', 'DANCE', 'DARE', 'DARK',
  'DART', 'DASH', 'DATA', 'DATE', 'DAWN', 'DAY', 'DEAD', 'DEAL', 'DEAR', 'DECK', 'DEEP',
  'DEER', 'DENSE', 'DESK', 'DIAL', 'DICE', 'DID', 'DIG', 'DIM', 'DINE', 'DIP', 'DIRT',
  'DISH', 'DIVE', 'DOCK', 'DOES', 'DOG', 'DOLL', 'DOME', 'DONE', 'DOOR', 'DOSE', 'DOT',
  'DOWN', 'DRAG', 'DRAIN', 'DRAMA', 'DRANK', 'DRAW', 'DREAM', 'DRESS', 'DRIED', 'DRIFT',
  'DRILL', 'DRINK', 'DRIVE', 'DROP', 'DROVE', 'DRUM', 'DRY', 'DUCK', 'DUE', 'DULL', 'DUMB',
  'DUNE', 'DUSK', 'DUST', 'DUTY', 'EACH', 'EAGER', 'EAR', 'EARLY', 'EARN', 'EARTH', 'EASE',
  'EAST', 'EASY', 'EAT', 'ECHO', 'EDGE', 'EDIT', 'EGG', 'EIGHT', 'ELSE', 'EMBER', 'END',
  'ENJOY', 'ENTER', 'EQUAL', 'ERROR', 'EVEN', 'EVENT', 'EVER', 'EVERY', 'EXACT', 'EXTRA',
  'EYE', 'FACE', 'FACT', 'FADE', 'FAIL', 'FAIR', 'FAITH', 'FALL', 'FALSE', 'FAME', 'FAN',
  'FANCY', 'FAR', 'FARM', 'FAST', 'FAT', 'FATE', 'FAULT', 'FAVOR', 'FEAR', 'FEAST', 'FED',
  'FEED', 'FEEL', 'FEET', 'FELL', 'FELT', 'FENCE', 'FERN', 'FEW', 'FIBER', 'FIELD', 'FIG',
  'FIGHT', 'FILE', 'FILL', 'FILM', 'FINAL', 'FIND', 'FINE', 'FIRE', 'FIRM', 'FIRST', 'FISH',
  'FIST', 'FIT', 'FIVE', 'FIX', 'FLAG', 'FLAME', 'FLASH', 'FLAT', 'FLAW', 'FLEE', 'FLEET',
  'FLESH', 'FLEW', 'FLEX', 'FLIGHT', 'FLIP', 'FLOAT', 'FLOCK', 'FLOOD', 'FLOOR', 'FLOUR',
  'FLOW', 'FLOWER', 'FLY', 'FOAM', 'FOCUS', 'FOG', 'FOLD', 'FOLK', 'FOND', 'FOOD', 'FOOL',
  'FOOT', 'FOR', 'FORCE', 'FORD', 'FORE', 'FORK', 'FORM', 'FORT', 'FORTH', 'FOUND', 'FOUR',
  'FOX', 'FRAME', 'FRANK', 'FREE', 'FRESH', 'FRIED', 'FRIEND', 'FROG', 'FROM', 'FRONT',
  'FROST', 'FRUIT', 'FRY', 'FUEL', 'FULL', 'FUN', 'FUND', 'FUNNY', 'FUR', 'FUSE', 'GAIN',
  'GALA', 'GALE', 'GAME', 'GAP', 'GARDEN', 'GAS', 'GATE', 'GATHER', 'GAUGE', 'GAZE', 'GEAR',
  'GEM', 'GENT', 'GET', 'GHOST', 'GIANT', 'GIFT', 'GIRL', 'GIVE', 'GLAD', 'GLARE', 'GLASS',
  'GLEAM', 'GLIDE', 'GLINT', 'GLOBE', 'GLOOM', 'GLORY', 'GLOVE', 'GLOW', 'GLUE', 'GOAL',
  'GOAT', 'GOLD', 'GOLF', 'GONE', 'GOOD', 'GOOSE', 'GRAB', 'GRACE', 'GRADE', 'GRAIN',
  'GRAND', 'GRANT', 'GRAPE', 'GRAPH', 'GRASP', 'GRASS', 'GRAVE', 'GRAY', 'GREAT', 'GREEN',
  'GREET', 'GREW', 'GRID', 'GRIEF', 'GRILL', 'GRIN', 'GRIND', 'GRIP', 'GROAN', 'GROOM',
  'GROUP', 'GROVE', 'GROW', 'GROWN', 'GUARD', 'GUESS', 'GUEST', 'GUIDE', 'GUILT', 'GULF',
  'GUM', 'GUN', 'GUST', 'GUY', 'GYM', 'HABIT', 'HAD', 'HAIL', 'HAIR', 'HALF', 'HALL',
  'HALT', 'HAM', 'HAND', 'HANG', 'HAPPY', 'HARD', 'HARE', 'HARM', 'HARP', 'HARSH', 'HAS',
  'HASTE', 'HAT', 'HATCH', 'HATE', 'HAVE', 'HAWK', 'HAY', 'HAZE', 'HEAD', 'HEAL', 'HEAP',
  'HEAR', 'HEART', 'HEAT', 'HEAVE', 'HEAVY', 'HEDGE', 'HEED', 'HEEL', 'HEIR', 'HELD',
  'HELLO', 'HELM', 'HELP', 'HEM', 'HEN', 'HER', 'HERB', 'HERD', 'HERE', 'HERO', 'HIDE',
  'HIGH', 'HIKE', 'HILL', 'HILT', 'HIM', 'HIND', 'HINT', 'HIP', 'HIRE', 'HIS', 'HIT',
  'HIVE', 'HOARD', 'HOBBY', 'HOLD', 'HOLE', 'HOLLOW', 'HOME', 'HONEY', 'HOOD', 'HOOK',
  'HOOP', 'HOOT', 'HOP', 'HOPE', 'HORN', 'HORSE', 'HOSE', 'HOST', 'HOT', 'HOTEL', 'HOUND',
  'HOUR', 'HOUSE', 'HOVER', 'HOW', 'HOWL', 'HUB', 'HUE', 'HUG', 'HUGE', 'HULL', 'HUM',
  'HUMAN', 'HUMID', 'HUMOR', 'HUMP', 'HUNG', 'HUNT', 'HURL', 'HURRY', 'HURT', 'HUSH',
  'HUT', 'HYMN', 'ICE', 'ICON', 'IDEA', 'IDEAL', 'IDLE', 'IDOL', 'ILL', 'IMAGE', 'INCH',
  'INDEX', 'INK', 'INN', 'INNER', 'INPUT', 'INTO', 'ION', 'IRON', 'ISLE', 'ISSUE', 'ITEM',
  'IVORY', 'JACK', 'JADE', 'JAIL', 'JAM', 'JAR', 'JAW', 'JAY', 'JAZZ', 'JEAN', 'JEEP',
  'JELLY', 'JERK', 'JEST', 'JET', 'JEWEL', 'JIG', 'JOB', 'JOG', 'JOIN', 'JOINT', 'JOKE',
  'JOLLY', 'JOLT', 'JOY', 'JUDGE', 'JUICE', 'JUMP', 'JUNE', 'JUNK', 'JURY', 'JUST',
  'KEEN', 'KEEP', 'KELP', 'KEPT', 'KEY', 'KICK', 'KID', 'KILL', 'KIN', 'KIND', 'KING',
  'KISS', 'KIT', 'KITE', 'KNEE', 'KNEW', 'KNIFE', 'KNIT', 'KNOB', 'KNOCK', 'KNOT', 'KNOW',
  'KNOWN', 'LAB', 'LACE', 'LACK', 'LAD', 'LADEN', 'LADY', 'LAG', 'LAID', 'LAKE', 'LAMB',
  'LAME', 'LAMP', 'LAND', 'LANE', 'LAP', 'LARCH', 'LARGE', 'LARK', 'LASER', 'LASH', 'LAST',
  'LATE', 'LATER', 'LATHE', 'LAUGH', 'LAVA', 'LAW', 'LAWN', 'LAY', 'LAYER', 'LAZY', 'LEAD',
  'LEAF', 'LEAGUE', 'LEAK', 'LEAN', 'LEAP', 'LEARN', 'LEASE', 'LEAST', 'LEAVE', 'LED',
  'LEDGE', 'LEFT', 'LEG', 'LEGAL', 'LEMON', 'LEND', 'LENS', 'LENT', 'LESS', 'LET', 'LEVEL',
  'LEVER', 'LID', 'LIE', 'LIFE', 'LIFT', 'LIGHT', 'LIKE', 'LILAC', 'LILT', 'LILY', 'LIMB',
  'LIME', 'LIMIT', 'LIMP', 'LINE', 'LINEN', 'LINGO', 'LINK', 'LINT', 'LION', 'LIP', 'LIST',
  'LIT', 'LIVE', 'LIVER', 'LIVID', 'LOAD', 'LOAF', 'LOAN', 'LOB', 'LOBBY', 'LOCAL', 'LOCK',
  'LODGE', 'LOFT', 'LOG', 'LOGIC', 'LONE', 'LONG', 'LOOK', 'LOOM', 'LOOP', 'LOOSE', 'LOOT',
  'LORD', 'LORE', 'LOSE', 'LOSS', 'LOST', 'LOT', 'LOTUS', 'LOUD', 'LOVE', 'LOW', 'LOWER',
  'LOYAL', 'LUCK', 'LUCKY', 'LUG', 'LULL', 'LUMBER', 'LUMP', 'LUNAR', 'LUNCH', 'LUNG',
  'LURE', 'LURK', 'LUSH', 'LUST', 'LUTE', 'LYRIC', 'MADE', 'MAGIC', 'MAID', 'MAIL', 'MAIN',
  'MAJOR', 'MAKE', 'MAKER', 'MALE', 'MALL', 'MALT', 'MAN', 'MANE', 'MANGO', 'MANOR', 'MANY',
  'MAP', 'MAPLE', 'MAR', 'MARCH', 'MARE', 'MARK', 'MARSH', 'MASK', 'MASS', 'MAST', 'MASTER',
  'MAT', 'MATCH', 'MATE', 'MATH', 'MAUL', 'MAY', 'MAYOR', 'MAZE', 'MEAD', 'MEAL', 'MEAN',
  'MEANT', 'MEAT', 'MEDAL', 'MEDIA', 'MEEK', 'MEET', 'MELON', 'MELT', 'MEMO', 'MEN', 'MEND',
  'MENU', 'MERCY', 'MERE', 'MERGE', 'MERIT', 'MERRY', 'MESH', 'MESS', 'MET', 'METAL',
  'METER', 'MID', 'MIDST', 'MIGHT', 'MILD', 'MILE', 'MILK', 'MILL', 'MIME', 'MIND', 'MINE',
  'MINER', 'MINI', 'MINOR', 'MINT', 'MINUS', 'MIRTH', 'MIST', 'MITT', 'MIX', 'MOAN', 'MOAT',
  'MOB', 'MOCK', 'MODE', 'MODEL', 'MODEM', 'MOIST', 'MOLD', 'MOLE', 'MOLT', 'MOM', 'MONEY',
  'MONK', 'MONTH', 'MOOD', 'MOON', 'MOOR', 'MOP', 'MORAL', 'MORE', 'MORN', 'MOSS', 'MOST',
  'MOTH', 'MOTOR', 'MOTTO', 'MOUND', 'MOUNT', 'MOURN', 'MOUSE', 'MOUTH', 'MOVE', 'MOVIE',
  'MOW', 'MUCH', 'MUD', 'MUG', 'MULCH', 'MULE', 'MULL', 'MUMMY', 'MUNCH', 'MURAL', 'MURK',
  'MUSE', 'MUSH', 'MUSIC', 'MUSK', 'MUST', 'MUTE', 'MUTT', 'MYTH', 'NAB', 'NAG', 'NAIL',
  'NAME', 'NAP', 'NAPE', 'NARROW', 'NASAL', 'NASTY', 'NAVAL', 'NAVE', 'NAVY', 'NEAR', 'NEAT',
  'NECK', 'NEED', 'NEON', 'NERD', 'NERVE', 'NEST', 'NET', 'NEVER', 'NEW', 'NEWS', 'NEWT',
  'NEXT', 'NICE', 'NICHE', 'NICK', 'NIECE', 'NIGHT', 'NINE', 'NINTH', 'NIP', 'NITRO', 'NOBLE',
  'NOD', 'NODE', 'NOISE', 'NOISY', 'NOMAD', 'NONE', 'NOOK', 'NOON', 'NOR', 'NORM', 'NORTH',
  'NOSE', 'NOISY', 'NOT', 'NOTE', 'NOUN', 'NOVEL', 'NOW', 'NUDGE', 'NULL', 'NUMB', 'NURSE',
  'NUT', 'NYLON', 'OAK', 'OAR', 'OAT', 'OATH', 'OBEY', 'OBJECT', 'OCEAN', 'ODD', 'ODDS',
  'ODE', 'ODOR', 'OFF', 'OFFER', 'OFTEN', 'OIL', 'OILY', 'OINT', 'OKAY', 'OLD', 'OLIVE',
  'OMEGA', 'OMEN', 'OMIT', 'ONCE', 'ONE', 'ONION', 'ONLY', 'ONSET', 'ONTO', 'OOZE', 'OPAL',
  'OPEN', 'OPERA', 'OPT', 'OPTIC', 'ORBIT', 'ORCA', 'ORDER', 'ORE', 'ORGAN', 'OTHER', 'OTTER',
  'OUCH', 'OUGHT', 'OUNCE', 'OUR', 'OUT', 'OUTER', 'OVAL', 'OVEN', 'OVER', 'OWE', 'OWL',
  'OWN', 'OWNER', 'OXEN', 'OZONE', 'PACE', 'PACK', 'PACT', 'PAD', 'PADDLE', 'PAGE', 'PAID',
  'PAIL', 'PAIN', 'PAINT', 'PAIR', 'PAL', 'PALE', 'PALM', 'PAN', 'PANDA', 'PANE', 'PANEL',
  'PANG', 'PANIC', 'PANT', 'PAPER', 'PAR', 'PARCH', 'PARE', 'PARK', 'PART', 'PARTY', 'PASS',
  'PAST', 'PASTE', 'PAT', 'PATCH', 'PATH', 'PATIO', 'PAUSE', 'PAVE', 'PAW', 'PAWN', 'PAY',
  'PEA', 'PEACE', 'PEACH', 'PEAK', 'PEAR', 'PEARL', 'PEAT', 'PEBBLE', 'PECK', 'PEDAL',
  'PEEK', 'PEEL', 'PEEP', 'PEER', 'PEG', 'PELT', 'PEN', 'PENAL', 'PENCIL', 'PEND', 'PENNY',
  'PEP', 'PER', 'PERCH', 'PERIL', 'PERK', 'PERM', 'PEST', 'PET', 'PETAL', 'PETTY', 'PHASE',
  'PHONE', 'PHOTO', 'PIANO', 'PICK', 'PIE', 'PIECE', 'PIER', 'PIG', 'PIKE', 'PILE', 'PILL',
  'PILOT', 'PIN', 'PINCH', 'PINE', 'PING', 'PINK', 'PINT', 'PIOUS', 'PIPE', 'PIQUE', 'PIT',
  'PITCH', 'PITH', 'PITON', 'PIVOT', 'PIXEL', 'PIZZA', 'PLACE', 'PLAID', 'PLAIN', 'PLAIT',
  'PLAN', 'PLANE', 'PLANK', 'PLANT', 'PLATE', 'PLAY', 'PLAZA', 'PLEA', 'PLEAD', 'PLEAT',
  'PLEDGE', 'PLENT', 'PLIED', 'PLIGHT', 'PLOD', 'PLOP', 'PLOT', 'PLOW', 'PLOY', 'PLUCK',
  'PLUG', 'PLUM', 'PLUMB', 'PLUME', 'PLUMP', 'PLUNGE', 'PLUS', 'PLUSH', 'PLY', 'POACH',
  'POD', 'POEM', 'POET', 'POINT', 'POISE', 'POKE', 'POLE', 'POLL', 'POLO', 'POMP', 'POND',
  'PONDER', 'PONY', 'POOL', 'POOR', 'POP', 'POPE', 'PORCH', 'PORE', 'PORK', 'PORT', 'POSE',
  'POSH', 'POST', 'POSY', 'POT', 'POUCH', 'POUND', 'POUR', 'POUT', 'POW', 'POWER', 'PRANK',
  'PRAWN', 'PRAY', 'PREEN', 'PREP', 'PRESS', 'PREY', 'PRICE', 'PRICK', 'PRIDE', 'PRIED',
  'PRIME', 'PRINT', 'PRIOR', 'PRISM', 'PRIVY', 'PRIZE', 'PROBE', 'PROD', 'PROEM', 'PROM',
  'PRONE', 'PRONG', 'PROOF', 'PROP', 'PROSE', 'PROUD', 'PROVE', 'PROW', 'PROWL', 'PRUDE',
  'PRUNE', 'PRY', 'PUB', 'PUCK', 'PUDDLE', 'PUFF', 'PUG', 'PULL', 'PULP', 'PULSE', 'PUMP',
  'PUNCH', 'PUNK', 'PUNY', 'PUP', 'PUPIL', 'PUPPY', 'PURE', 'PURGE', 'PURR', 'PURSE', 'PUSH',
  'PUT', 'PUTT', 'PYRE', 'QUACK', 'QUAD', 'QUAIL', 'QUAKE', 'QUALM', 'QUART', 'QUASH',
  'QUAY', 'QUEEN', 'QUEER', 'QUELL', 'QUERY', 'QUEST', 'QUEUE', 'QUICK', 'QUIET', 'QUILL',
  'QUILT', 'QUIP', 'QUIRK', 'QUIT', 'QUITE', 'QUOTA', 'QUOTE', 'RACE', 'RACK', 'RADAR',
  'RADIO', 'RAFT', 'RAG', 'RAGE', 'RAID', 'RAIL', 'RAIN', 'RAISE', 'RAKE', 'RALLY', 'RAM',
  'RAMP', 'RAN', 'RANCH', 'RAND', 'RANGE', 'RANK', 'RANT', 'RAP', 'RAPID', 'RARE', 'RASH',
  'RASP', 'RAT', 'RATE', 'RATIO', 'RAVE', 'RAVEN', 'RAW', 'RAY', 'RAZOR', 'REACH', 'REACT',
  'READ', 'READY', 'REAL', 'REALM', 'REAM', 'REAP', 'REAR', 'REBEL', 'RECAP', 'RED', 'REED',
  'REEF', 'REEK', 'REEL', 'REFER', 'REGAL', 'REIGN', 'REIN', 'RELAX', 'RELAY', 'RELIC',
  'RELY', 'REM', 'REMIT', 'REND', 'RENEW', 'RENT', 'REPAY', 'REPEL', 'REPLY', 'RESET',
  'RESIN', 'REST', 'RETRO', 'RETRY', 'REUSE', 'REV', 'REVEL', 'RHYME', 'RIB', 'RICE', 'RICH',
  'RID', 'RIDE', 'RIDGE', 'RIFLE', 'RIFT', 'RIG', 'RIGHT', 'RIGID', 'RIM', 'RIME', 'RIND',
  'RING', 'RINSE', 'RIOT', 'RIP', 'RIPE', 'RIPEN', 'RISE', 'RISEN', 'RISK', 'RITE', 'RIVAL',
  'RIVER', 'ROAD', 'ROAM', 'ROAR', 'ROAST', 'ROB', 'ROBE', 'ROBIN', 'ROBOT', 'ROCK', 'ROCKY',
  'ROD', 'RODE', 'ROGUE', 'ROLE', 'ROLL', 'ROMAN', 'ROMP', 'ROOF', 'ROOK', 'ROOM', 'ROOST',
  'ROOT', 'ROPE', 'ROSE', 'ROSY', 'ROT', 'ROTE', 'ROTOR', 'ROUGE', 'ROUGH', 'ROUND', 'ROUSE',
  'ROUTE', 'ROVE', 'ROW', 'ROYAL', 'RUB', 'RUBY', 'RUDDY', 'RUDE', 'RUE', 'RUG', 'RUIN',
  'RULE', 'RUM', 'RUMEN', 'RUMP', 'RUN', 'RUNE', 'RUNG', 'RUNIC', 'RUNT', 'RURAL', 'RUSE',
  'RUSH', 'RUST', 'RUSTY', 'RUT', 'SACK', 'SAD', 'SADDLE', 'SAFE', 'SAGA', 'SAGE', 'SAID',
  'SAIL', 'SAINT', 'SAKE', 'SALAD', 'SALE', 'SALON', 'SALSA', 'SALT', 'SALTY', 'SALVE',
  'SAME', 'SAND', 'SANDY', 'SANE', 'SANG', 'SANK', 'SAP', 'SASH', 'SAT', 'SATIN', 'SATYR',
  'SAUCE', 'SAUNA', 'SAVE', 'SAVOR', 'SAW', 'SAY', 'SCAB', 'SCALD', 'SCALE', 'SCALP', 'SCAM',
  'SCAN', 'SCANT', 'SCAR', 'SCARE', 'SCARF', 'SCARY', 'SCENE', 'SCENT', 'SCHOOL', 'SCOFF',
  'SCOLD', 'SCOOP', 'SCOPE', 'SCORE', 'SCORN', 'SCOUT', 'SCOWL', 'SCRAM', 'SCRAP', 'SCREW',
  'SCRIM', 'SCRIP', 'SCRUB', 'SEA', 'SEAL', 'SEAM', 'SEAR', 'SEARCH', 'SEAT', 'SECT', 'SEC',
  'SEE', 'SEED', 'SEEK', 'SEEM', 'SEEN', 'SEEP', 'SELF', 'SELL', 'SEND', 'SENSE', 'SENT',
  'SEPAL', 'SERF', 'SERIF', 'SERUM', 'SERVE', 'SET', 'SEVEN', 'SEVER', 'SEW', 'SHACK',
  'SHADE', 'SHADY', 'SHAFT', 'SHAKE', 'SHAKY', 'SHALE', 'SHALL', 'SHALT', 'SHAME', 'SHANK',
  'SHAPE', 'SHARD', 'SHARE', 'SHARK', 'SHARP', 'SHAVE', 'SHAWL', 'SHE', 'SHEAF', 'SHEAR',
  'SHED', 'SHEEN', 'SHEEP', 'SHEER', 'SHEET', 'SHEIK', 'SHELF', 'SHELL', 'SHIFT', 'SHIN',
  'SHINE', 'SHINY', 'SHIP', 'SHIRE', 'SHIRK', 'SHIRT', 'SHOAL', 'SHOCK', 'SHOE', 'SHONE',
  'SHOOK', 'SHOOT', 'SHOP', 'SHORE', 'SHORN', 'SHORT', 'SHOT', 'SHOUT', 'SHOVE', 'SHOW',
  'SHOWN', 'SHOWY', 'SHRED', 'SHREW', 'SHRUB', 'SHRUG', 'SHUCK', 'SHUN', 'SHUNT', 'SHUT',
  'SHY', 'SICK', 'SIDE', 'SIEGE', 'SIEVE', 'SIFT', 'SIGH', 'SIGHT', 'SIGN', 'SILK', 'SILKY',
  'SILL', 'SILLY', 'SILO', 'SILT', 'SILVER', 'SIMON', 'SIN', 'SINCE', 'SINEW', 'SING',
  'SINGE', 'SINK', 'SIP', 'SIR', 'SIRE', 'SIREN', 'SIT', 'SITE', 'SIX', 'SIXTH', 'SIXTY',
  'SIZE', 'SKATE', 'SKEET', 'SKEIN', 'SKETCH', 'SKEW', 'SKI', 'SKID', 'SKIFF', 'SKILL',
  'SKIM', 'SKIMP', 'SKIN', 'SKIP', 'SKIRT', 'SKIT', 'SKULK', 'SKULL', 'SKUNK', 'SKY',
  'SLAB', 'SLACK', 'SLAG', 'SLAIN', 'SLAM', 'SLANG', 'SLANT', 'SLAP', 'SLASH', 'SLATE',
  'SLAVE', 'SLAY', 'SLED', 'SLEEK', 'SLEEP', 'SLEET', 'SLEPT', 'SLICE', 'SLICK', 'SLID',
  'SLIDE', 'SLIME', 'SLIMY', 'SLING', 'SLINK', 'SLIP', 'SLIT', 'SLOB', 'SLOG', 'SLOP',
  'SLOPE', 'SLOSH', 'SLOT', 'SLOTH', 'SLOW', 'SLUG', 'SLUM', 'SLUMP', 'SLUNG', 'SLUNK',
  'SLUR', 'SLURP', 'SLUSH', 'SLY', 'SMACK', 'SMALL', 'SMART', 'SMASH', 'SMEAR', 'SMELL',
  'SMELT', 'SMILE', 'SMIRK', 'SMITE', 'SMITH', 'SMOCK', 'SMOKE', 'SMOKY', 'SMOTE', 'SNACK',
  'SNAG', 'SNAIL', 'SNAKE', 'SNAKY', 'SNAP', 'SNARE', 'SNARL', 'SNEAK', 'SNEER', 'SNIDE',
  'SNIFF', 'SNIP', 'SNIPE', 'SNOB', 'SNOOP', 'SNORE', 'SNORT', 'SNOUT', 'SNOW', 'SNOWY',
  'SNUB', 'SNUCK', 'SNUG', 'SOAK', 'SOAP', 'SOAPY', 'SOAR', 'SOB', 'SOBER', 'SOCK', 'SOD',
  'SODA', 'SOFA', 'SOFT', 'SOGGY', 'SOIL', 'SOLAR', 'SOLD', 'SOLE', 'SOLID', 'SOLO', 'SOLVE',
  'SOME', 'SON', 'SONAR', 'SONG', 'SONIC', 'SOON', 'SOOT', 'SOOTY', 'SOP', 'SORE', 'SORRY',
  'SORT', 'SOUL', 'SOUND', 'SOUP', 'SOUR', 'SOUTH', 'SOW', 'SPACE', 'SPADE', 'SPAN', 'SPANK',
  'SPAR', 'SPARE', 'SPARK', 'SPASM', 'SPAT', 'SPAWN', 'SPEAK', 'SPEAR', 'SPECK', 'SPEED',
  'SPELL', 'SPEND', 'SPENT', 'SPERM', 'SPICE', 'SPICY', 'SPIED', 'SPIEL', 'SPIKE', 'SPIKY',
  'SPILL', 'SPIN', 'SPINE', 'SPINY', 'SPIRE', 'SPITE', 'SPLIT', 'SPOIL', 'SPOKE', 'SPOOF',
  'SPOOK', 'SPOOL', 'SPOON', 'SPORE', 'SPORT', 'SPOT', 'SPOUT', 'SPRAY', 'SPREE', 'SPRIG',
  'SPUD', 'SPUME', 'SPUN', 'SPUNK', 'SPUR', 'SPURN', 'SPURT', 'SPY', 'SQUAB', 'SQUAD',
  'SQUAT', 'SQUAW', 'SQUIB', 'SQUID', 'STAB', 'STACK', 'STAFF', 'STAGE', 'STAG', 'STAID',
  'STAIN', 'STAIR', 'STAKE', 'STALE', 'STALK', 'STALL', 'STAMP', 'STAND', 'STANK', 'STARE',
  'STARK', 'START', 'STAR', 'STASH', 'STATE', 'STAVE', 'STAY', 'STEAD', 'STEAK', 'STEAL',
  'STEAM', 'STEED', 'STEEL', 'STEEP', 'STEER', 'STEM', 'STEP', 'STERN', 'STEW', 'STICK',
  'STIFF', 'STILL', 'STILT', 'STING', 'STINK', 'STINT', 'STIR', 'STOCK', 'STOIC', 'STOKE',
  'STOLE', 'STOMP', 'STONE', 'STONY', 'STOOD', 'STOOL', 'STOOP', 'STOP', 'STORE', 'STORK',
  'STORM', 'STORY', 'STOUT', 'STOVE', 'STOW', 'STRAP', 'STRAW', 'STRAY', 'STREW', 'STRIP',
  'STRUT', 'STUB', 'STUCK', 'STUD', 'STUDY', 'STUFF', 'STUMP', 'STUNG', 'STUNK', 'STUNT',
  'STYLE', 'SUAVE', 'SUB', 'SUCH', 'SUCK', 'SUD', 'SUDS', 'SUE', 'SUET', 'SUGAR', 'SUIT',
  'SUITE', 'SULK', 'SULKY', 'SULLY', 'SUM', 'SUMAC', 'SUN', 'SUNG', 'SUNK', 'SUNNY',
  'SUPER', 'SURER', 'SURF', 'SURGE', 'SURLY', 'SUSHI', 'SWAB', 'SWAG', 'SWAMP', 'SWAN',
  'SWANK', 'SWAP', 'SWARM', 'SWAT', 'SWATH', 'SWAY', 'SWEAR', 'SWEAT', 'SWEEP', 'SWEET',
  'SWELL', 'SWEPT', 'SWIFT', 'SWIG', 'SWILL', 'SWIM', 'SWINE', 'SWING', 'SWIPE', 'SWIRL',
  'SWISH', 'SWISS', 'SWOON', 'SWOOP', 'SWORD', 'SWORE', 'SWORN', 'SWUNG', 'SYNOD', 'SYRUP',
  'TAB', 'TABBY', 'TABLE', 'TABOO', 'TACIT', 'TACK', 'TACKY', 'TACO', 'TACT', 'TAD',
  'TAG', 'TAIL', 'TAINT', 'TAKE', 'TAKEN', 'TALE', 'TALK', 'TALL', 'TALLY', 'TALON', 'TAME',
  'TAMP', 'TAN', 'TANG', 'TANGO', 'TANGY', 'TANK', 'TAP', 'TAPE', 'TAPER', 'TAPIR', 'TAR',
  'TARDY', 'TAROT', 'TARP', 'TART', 'TASK', 'TASTE', 'TASTY', 'TAT', 'TAUNT', 'TAUPE',
  'TAUT', 'TAWNY', 'TAX', 'TAXI', 'TEA', 'TEACH', 'TEAK', 'TEAL', 'TEAM', 'TEAR', 'TEASE',
  'TECH', 'TEDDY', 'TEE', 'TEEM', 'TEEN', 'TEETH', 'TELL', 'TEMPO', 'TEN', 'TEND', 'TENET',
  'TENOR', 'TENSE', 'TENT', 'TENTH', 'TEPEE', 'TEPID', 'TERM', 'TERRA', 'TERSE', 'TEST',
  'TEXT', 'THAN', 'THANK', 'THAT', 'THAW', 'THE', 'THEFT', 'THEIR', 'THEM', 'THEME', 'THEN',
  'THERE', 'THESE', 'THETA', 'THEY', 'THICK', 'THIEF', 'THIGH', 'THIN', 'THING', 'THINK',
  'THIRD', 'THORN', 'THOSE', 'THREE', 'THREW', 'THROB', 'THROW', 'THRUM', 'THUD', 'THUG',
  'THUMB', 'THUMP', 'THUS', 'THY', 'THYME', 'TIARA', 'TIBIA', 'TIC', 'TICK', 'TIDAL',
  'TIDE', 'TIDY', 'TIE', 'TIER', 'TIGER', 'TIGHT', 'TILDE', 'TILE', 'TILL', 'TILT', 'TIME',
  'TIMID', 'TIN', 'TINGE', 'TINNY', 'TINT', 'TINY', 'TIP', 'TIPSY', 'TIRE', 'TITAN', 'TITHE',
  'TITLE', 'TOAD', 'TOAST', 'TODAY', 'TODDY', 'TOE', 'TOFF', 'TOFU', 'TOGA', 'TOIL',
  'TOKEN', 'TOLD', 'TOLL', 'TOMB', 'TOME', 'TON', 'TONAL', 'TONE', 'TONG', 'TONIC', 'TONY',
  'TOO', 'TOOK', 'TOOL', 'TOOT', 'TOOTH', 'TOP', 'TOPAZ', 'TOPIC', 'TORCH', 'TORE', 'TORN',
  'TORSO', 'TORT', 'TORUS', 'TOSS', 'TOT', 'TOTAL', 'TOTE', 'TOTEM', 'TOUCH', 'TOUGH',
  'TOUR', 'TOUT', 'TOW', 'TOWEL', 'TOWER', 'TOWN', 'TOXIC', 'TOXIN', 'TOY', 'TRACE', 'TRACK',
  'TRACT', 'TRADE', 'TRAIL', 'TRAIN', 'TRAIT', 'TRAM', 'TRAMP', 'TRAP', 'TRASH', 'TRAWL',
  'TRAY', 'TREAD', 'TREAT', 'TREE', 'TREK', 'TREND', 'TRESS', 'TRIAD', 'TRIAL', 'TRIBE',
  'TRICE', 'TRICK', 'TRIED', 'TRIG', 'TRIM', 'TRIO', 'TRIP', 'TRITE', 'TROLL', 'TROOP',
  'TROPE', 'TROT', 'TROUT', 'TROVE', 'TRUCE', 'TRUCK', 'TRUE', 'TRULY', 'TRUMP', 'TRUNK',
  'TRUSS', 'TRUST', 'TRUTH', 'TRY', 'TUB', 'TUBA', 'TUBE', 'TUCK', 'TUFT', 'TUG', 'TULIP',
  'TULLE', 'TUMOR', 'TUNA', 'TUNE', 'TUNIC', 'TURBO', 'TURF', 'TURN', 'TUSK', 'TUTOR',
  'TUTU', 'TWAIN', 'TWANG', 'TWEAK', 'TWEED', 'TWEET', 'TWICE', 'TWIG', 'TWILL', 'TWIN',
  'TWINE', 'TWIRL', 'TWIST', 'TWIT', 'TWO', 'TYING', 'TYPE', 'TYPO', 'UDDER', 'ULCER',
  'ULTRA', 'UMBRA', 'UMP', 'UNCLE', 'UNDER', 'UNDID', 'UNDO', 'UNDUE', 'UNFED', 'UNFIT',
  'UNIFY', 'UNION', 'UNIT', 'UNITE', 'UNITY', 'UNLIT', 'UNMET', 'UNSET', 'UNTIE', 'UNTIL',
  'UNWED', 'UNZIP', 'UPON', 'UPPER', 'UPSET', 'URBAN', 'URGE', 'URINE', 'URN', 'USAGE',
  'USE', 'USED', 'USER', 'USHER', 'USING', 'USUAL', 'USURP', 'UTILE', 'UTTER', 'VAGUE',
  'VAIN', 'VALE', 'VALID', 'VALOR', 'VALUE', 'VALVE', 'VAN', 'VANE', 'VAPID', 'VAPOR',
  'VARY', 'VASE', 'VAST', 'VAT', 'VAULT', 'VAUNT', 'VEAL', 'VEER', 'VEGAN', 'VEIL', 'VEIN',
  'VELDT', 'VENAL', 'VEND', 'VENOM', 'VENT', 'VENUE', 'VERB', 'VERGE', 'VERSE', 'VERSO',
  'VERVE', 'VEST', 'VET', 'VETO', 'VEX', 'VIA', 'VIAL', 'VIBES', 'VICAR', 'VICE', 'VIDEO',
  'VIE', 'VIEW', 'VIGIL', 'VIGOR', 'VILE', 'VILLA', 'VINE', 'VINYL', 'VIOLA', 'VIPER',
  'VIRAL', 'VIRUS', 'VISA', 'VISIT', 'VISOR', 'VISTA', 'VITAL', 'VIVID', 'VIXEN', 'VOCAL',
  'VODKA', 'VOGUE', 'VOICE', 'VOID', 'VOILE', 'VOLT', 'VOMIT', 'VOTE', 'VOUCH', 'VOW',
  'VOWEL', 'VYING', 'WACKY', 'WAD', 'WADE', 'WAFER', 'WAFT', 'WAG', 'WAGE', 'WAGER',
  'WAGON', 'WAIF', 'WAIL', 'WAIST', 'WAIT', 'WAIVE', 'WAKE', 'WAKEN', 'WALK', 'WALL',
  'WALTZ', 'WAN', 'WAND', 'WANE', 'WANT', 'WAR', 'WARD', 'WARE', 'WARM', 'WARN', 'WARP',
  'WART', 'WARY', 'WAS', 'WASH', 'WASP', 'WASTE', 'WATCH', 'WATER', 'WATT', 'WAVE', 'WAVER',
  'WAVY', 'WAX', 'WAXEN', 'WAY', 'WEAK', 'WEAL', 'WEAN', 'WEAR', 'WEARY', 'WEAVE', 'WEB',
  'WED', 'WEDGE', 'WEE', 'WEED', 'WEEDY', 'WEEK', 'WEEP', 'WEIGH', 'WEIRD', 'WELD', 'WELL',
  'WELSH', 'WELT', 'WEND', 'WENT', 'WEPT', 'WERE', 'WEST', 'WET', 'WHACK', 'WHALE', 'WHAM',
  'WHARF', 'WHAT', 'WHEAT', 'WHEEL', 'WHELM', 'WHELP', 'WHEN', 'WHERE', 'WHET', 'WHICH',
  'WHIFF', 'WHILE', 'WHIM', 'WHINE', 'WHINY', 'WHIP', 'WHIR', 'WHIRL', 'WHISK', 'WHITE',
  'WHIZ', 'WHO', 'WHOA', 'WHOLE', 'WHOM', 'WHOOP', 'WHOSE', 'WHY', 'WICK', 'WIDEN', 'WIDER',
  'WIDOW', 'WIDTH', 'WIELD', 'WIFE', 'WIG', 'WIGHT', 'WILD', 'WILE', 'WILL', 'WILT',
  'WILY', 'WIMP', 'WIN', 'WINCE', 'WINCH', 'WIND', 'WINDY', 'WINE', 'WING', 'WINK', 'WINO',
  'WINTER', 'WINY', 'WIPE', 'WIRE', 'WIRY', 'WISE', 'WISH', 'WISP', 'WISPY', 'WIT', 'WITCH',
  'WITH', 'WITHE', 'WITHY', 'WITTY', 'WIVE', 'WOE', 'WOK', 'WOKE', 'WOKEN', 'WOLF', 'WOMAN',
  'WOMB', 'WOMEN', 'WON', 'WONK', 'WOO', 'WOOD', 'WOODY', 'WOOF', 'WOOL', 'WOOZY', 'WORD',
  'WORDY', 'WORE', 'WORK', 'WORLD', 'WORM', 'WORMY', 'WORN', 'WORRY', 'WORSE', 'WORST',
  'WORTH', 'WOULD', 'WOUND', 'WOVE', 'WOVEN', 'WOW', 'WRACK', 'WRAP', 'WRATH', 'WREAK',
  'WRECK', 'WREN', 'WREST', 'WRIER', 'WRING', 'WRIST', 'WRITE', 'WRIT', 'WRONG', 'WROTE',
  'WRUNG', 'WRY', 'WRYLY', 'YACHT', 'YAHOO', 'YAK', 'YAM', 'YANK', 'YAP', 'YARD', 'YARN',
  'YAW', 'YAWL', 'YAWN', 'YEA', 'YEAR', 'YEARN', 'YEAST', 'YELL', 'YELP', 'YEN', 'YES',
  'YET', 'YEW', 'YIELD', 'YODEL', 'YOGA', 'YOGI', 'YOKE', 'YOKEL', 'YOLK', 'YON', 'YORE',
  'YOU', 'YOUNG', 'YOUR', 'YOUTH', 'YOWL', 'YULE', 'ZANY', 'ZAP', 'ZEAL', 'ZEBRA', 'ZERO',
  'ZEST', 'ZESTY', 'ZINC', 'ZING', 'ZIP', 'ZIPPY', 'ZIT', 'ZODIAC', 'ZONE', 'ZOO', 'ZOOM',
];

const dictionaryPromiseCache = new Map<string, Promise<LoadedDictionary>>();
const definitionMemCache = new Map<string, WordDefinitionResult>();
const DICT_CACHE_STORAGE_KEY = 'enscribe_dict_cache_en_v1';
const MAX_LOCAL_DEF_CACHE = 200;

function buildDictionaryFromWords(
  language: string,
  wordList: Iterable<string>,
  isFallback: boolean
): LoadedDictionary {
  const words = new Set<string>();
  const prefixes = new Set<string>();

  for (const raw of wordList) {
    const clean = raw.trim().toUpperCase();
    if (clean.length < 3 || clean.length > 15) continue;
    words.add(clean);
    const prefixLimit = Math.min(clean.length, 6);
    for (let len = 1; len <= prefixLimit; len++) {
      prefixes.add(clean.slice(0, len));
    }
  }

  return { language, words, prefixes, isFallback };
}

export function loadGridItDictionary(language = 'en'): Promise<LoadedDictionary> {
  const key = language.toLowerCase();
  const cached = dictionaryPromiseCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<LoadedDictionary> => {
    try {
      const res = await fetch(`/dictionaries/${encodeURIComponent(key)}.txt`);
      if (!res.ok) {
        throw new Error(`Dictionary fetch failed (${res.status})`);
      }
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      const built = buildDictionaryFromWords(key, lines, false);
      if (built.words.size > 1000) {
        return built;
      }
      throw new Error('Dictionary file empty');
    } catch {
      return buildDictionaryFromWords(key, FALLBACK_CORE_WORDS, true);
    }
  })();

  dictionaryPromiseCache.set(key, promise);
  return promise;
}

function readPersistedDefCache(): Record<string, WordDefinitionResult> {
  try {
    const raw = localStorage.getItem(DICT_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistedDefCache(wordKey: string, value: WordDefinitionResult): void {
  try {
    const existing = readPersistedDefCache();
    existing[wordKey] = value;
    const keys = Object.keys(existing);
    if (keys.length > MAX_LOCAL_DEF_CACHE) {
      for (const oldKey of keys.slice(0, keys.length - MAX_LOCAL_DEF_CACHE)) {
        delete existing[oldKey];
      }
    }
    localStorage.setItem(DICT_CACHE_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchWordDefinition(
  word: string,
  language = 'en'
): Promise<WordDefinitionResult> {
  const normalized = word.trim().toUpperCase();
  const cacheKey = `${language.toLowerCase()}:${normalized}`;

  const memHit = definitionMemCache.get(cacheKey);
  if (memHit) return memHit;

  const persisted = readPersistedDefCache();
  if (persisted[cacheKey]) {
    definitionMemCache.set(cacheKey, persisted[cacheKey]);
    return persisted[cacheKey];
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      word: normalized,
      found: false,
      language: 'English',
      source: 'Free Dictionary API',
      meanings: [],
      reason: 'offline',
    };
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized.toLowerCase())}`,
      { signal: AbortSignal.timeout(6000) }
    );

    if (res.status === 404) {
      return {
        word: normalized,
        found: false,
        language: 'English',
        source: 'Free Dictionary API',
        meanings: [],
        reason: 'not_found',
      };
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = (await res.json()) as Array<{
      phonetic?: string;
      phonetics?: Array<{ text?: string }>;
      meanings?: Array<{
        partOfSpeech?: string;
        definitions?: Array<{ definition?: string; example?: string }>;
      }>;
    }>;

    const entry = json[0];
    if (!entry) {
      return {
        word: normalized,
        found: false,
        language: 'English',
        source: 'Free Dictionary API',
        meanings: [],
        reason: 'not_found',
      };
    }

    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p) => typeof p.text === 'string' && p.text.trim())?.text;

    const meanings: WordDefinitionMeaning[] = (entry.meanings || [])
      .map((m) => ({
        partOfSpeech: m.partOfSpeech || 'word',
        definitions: (m.definitions || [])
          .filter((d) => Boolean(d.definition))
          .slice(0, 3)
          .map((d) => ({
            definition: String(d.definition),
            example: d.example ? String(d.example) : undefined,
          })),
      }))
      .filter((m) => m.definitions.length > 0);

    const result: WordDefinitionResult = {
      word: normalized,
      found: meanings.length > 0,
      phonetic,
      language: 'English',
      source: 'Free Dictionary API',
      meanings,
      reason: meanings.length > 0 ? undefined : 'not_found',
    };

    if (result.found) {
      definitionMemCache.set(cacheKey, result);
      writePersistedDefCache(cacheKey, result);
    }

    return result;
  } catch {
    return {
      word: normalized,
      found: false,
      language: 'English',
      source: 'Free Dictionary API',
      meanings: [],
      reason: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'not_found',
    };
  }
}
