/**
 * Tipos de la API nativa `BarcodeDetector`.
 *
 * `BarcodeDetector` todavía NO está en `lib.dom.d.ts` de TypeScript 6, así
 * que la declaramos aquí con el subconjunto que usa la app. Cuando el
 * proyecto suba de versión de TypeScript y la API entre en el lib, este
 * archivo puede borrarse sin tocar el escáner.
 *
 * Referencia: https://developer.mozilla.org/docs/Web/API/BarcodeDetector
 */

interface DetectedBarcode {
  /** Texto crudo leído del código. Para un QR es el string completo. */
  readonly rawValue: string;
  readonly boundingBox: DOMRectReadOnly;
  readonly cornerPoints: ReadonlyArray<{ x: number; y: number }>;
}

interface BarcodeDetectorOptions {
  formats: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}