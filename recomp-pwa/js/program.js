/* Recomp Program — data model. Source of truth: recompprogram.md */
'use strict';

const PROGRAM = {
  title: 'Recomp Program',
  phase: '13.5% → 12% body fat · maintain weight · gain muscle',
  diet: 'maintenance −200–300 kcal · protein 180 g · fasting window 14 h · carbs pre-training',
  frequency: 'every muscle 2×/week · 9–12 hard sets per muscle',
  blockWeeks: 6,

  days: [
    {
      id: 'd1', n: 1, name: 'Upper A', kind: 'lift', minutes: 75,
      blocks: [
        {
          type: 'main', key: 'bench', name: 'Bench press',
          sets: 5, reps: 5, restSec: 210, restLabel: '3–4 min', inc: 2.5,
          notes: [
            'Ramp: bar → 40% → 60% → 80% → work sets',
            'All 25 reps at RPE 8 or under → +2.5 kg next session',
          ],
        },
        {
          type: 'main', key: 'chin', name: 'Weighted chin-ups',
          sets: 5, reps: 5, restSec: 180, restLabel: '3 min', inc: 2.5,
          notes: ['One grip per 6-week block'],
        },
        {
          type: 'superset', restSec: 75, items: [
            { key: 'fly', name: 'Chest fly', sets: 3, reps: '10–15' },
            { key: 'csrow', name: 'Chest-supported row', sets: 3, reps: '10–15' },
          ],
        },
        {
          type: 'superset', restSec: 60, items: [
            { key: 'facepull', name: 'Face pull', sets: 3, reps: '12–15' },
            { key: 'band', name: 'Physio band homework', sets: 3, reps: 'per physio' },
          ],
        },
      ],
      caution: 'Shoulder: lateral raises frozen until discharge. Re-entry = cable raise, scapular plane, 2×15 light, physio sets the date.',
    },

    {
      id: 'd2', n: 2, name: 'Run', kind: 'run', minutes: 45,
      note: 'Zone 2, conversational pace.',
    },

    {
      id: 'd3', n: 3, name: 'Lower', kind: 'lift', minutes: 70,
      blocks: [
        {
          type: 'main', key: 'squat', name: 'Back squat',
          sets: 5, reps: 5, restSec: 210, restLabel: '3–4 min', inc: 5,
          notes: [
            'Pyramid up to working weight',
            '25 clean reps → +5 kg',
          ],
        },
        {
          type: 'single', key: 'rdl', name: 'Romanian deadlift',
          sets: 3, reps: '8–10', restSec: 120, restLabel: '2 min',
        },
        {
          type: 'superset', restSec: 75, items: [
            { key: 'lunge', name: 'Reverse lunge', sets: 3, reps: '8–12 / leg', swap: 'swap: leg press 3×10–12' },
            { key: 'calf', name: 'Seated calf raise', sets: 4, reps: '10–15', cue: 'slow, full ROM' },
          ],
        },
        {
          type: 'single', key: 'thrust', name: 'Hip thrust',
          sets: 3, reps: '8–12', restSec: 120, restLabel: '2 min',
          gate: 'Green recovery only. Red Whoop → skip it, session ends.',
        },
      ],
    },

    {
      id: 'd4', n: 4, name: 'Core', kind: 'lift', minutes: 45,
      blocks: [
        { type: 'single', key: 'ropecurl', name: 'Rope ab curls', sets: 4, reps: '8–15', restSec: 90, cue: 'add load weekly · neck neutral' },
        { type: 'single', key: 'kneeraise', name: 'Weighted hanging knee raise', sets: 4, reps: '8–12', restSec: 90, cue: 'lats on, zero swing' },
        { type: 'single', key: 'revcrunch', name: 'Reverse crunch or ab wheel', sets: 3, reps: '10–15', restSec: 75, cue: 'slow eccentric' },
        { type: 'single', key: 'pallof', name: 'Pallof press', sets: 3, reps: '10 / side', restSec: 60 },
        { type: 'finisher', key: 'incline', name: 'Incline walk', detail: '15 min · done' },
      ],
    },

    {
      id: 'd5', n: 5, name: 'Upper B', kind: 'lift', minutes: 70,
      blocks: [
        {
          type: 'main', key: 'ohp', name: 'Standing OHP',
          sets: 5, reps: 5, restSec: 180, restLabel: '3 min', inc: 2.5,
          notes: [
            '25 reps at RPE 8 or under → +2.5 kg',
            'Swap the day it pinches or physio caps it: landmine press 5×5 per side (or two-hand at chest), 25 clean reps → +2.5 kg on the bar',
            'Backup: high-incline DB press, 45–60°, neutral grip, 5×5',
          ],
        },
        {
          type: 'superset', restSec: 90, items: [
            { key: 'dips', name: 'Weighted dips', sets: 3, reps: '8–12' },
            { key: 'dbrow', name: 'One-arm DB row', sets: 3, reps: '8–12' },
          ],
        },
        {
          type: 'superset', restSec: 75, items: [
            { key: 'legcurl', name: 'Leg curl', sets: 3, reps: '8–12' },
            { key: 'hammer', name: 'Hammer curl', sets: 3, reps: '8–12' },
          ],
        },
        {
          type: 'superset', restSec: 60, items: [
            { key: 'triext', name: 'Overhead triceps extension', sets: 3, reps: '10–15' },
            { key: 'reardelt', name: 'Rear-delt fly', sets: 3, reps: '12–15' },
          ],
        },
      ],
    },

    {
      id: 'd6', n: 6, name: 'Run', kind: 'run', minutes: 45,
      note: 'Zone 2, strides optional.',
    },

    {
      id: 'd7', n: 7, name: 'Off', kind: 'off', minutes: 0,
      note: 'Walk if restless.',
    },
  ],

  rules: [
    { title: '5×5 progression', body: 'Add weight after all 25 reps land at RPE 8 or under. +2.5 kg upper, +5 kg lower.' },
    { title: 'Accessories', body: 'Every set hits the top of the rep range → add load.' },
    { title: 'Week 6', body: 'Deload. Half the sets, same loads. Non-negotiable in a deficit.' },
    { title: 'Stall protocol', body: 'Lift stalls 2 weeks with no soreness → +1 set for that muscle next block.' },
    { title: 'Shoulder rule', body: 'One pinch ends the lift for the day. Log it, tell the physio.' },
  ],

  banned: [
    { name: 'Bulgarian split squats', status: 'banned', detail: 'Permanent.' },
    { name: 'Lateral raises', status: 'frozen', detail: 'Until physio discharge.' },
  ],

  track: [
    'Log every 5×5 load and rep count. The log is the evidence, whatever the mirror says.',
    'InBody every 3–4 weeks. Expect 12–24 weeks for the visible shift.',
  ],
};

/* Main lifts tracked in the log, in display order. */
const MAIN_LIFTS = [
  { key: 'bench', name: 'Bench press', inc: 2.5, dayId: 'd1' },
  { key: 'chin',  name: 'Weighted chin-ups', inc: 2.5, dayId: 'd1' },
  { key: 'squat', name: 'Back squat', inc: 5, dayId: 'd3' },
  { key: 'ohp',   name: 'Standing OHP', inc: 2.5, dayId: 'd5' },
];
