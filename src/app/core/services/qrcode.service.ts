import { Injectable } from '@angular/core';
import qrcode from 'qrcode-generator';

/** Nivel de corrección de errores del estándar ISO/IEC 18004. */
export type QrNivel = 'L' | 'M' | 'Q' | 'H';

export type QrOpciones = {
  /** Módulos por lado. 4 ≈ 1 mm a 300 dpi. */
  cellSize?: number;
  /** Módulos de zona tranquila. El estándar pide 4. */
  margin?: number;
  nivel?: QrNivel;
};

const DEFAULTS: Required<QrOpciones> = {
  cellSize: 4,
  margin: 4,
  // H tolera hasta ~30 % del área tapada: en un almacén el código se
  // ensucia, se rasga y se cubre con film. Un QR ilegible es peor que uno
  // "gordo".
  nivel: 'H',
};

/**
 * Genera códigos QR en SVG para las etiquetas del almacén.
 *
 * Por qué SVG y no canvas/PNG: una etiqueta se imprime, y el SVG escala sin
 * que los píxeles se vean al ampliar. Además permite abrir el archivo
 * generado en cualquier editor vectorial.
 *
 * Por qué `qrcode-generator` y no `chart.js`-style libs modernas: 0
 * dependencias, 7 kB y una única API (`createSvgTag`). El único punto débil
 * es que devuelve un string HTML, por eso se sanea en `insertarEn`.
 */
@Injectable({ providedIn: 'root' })
export class QrCodeService {
  /** Caché por contenido+opciones: la misma etiqueta no se regenera. */
  private readonly cache = new Map<string, string>();

  /**
   * Devuelve el QR como fragmento `<svg>` (sin contenedor).
   * Cacheado: llamar dos veces con los mismos datos es gratis.
   */
  svg(texto: string, opciones: QrOpciones = {}): string {
    const opts = { ...DEFAULTS, ...opciones };
    const clave = `${opts.nivel}|${opts.cellSize}|${opts.margin}|${texto}`;

    const cacheado = this.cache.get(clave);
    if (cacheado) return cacheado;

    const qr = qrcode(0, opts.nivel);
    qr.addData(texto);
    qr.make();

    const svg = qr.createSvgTag({ cellSize: opts.cellSize, margin: opts.margin, scalable: true });
    this.cache.set(clave, svg);
    return svg;
  }

  /**
   * Data URL (`data:image/svg+xml;base64,…`) lista para `<img>` o descarga.
   *
   * Se usa base64 (y no `encodeURIComponent`) porque `<img src>` y la
   * descarga por `href` la tratan igual en todos los navegadores.
   */
  dataUrl(texto: string, opciones: QrOpciones = {}): string {
    const svg = this.svg(texto, opciones);
    return 'data:image/svg+xml;base64,' + base64(svg);
  }

  /**
   * Inserta el QR dentro de un elemento del DOM.
   *
   * Se hace con DOM en vez de `[innerHTML]` a propósito: el string viene de
   * una librería de terceros y no queremos meterlo en el binding de Angular
   * (que lo sanitizaría y rompería los `<path>`, o que obligaría a usar
   * `bypassSecurityTrustHtml` y abrir un agujero de XSS).
   */
  insertarEn(contenedor: HTMLElement, texto: string, opciones: QrOpciones = {}): void {
    contenedor.innerHTML = this.svg(texto, opciones);
  }

  /** Lanza la descarga del QR como archivo SVG. */
  descargar(texto: string, nombreArchivo: string, opciones: QrOpciones = {}): void {
    const completo = envolverSvg(this.svg(texto, { ...opciones, cellSize: 8 }), texto);
    descargarBlob(new Blob([completo], { type: 'image/svg+xml;charset=utf-8' }), nombreArchivo);
  }

  /**
   * Descarga el QR como PNG usando un canvas temporal.
   * Útil para quien necesita una imagen plana (WhatsApp, PowerPoint).
   */
  descargarPng(
    texto: string,
    nombreArchivo: string,
    opciones: QrOpciones = {},
    escala = 512,
  ): void {
    const n = modulosDe(texto, opciones);
    const celda = Math.max(1, Math.floor(escala / n));

    const canvas = document.createElement('canvas');
    canvas.width = n * celda;
    canvas.height = n * celda;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';

    const qr = qrcode(0, { ...DEFAULTS, ...opciones }.nivel);
    qr.addData(texto);
    qr.make();

    for (let fila = 0; fila < qr.getModuleCount(); fila++) {
      for (let col = 0; col < qr.getModuleCount(); col++) {
        if (qr.isDark(fila, col)) {
          ctx.fillRect(col * celda, fila * celda, celda, celda);
        }
      }
    }

    canvas.toBlob((blob) => {
      if (blob) descargarBlob(blob, nombreArchivo);
    }, 'image/png');
  }
}

/** Nº total de módulos del QR (datos + zona tranquila) para el cálculo del canvas. */
function modulosDe(texto: string, opciones: QrOpciones): number {
  const opts = { ...DEFAULTS, ...opciones };
  const qr = qrcode(0, opts.nivel);
  qr.addData(texto);
  qr.make();
  return qr.getModuleCount() + opts.margin * 2;
}

/**
 * `createSvgTag` devuelve un `<svg>` sin `xmlns`, sin tamaño y con un `viewBox`
 * calculado. Para un archivo que se va a abrir o imprimir por separado, hace
 * falta un documento SVG válido y autocontenido.
 */
function envolverSvg(fragmento: string, texto: string): string {
  const conXmlns = fragmento.includes('xmlns=')
    ? fragmento
    : fragmento.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    conXmlns.replace('<svg', `<svg data-valor="${escapar(texto)}"`)
  );
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  // Liberar la URL evita que el blob quede retenido en memoria.
  URL.revokeObjectURL(url);
}

/** Convierte a base64 sin depender de `btoa` con acentos (UTF-8). */
function base64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

/** Escapa para atributos XML. */
function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}