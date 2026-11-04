/* ============================================================
   SECTION: CONFIG & CONSTANTS
   ============================================================ */
const APP_VERSION = '2.6.0';

/* bodyweight pseudo-series (chart tab) */
const BW_KEY = '__BW__';
const BW_COLOR = '#d4b8ff';

const SPLIT_ORDER = ['Push', 'Pull', 'Legs', 'Full Upper', 'Legs + Arms', 'Abs'];
const SPLIT_COLORS = {
  Push: '#e85d3a', Pull: '#3a8ee8', Legs: '#2ecc71',
  'Full Upper': '#e8b83a', 'Legs + Arms': '#a83ae8', Abs: '#3ae8c7'
};

const PHASE_META = {
  bulk:     { label: 'BULK',     color: '#2ecc71', blurb: 'chasing PRs' },
  leangain: { label: 'LEAN GAIN', color: '#a8e83a', blurb: 'slow surplus — volume up, rate capped' },
  cut:      { label: 'CUT',      color: '#3a8ee8', blurb: 'goal is retention, not PRs' },
  maintain: { label: 'MAINTAIN', color: '#e8b83a', blurb: 'hold the line' }
};

/* e1RM reps beyond this are extrapolation, not estimation — Epley is
   reasonable to ~10-12 reps and inflates badly past that (200x20 "=" 333 lb) */
const E1RM_REP_CAP = 12;

const MUSCLES = {
  chest_upper: 'Upper Chest', chest_lower: 'Lower Chest',
  delt_front: 'Anterior Delt', delt_side: 'Lateral Delt', delt_rear: 'Rear Delt',
  traps_upper: 'Upper Traps', traps_lower: 'Mid/Lower Traps',
  lats: 'Lats', erectors: 'Spinal Erectors',
  biceps: 'Biceps', brachialis: 'Brachialis',
  triceps_long: 'Triceps (Long Head)', triceps_lat: 'Triceps (Lateral Head)',
  forearm_flex: 'Forearm Flexors', forearm_ext: 'Forearm Extensors',
  abs: 'Rectus Abdominis', obliques: 'Obliques',
  quads: 'Quads', adductors: 'Adductors',
  glute_max: 'Glute Max', glute_med: 'Glute Med',
  hamstrings: 'Hamstrings', calves_gastro: 'Gastrocnemius', calves_soleus: 'Soleus',
  tibialis: 'Tibialis'
};

const ALIAS = {
  triceps: ['triceps_long', 'triceps_lat'],
  calves: ['calves_gastro', 'calves_soleus'],
  forearms: ['forearm_flex', 'forearm_ext'],
  chest: ['chest_upper', 'chest_lower']
};

/* pairs collapsed to one display name in readouts */
const PAIRS = [
  [['triceps_long', 'triceps_lat'], 'Triceps'],
  [['calves_gastro', 'calves_soleus'], 'Calves'],
  [['forearm_flex', 'forearm_ext'], 'Forearms'],
  [['chest_upper', 'chest_lower'], 'Chest']
];

/* ---- weekly volume view: muscle groups + phase-aware fractional-set targets ----
   counting convention (Pelland 2025 meta-regression): primary tag = 1 set, secondary = 0.5 */
const VOL_GROUPS = [
  { key: 'chest',      label: 'CHEST',      ids: ['chest_upper','chest_lower'] },
  { key: 'delt_front', label: 'FRONT DELT', ids: ['delt_front'] },
  { key: 'delt_side',  label: 'SIDE DELT',  ids: ['delt_side'] },
  { key: 'delt_rear',  label: 'REAR DELT',  ids: ['delt_rear'] },
  { key: 'back',       label: 'BACK',       ids: ['lats','traps_lower'] },
  { key: 'traps',      label: 'TRAPS',      ids: ['traps_upper'] },
  { key: 'biceps',     label: 'BICEPS',     ids: ['biceps','brachialis'] },
  { key: 'triceps',    label: 'TRICEPS',    ids: ['triceps_long','triceps_lat'] },
  { key: 'forearms',   label: 'FOREARMS',   ids: ['forearm_flex','forearm_ext'] },
  { key: 'quads',      label: 'QUADS',      ids: ['quads'] },
  { key: 'hamstrings', label: 'HAMSTRINGS', ids: ['hamstrings'] },
  { key: 'glutes',     label: 'GLUTES',     ids: ['glute_max','glute_med'] },
  { key: 'calves',     label: 'CALVES',     ids: ['calves_gastro','calves_soleus'] },
  { key: 'erectors',   label: 'LOWER BACK', ids: ['erectors'] },
  { key: 'abs',        label: 'ABS',        ids: ['abs'] },
  { key: 'obliques',   label: 'OBLIQUES',   ids: ['obliques'] }
];

/* [min,max] fractional sets / week; null = tracked, no target.
   obliques: deliberate cap (waist), over-target flags instead of under. */
const VOL_TARGETS = {
  cut: {
    chest: [10,15], back: [10,15], delt_side: [10,15], quads: [10,15],
    hamstrings: [10,15], biceps: [10,15], triceps: [10,15],
    delt_rear: [6,10], glutes: [6,10], calves: [6,10],
    abs: [8,12], obliques: [0,6],
    delt_front: null, traps: null, forearms: null, erectors: null
  },
  bulk: {
    chest: [12,20], back: [12,20], delt_side: [12,20], quads: [12,20],
    hamstrings: [12,20], biceps: [12,20], triceps: [12,20],
    delt_rear: [8,12], glutes: [8,12], calves: [8,12],
    abs: [10,16], obliques: [0,6],
    delt_front: null, traps: null, forearms: null, erectors: null
  },
  /* slow surplus: above cut, but reachable in ~90-100 sets/week */
  leangain: {
    chest: [10,16], back: [10,16], delt_side: [10,16], quads: [10,16],
    hamstrings: [10,16], biceps: [10,16], triceps: [10,16],
    delt_rear: [6,10], glutes: [6,10], calves: [6,10],
    abs: [8,12], obliques: [0,6],
    delt_front: null, traps: null, forearms: null, erectors: null
  },
  maintain: {
    chest: [6,10], back: [6,10], delt_side: [6,10], quads: [6,10],
    hamstrings: [6,10], biceps: [6,10], triceps: [6,10],
    delt_rear: [4,8], glutes: [4,8], calves: [4,8],
    abs: [6,10], obliques: [0,6],
    delt_front: null, traps: null, forearms: null, erectors: null
  }
};

/* selectable muscle chips for custom exercises: label → tag id or alias key */
const CHIP_TAGS = [
  ['Upper Chest','chest_upper'],['Lower Chest','chest_lower'],
  ['Anterior Delt','delt_front'],['Lateral Delt','delt_side'],['Rear Delt','delt_rear'],
  ['Upper Traps','traps_upper'],['Mid/Lower Traps','traps_lower'],
  ['Lats','lats'],['Spinal Erectors','erectors'],
  ['Biceps','biceps'],['Brachialis','brachialis'],['Triceps','triceps'],
  ['Forearms','forearms'],
  ['Abs','abs'],['Obliques','obliques'],
  ['Quads','quads'],['Adductors','adductors'],
  ['Glute Max','glute_max'],['Glute Med','glute_med'],
  ['Hamstrings','hamstrings'],['Calves','calves'],['Tibialis','tibialis']
];

/* ============================================================
   SECTION: EXERCISE LIBRARY (bw:1 = bodyweight-loaded)
   ============================================================ */
const LIB = [
  /* chest / push */
  { n: 'Incline DB Bench Press', p: ['chest_upper','delt_front'], s: ['triceps'] },
  { n: 'Flat DB Bench Press', p: ['chest'], s: ['delt_front','triceps'] },
  { n: 'Decline DB Bench Press', p: ['chest_lower'], s: ['triceps','delt_front'] },
  { n: 'Barbell Bench Press', p: ['chest'], s: ['delt_front','triceps'] },
  { n: 'Incline Barbell Bench Press', p: ['chest_upper','delt_front'], s: ['triceps'] },
  { n: 'Machine Chest Press', p: ['chest'], s: ['triceps','delt_front'] },
  { n: 'Flat Machine Press', p: ['chest_upper','chest_lower'], s: ['triceps','delt_front'] },
  { n: 'Incline Press (Plate)', p: ['chest_upper','delt_front'], s: ['triceps'] },
  { n: 'Incline Machine Press', p: ['chest_upper','delt_front'], s: ['triceps'] },
  { n: 'Pec Deck', p: ['chest'], s: ['delt_front'] },
  { n: 'Seated Cable Fly', p: ['chest'], s: ['delt_front'] },
  { n: 'DB Fly', p: ['chest'], s: ['delt_front'] },
  { n: 'Cable Fly', p: ['chest'], s: ['delt_front'] },
  { n: 'Incline Cable Fly', p: ['chest_upper'], s: ['delt_front'] },
  { n: 'Push-up', bw: 1, p: ['chest'], s: ['triceps','delt_front','abs'] },
  { n: 'Dip', bw: 1, p: ['chest_lower','triceps'], s: ['delt_front'] },
  { n: 'DB Pullover', p: ['chest','lats'], s: ['triceps_long'] },
  { n: 'Landmine Press', p: ['delt_front','chest_upper'], s: ['triceps'] },
  /* shoulders */
  { n: 'DB Shoulder Press', p: ['delt_front','delt_side'], s: ['triceps'] },
  { n: 'Seated DB Shoulder Press', p: ['delt_front','delt_side'], s: ['triceps'] },
  { n: 'Machine Shoulder Press', p: ['delt_front','delt_side'], s: ['triceps'] },
  { n: 'Barbell Overhead Press', p: ['delt_front','delt_side'], s: ['triceps','abs'] },
  { n: 'Arnold Press', p: ['delt_front','delt_side'], s: ['triceps'] },
  { n: 'DB Lateral Raise', p: ['delt_side'], s: ['traps_upper'] },
  { n: 'Cable Lateral Raise', p: ['delt_side'], s: ['traps_upper'] },
  { n: 'Machine Lateral Raise', p: ['delt_side'], s: [] },
  { n: 'Front Raise', p: ['delt_front'], s: ['delt_side'] },
  { n: 'Reverse Fly', p: ['delt_rear'], s: ['traps_lower'] },
  { n: 'Rear Delt Machine', p: ['delt_rear'], s: ['traps_lower'] },
  { n: 'Cable Rear Delt Fly', p: ['delt_rear'], s: ['traps_lower'] },
  { n: 'Face Pull', p: ['delt_rear','traps_lower'], s: ['traps_upper'] },
  { n: 'Upright Row', p: ['delt_side','traps_upper'], s: ['biceps'] },
  { n: 'Cable Upright Row', p: ['delt_side','traps_upper'], s: ['biceps'] },
  { n: 'Pike Push-up', bw: 1, p: ['delt_front','delt_side'], s: ['triceps'] },
  /* triceps */
  { n: 'Skull Crusher', p: ['triceps'], s: [] },
  { n: 'Tricep Kickback', p: ['triceps'], s: [] },
  { n: 'Cable Tricep Pushdown', p: ['triceps_lat'], s: ['triceps_long'] },
  { n: 'Rope Pushdown', p: ['triceps_lat'], s: ['triceps_long'] },
  { n: 'Overhead Cable Extension', p: ['triceps_long'], s: ['triceps_lat'] },
  { n: 'Overhead DB Extension', p: ['triceps_long'], s: ['triceps_lat'] },
  { n: 'Close Grip Bench Press', p: ['triceps'], s: ['chest','delt_front'] },
  { n: 'Diamond Push-up', bw: 1, p: ['triceps'], s: ['chest'] },
  { n: 'Bench Dip', bw: 1, p: ['triceps'], s: ['delt_front','chest_lower'] },
  /* back */
  { n: 'Pull-up', bw: 1, p: ['lats'], s: ['biceps','traps_lower','forearms'] },
  { n: 'Chin-up', bw: 1, p: ['lats','biceps'], s: ['traps_lower','forearms'] },
  { n: 'Assisted Pull-up', p: ['lats'], s: ['biceps','traps_lower'] },
  { n: 'Machine Pulldown', p: ['lats'], s: ['biceps','traps_lower'] },
  { n: 'Cable Lat Pulldown', p: ['lats'], s: ['biceps','traps_lower'] },
  { n: 'Straight Arm Pulldown', p: ['lats'], s: ['triceps_long'] },
  { n: 'DB Row', p: ['lats','traps_lower'], s: ['biceps','delt_rear','erectors'] },
  { n: 'Barbell Row', p: ['lats','traps_lower'], s: ['biceps','erectors','delt_rear'] },
  { n: 'Seated Cable Row', p: ['lats','traps_lower'], s: ['biceps','delt_rear'] },
  { n: 'Machine Row', p: ['lats','traps_lower'], s: ['biceps','delt_rear'] },
  { n: 'Chest Supported Row', p: ['traps_lower','lats'], s: ['delt_rear','biceps'] },
  { n: 'T-Bar Row', p: ['lats','traps_lower'], s: ['biceps','erectors'] },
  { n: 'Single Arm Cable Row', p: ['lats'], s: ['biceps','obliques'] },
  { n: 'Meadows Row', p: ['lats','traps_lower'], s: ['biceps'] },
  { n: 'Inverted Row', bw: 1, p: ['traps_lower','lats'], s: ['biceps','delt_rear'] },
  { n: 'Renegade Row', p: ['lats','abs'], s: ['biceps','obliques'] },
  { n: 'DB Shrug', p: ['traps_upper'], s: [] },
  { n: 'Barbell Shrug', p: ['traps_upper'], s: [] },
  { n: 'Back Extension', bw: 1, p: ['erectors','glute_max'], s: ['hamstrings'] },
  { n: 'Superman', bw: 1, p: ['erectors'], s: ['glute_max'] },
  { n: 'Good Morning', p: ['hamstrings','erectors'], s: ['glute_max'] },
  /* biceps / forearms */
  { n: 'DB Curl', p: ['biceps'], s: ['brachialis','forearm_flex'] },
  { n: 'Incline DB Curl', p: ['biceps'], s: ['brachialis'] },
  { n: 'Hammer Curl', p: ['brachialis'], s: ['biceps','forearm_ext'] },
  { n: 'Preacher Hammer Curl', p: ['brachialis'], s: ['biceps','forearm_ext'] },
  { n: 'Cable Hammer Curl', p: ['brachialis'], s: ['biceps','forearm_ext'] },
  { n: 'Single Arm DB Preacher Curl', p: ['biceps'], s: ['brachialis'] },
  { n: 'Machine Preacher Curl', p: ['biceps'], s: ['brachialis'] },
  { n: 'Incline Machine Curl', p: ['biceps'], s: ['brachialis'] },
  { n: 'EZ Bar Curl', p: ['biceps'], s: ['brachialis','forearm_flex'] },
  { n: 'Cable Curl', p: ['biceps'], s: ['brachialis'] },
  { n: 'Concentration Curl', p: ['biceps'], s: ['brachialis'] },
  { n: 'Spider Curl', p: ['biceps'], s: [] },
  { n: 'Zottman Curl', p: ['biceps','forearm_ext'], s: ['brachialis'] },
  { n: 'Reverse Curl', p: ['brachialis','forearm_ext'], s: ['biceps'] },
  { n: 'Wrist Curl', p: ['forearm_flex'], s: [] },
  { n: 'Reverse Wrist Curl', p: ['forearm_ext'], s: [] },
  { n: "Farmer's Carry", p: ['forearms','traps_upper'], s: ['abs','obliques'] },
  /* legs */
  { n: 'Goblet Squat', p: ['quads','glute_max'], s: ['abs','adductors'] },
  { n: 'Suitcase Squat', p: ['quads','glute_max'], s: ['obliques','forearms'] },
  { n: 'Barbell Back Squat', p: ['quads','glute_max'], s: ['erectors','adductors','hamstrings'] },
  { n: 'Front Squat', p: ['quads'], s: ['glute_max','abs','erectors'] },
  { n: 'Hack Squat', p: ['quads'], s: ['glute_max'] },
  { n: 'Leg Press', p: ['quads','glute_max'], s: ['hamstrings','adductors'] },
  { n: 'Angled Leg Press', p: ['quads','glute_max'], s: ['hamstrings','adductors'] },
  { n: 'Bulgarian Split Squat', p: ['quads','glute_max'], s: ['adductors','glute_med'] },
  { n: 'Walking Lunge', p: ['quads','glute_max'], s: ['hamstrings','glute_med'] },
  { n: 'DB Lunge', p: ['quads','glute_max'], s: ['hamstrings','glute_med'] },
  { n: 'Reverse Lunge', p: ['glute_max','quads'], s: ['hamstrings'] },
  { n: 'Step-up', p: ['quads','glute_max'], s: ['glute_med'] },
  { n: 'Leg Extension', p: ['quads'], s: [] },
  { n: 'DB Deadlift', p: ['glute_max','hamstrings','erectors'], s: ['quads','traps_upper','forearms'] },
  { n: 'Barbell Deadlift', p: ['glute_max','hamstrings','erectors'], s: ['quads','traps_upper','forearms','lats'] },
  { n: 'Sumo Deadlift', p: ['glute_max','adductors'], s: ['hamstrings','quads','erectors'] },
  { n: 'Barbell Romanian Deadlift', p: ['hamstrings','glute_max'], s: ['erectors','forearms'] },
  { n: 'DB RDL', p: ['hamstrings','glute_max'], s: ['erectors'] },
  { n: 'Single Leg DB RDL', p: ['hamstrings','glute_max'], s: ['glute_med','erectors'] },
  { n: 'Nordic Curl', bw: 1, p: ['hamstrings'], s: ['calves_gastro'] },
  { n: 'Lying Leg Curl Machine', p: ['hamstrings'], s: ['calves_gastro'] },
  { n: 'Seated Leg Curl', p: ['hamstrings'], s: [] },
  { n: 'DB Hip Thrust', p: ['glute_max'], s: ['hamstrings','quads'] },
  { n: 'Hip Thrust Machine', p: ['glute_max'], s: ['hamstrings'] },
  { n: 'Glute Bridge', bw: 1, p: ['glute_max'], s: ['hamstrings'] },
  { n: 'Cable Glute Kickback', p: ['glute_max'], s: ['hamstrings'] },
  { n: 'Hip Abduction Machine', p: ['glute_med'], s: ['glute_max'] },
  { n: 'Adductor Machine', p: ['adductors'], s: [] },
  { n: 'Kettlebell Swing', p: ['glute_max','hamstrings'], s: ['erectors','abs'] },
  { n: 'Calf Raise', p: ['calves_gastro'], s: ['calves_soleus'] },
  { n: 'Standing Calf Raise', p: ['calves_gastro'], s: ['calves_soleus'] },
  { n: 'Seated Calf Raise', p: ['calves_soleus'], s: ['calves_gastro'] },
  { n: 'Calf Press (Leg Press)', p: ['calves_gastro'], s: ['calves_soleus'] },
  { n: 'Tibialis Raise', p: ['tibialis'], s: [] },
  /* abs / core */
  { n: 'Decline Weighted Sit-up', p: ['abs'], s: ['obliques'] },
  { n: 'Sit-up', bw: 1, p: ['abs'], s: ['obliques'] },
  { n: 'Crunch', bw: 1, p: ['abs'], s: [] },
  { n: 'Cable Crunch', p: ['abs'], s: ['obliques'] },
  { n: 'Ab Crunch Machine', p: ['abs'], s: [] },
  { n: 'Incline Leg Lift', bw: 1, p: ['abs'], s: ['obliques','quads'] },
  { n: 'Hanging Leg Raise', bw: 1, p: ['abs'], s: ['obliques','forearms'] },
  { n: 'Lying Leg Raise', bw: 1, p: ['abs'], s: [] },
  { n: 'Russian Twist', p: ['obliques'], s: ['abs'] },
  { n: 'Cable Woodchop', p: ['obliques'], s: ['abs'] },
  { n: 'Dumbbell Side Bend', p: ['obliques'], s: [] },
  { n: 'Plank', bw: 1, p: ['abs'], s: ['obliques','erectors'] },
  { n: 'Side Plank', bw: 1, p: ['obliques'], s: ['abs','glute_med'] },
  { n: 'Ab Wheel Rollout', bw: 1, p: ['abs'], s: ['lats','obliques'] },
  { n: 'Pallof Press', p: ['obliques','abs'], s: [] },
  { n: 'Dead Bug', bw: 1, p: ['abs'], s: [] },
  { n: 'Mountain Climber', bw: 1, p: ['abs'], s: ['obliques','quads'] },
  /* cardio (logged as incline % · minutes · mph; headline metric = vertical feet) */
  { n: 'Incline Walk', cardio: 1, p: ['quads','glute_max','calves_gastro'], s: ['hamstrings','calves_soleus','tibialis'] },
  { n: 'Treadmill Run', cardio: 1, p: ['quads','calves_gastro','hamstrings'], s: ['glute_max','calves_soleus','tibialis'] }
];

const CARDIO_COLOR = '#e83a8e';

/* seed split layout — used only on first run, then stored config takes over */
const SEED = {
  home: {
    Push: ['Incline DB Bench Press','DB Lateral Raise','DB Fly','Tricep Kickback','DB Shoulder Press','Skull Crusher'],
    Pull: ['DB Row','Single Arm DB Preacher Curl','Pull-up','Incline DB Curl','Reverse Fly','Upright Row'],
    Legs: ['Suitcase Squat','Calf Raise','DB Deadlift','DB Hip Thrust','Bulgarian Split Squat','Nordic Curl'],
    'Full Upper': ['Incline DB Bench Press','Pull-up','DB Fly','DB Row','Arnold Press','Reverse Fly'],
    'Legs + Arms': ['Goblet Squat','Preacher Hammer Curl','Leg Extension','Skull Crusher','Single Leg DB RDL','Calf Raise','DB Curl'],
    Abs: ['Decline Weighted Sit-up','Incline Leg Lift','Dumbbell Side Bend']
  },
  gym: {
    Push: ['Incline Press (Plate)','Pec Deck','Overhead Cable Extension','Rope Pushdown','Machine Shoulder Press','Cable Lateral Raise'],
    Pull: ['Seated Cable Row','Cable Lat Pulldown','Incline Machine Curl','Machine Preacher Curl','Rear Delt Machine','Face Pull'],
    Legs: ['Hack Squat','Barbell Romanian Deadlift','Leg Press','Calf Press (Leg Press)','Leg Extension','Seated Leg Curl','Ab Crunch Machine','Ab Coaster'],
    'Full Upper': ['Flat Machine Press','DB Lateral Raise','Seated Cable Fly','Machine Shoulder Press','Machine Row','Machine Pulldown'],
    'Legs + Arms': ['Leg Press','Leg Extension','Calf Press (Leg Press)','Seated Leg Curl','Cable Hammer Curl','Rope Pushdown','Ab Crunch Machine'],
    Abs: ['Ab Crunch Machine','Ab Coaster','Hanging Leg Raise']
  }
};
