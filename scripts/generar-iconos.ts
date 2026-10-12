/**
 * Genera los PNG del icono PWA a partir de los SVG de `public/icons/`.
 *
 * Por qué un script y no los PNG a mano: los iconos tienen que salir de los
 * SVG para que haya una sola fuente de verdad. Si mañana se cambia el color de
 * la marca, se edita el SVG y se ejecuta esto; no hay que redibujar cinco
 * PNG ni acordarse de WHICH tamaños cambiar.
 *
 * Uso:  npx tsx scripts/generar-iconos.ts
 *
 * Requiere `rsvg-convert` (librsvg). Si no está instalado, el script dice qué
 * hacer en lugar de fallar con un error de subprocess.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_ICONOS = resolve(RAIZ, 'public/icons');

interface Icono {
  /** Nombre del SVG de origen. */
  origen: string;
  /** Tamaños en px que hay que generar. */
  tamanos: number[];
}

const ICONOS: Icono[] = [
  // Icono "any": el que usan la mayoría de plataformas.
  { origen: 'icon.svg', tamanos: [72, 96, 128, 144, 152, 192, 256, 384, 512] },
  // Maskable: solo 512, que es lo que pide Chrome para el install prompt.
  { origen: 'icon-maskable.svg', tamanos: [512] },
];

function comprobarRsvg(): void {
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
  } catch {
    console.error(
      [
        'Falta `rsvg-convert`, necesario para convertir los SVG a PNG.',
        '',
        '  Debian/Ubuntu:  sudo apt install librsvg2-bin',
        '  Fedora:          sudo dnf install librsvg2-tools',
        '  macOS:           brew install librsvg',
      ].join('\n'),
    );
    process.exit(1);
  }
}

function main(): void {
  comprobarRsvg();
  mkdirSync(DIR_ICONOS, { recursive: true });

  let generados = 0;
  for (const { origen, tamanos } of ICONOS) {
    const svg = resolve(DIR_ICONOS, origen);
    if (!existsSync(svg)) {
      console.error(`No existe el SVG de origen: ${svg}`);
      process.exit(1);
    }

    const sufijo = origen.includes('maskable') ? '-maskable' : '';
    for (const tamano of tamanos) {
      const destino = resolve(DIR_ICONOS, `icon-${tamano}${sufijo}.png`);
      execFileSync('rsvg-convert', [
        '-w', String(tamano),
        '-h', String(tamano),
        '-o', destino,
        svg,
      ]);
      generados++;
    }
  }

  console.log(`${generados} iconos generados en public/icons/`);
}

main();