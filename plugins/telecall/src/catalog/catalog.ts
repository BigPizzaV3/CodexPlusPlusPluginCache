import { TeleCallProduct } from '../types/product';
import { FIBER_PRODUCTS } from './fiber';
import { MOBILE_PRODUCTS } from './mobile';
import { COMBINED_PRODUCTS } from './combined';
import { ADDITIONAL_LINE_PRODUCTS } from './additionalLines';
import { SECOND_RESIDENCE_PRODUCTS } from './secondResidence';
import { ROAMING_ZONES } from './roamingData';

export const TELECALL_DISCLAIMER =
  "Demo independiente. TeleCall no es una aplicación oficial de O2. Las tarifas y precios utilizados son datos de referencia basados en información pública de O2 España y pueden cambiar.";

export const ALL_PRODUCTS: TeleCallProduct[] = [
  ...FIBER_PRODUCTS,
  ...MOBILE_PRODUCTS,
  ...COMBINED_PRODUCTS,
  ...ADDITIONAL_LINE_PRODUCTS,
  ...SECOND_RESIDENCE_PRODUCTS
];

export const CATALOG_METADATA = {
  catalogVersion: "1.0.0",
  lastUpdated: "2026-09-19",
  source: "Información pública de referencia de O2 España",
  totalProducts: ALL_PRODUCTS.length,
  roamingZones: ROAMING_ZONES
};
