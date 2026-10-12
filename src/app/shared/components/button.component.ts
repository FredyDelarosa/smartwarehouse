import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent, type IconName } from './icon.component';

/**
 * Botón base de la app.
 *
 * Variantes: primary | secondary | ghost | danger | success
 * Tamaños: sm | md | lg
 *
 * Se usa `<button>` real cuando hay acción (navegación va con routerLink
 * para conservar cmd+click y accessibility), así que este componente NO
 * gestiona navegación.
 */
@Component({
  selector: 'sw-btn',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [class]="classes()"
    >
      @if (loading()) {
        <sw-icon name="cargando" [size]="sizeIcon()" class="animate-spin" />
        <span class="sr-only-focusable">{{ loadingLabel() }}</span>
      } @else if (icon()) {
        <sw-icon [name]="icon()!" [size]="sizeIcon()" />
      }
      @if (label()) {
        <span [class.sr-only-focusable]="iconOnly()">{{ label() }}</span>
      }
    </button>
  `,
  imports: [IconComponent],
  host: { class: 'inline-flex' },
})
export class ButtonComponent {
  readonly label = input<string>('');
  readonly variant = input<'primary' | 'secondary' | 'ghost' | 'danger' | 'success'>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly loadingLabel = input<string>('Procesando…');
  readonly icon = input<IconName | null>(null);
  /** Botón solo-icono: exige `label` para lectores de pantalla. */
  readonly iconOnly = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);

  readonly sizeIcon = computed(() => ({ sm: 16, md: 18, lg: 20 })[this.size()]);

  readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';
    const sizes = {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-3.5 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    } as const;

    const variants = {
      primary: 'bg-primary text-on-primary hover:bg-primary-hover',
      secondary:
        'bg-surface text-foreground border border-border-strong hover:bg-surface-sunken',
      ghost: 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground',
      danger: 'bg-danger text-white hover:bg-danger-hover',
      success: 'bg-success text-white hover:bg-accent-hover',
    } as const;

    const iconOnlySize = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-2.5',
    } as const;

    const width = this.fullWidth() ? 'w-full' : '';
    const pad = this.iconOnly() ? iconOnlySize[this.size()] : sizes[this.size()];

    return [base, pad, variants[this.variant()], width].filter(Boolean).join(' ');
  });
}