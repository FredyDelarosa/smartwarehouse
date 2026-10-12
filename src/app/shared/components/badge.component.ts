import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Estados visuales reutilizables en toda la app. */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/**
 * Etiqueta compacta de estado (activo, tipo de movimiento, rol…).
 *
 * Diseño: fondo teñido + texto del mismo tono. El color nunca es el único
 * portador de información: siempre acompaña a un texto ("Activo", "Dañado"),
 * que es lo que lee el usuario con daltonismo o en escala de grises.
 */
@Component({
  selector: 'sw-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="classes()"
      [attr.title]="title() || null"
    >
      @if (dot()) {
        <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input<boolean>(false);
  readonly size = input<'sm' | 'md'>('sm');
  readonly title = input<string>('');

  readonly classes = computed(() => {
    const tones: Record<BadgeTone, string> = {
      neutral: 'bg-surface-sunken text-muted-foreground border-border',
      info: 'bg-info-surface text-info border-info/30',
      success: 'bg-success-surface text-success border-success/30',
      warning: 'bg-warning-surface text-warning border-warning/30',
      danger: 'bg-danger-surface text-danger border-danger/30',
      accent: 'bg-accent/10 text-accent border-accent/30',
    };
    const sizes = {
      sm: 'px-2 py-0.5 text-[11px] gap-1',
      md: 'px-2.5 py-1 text-xs gap-1.5',
    } as const;

    return [
      'inline-flex items-center rounded-full border font-medium whitespace-nowrap',
      tones[this.tone()],
      sizes[this.size()],
    ].join(' ');
  });
}

/** Convierte estados del dominio en tonos. Cada feature usa esta tabla. */
export const TONE_POR_ESTADO = {
  activo: 'success',
  inactivo: 'neutral',
  alerta: 'danger',
  resuelto: 'success',
  abierto: 'warning',
} as const satisfies Record<string, BadgeTone>;