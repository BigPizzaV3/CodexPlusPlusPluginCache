import { TeleCallProduct } from '../types/product';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCatalog(products: TeleCallProduct[]): ValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const p of products) {
    // 1. Unique ID
    if (!p.id || typeof p.id !== 'string') {
      errors.push(`Producto sin ID válido: ${JSON.stringify(p)}`);
    } else if (seenIds.has(p.id)) {
      errors.push(`ID duplicado detectado: ${p.id}`);
    } else {
      seenIds.add(p.id);
    }

    // 2. Active status
    if (typeof p.active !== 'boolean') {
      errors.push(`Producto ${p.id} debe tener un booleano active`);
    }

    // 3. Price validation
    if (!p.price || typeof p.price.monthly !== 'number') {
      errors.push(`Producto ${p.id} no tiene precio mensual numérico`);
    } else if (p.price.monthly < 0) {
      errors.push(`Producto ${p.id} tiene un precio mensual negativo: ${p.price.monthly}`);
    }

    // 4. Fiber speed validation
    if (p.fiber) {
      if (typeof p.fiber.speedMbps !== 'number' || p.fiber.speedMbps <= 0) {
        errors.push(`Producto ${p.id} tiene velocidad de fibra inválida: ${p.fiber.speedMbps}`);
      }
    }

    // 5. Mobile GB validation
    if (p.mobile && p.mobile.dataGB !== undefined) {
      if (typeof p.mobile.dataGB !== 'number' || p.mobile.dataGB < 0) {
        errors.push(`Producto ${p.id} tiene datos móviles negativos: ${p.mobile.dataGB}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
