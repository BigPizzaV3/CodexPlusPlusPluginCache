import { TeleCallProduct } from '../types/product';
import { PriceBreakdown, PriceItem } from '../types/pricing';
import { ADDITIONAL_LINE_PRODUCTS } from '../catalog/additionalLines';
import { SECOND_RESIDENCE_PRODUCTS } from '../catalog/secondResidence';

export class PricingService {
  /**
   * Calcula el precio total mensual de una configuración de productos
   */
  public calculatePrice(
    baseProduct: TeleCallProduct,
    additionalLinesCount: number = 0,
    preferredAdditionalLineGB: number = 40,
    secondResidenceSpeedMbps?: number
  ): PriceBreakdown {
    const baseMonthly = baseProduct.price?.monthly || 0;
    const items: PriceItem[] = [
      {
        name: baseProduct.name,
        monthly: baseMonthly,
        category: "base",
        detail: baseProduct.description
      }
    ];

    const additionalLinesBreakdown: PriceBreakdown['additionalLines'] = [];
    let additionalLinesTotal = 0;

    if (additionalLinesCount > 0) {
      // Find best matching additional line product
      let addProduct = ADDITIONAL_LINE_PRODUCTS.find(
        p => (p.mobile?.dataGB || 0) >= preferredAdditionalLineGB
      );
      if (!addProduct) {
        // Default to largest or smallest available
        addProduct = ADDITIONAL_LINE_PRODUCTS[0];
      }

      const priceEach = addProduct.price?.monthly || 0;
      const total = priceEach * additionalLinesCount;
      additionalLinesTotal += total;

      additionalLinesBreakdown.push({
        product: addProduct,
        quantity: additionalLinesCount,
        priceEach,
        total
      });

      items.push({
        name: `${additionalLinesCount}x ${addProduct.name}`,
        monthly: total,
        category: "additional_line",
        detail: `${additionalLinesCount} línea(s) adicional(es) de ${addProduct.mobile?.dataGB} GB a ${priceEach} €/ud`
      });
    }

    let secondResidenceBreakdown: PriceBreakdown['secondResidence'] | undefined;
    let secondResidenceTotal = 0;

    if (secondResidenceSpeedMbps) {
      const secProd = SECOND_RESIDENCE_PRODUCTS.find(
        p => (p.fiber?.speedMbps || 0) >= secondResidenceSpeedMbps
      ) || SECOND_RESIDENCE_PRODUCTS[0];

      const secPrice = secProd.price?.monthly || 0;
      secondResidenceTotal = secPrice;
      secondResidenceBreakdown = {
        product: secProd,
        price: secPrice
      };

      items.push({
        name: secProd.name,
        monthly: secPrice,
        category: "second_residence",
        detail: `Fibra de ${secProd.fiber?.speedMbps} Mb para segunda residencia`
      });
    }

    const totalMonthly = baseMonthly + additionalLinesTotal + secondResidenceTotal;

    return {
      baseProduct,
      basePrice: baseMonthly,
      additionalLines: additionalLinesBreakdown,
      secondResidence: secondResidenceBreakdown,
      discounts: [],
      totalMonthly,
      currency: "EUR",
      items
    };
  }

  /**
   * Determina si una configuración cabe dentro del presupuesto del usuario
   */
  public isWithinBudget(totalMonthly: number, budget?: number): boolean {
    if (budget === undefined || budget === null || budget <= 0) return true;
    return totalMonthly <= budget;
  }
}

export const pricingService = new PricingService();
