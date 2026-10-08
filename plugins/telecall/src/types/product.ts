export type ProductType =
  | "fiber"
  | "mobile"
  | "fiber_mobile"
  | "tv"
  | "additional_line"
  | "second_residence";

export interface SourceMetadata {
  sourceName: string;
  sourceUrl?: string;
  retrievedAt?: string;
}

export interface ProductPrice {
  monthly: number;
  currency: "EUR";
  promotional?: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface FiberSpecs {
  speedMbps: number;
  symmetric: boolean;
}

export interface MobileSpecs {
  dataGB?: number;
  unlimitedCalls?: boolean;
  unlimitedSms?: boolean;
  network?: string;
}

export interface TelevisionSpecs {
  movistarPlus?: boolean;
  netflix?: boolean;
  disneyPlus?: boolean;
  sports?: boolean;
  football?: boolean;
}

export interface ProductConditions {
  permanence?: boolean;
  installationIncluded?: boolean;
  routerIncluded?: boolean;
  landlineIncluded?: boolean;
  allowsAdditionalLines?: boolean;
  requiresParentPlan?: string;
  requiresExistingCustomer?: boolean;
}

export interface TeleCallProduct {
  id: string;
  name: string;
  type: ProductType;
  active: boolean;
  description?: string;
  price?: ProductPrice;
  fiber?: FiberSpecs;
  mobile?: MobileSpecs;
  television?: TelevisionSpecs;
  conditions?: ProductConditions;
  source?: SourceMetadata;
}

export interface CatalogData {
  catalogVersion: string;
  lastUpdated: string;
  source: string;
  disclaimer: string;
  products: TeleCallProduct[];
  roaming?: any;
}
