export interface Dog {
  id: string;
  name: string;
  age: string;
  breed: string;
  shelter: string;
  location: { x: number; y: number }; // Percentage coordinates for the map
  photo: string;
  description: string;
}

export interface ImpactStats {
  dogsHelped: number;
  donationsMade: number;
  adoptionRequests: number;
}

export type BadgeType = 'Dog Supporter' | 'Rescue Hero' | null;
