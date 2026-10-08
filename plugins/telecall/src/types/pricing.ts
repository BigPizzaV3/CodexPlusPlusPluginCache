import { TeleCallProduct } from './product';

export interface PriceItem {
  name: string;
  monthly: number;
  category: "base" | "additional_line" | "tv_addon" | "second_residence" | "discount";
  detail?: string;
}

export interface PriceBreakdown {
  baseProduct: TeleCallProduct;
  basePrice: number;
  additionalLines: Array<{
    product: TeleCallProduct;
    quantity: number;
    priceEach: number;
    total: number;
  }>;
  secondResidence?: {
    product: TeleCallProduct;
    price: number;
  };
  discounts: Array<{
    concept: string;
    amount: number;
  }>;
  totalMonthly: number;
  postPromotionalMonthly?: number;
  currency: "EUR";
  items: PriceItem[];
}
