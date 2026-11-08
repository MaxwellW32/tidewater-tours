// Static catalogue for the sample API. A real service would read from a
// database; a fixed list keeps the project focused on shipping, not storage.
export const tours = [
  {
    id: 'sunset-harbour-cruise',
    name: 'Sunset Harbour Cruise',
    durationMinutes: 90,
    priceUsd: 45,
    capacity: 24,
  },
  {
    id: 'mangrove-kayak',
    name: 'Mangrove Kayak Safari',
    durationMinutes: 150,
    priceUsd: 65,
    capacity: 10,
  },
  {
    id: 'lighthouse-walk',
    name: 'Lighthouse Heritage Walk',
    durationMinutes: 120,
    priceUsd: 25,
    capacity: 30,
  },
  {
    id: 'dolphin-watch',
    name: 'Morning Dolphin Watch',
    durationMinutes: 180,
    priceUsd: 80,
    capacity: 16,
  },
];

export function findTour(id) {
  return tours.find((tour) => tour.id === id) ?? null;
}
