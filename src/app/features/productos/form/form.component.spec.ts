import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiService } from '../../../core/services/api.service';
import { CategoriasService } from '../../../core/services/categorias.service';
import { CodigoProductoService } from '../../../core/services/codigo-producto.service';
import { ProductoFormComponent, type ProductoFormModel } from './form.component';

/**
 * El código se rellena solo. Regresión de un bug real.
 *
 * Al elegir categoría se llamaba a un método que proponía el código y marcaba
 * esa combinación como "ya sugerida". Pero la lista de códigos existentes llega
 * por red, así que si el usuario elegía categoría antes de que terminara de
 * llegar, la propuesta devolvía `null` (no se puede saber qué códigos están
 * ocupados) y la combinación quedaba marcada como sugerida igualmente. No
 * había segundo intento: el campo se quedaba vacío para siempre y al crear
 * salía «El código es obligatorio» sin ninguna pista de por qué.
 *
 * Se cubre la carrera y el caso de que la persona escriba el código a mano.
 */

const CATEGORIAS = [
  { id: 1, nombre: 'Tornillería', descripcion: null, activo: true },
  { id: 2, nombre: 'Plomería', descripcion: null, activo: true },
  // Categoría nueva, todavía sin prefijo asignado en la convención.
  { id: 3, nombre: 'Ferretería', descripcion: null, activo: true },
];

/** Petición de catálogo que el test resuelve cuando quiere. */
const catalogoPENDIENTE = new Subject<unknown>();

const PRODUCTOS_EXISTENTES = [
  { id: 1, codigo: 'TT001', nombre: 'Tornillo de acero' },
  { id: 2, codigo: 'TA001', nombre: 'Arandela plana' },
];

function crearApiStub(cargaRetrasada: { pendiente: boolean }) {
  return {
    get: (url: string) => {
      if (url.startsWith('/categorias')) return of(CATEGORIAS);
      if (url.startsWith('/productos/')) {
        if (cargaRetrasada.pendiente) return of([]); // aún no ha llegado
        return of(PRODUCTOS_EXISTENTES);
      }
      return of(null);
    },
    post: () => of(null),
    patch: () => of(null),
  } as unknown as ApiService;
}

describe('ProductoFormComponent · generación automática del código', () => {
  let fixture: ComponentFixture<ProductoFormComponent>;
  let componente: ProductoFormComponent;
  let api: ReturnType<typeof crearApiStub>;

  beforeEach(async () => {
    api = crearApiStub({ pendiente: false });
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // La plantilla tiene un routerLink («Volver a productos»): sin el
        // router, DI falla al montar el componente.
        provideRouter([]),
        { provide: ApiService, useValue: api },
        {
          provide: CategoriasService,
          useValue: {
            cargar: () => undefined,
            items: () => CATEGORIAS,
            disponible: () => true,
            opcionesConFallback: (actual: number | null) =>
              CATEGORIAS.map((c) => ({ value: String(c.id), label: c.nombre })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductoFormComponent);
    componente = fixture.componentInstance;
  });

  function rellenar(categoriaId: string, nombre: string): void {
    componente.model.set({ ...componente.model(), categoria_id: categoriaId, nombre });
  }

  it('rellena el código con categoría + inicial al elegir ambas', () => {
    componente.codigos.cargar();
    fixture.detectChanges();
    rellenar('1', 'Tornillo de acero');
    fixture.detectChanges();

    // T de Tornillería + T de Tornillo, y TT001 ya existe → TT002.
    expect(componente.model().codigo).toBe('TT002');
  });

  it('cambia el código cuando cambia la inicial del nombre', () => {
    componente.codigos.cargar();
    fixture.detectChanges();
    rellenar('1', 'Tornillo');
    fixture.detectChanges();
    expect(componente.model().codigo).toBe('TT002');

    // Cambia la inicial: pasa a la serie de Arandelas.
    componente.model.update((m: ProductoFormModel) => ({ ...m, nombre: 'Arandela' }));
    fixture.detectChanges();
    expect(componente.model().codigo).toBe('TA002');
  });

  it('espera a que el catálogo termine y entonces rellena el campo', async () => {
    // La carrera de verdad: la petición sigue en vuelo, no «vuelve vacía».
    // Antes este test devolvía `of([])`, que no simula nada: una respuesta
    // vacía llega igual de rápido y, con la semántica correcta, debe generar
    // código (se cubre en el bloque de almacén nuevo).
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            get: (url: string) => {
              if (url.startsWith('/categorias')) return of(CATEGORIAS);
              return catalogoPENDIENTE;   // Subject sin resolver todavía
            },
            post: () => of(null),
            patch: () => of(null),
          },
        },
        {
          provide: CategoriasService,
          useValue: {
            cargar: () => undefined,
            items: () => CATEGORIAS,
            disponible: () => true,
            opcionesConFallback: () =>
              CATEGORIAS.map((c) => ({ value: String(c.id), label: c.nombre })),
          },
        },
      ],
    });
    const f = TestBed.createComponent(ProductoFormComponent);
    f.componentInstance.codigos.cargar();
    f.componentInstance.model.set({
      ...f.componentInstance.model(),
      categoria_id: '1',
      nombre: 'Tornillo',
    });
    await f.whenStable();

    // Catálogo sin resolver: no se puede saber qué está ocupado, el campo
    // sigue vacío.
    expect(f.componentInstance.codigos.listo()).toBe(false);
    expect(f.componentInstance.form.codigo().value()).toBe('');

    // Llega la lista: el campo se rellena solo, sin tocar nada más.
    catalogoPENDIENTE.next(PRODUCTOS_EXISTENTES);
    catalogoPENDIENTE.complete();
    await f.whenStable();

    expect(f.componentInstance.codigos.listo()).toBe(true);
    expect(f.componentInstance.form.codigo().value()).toBe('TT002');
  });

  it('no pisa un código que la persona escribió a mano', () => {
    componente.codigos.cargar();
    fixture.detectChanges();
    rellenar('1', 'Tornillo');
    fixture.detectChanges();

    // Simula que la persona teclea su propio código.
    componente.onCodigoManual({ target: { value: 'MI-CODIGO' } } as unknown as Event);
    componente.model.update((m: ProductoFormModel) => ({ ...m, codigo: 'MI-CODIGO' }));
    // Cambia la inicial: el efecto no debe tocar lo suyo.
    componente.model.update((m: ProductoFormModel) => ({ ...m, nombre: 'Arandela' }));
    fixture.detectChanges();

    expect(componente.model().codigo).toBe('MI-CODIGO');
  });

  it('genera el código en el envío si el campo sigue vacío', () => {
    componente.codigos.cargar();
    fixture.detectChanges();
    // Formulario medio rellenado y el usuario no ha ido al campo de código.
    componente.model.update((m: ProductoFormModel) => ({
      ...m,
      codigo: '',
      categoria_id: '2',
      nombre: 'Tubería PVC',
      unidad_medida: 'metro',
    }));
    fixture.detectChanges();
    componente.model.update((m: ProductoFormModel) => ({ ...m, codigo: '' }));
    fixture.detectChanges();

    componente.asegurarCodigo();
    // P de Plomería + T de Tubería.
    expect(componente.model().codigo).toBe('PT001');
  });

  it('la leyenda nombra el código exacto que va a salir', () => {
    componente.codigos.cargar();
    fixture.detectChanges();
    rellenar('1', 'Tornillo');
    fixture.detectChanges();

    const pista = componente.pistaCodigo();
    expect(pista).toContain('T (categoría)');
    // TT001 ya existe en el catálogo de ejemplo, así que el siguiente libre
    // es TT002. La leyenda enseña ese, no un número inventado.
    expect(pista).toContain('TT002');
    expect(pista).not.toContain('TT000');
  });

  it('avisa cuando la categoría no tiene prefijo en vez de prometer autogeneración', () => {
    componente.codigos.cargar();
    fixture.detectChanges();
    componente.model.update((m: ProductoFormModel) => ({ ...m, categoria_id: '3', nombre: 'Martillo' }));
    fixture.detectChanges();

    expect(componente.pistaCodigo()).toContain('no tiene prefijo');
  });
});
describe('ProductoFormComponent · almacén recién creado, sin productos', () => {
  /**
   * Este es el bug que reportó el usuario en su almacén nuevo.
   *
   * La generación se bloqueaba con `usados.size === 0`,thinking que si no hay
   * códigos cargados es que no se puede saber qué está ocupado. Pero un almacén
   * recién creado NO tiene productos: la lista llega vacía y, por tanto, el
   * código no se proponía nunca. La leyenda, en cambio, sí caía en un ejemplo
   * de reserva —un `Set` vacío es «truthy» en JavaScript— así que mostraba
   * «→ TT001» mientras el campo se quedaba en blanco. Al crear: «el código es
   * obligatorio».
   *
   * Con cero productos hay que proponer el PRIMER código de la serie: es justo
   * el único caso en el que no hay colisión posible.
   */
  async function montarConCatalogo(productos: unknown[]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            get: (url: string) => (url.startsWith('/categorias') ? of(CATEGORIAS) : of(productos)),
            post: () => of(null),
            patch: () => of(null),
          },
        },
        {
          provide: CategoriasService,
          useValue: {
            cargar: () => undefined,
            items: () => CATEGORIAS,
            disponible: () => true,
            opcionesConFallback: () =>
              CATEGORIAS.map((c) => ({ value: String(c.id), label: c.nombre })),
          },
        },
      ],
    });
    const f = TestBed.createComponent(ProductoFormComponent);
    f.componentInstance.codigos.cargar();
    await f.whenStable();
    return f;
  }

  it('propone el primer código aunque el catálogo venga vacío', async () => {
    const f = await montarConCatalogo([]);

    f.componentInstance.model.set({
      ...f.componentInstance.model(),
      categoria_id: '1',
      nombre: 'Tornillo de acero',
    });
    await f.whenStable();

    expect(f.componentInstance.codigos.usados().size).toBe(0);
    expect(f.componentInstance.model().codigo).toBe('TT001');
    // Lo que ve la persona en el input, no solo el modelo.
    expect(f.componentInstance.form.codigo().value()).toBe('TT001');
  });

  it('también propone si la carga de códigos falla', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            get: (url: string) => {
              if (url.startsWith('/categorias')) return of(CATEGORIAS);
              // El catálogo de productos falla: el usuario NO puede quedarse
              // sin poder crear un producto por un fallo de red.
              return throwError(() => new Error('sin red'));
            },
            post: () => of(null),
            patch: () => of(null),
          },
        },
        {
          provide: CategoriasService,
          useValue: {
            cargar: () => undefined,
            items: () => CATEGORIAS,
            disponible: () => true,
            opcionesConFallback: () =>
              CATEGORIAS.map((c) => ({ value: String(c.id), label: c.nombre })),
          },
        },
      ],
    });
    const f = TestBed.createComponent(ProductoFormComponent);
    f.componentInstance.codigos.cargar();
    await f.whenStable();

    f.componentInstance.model.set({
      ...f.componentInstance.model(),
      categoria_id: '1',
      nombre: 'Tornillo de acero',
    });
    await f.whenStable();

    expect(f.componentInstance.form.codigo().value()).toBe('TT001');
  });

  it('la leyenda y el campo dicen lo mismo', async () => {
    const f = await montarConCatalogo([]);
    f.componentInstance.model.set({
      ...f.componentInstance.model(),
      categoria_id: '1',
      nombre: 'Tornillo de acero',
    });
    await f.whenStable();

    // Si la leyenda enseña un código, el campo tiene que tener ese mismo.
    const pista = f.componentInstance.pistaCodigo() ?? '';
    const esperado = f.componentInstance.model().codigo;
    expect(pista).toContain(esperado);
  });
});

describe('ProductoFormComponent · el MODEL y el FORM no pueden divergir', () => {
  /**
   * Este es el bug que reportó el usuario: la leyenda enseñaba el código pero
   * el campo se quedaba vacío y al crear salía «el código es obligatorio».
   *
   * Mis tests anteriores miraban `model().codigo`, que SÍ se rellenaba. Lo que
   * ve la persona es `[formField]="campos.codigo"`, y eso es otra cosa: un
   * `model.update()` no necesariamente alcanza al campo del formulario. Un
   * test que mira el modelo da verde con el campo vacío delante.
   */
  it('el campo del formulario recibe el código, no solo el modelo', async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            get: (url: string) =>
              url.startsWith('/categorias') ? of(CATEGORIAS) : of(PRODUCTOS_EXISTENTES),
            post: () => of(null),
            patch: () => of(null),
          },
        },
        {
          provide: CategoriasService,
          useValue: {
            cargar: () => undefined,
            items: () => CATEGORIAS,
            disponible: () => true,
            opcionesConFallback: () =>
              CATEGORIAS.map((c) => ({ value: String(c.id), label: c.nombre })),
          },
        },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ProductoFormComponent);
    f.componentInstance.codigos.cargar();
    await f.whenStable();
    f.componentInstance.model.set({ ...f.componentInstance.model(), categoria_id: '1' });
    f.componentInstance.model.update((m: ProductoFormModel) => ({
      ...m,
      nombre: 'Tornillo de acero',
    }));
    await f.whenStable();

    // Lo que ve la persona en el input.
    console.log('  model().codigo  =', JSON.stringify(f.componentInstance.model().codigo));
    console.log('  form.codigo()   =', JSON.stringify(f.componentInstance.form.codigo().value()));
    expect(f.componentInstance.form.codigo().value()).not.toBe('');
  });
});
