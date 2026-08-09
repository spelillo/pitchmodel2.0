import { Player } from "@/types";

// Mock roster data. This isolated module is the seam where a real
// roster/Statcast ingestion service will plug in later — the rest of
// the app only depends on the Player shape, not on how it's sourced.

export const PITCHERS: Player[] = [
  { id: "p-skenes", name: "Paul Skenes", team: "PIT", throws: "R", role: "pitcher" },
  { id: "p-skubal", name: "Tarik Skubal", team: "DET", throws: "L", role: "pitcher" },
  { id: "p-cole", name: "Gerrit Cole", team: "NYY", throws: "R", role: "pitcher" },
  { id: "p-degrom", name: "Jacob deGrom", team: "TEX", throws: "R", role: "pitcher" },
  { id: "p-sale", name: "Chris Sale", team: "ATL", throws: "L", role: "pitcher" },
  { id: "p-gausman", name: "Kevin Gausman", team: "TOR", throws: "R", role: "pitcher" },
  { id: "p-webb", name: "Logan Webb", team: "SF", throws: "R", role: "pitcher" },
  { id: "p-burnes", name: "Corbin Burnes", team: "ARI", throws: "R", role: "pitcher" },
  { id: "p-strider", name: "Spencer Strider", team: "ATL", throws: "R", role: "pitcher" },
  { id: "p-glasnow", name: "Tyler Glasnow", team: "LAD", throws: "R", role: "pitcher" },
  { id: "p-fried", name: "Max Fried", team: "NYY", throws: "L", role: "pitcher" },
  { id: "p-crochet", name: "Garrett Crochet", team: "BOS", throws: "L", role: "pitcher" },
  { id: "p-lopez", name: "Pablo Lopez", team: "MIN", throws: "R", role: "pitcher" },
  { id: "p-ragans", name: "Cole Ragans", team: "KC", throws: "L", role: "pitcher" },
  { id: "p-eflin", name: "Zach Eflin", team: "TB", throws: "R", role: "pitcher" },
  { id: "p-valdez", name: "Framber Valdez", team: "HOU", throws: "L", role: "pitcher" },
  { id: "p-alcantara", name: "Sandy Alcantara", team: "MIA", throws: "R", role: "pitcher" },
  { id: "p-wheeler", name: "Zack Wheeler", team: "PHI", throws: "R", role: "pitcher" },
  { id: "p-mize", name: "Casey Mize", team: "DET", throws: "R", role: "pitcher" },
  { id: "p-king", name: "Michael King", team: "SD", throws: "R", role: "pitcher" },
];

export const BATTERS: Player[] = [
  { id: "b-judge", name: "Aaron Judge", team: "NYY", bats: "R", role: "batter" },
  { id: "b-ohtani", name: "Shohei Ohtani", team: "LAD", bats: "L", role: "batter" },
  { id: "b-witt", name: "Bobby Witt Jr.", team: "KC", bats: "R", role: "batter" },
  { id: "b-soto", name: "Juan Soto", team: "NYM", bats: "L", role: "batter" },
  { id: "b-betts", name: "Mookie Betts", team: "LAD", bats: "R", role: "batter" },
  { id: "b-alvarez", name: "Yordan Alvarez", team: "HOU", bats: "L", role: "batter" },
  { id: "b-devers", name: "Rafael Devers", team: "BOS", bats: "L", role: "batter" },
  { id: "b-freeman", name: "Freddie Freeman", team: "LAD", bats: "L", role: "batter" },
  { id: "b-tucker", name: "Kyle Tucker", team: "CHC", bats: "L", role: "batter" },
  { id: "b-acuna", name: "Ronald Acuna Jr.", team: "ATL", bats: "R", role: "batter" },
  { id: "b-arraez", name: "Luis Arraez", team: "SD", bats: "L", role: "batter" },
  { id: "b-ramirez", name: "Jose Ramirez", team: "CLE", bats: "S", role: "batter" },
  { id: "b-riley", name: "Austin Riley", team: "ATL", bats: "R", role: "batter" },
  { id: "b-olson", name: "Matt Olson", team: "ATL", bats: "L", role: "batter" },
  { id: "b-buxton", name: "Byron Buxton", team: "MIN", bats: "R", role: "batter" },
  { id: "b-desmond", name: "Elly De La Cruz", team: "CIN", bats: "S", role: "batter" },
  { id: "b-seager", name: "Corey Seager", team: "TEX", bats: "L", role: "batter" },
  { id: "b-harper", name: "Bryce Harper", team: "PHI", bats: "L", role: "batter" },
  { id: "b-chisholm", name: "Jazz Chisholm Jr.", team: "NYY", bats: "L", role: "batter" },
  { id: "b-carroll", name: "Corbin Carroll", team: "ARI", bats: "L", role: "batter" },
];

export function searchPlayers(players: Player[], query: string): Player[] {
  const q = query.trim().toLowerCase();
  if (!q) return players;
  return players.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q)
  );
}
