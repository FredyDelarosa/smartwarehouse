import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Ubicacion } from '../../../core/models/ubicacion.model';
import { PAGE_SIZE } from '../../../core/models/paginacion.model';
import { AuthStore } from '../../../core/store/auth.store';
import { QrCodeService } from '../../../core/services/qrcode.service';
import { normalizarPagina, paginaParams } from '../../../core/utils/paginacion';
import { ButtonComponent } from '../../../shared/components/button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { QrCodeComponent } from '../../../shared/components/qr-code.component';
import { UbicacionesService } from '../ubicaciones.service';

/**
 * Hoja de etiquetas QR para imprimir.
 *
 * Caso de uso real: dar de alta las ubicaciones en el sistema, imprimir las
 * etiquetas y pegarlas en cada estante. Es exactamente el punto donde la app
 * deja de ser "consultar" y pasa a "sembrar" el almacén.
 *
 * Diseño: columnas de tarjetas, se marca lo seleccionado y se imprime solo lo
 * marcado. Al imprimir se ocultan los controles con `print:` de Tailwind.
 */
@Component({
  selector: 'sw-etiquetas-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './etiquetas-qr.component.html',
  imports: [
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    IconComponent,
    QrCodeComponent,
  ],
})
export class EtiquetasQrComponent {
  private readonly ubicaciones = inject(UbicacionesService);
  private readonly qr = inject(QrCodeService);
  private readonly store = inject(AuthStore);

  protected readonly pagina = signal(0);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<Ubicacion[]>([]);
  protected readonly tieneMas = signal(false);

  /** Ids marcados para imprimir. */
  private readonly seleccionados = signal<ReadonlySet<number>>(new Set());

  protected readonly seleccion = computed(() => this.seleccionados());
  protected readonly puedeCrear = computed(() => this.store.can('ubicaciones:crear'));

  protected readonly todasSeleccionadas = computed(
    () => this.items().length > 0 && this.seleccionados().size === this.items().length,
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    const { skip, limit } = paginaParams(this.pagina(), PAGE_SIZE);
    this.ubicaciones.listar({ skip, solo_activas: true }, limit).subscribe({
      next: (respuesta) => {
        const pag = normalizarPagina(respuesta, this.pagina(), PAGE_SIZE);
        this.items.set(pag.items);
        this.tieneMas.set(pag.hasNext);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar las ubicaciones.');
      },
    });
  }

  protected alternar(u: Ubicacion): void {
    this.seleccionados.update((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(u.id)) siguiente.delete(u.id);
      else siguiente.add(u.id);
      return siguiente;
    });
  }

  protected alternarTodas(): void {
    this.seleccionados.update((prev) =>
      prev.size === this.items().length ? new Set() : new Set(this.items().map((u) => u.id)),
    );
  }

  protected imprimir(): void {
    if (this.seleccionados().size === 0) return;
    // El usuario confirma en el diálogo nativo: imprimir 60 etiquetas por
    // error sale caro (papel y tinta) y no hay "deshacer".
    const n = this.seleccionados().size;
    if (!confirm(`¿Imprimir ${n} etiqueta${n === 1 ? '' : 's'}?`)) return;
    window.print();
  }

  /** Descarga el QR de una ubicación concreta como SVG. */
  protected descargarUna(u: Ubicacion): void {
    this.qr.descargar(u.codigo_qr, `${u.codigo_qr}.svg`);
  }

  protected irA(pagina: number): void {
    this.pagina.set(Math.max(0, pagina));
    this.cargar();
  }

  /** Texto legible que acompaña al QR en la etiqueta. */
  protected pieDe(u: Ubicacion): string {
    return `Pasillo ${u.pasillo} · Estante ${u.estante} · Nivel ${u.nivel}`;
  }

  /** Una etiqueta marcada se refuerza con un borde de acento. */
  protected tarjetaClasses(u: Ubicacion): string {
    return [
      'sw-card flex flex-col p-3 transition-all print:p-2',
      this.seleccionados().has(u.id)
        ? 'ring-2 ring-accent border-accent'
        : 'border-border',
    ].join(' ');
  }

  protected readonly checkActivo =
    'flex size-4 shrink-0 items-center justify-center rounded border-2 border-accent bg-accent text-white';
  protected readonly checkInactivo =
    'flex size-4 shrink-0 items-center justify-center rounded border-2 border-border-strong bg-surface';
}