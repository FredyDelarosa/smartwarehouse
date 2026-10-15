import type { ProductoEnUbicacion, UbicacionStock } from '../../../core/models/ubicacion.model';

/**
 * Agrupación de las listas de estante (PET-4).
 *
 * ## Por qué el QR se sustituye por una lista
 *
 * El QR no era un dato: era una clave de búsqueda dentro de `ubicaciones`. Una
 * lista por estante es **la misma información, agrupada de otra forma**, así
 * que no hace falta tocar el modelo de datos ni añadir endpoints: se agrupa
 * en memoria lo que ya devuelve `GET /inventario/ubicaciones`.
 *
 * ## La diferencia de fondo
 *
 * El QR se escanea y siempre está al día. Una lista impresa es una fotografía:
 * si mañana se mueven tres cajas, la lista sigue diciendo lo de hasta ayer.
 * Se acepta porque es legible sin cámara y porque el almacén la puede
 * reimprimir cuando cambia algo, pero conviene tenerlo presente.
 *
 * ## El nivel es la clave de agrupación, no el estante
 *
 * Un estante (P2-A) tiene tres alturas, es decir tres ubicaciones. La lista
 * por estante las agrupa y las muestra como subniveles; la lista por pasillo
 * agrupa estantes y, dentro de cada uno, sus niveles. El mismo producto puede
 * estar en dos niveles distintos y por eso se suman por nivel y no por
 * estante: en una lista por estante conviene distinguir «20 unidades en el
 * suelo» de «20 repartidas en tres alturas».
 */

/** Un nivel concreto: un producto y cuántas unidades hay ahí. */
export type LineaNivel = {
  producto_id: number;
  codigo: string;
  nombre: string;
  cantidad: number;
};

/** Una altura de un estante (P2-A-01, P2-A-02…). */
export type NivelResumen = {
  codigo: string;
  nivel: string;
  productos: LineaNivel[];
  totalUnidades: number;
};

/** Un estante con todas sus alturas. */
export type EstanteResumen = {
  estante: string;
  niveles: NivelResumen[];
  totalUnidades: number;
  /** Códigos de todos los niveles, para el título. Ej: P2-A-01, P2-A-02. */
  codigos: string[];
};

/** Un pasillo con todos sus estantes. */
export type PasilloResumen = {
  pasillo: string;
  estantes: EstanteResumen[];
  totalUnidades: number;
  totalProductos: number;
};

/** Ordena las unidades por su valor como número, no por su texto. */
function porNumero(a: string, b: string): number {
  return (Number(a) || 0) - (Number(b) || 0);
}

/**
 * Una hoja por pasillo, con sus estantes y dentro sus niveles.
 *
 * Se ordena por pasillo, estante y nivel para que la lista salga en el mismo
 * orden en que se recorre el almacén físicamente.
 */
export function agruparPorPasillo(stock: readonly UbicacionStock[]): PasilloResumen[] {
  const porPasillo = new Map<string, Map<string, Map<string, NivelResumen>>>();

  for (const u of stock) {
    let estantes = porPasillo.get(u.pasillo);
    if (!estantes) {
      estantes = new Map();
      porPasillo.set(u.pasillo, estantes);
    }
    let niveles = estantes.get(u.estante);
    if (!niveles) {
      niveles = new Map();
      estantes.set(u.estante, niveles);
    }
    const anterior = niveles.get(u.nivel);
    const productos: LineaNivel[] = anterior
      ? [...anterior.productos]
      : [];
    for (const p of u.productos as ProductoEnUbicacion[]) {
      productos.push({
        producto_id: p.producto_id,
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad: p.cantidad,
      });
    }
    productos.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
    niveles.set(u.nivel, {
      codigo: u.codigo_ubicacion,
      nivel: u.nivel,
      productos,
      totalUnidades: productos.reduce((s, p) => s + p.cantidad, 0),
    });
  }

  return [...porPasillo.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))
    .map(([pasillo, estantes]) => {
      const listaEstantes: EstanteResumen[] = [...estantes.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'es'))
        .map(([estante, niveles]) => {
          const listaNiveles = [...niveles.values()].sort((a, b) => porNumero(a.nivel, b.nivel));
          return {
            estante,
            niveles: listaNiveles,
            totalUnidades: listaNiveles.reduce((s, n) => s + n.totalUnidades, 0),
            codigos: listaNiveles.map((n) => n.codigo),
          };
        });
      return {
        pasillo,
        estantes: listaEstantes,
        totalUnidades: listaEstantes.reduce((s, e) => s + e.totalUnidades, 0),
        // "Productos distintos", no unidades: es el número de filas que verá
        // quien lea la lista.
        totalProductos: new Set(
          listaEstantes.flatMap((e) => e.niveles.flatMap((n) => n.productos.map((p) => p.producto_id))),
        ).size,
      };
    });
}

/** Una hoja por estante, para colgar en el propio estante. */
export function estantesDe(pasillo: PasilloResumen | undefined): EstanteResumen[] {
  return pasillo?.estantes ?? [];
}
