export type AnalyticsEventType =
  | "search"
  | "intent_detected"
  | "product_viewed"
  | "comparison"
  | "recommendation"
  | "pricing_query"
  | "contract_click";

export interface AnalyticsEvent {
  id: string;
  timestamp: string;
  eventType: AnalyticsEventType;
  payload: {
    query?: string;
    intents?: string[];
    productId?: string;
    productName?: string;
    recommendedIds?: string[];
    price?: number;
    filters?: Record<string, any>;
  };
}
