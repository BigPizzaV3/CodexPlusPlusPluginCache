import { TeleCallProduct } from './product';
import { PriceBreakdown } from './pricing';
import { UserNeeds } from './userNeeds';

export interface ObjectiveReason {
  feature: string;
  description: string;
  matchesNeed: boolean;
}

export interface Recommendation {
  id: string;
  primaryProduct: TeleCallProduct;
  additionalProducts: TeleCallProduct[];
  pricing: PriceBreakdown;
  objectiveReasons: ObjectiveReason[];
  highlights: string[];
  caveats?: string[];
  exactMatch: boolean;
  relaxedRequirements?: string[];
}

export interface ComparisonRow {
  optionName: string;
  fiberSpeed: string;
  mobileData: string;
  television: string;
  services: string;
  monthlyPrice: string;
  keyDifferentiator: string;
}

export interface ComparisonResult {
  headers: string[];
  rows: ComparisonRow[];
  summaryDifferences: string[];
}

export interface RecommendationEngineResult {
  userNeeds: UserNeeds;
  recommendations: Recommendation[];
  comparison?: ComparisonResult;
  budgetStatus: "within_budget" | "budget_exceeded" | "no_budget_specified";
  message: string;
}
