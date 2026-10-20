import type { RoomDims } from "./room";

// Deck 7 floor plan for Worklive: 24 docking stations (4 rows × 6), aisles behind every row,
// gaps between consoles to cross, the break area along the back wall and the fun zone in front.

export const DIMS: RoomDims = { x0: -10.6, x1: 10.6, z0: -7.3, z1: 11.6, h: 4.4 };
const COLS = [-1.5, 1.5, -4.5, 4.5, -7.5, 7.5]; // filled from the middle out
const ROWS = [-3.6, -0.2, 3.2, 6.6]; // where the robot stands; its console is 0.75 in front
export const STATIONS: [number, number][] = ROWS.flatMap(z => COLS.map(x => [x, z] as [number, number]));
export const AISLES = [-5.0, -1.6, 1.8, 5.2, 8.7];
export const GAPS = ROWS.map(() => [-9.2, -6, -3, 0, 3, 6, 9.2]);
export const WINDOWS = [-3.6, 0.8];

export const PLACES = {
  pods: [[-9.4, -6.45], [-7.8, -6.45]] as [number, number][],
  oil: [4.6, -6.85] as [number, number],
  hatch: [8.8, -7.0] as [number, number],
  queue: [[10.0, -4.4], [10.0, -3.6]] as [number, number][],
  wheel: [-9.2, 10.1] as [number, number], // hamster-wheel generator (replaces the sofa)
  jukebox: [-7.4, 10.3] as [number, number], // jukebox + disco floor, facing +x (replaces the arcade)
  bin: [-3.7, 11.0] as [number, number],
  zen: [-2.0, 10.7] as [number, number],
  chute: [1.8, 9.9] as [number, number],
  junk: [5.0, 10.9] as [number, number],
  gaming: [7.4, 9.2] as [number, number], // the old gaming station (front right)
  loiter: [[-9.8, -0.9], [9.8, -0.8], [-9.8, 5.5], [9.8, 4.0], [3.8, 9.4], [-3.4, 9.2]] as [number, number][],
  janitor: [-10.2, 8.2] as [number, number],
};

export const HOME = { pos: [0, 18.5, 22] as [number, number, number], target: [0, 0, 1.8] as [number, number, number] };
