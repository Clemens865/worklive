// Shared office layout in metres. Both visual styles build from this data.
export const ROOM = { minX: -16, maxX: 16, minZ: -10, maxZ: 10, height: 3.4 };

// Desk size. Chair, keyboard and monitor keep fixed distances to the desk's FRONT edge (+z), so seated poses
// stay valid for any desk size; extra depth becomes free space behind the monitor.
export const DESK = { w: 2.3, d: 1.05 };
// Desk centres: three columns of desk pairs, two rows, wide aisles. Agent sits on +z, monitor at -z.
// The office starts with the first 12 slots; hiring beyond that adds desks pair by pair (rows 3 and 4).
const COLS = [-13.0, -10.7, -6.6, -4.3, -0.2, 2.1], ROWS = [-6.0, -1.2, 3.6, 7.4];
export const DESK_SLOTS = ROWS.flatMap(z => COLS.map(x => ({ x, z })));
export const DESKS = DESK_SLOTS.slice(0, 12); // grows at runtime (push), never shrinks
export const seatOf = d => ({ x: d.x, z: d.z + DESK.d / 2 + 0.29, yaw: Math.PI });
export const monitorOf = d => ({ x: d.x, y: 1.12, z: d.z - DESK.d / 2 + 0.21 });
export const keyboardZ = DESK.d / 2 - 0.15; // desk-local z of the keyboard centre
// Where an agent stands before sliding into / after getting up from its desk chair (beside the chair).
export const deskApproach = seat => ({ x: seat.x + 0.72, z: seat.z + 0.12 });

export const STATUS = {
  working: { color: "#34c77b", label: "Working" },
  needs: { color: "#f5a524", label: "Needs you" },
  review: { color: "#8b6cf0", label: "Ready for review" },
  idle: { color: "#a3aaa6", label: "Free" },
};
export const PROVIDER = {
  codex: { color: "#2D9D8F", name: "Codex" },
  claude: { color: "#D97757", name: "Claude Code" },
};

// Furniture placements used by both styles.
export const LOUNGE = { sofa: { x: 8.6, z: 5.2, yaw: Math.PI / 2 }, table: { x: 10.5, z: 5.2 },
  chairs: [{ x: 10.5, z: 3.4, yaw: 0 }, { x: 10.5, z: 7.0, yaw: Math.PI }], screen: { x: 15.9, z: 5.2 } };
export const CAFE = { counter: { x: 7.4, z: -9.5, w: 5.0 }, table: { x: 7.4, z: -6.3 },
  stools: [{ x: 6.6, z: -6.3 }, { x: 8.2, z: -6.3 }, { x: 7.4, z: -5.5 }] };
export const MEETING = { minX: 11.2, maxX: 16, minZ: -10, maxZ: -4.4 };
export const PLANTS = [{ x: -15.3, z: -9.3, s: 1.2 }, { x: 4.4, z: -3.6, s: 0.9 }, { x: 15.2, z: 9.3, s: 1 },
  { x: -15.3, z: 9.3, s: 0.9 }, { x: 10.4, z: -9.4, s: 1 }, { x: -8.6, z: -9.4, s: 1.1 }, { x: 4.4, z: 1.6, s: 0.9 }];
