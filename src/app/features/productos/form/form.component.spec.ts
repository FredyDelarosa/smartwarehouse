import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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

  it('el campo se rellena aunque el catálogo llegue tarde', () => {
    // ESTA es la carrera del bug. Con el catálogo todavía sin llegar no se
    // puede saber qué códigos están ocupados, así que la propuesta es null y
    // el campo sigue vacío. Lo que no puede pasar es que eso se quede así:
    // cuando la lista llegue, tiene que rellenarse solo.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ApiService, useValue: crearApiStub({ pendiente: true }) },
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
    });
    const temprano: ComponentFixture<ProductoFormComponent> = TestBed.createComponent(ProductoFormComponent);
    temprano.componentInstance.codigos.cargar();
    temprano.detectChanges();
    temprano.componentInstance.model.set({
      ...temprano.componentInstance.model(),
      categoria_id: '1',
      nombre: 'Tornillo',
    });
    temprano.detectChanges();

    // Sin lista, nada que proponer: el campo queda vacío.
    expect(temprano.componentInstance.codigos.usados().size).toBe(0);
    expect(temprano.componentInstance.model().codigo).toBe('');

    // Llega la lista (el componente se suscribe a `usados()`).
    temprano.componentInstance.codigos.reservar('TT001');
    temprano.componentInstance.codigos.reservar('TT002');
    temprano.detectChanges();

    expect(temprano.componentInstance.model().codigo).toBe('TT003');
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