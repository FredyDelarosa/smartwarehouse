# SmartWarehouse — Frontend

Aplicación web para **localizar y controlar productos dentro de un almacén**.

El trabajador escribe el nombre de un producto (o escanea el QR del estante) y
la app le dice **exactamente en qué pasillo, estante y nivel** está, cuánto hay
de ese producto allí, y cronometra cuánto tardó en encontrarlo. Ese tiempo es
el indicador que demuestra la mejora del proyecto.

---

## Stack

| | |
|---|---|
| Framework | **Angular 22.2** (standalone, zoneless, OnPush por defecto) |
| Estado | **Signals** + **Signal Forms** (`@angular/forms/signals`) |
| Datos | `HttpClient` + interceptores funcionales + `httpResource` / `rxResource` |
| Estilos | **TailwindCSS v4** (tokens CSS, sin `tailwind.config.js`) |
| UI | Componentes propios sobre Tailwind — **sin Angular Material** |
| Gráficos | **SVG nativo** — sin Chart.js |
| QR | **`BarcodeDetector` nativo** — sin zxing |
| Paquetes | npm · Node 26 |
| Tests | Vitest (`ng test`) |

> Las decisiones que se apartan del plan original están justificadas una por una
> en **[DECISIONS.md](./DECISIONS.md)**.

---

## Requisitos

- **Node.js 26 LTS** (o superior)
- **npm 10+**
- Backend de SmartWarehouse en `http://localhost:8000`

```bash
node --version
npm --version
```

---

## Instalación

```bash
npm install
npm start          # http://localhost:4200
```

El dev-server hace de proxy de `/api` hacia `http://localhost:8000`
(`proxy.conf.json`), así que **no hay CORS en desarrollo**.

### Modo demostración (sin backend)

El proyecto incluye un backend simulado que replica el almacén ficticio del
proyecto (5 pasillos, 80 ubicaciones, 50 productos, movimientos, incidencias y
un historial de búsquedas con la curva julio→septiembre). Útil para demos
offline, capturas o cuando el servidor no está levantado:

```ts
// src/environments/environment.ts
useMockApi: true,   // por defecto es false
```

En producción es **siempre `false`**: la app nunca muestra datos inventados
cuando el servidor falla.

### Usuarios

| Correo | Contraseña | Rol |
|---|---|---|
| `ana.torres@xyz.com` | `Demo1234!` | Administrador |

> ⚠️ El backend actual solo tiene sembrada esta cuenta, aunque
> `API_FRONTEND.md` documenta tres. En cuanto se ejecute el seed de usuarios,
> el botón "Cuentas de demostración" del login funciona con los tres roles.
> Ver **BUG-2** en [DECISIONS.md](./DECISIONS.md).

---

## Producción

**https://smartwarehouse.inode.cloud** — desplegado y verificado (2026-10-12).

Para desplegar cambios, ver **[DEPLOY.md](./DEPLOY.md)**. Resumen:

```bash
ssh -i <clave> ubuntu@50.16.208.204
sudo deploy-smartwarehouse      # backend + frontend
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en `localhost:4200` |
| `npm run build` | Build de desarrollo |
| `npm run build:prod` | Build optimizado para producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run watch` | Build en modo watch |

---

## Estructura

```
src/app/
├── core/                    # Todo lo transversal a las features
│   ├── models/              # Tipos espejo de los DTOs del backend
│   ├── services/            # ApiService, AuthService, ThemeService, mock
│   ├── interceptors/        # JWT (+refresh compartido), errores, mock API
│   ├── guards/              # authGuard, guestGuard, roleGuard
│   ├── store/               # AuthStore (signals)
│   └── utils/               # format, paginación, debounce
│
├── shared/
│   ├── components/          # Biblioteca UI propia (botón, modal, charts…)
│   └── utils/               # Helpers de Signal Forms
│
├── layout/                  # Shell: sidebar + topbar
│
├── features/                # Una carpeta por dominio
│   ├── auth/                # login, cambio de contraseña
│   ├── dashboard/           # KPIs + alertas de stock
│   ├── busquedas/           # Flujo principal: buscar → ubicar → confirmar
│   ├── productos/           # CRUD con permisos por rol
│   ├── ubicaciones/         # Listado + escáner QR
│   ├── inventario/          # Stock consolidado + alertas
│   ├── movimientos/         # Entrada / salida / traslado
│   ├── incidencias/         # Reportar y resolver
│   └── metricas/            # Comparativa antes vs. después
│
├── app.config.ts            # Providers, interceptores, init
└── app.routes.ts            # Rutas lazy por feature

src/environments/            # environment.ts (dev) / environment.prod.ts
src/styles.css               # Design system: tokens + componentes base
design-system/               # Design system generado por la skill (referencia)
```

---

## Cómo agregar una feature

1. **Modelos** — si la feature tiene DTOs propios, añádelos a `core/models/` y
   expónlos en el barrel `index.ts`. Deben reflejar **exactamente** lo que
   devuelve el backend.

2. **Service** en `features/<nombre>/<nombre>.service.ts`:

```ts
@Service()                       // decorator propio de Angular 22
export class MiService {
  private readonly api = inject(ApiService);

  listar(skip = 0, limit = 20): Observable<MiDto[]> {
    return this.api.get<MiDto[]>('/mi-recurso/', { skip, limit: limit + 1 });
  }
}
```

Toda llamada devuelve `Observable<T>` y pasa por `ApiService`, que ya
antepone `environment.apiUrl`, serializa query params y normaliza los errores
a `ApiError`.

3. **Componente** con signals:

```ts
@Component({
  selector: 'sw-mi-feature',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mi.component.html',
  imports: [ButtonComponent, IconComponent],
})
export class MiComponent {
  readonly datos = httpResource<MiDto>(() => this.api.url('/mi-recurso/'));
}
```

4. **Rutas** en `features/<nombre>/<nombre>.routes.ts`, registradas como
   `loadChildren` en `app.routes.ts` dentro del bloque protegido.

---

## Convenciones

| Tema | Regla |
|---|---|
| Componentes | Standalone implícito. **Siempre** `ChangeDetectionStrategy.OnPush` |
| Servicios | `@Service()` (no `@Injectable`). Un servicio por feature |
| Estado | `signal()` para local, `computed()` para derivados. Nada de `BehaviorSubject` |
| Datos async | `httpResource` (GET simple) o `rxResource` (params reactivas) |
| Formularios | **Signal Forms**. Nunca `FormGroup`/`FormBuilder` |
| Plantillas | `@if` / `@for` (con `track`) / `@switch`. Nunca `*ngIf`/`*ngFor` |
| Estilos | Solo clases de Tailwind y **tokens** del design system. Cero hex inline |
| Colores | `surface` `foreground` `muted-foreground` `border` `accent` `primary` `danger` `warning` `success` `info` |
| Iconos | `<sw-icon name="…">` (SVG inline). **Nunca emojis** |
| URLs | Siempre `environment.apiUrl`. **Nunca** hardcodear dominios |
| Errores | Deja que los lance `ApiService`. `errorInterceptor` los muestra |
| Accesibilidad | `scope="col"`, `aria-label` en botones solo-icono, foco visible, `prefers-reduced-motion` |
| Responsive | Tabla en `sm:`, tarjetas en móvil. probarlo a 375 px |

### Reglas de permisos

`AuthStore.can('permiso')` decide si mostrar una acción. La tabla vive en
`core/models/rol.model.ts`.

> **Esto es UX, no seguridad.** El backend sigue validando cada endpoint; un
> usuario sin permiso que fuerce la llamada recibirá 403.

---

## Variables de entorno

`src/environments/environment.ts` (desarrollo) y `environment.prod.ts`
(producción, sustituido automáticamente en el build de producción).

| Variable | Descripción |
|---|---|
| `production` | `true` en build de producción |
| `apiUrl` | `'api/v1'` — **relativa**: el dev-server hace de proxy |
| `appName` | Nombre mostrado en la UI |
| `useMockApi` | Backend simulado. `false` (con backend real). Siempre `false` en producción |
| `mockLatencyMs` | Latencia artificial del mock |

Para cambiar el backend en otro host, ajusta `proxy.conf.json` (desarrollo) o
sirve la app detrás del mismo dominio (producción, evita CORS).

---

## Despliegue

```bash
npm run build:prod      # salida en dist/SmartWarehouse/browser
```

El build es **estático** (sin SSR). Solo falta la redirección de SPA: cualquier
ruta desconocida debe servir `index.html`.

Nginx:

```nginx
location / {
  root /var/www/smartwarehouse;
  try_files $uri $uri/ /index.html;
}

location /api/ {
  proxy_pass http://localhost:8000;
}
```

> Configura CORS en el backend si sirves el frontend desde otro dominio.

---

## Notas de diseño

La interfaz sigue el sistema de diseño de `design-system/smartwarehouse/MASTER.md`:
**Flat Design + Data-Dense Dashboard**, pensado para leerse de un vistazo en el
pasillo, con guantes y con poca luz.

Decisiones que afectan a la UX:

- **El flujo de búsqueda ocupa una sola pantalla.** El resultado depende del
  `busqueda_id` que devuelve `iniciar`; separarlo obligaría a navegar y volver
  a pedir los datos en el momento justo en que el usuario ya eligió.
- **Pasillo / estante / nivel en tamaño grande** en el resultado: es la
  información que se lee de lejos.
- **Autocomplete con 250 ms de debounce y `switchMap`**, para que escribir
  rápido no genere una ráfaga de peticiones ni respuestas fuera de orden.
- **Modo oscuro** con los mismos tokens semánticos, activado por
  `prefers-color-scheme` o manualmente desde la topbar.
- **Escala de espaciado densa** (4/8 px) propia de tablas de operación.

---

## Estado

Implementados los **Bloques 1, 2 y 3** del plan de trabajo.

### Verificado contra el backend real

| Flujo | Estado |
|---|---|
| Login con JWT + `GET /auth/me` | ✅ |
| Panel con los 6 indicadores + alertas | ✅ |
| Buscar producto (autocomplete con debounce) | ✅ |
| Resultado con ubicaciones y cantidades | ✅ |
| Métricas y comparativa antes/después (↓57,8 % real) | ✅ |
| Listados de productos, ubicaciones, inventario, movimientos, incidencias | ✅ |
| **Generar etiquetas QR + hoja imprimible** | ✅ |
| **QR en detalle y edición de ubicación (descarga SVG/PNG)** | ✅ |
| Diálogo de resolución de incidencia | ✅ (el backend responde 403, ver BUG-3) |
| Filtros, paginación y modales accesibles | ✅ |
| Alta/edición de productos y ubicaciones | ✅ |
| Responsive 375 px / 1440 px y tema oscuro | ✅ |
| **PWA instalable + arranque sin red** | ✅ **Verificado 2026-10-12** |
| Registrar movimiento (entrada/salida/traslado) | ⚠️ Formulario validado; escritura no verificada |
| **Confirmar búsqueda encontrada (cronometrada)** | ✅ **Verificado 2026-10-12** |
| **Nombres de categoría en vez de ids** | ✅ **Verificado 2026-10-12** |

### Bloqueantes en el backend

| # | Incidencia |
|---|---|
**Todos resueltos y verificados contra el backend real el 2026-10-12.**

| # | Incidencia | Estado |
|---|---|---|
| BUG-1 | `POST /busquedas/{id}/finalizar` daba 404 | ✅ Corregido: el flujo cronometra en vivo |
| BUG-2 | Faltaban Supervisor y Almacenero | ✅ Los 3 usuarios entran y la UI cambia por rol |
| BUG-3 | `resolver` rechazaba al Administrador con 403 | ✅ Corregido: responde 200 |
| PET-1 | `GET /categorias/` daba 500 | ✅ Corregido: 200 con las 8 categorías reales |
| PET-2 | `codigo_qr` sin unicidad | ✅ Corregido: responde 409 |
| BUG-4 | `/categorias` no persistía nada (faltaba `commit()`) | ✅ Corregido: crear/desactivar/borrar verificados |

Ambos están detallados con diagnóstico y corrección sugerida en
**[DECISIONS.md](./DECISIONS.md)**.

### Mejoras pendientes (no bloquean)

Todo lo que quedaba del contrato original está resuelto y verificado contra el
backend real. Quedan tres mejoras menores:

| # | Cambio | Por qué |
|---|---|---|
| **OBS-1** | Servir `/assets/products/…` o devolver `foto_url: null` | Hoy todas las fotos dan 404; la UI ya muestra un marcador en su lugar |
| **OBS-3** | Endpoint de stock masivo (`?ids=1,2,3`) | El listado hace ~20 peticiones por página |
| **OBS-5** | `unidad_medida` como `Literal` o tabla | Hoy es texto libre: conviven "pieza", "piezas", "unid"… |

Detalle en [DECISIONS.md](./DECISIONS.md).

> **No tocar sin avisar:** `/metricas/tiempo-promedio` y `/metricas/comparativa`
> devuelven `null` (no `0`) cuando un rango no tiene búsquedas. Es intencionado:
> es lo que permite distinguir "no hay datos" de "el tiempo fue cero". Si se
> cambia a `0`, la comparativa prometerá mejoras del 100 % inexistentes.

### Probar la PWA

La PWA **solo existe en el build de producción**: en `ng serve` no hay service
worker, y así debe ser (si lo estuviera, cachearía el bundle y los cambios que
guardas no se verían).

```bash
# 1. Generar los iconos desde los SVG (solo si los cambias)
npm run generar:iconos      # requiere librsvg2-bin

# 2. Build de producción y servidor local con fallback SPA + proxy a la API
npm run preview             # build + servidor en http://localhost:4300

# O por partes:
npm run build:prod
npm run servir:dist
```

Para comprobar que funciona **de verdad**, entra en `http://localhost:4300`,
espera unos segundos a que se registre el service worker, **para el servidor**
(`Ctrl+C`) y recarga: la app debe seguir arrancando desde la caché. Los datos
no estarán (no se cachea la API a propósito), pero el shell carga.

En Chrome, `DevTools → Application → Manifest` muestra si la app es
instalable; el icono de instalar aparece en la barra de direcciones.

### Pendiente del frontend

- [ ] 4.1 PWA (`@angular/pwa`) — instalable + offline básico
- [ ] 4.3 Tests unitarios con cobertura > 70 % (hoy: 48 tests del núcleo)
- [ ] 4.4 Despliegue en producción