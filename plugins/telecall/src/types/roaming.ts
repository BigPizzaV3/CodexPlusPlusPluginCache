export type RoamingZoneType = "zone_1_eu" | "zone_2_and_3_international";

export interface RoamingZoneInfo {
  name: string;
  description: string;
  countries?: string[];
  popularCountries?: string[];
  pricing: {
    calls?: string;
    callsOutgoing?: string;
    callsIncoming?: string;
    sms?: string;
    data?: string;
    extraCosts: boolean;
  };
  notes?: string;
  recommendation?: string;
}

export interface RoamingQueryResult {
  country: string;
  zone: RoamingZoneType;
  zoneName: string;
  isEU: boolean;
  pricing: {
    calls: string;
    sms: string;
    data: string;
    extraCosts: boolean;
  };
  advice: string;
  disclaimer: string;
}
