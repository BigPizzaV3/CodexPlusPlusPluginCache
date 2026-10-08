import { TeleCallProduct, ProductType } from '../types/product';
import { ALL_PRODUCTS, CATALOG_METADATA } from '../catalog/catalog';
import { validateCatalog } from '../utils/validation';

export class CatalogService {
  private products: TeleCallProduct[];

  constructor(customProducts?: TeleCallProduct[]) {
    this.products = customProducts || ALL_PRODUCTS;
    const validation = validateCatalog(this.products);
    if (!validation.valid) {
      console.warn("Advertencias de validación en el catálogo:", validation.errors);
    }
  }

  public getAllActiveProducts(): TeleCallProduct[] {
    return this.products.filter(p => p.active);
  }

  public getProductById(id: string): TeleCallProduct | undefined {
    return this.products.find(p => p.id === id);
  }

  public getProductsByType(type: ProductType): TeleCallProduct[] {
    return this.products.filter(p => p.active && p.type === type);
  }

  public getFiberProducts(): TeleCallProduct[] {
    return this.getProductsByType("fiber");
  }

  public getMobileProducts(): TeleCallProduct[] {
    return this.getProductsByType("mobile");
  }

  public getCombinedProducts(): TeleCallProduct[] {
    return this.getProductsByType("fiber_mobile");
  }

  public getAdditionalLineProducts(): TeleCallProduct[] {
    return this.getProductsByType("additional_line");
  }

  public getSecondResidenceProducts(): TeleCallProduct[] {
    return this.getProductsByType("second_residence");
  }

  public getMetadata() {
    return CATALOG_METADATA;
  }
}

export const catalogService = new CatalogService();
