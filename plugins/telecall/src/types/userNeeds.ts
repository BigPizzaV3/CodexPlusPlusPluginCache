export type UserIntent =
  | "fiber"
  | "mobile"
  | "fiber_mobile"
  | "tv"
  | "additional_line"
  | "second_residence"
  | "roaming"
  | "pricing"
  | "comparison"
  | "coverage"
  | "existing_customer"
  | "general_information";

export interface UserNeeds {
  people?: number;
  mobileLines?: number;

  fiberRequired?: boolean;
  fiberSpeedRequired?: number; // e.g. 300, 600, 1000

  mobileDataRequired?: number; // e.g. 35, 50, 60, 100, 150, 300, 350

  teleworking?: boolean;
  gaming?: boolean;
  streaming?: boolean;

  netflix?: boolean;
  disneyPlus?: boolean;
  movistarPlus?: boolean;

  sports?: boolean;
  football?: boolean;

  secondResidence?: boolean;

  budget?: number; // Max monthly budget in EUR

  existingCustomer?: boolean;

  country?: string; // For roaming queries
}

export interface IntentDetectionResult {
  intents: UserIntent[];
  extractedNeeds: UserNeeds;
  confidence: number;
  rawQuery: string;
}
