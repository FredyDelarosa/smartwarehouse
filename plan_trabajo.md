# 📘 Plan de Trabajo — Frontend Angular SmartWarehouse (Actualizado)

## 🎯 Visión general (actualizada)

| Aspecto            | Decisión                                                         |
| ------------------ | ---------------------------------------------------------------- |
| Framework          | Angular 22 (standalone components, zoneless, OnPush por defecto) |
| Node               | Node 26 LTS (o Current, según tu entorno)                        |
| Gestor de paquetes | pnpm (preferencial)                                              |
| Estado             | Signals + Signal Forms (estables en v22)                         |
| Estilos            | TailwindCSS v4 (sin archivo de config JS) + Angular Material 22  |
| HTTP               | HttpClient con interceptores funcionales                         |
| Formularios        | Signal Forms (API estable en v22)                                |
| QR                 | @zxing/ngx-scanner@22                                            |
| Testing            | Vitest (recomendado en v22) o Karma                              |
| PWA                | @angular/pwa                                                     |

## 📏 Reglas transversales (actualizadas)

Estas reglas aplican a **todas las fases**:

1.  **Standalone components siempre**. En v22 `standalone: true` es implícito.
2.  **Zoneless por defecto**: los nuevos proyectos v22 ya no incluyen `zone.js`. No agregues `provideZoneChangeDetection`.
3.  **OnPush por defecto** en v22. La estrategia anterior se renombró a `Eager`. No necesitas declarar `ChangeDetectionStrategy.OnPush` explícitamente, pero verifica que no estés usando `Eager` sin necesidad.
4.  **Signal Forms en lugar de Reactive Forms** para nuevos formularios. La API es estable y declarativa.
5.  **`**@Service()**` decorator** disponible como alternativa a `@Injectable({ providedIn: 'root' })`.
6.  **`**injectAsync()**`** para lazy DI cuando aplique.
7.  **Signals para estado local y compartido**. `BehaviorSubject` solo para streams complejos.
8.  **Servicios por feature**.
9.  **Modelos TypeScript espejo de los DTOs del backend** en `core/models/`.
10.  **Interceptores funcionales** para JWT y errores.
11.  **Guards funcionales** (`CanActivateFn`).
12.  **Rutas lazy-loaded** por feature.
13.  **Toda llamada HTTP devuelve `**Observable<T>**`**.
14.  **Manejo de errores centralizado** en el interceptor.
15.  **Nunca hardcodear URLs**. Todo por `environment.apiUrl`.
16.  **pnpm como gestor de paquetes**. Nunca `npm install`.
17.  **Un commit por fase**, mensaje `feat(frontend-X.Y): descripción`.

## 📁 Estructura objetivo del proyecto (sin cambios)

text

frontend/  
├── src/  
│   ├── app/  
│   │   ├── core/  
│   │   │   ├── models/  
│   │   │   ├── services/  
│   │   │   ├── interceptors/  
│   │   │   ├── guards/  
│   │   │   ├── store/  
│   │   │   └── utils/  
│   │   ├── shared/  
│   │   │   ├── components/  
│   │   │   ├── directives/  
│   │   │   └── pipes/  
│   │   ├── layout/  
│   │   │   ├── main-layout/  
│   │   │   ├── sidebar/  
│   │   │   └── topbar/  
│   │   ├── features/  
│   │   │   ├── auth/  
│   │   │   ├── dashboard/  
│   │   │   ├── productos/  
│   │   │   ├── ubicaciones/  
│   │   │   ├── inventario/  
│   │   │   ├── movimientos/  
│   │   │   ├── busquedas/  
│   │   │   ├── incidencias/  
│   │   │   └── metricas/  
│   │   ├── app.component.ts  
│   │   ├── app.config.ts  
│   │   └── app.routes.ts  
│   ├── environments/  
│   ├── styles.scss  
│   └── main.ts  
├── public/  
├── proxy.conf.json  
├── pnpm-workspace.yaml  
├── package.json  
└── tsconfig.json

# 🔷 BLOQUE 1 — Setup inicial

## 📄 Fase 1.1 — Crear el proyecto Angular 22 con pnpm

### Objetivo

Proyecto Angular 22 base, zoneless, OnPush por defecto, con TailwindCSS v4 + Angular Material 22, usando pnpm.

### Pasos

bash

\# 1. Verificar versiones  
node --version   # debe ser v26.x  
pnpm --version   # debe ser v10+ (o v11)  
  
\# 2. Instalar Angular CLI 22 globalmente (o usar pnpm dlx)  
pnpm dlx @angular/cli@22 new smartwarehouse-frontend \\  
  --standalone \\  
  --routing \\  
  --style=scss \\  
  --strict \\  
  --ssr=false \\  
  --package-manager=pnpm \\  
  --zoneless=true  
  
cd smartwarehouse-frontend  
  
\# 3. TailwindCSS v4 (sin archivo de config JS)  
pnpm add tailwindcss @tailwindcss/postcss postcss  
  
\# 4. Angular Material 22  
pnpm dlx @angular/cli@22 add @angular/material  
  
\# 5. Librerías adicionales  
pnpm add @zxing/ngx-scanner@22 @zxing/library  
pnpm add date-fns  
  
\# 6. Dev dependencies  
pnpm add -D @types/node

### ⚠️ Notas importantes sobre Angular 22

-   **Zoneless**: el flag `--zoneless=true` (o el default en v22) elimina `zone.js`. No agregues `provideZoneChangeDetection` en `app.config.ts`.
-   **OnPush es el default**: no necesitas declarar `ChangeDetectionStrategy.OnPush` en cada componente. Si un componente necesita la estrategia anterior, usa `ChangeDetectionStrategy.Eager`.
-   **Signal Forms**: los nuevos formularios usan esta API. Reactive Forms siguen disponibles pero no son el default recomendado.
-   **`**@Service()**` decorator**: puedes usarlo en lugar de `@Injectable({ providedIn: 'root' })`.
-   **`**injectAsync()**`**: disponible para lazy DI.

### Configuración TailwindCSS v4

**Tailwind v4 NO tiene archivo `**tailwind.config.js**`**. Toda la personalización se hace en CSS.

`src/styles.scss`:

scss

@import 'tailwindcss';  
@import '@angular/material/prebuilt-themes/indigo-pink.css';  
  
@theme {  
  --color-primary-50: #eff6ff;  
  --color-primary-500: #3b82f6;  
  --color-primary-600: #2563eb;  
  --color-primary-700: #1d4ed8;  
}  
  
html, body { height: 100%; }  
body { margin: 0; font-family: Roboto, 'Helvetica Neue', sans-serif; }

### `pnpm-workspace.yaml` (si usas monorepo)

yaml

packages:  
  - '.'  
  
\# pnpm v11 defaults  
onlyBuiltDependencies: \[\]

### Verificación

bash

pnpm start  
\# La app debe abrir en http://localhost:4200

### Criterio de cierre

`pnpm start` abre sin errores. `pnpm build` compila sin warnings.

## 📄 Fase 1.2 — Configuración del entorno y proxy

### Objetivo

Poder llamar al backend en `localhost:8000` sin CORS en desarrollo.

### Archivos

-   **Nuevo**: `proxy.conf.json`
-   **Nuevo**: `src/environments/environment.ts`
-   **Nuevo**: `src/environments/environment.prod.ts`
-   **Modificado**: `angular.json`

### `proxy.conf.json` (sin cambios)

json

{  
  "/api": {  
    "target": "http://localhost:8000",  
    "secure": false,  
    "changeOrigin": true,  
    "logLevel": "debug"  
  }  
}

### `src/environments/environment.ts` (sin cambios)

typescript

export const environment = {  
  production: false,  
  apiUrl: '/api/v1',  
  appName: 'SmartWarehouse',  
};

### `angular.json` — bloque `serve.options`

json

"serve": {  
  "builder": "@angular-devkit/build-angular:dev-server",  
  "options": {  
    "proxyConfig": "proxy.conf.json"  
  }  
}

### Criterio de cierre

Con backend corriendo, `fetch('/api/v1/health')` desde la consola devuelve 200.

## 📄 Fase 1.3 — Modelos TypeScript (espejo del backend)

### Objetivo

Tipados idénticos a los DTOs del backend.

### Archivos

text

src/app/core/models/  
├── index.ts  
├── auth.model.ts  
├── usuario.model.ts  
├── producto.model.ts  
├── ubicacion.model.ts  
├── inventario.model.ts  
├── movimiento.model.ts  
├── busqueda.model.ts  
├── incidencia.model.ts  
├── metrica.model.ts  
└── paginacion.model.ts

### Cambio importante en Angular 22

Usa **`**type**` en lugar de `**interface**`** cuando sea posible, para mejor inferencia con Signal Forms. Ejemplo:

typescript

export type Producto = {  
  id: number;  
  codigo: string;  
  nombre: string;  
  descripcion: string | null;  
  categoria\_id: number | null;  
  unidad\_medida: string;  
  stock\_minimo: number;  
  foto\_url: string | null;  
  activo: boolean;  
  fecha\_creacion: string | null;  
  fecha\_actualizacion: string | null;  
};  
  
export type ProductoCreate = {  
  codigo: string;  
  nombre: string;  
  descripcion?: string;  
  categoria\_id?: number | null;  
  unidad\_medida: string;  
  stock\_minimo: number;  
  foto\_url?: string | null;  
  activo: boolean;  
};

### Criterio de cierre

`pnpm build` compila.

## 📄 Fase 1.4 — Servicio base de API

### Objetivo

Punto único para todas las llamadas HTTP.

### Archivos

-   **Nuevo**: `src/app/core/services/api.service.ts`
-   **Nuevo**: `src/app/core/services/notification.service.ts`
-   **Nuevo**: `src/app/core/models/error.model.ts`

### Cambio con Angular 22

Puedes usar el decorador **`**@Service()**`** en lugar de `@Injectable({ providedIn: 'root' })`:

typescript

import { Service } from '@angular/core'; // ⚠️ si tu versión lo soporta  
  
@Service()  
export class ApiService { ... }

Si tu instalación no expone `@Service`, usa `@Injectable({ providedIn: 'root' })` como antes.

### Criterio de cierre

`ApiService` inyectable. Compila.

## 📄 Fase 1.5 — Estado de autenticación (AuthStore con Signals)

### Objetivo

Token, usuario y rol en un único store reactivo.

### Archivo

`src/app/core/store/auth.store.ts`

### Cambio con Angular 22: usa `resource()` para cargar el usuario

En lugar de llamar a `loadMe()` manualmente, puedes usar la **Resource API** (estable en v22):

typescript

readonly userResource = resource({  
  loader: () => firstValueFrom(this.api.get<Usuario>('/auth/me')),  
});

### Criterio de cierre

`AuthStore` compila y expone signals reactivos.

# 🔷 BLOQUE 2 — Auth HTTP y navegación

## 📄 Fase 2.1 — Servicios y guardias

### Objetivo

Login, refresh, logout funcionales; rutas protegidas.

### Archivos

-   `core/services/auth.service.ts`
-   `core/guards/auth.guard.ts`
-   `core/guards/guest.guard.ts`
-   `core/guards/role.guard.ts`

### Cambio con Angular 22

Puedes usar **`**injectAsync()**`** para lazy DI del `AuthService` dentro de los guards, reduciendo el bundle inicial:

typescript

export const authGuard: CanActivateFn = async () => {  
  const store = await injectAsync(AuthStore);  
  // ...  
};

### Criterio de cierre

Los guards funcionales compilan.

## 📄 Fase 2.2 — Interceptores HTTP

### Objetivo

Adjuntar JWT, renovar cuando expira, traducir errores a notificaciones.

### Archivos

-   `core/interceptors/jwt.interceptor.ts`
-   `core/interceptors/error.interceptor.ts`
-   **Modificado**: `app.config.ts`

### `app.config.ts` (sin `zone.js`)

typescript

import { ApplicationConfig } from '@angular/core';  
import { provideRouter } from '@angular/router';  
import { provideHttpClient, withInterceptors } from '@angular/common/http';  
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';  
  
import { routes } from './app.routes';  
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';  
import { errorInterceptor } from './core/interceptors/error.interceptor';  
  
export const appConfig: ApplicationConfig = {  
  providers: \[  
    // ⚠️ NO incluir provideZoneChangeDetection: v22 es zoneless por defecto  
    provideRouter(routes),  
    provideHttpClient(withInterceptors(\[jwtInterceptor, errorInterceptor\])),  
    provideAnimationsAsync(),  
  \],  
};

### Criterio de cierre

Build pasa sin `zone.js`.

## 📄 Fase 2.3 — Layout principal y navegación

### Objetivo

Shell con sidebar responsive y topbar.

### Archivos

-   `layout/main-layout/`
-   `layout/sidebar/`
-   `layout/topbar/`
-   **Modificado**: `app.routes.ts`

### Cambio con Angular 22

Usa **View Transitions** (estables en v22) para transiciones suaves entre rutas:

typescript

// app.config.ts  
provideRouter(routes, withViewTransitions())

### Criterio de cierre

Funciona en 375 px y 1440 px.

# 🔷 BLOQUE 3 — Features de negocio

## 📄 Fase 3.1 — Feature Auth (Login + Change Password)

### Objetivo

Login funcional con Signal Forms.

### Archivos

text

features/auth/  
├── auth.routes.ts  
├── login/  
│   ├── login.component.ts|html|scss  
└── change-password/  
    ├── change-password.component.ts|html|scss

### Cambio con Angular 22: Signal Forms

En lugar de `FormGroup`/`FormControl`, usa la nueva API:

typescript

import { form, field } from '@angular/forms'; // ⚠️ API v22  
  
export class LoginComponent {  
  readonly form = form({  
    email: field('', { validators: \[Validators.required, Validators.email\] }),  
    password: field('', { validators: \[Validators.required, Validators.minLength(8)\] }),  
  });  
  
  onSubmit() {  
    if (this.form.invalid()) return;  
    // this.form.value() contiene los datos tipados  
  }  
}

> Consulta la documentación oficial de Angular 22 para la sintaxis exacta de Signal Forms, ya que puede haber variaciones.

### Criterio de cierre

Login funciona end-to-end.

## 📄 Fase 3.2 — Feature Dashboard

### Objetivo

Indicadores principales del backend.

### Archivos

text

features/dashboard/  
├── dashboard.routes.ts  
├── dashboard.component.ts|html|scss  
└── components/  
    ├── indicador-card/  
    └── comparativa-chart/

### Cambio con Angular 22: `httpResource`

Usa la nueva API para cargar datos:

typescript

readonly dashboard = httpResource<DashboardResumen>(  
  () => \`${environment.apiUrl}/metricas/dashboard\`  
);

En el template:

html

@if (dashboard.isLoading()) {  
  <app-skeleton />  
} @else if (dashboard.hasValue()) {  
  <div class="grid grid-cols-2 md:grid-cols-3 gap-4">  
    <app-indicador-card icon="📦" \[value\]="dashboard.value().total\_productos" label="Productos" />  
    <!-- ... -->  
  </div>  
}

### Criterio de cierre

Los 6 números coinciden con el backend.

## 📄 Fase 3.3 — Feature Productos

### Objetivo

CRUD completo con listado paginado, búsqueda y detalle.

### Archivos

text

features/productos/  
├── productos.routes.ts  
├── productos.service.ts  
├── listado/  
├── detalle/  
├── form/  
└── components/  
    └── producto-card/

### Endpoints consumidos

-   `GET /productos?skip=&limit=&categoria_id=&solo_activos=`
-   `GET /productos/buscar?q=&limit=`
-   `GET /productos/{id}`
-   `POST /productos`
-   `PATCH /productos/{id}`
-   `DELETE /productos/{id}`

### Criterio de cierre

Todo funciona con roles correctos.

## 📄 Fase 3.4 — Feature Ubicaciones + Escaneo QR

### Objetivo

Listar ubicaciones, crear una, escanear QR.

### Archivos

text

features/ubicaciones/  
├── ubicaciones.routes.ts  
├── ubicaciones.service.ts  
├── listado/  
├── detalle/  
├── form/  
└── escaner-qr/  
    ├── escaner-qr.component.ts|html|scss

### Cambio con Angular 22: `@defer`

Usa **deferred loading** para cargar el escáner QR solo cuando se necesite:

html

@defer (on interaction) {  
  <zxing-scanner (scanSuccess)="onScan($event)" />  
} @placeholder {  
  <button>Activar cámara</button>  
}

### Dependencia

`@zxing/ngx-scanner@22` (compatible con Angular 22).

### Criterio de cierre

Escaneo funciona en móvil real.

## 📄 Fase 3.5 — Feature Inventario

### Objetivo

Stock consolidado y alertas.

### Archivos

text

features/inventario/  
├── inventario.routes.ts  
├── inventario.service.ts  
├── stock-producto/  
└── alertas/

### Criterio de cierre

Coincide con el backend.

## 📄 Fase 3.6 — Feature Movimientos

### Objetivo

Registrar entradas, salidas y traslados.

### Archivos

text

features/movimientos/  
├── movimientos.routes.ts  
├── movimientos.service.ts  
├── listado/  
├── entrada/  
├── salida/  
└── traslado/

### Cambio con Angular 22: Signal Forms para formularios complejos

typescript

readonly form = form({  
  producto\_id: field<number | null>(null, { validators: \[Validators.required\] }),  
  cantidad: field(0, { validators: \[Validators.required, Validators.min(1)\] }),  
  ubicacion\_origen\_id: field<number | null>(null),  
  ubicacion\_destino\_id: field<number | null>(null),  
  referencia: field(''),  
  observaciones: field(''),  
});

### Criterio de cierre

Todo funciona. Movimientos registrados.

## 📄 Fase 3.7 — Feature Búsquedas (el corazón del proyecto)

### Objetivo

Flujo completo: buscar → ver ubicación → confirmar → métrica.

### Archivos

text

features/busquedas/  
├── busquedas.routes.ts  
├── busquedas.service.ts  
├── buscar/  
├── resultado/  
└── historial/

### Flujo UX

1.  El trabajador entra a `/busquedas`.
2.  Escribe el nombre. Autocomplete con debounce de 250 ms.
3.  Al elegir, `POST /busquedas/iniciar` → `busqueda_id`, ubicaciones.
4.  Muestra: foto, código, cantidad, y ubicaciones ordenadas.
5.  Botón **"Confirmar encontrado aquí"** en cada ubicación.
6.  Al pulsar, `POST /busquedas/{id}/finalizar`.
7.  Resumen: "Encontrado en X segundos".

**En móvil**: pasillo/estante/nivel en tamaño XXL.

### Criterio de cierre

Flujo completo con tiempo registrado.

## 📄 Fase 3.8 — Feature Incidencias

### Objetivo

Reportar y resolver incidencias.

### Archivos

text

features/incidencias/  
├── incidencias.routes.ts  
├── incidencias.service.ts  
├── listado/  
├── form/  
└── resolver-dialog/

### Criterio de cierre

Crear → listar → resolver funciona.

## 📄 Fase 3.9 — Feature Métricas

### Objetivo

Indicadores y comparativa "antes vs después".

### Archivos

text

features/metricas/  
├── metricas.routes.ts  
├── metricas.service.ts  
├── dashboard-metricas/  
├── comparativa/  
└── componentes/  
    ├── linea-tiempo-chart/  
    └── bar-chart/

### Librería de gráficos

bash

pnpm add ng2-charts chart.js

### Vista principal

-   **Comparativa Julio vs Septiembre**: barra con dos valores y "**Mejora: XX %**".
-   **Evolución mensual**: línea con promedio de cada mes.
-   **Top productos más buscados**.
-   **Distribución de incidencias**: donut.

### Criterio de cierre

Mejora > 50 % visible desde la UI.

# 🔷 BLOQUE 4 — PWA, optimizaciones y cierre

## 📄 Fase 4.1 — PWA

### Objetivo

App instalable con offline básico.

### Pasos

bash

pnpm dlx @angular/cli@22 add @angular/pwa

### Configuración

-   Editar `manifest.webmanifest`.
-   Service Worker solo en `production`.
-   No cachear API por defecto.
-   Banner "Nueva versión disponible" con `SwUpdate`.

### Criterio de cierre

Chrome muestra prompt "Añadir a pantalla de inicio".

## 📄 Fase 4.2 — Optimizaciones

### Objetivo

Rendimiento y UX.

### Acciones

-   Verificar que **OnPush es el default** (v22). No declaren `Eager` sin necesidad.
-   **`**@defer**`** en bloques pesados (gráficos, escáner QR).
-   Imágenes con `NgOptimizedImage`.
-   `@for` con `track` en listas largas.
-   Preloading strategy en rutas.
-   **Zoneless**: ya activo por defecto en v22. Verifica que no haya `zone.js` en `polyfills`.

### Criterio de cierre

Lighthouse móvil > 90 en Performance y PWA.

## 📄 Fase 4.3 — Suite de tests

### Objetivo

Cobertura razonable.

### Herramientas recomendadas para v22

| Herramienta     | Uso                                                  |
| --------------- | ---------------------------------------------------- |
| Vitest          | Unitarios (más rápido que Karma, recomendado en v22) |
| Playwright      | E2E (reemplazo moderno de Cypress)                   |
| Karma + Jasmine | Fallback si prefieres el default histórico           |

### Instalación

bash

pnpm add -D vitest @vitest/coverage-v8  
pnpm add -D @analogjs/vite-plugin-angular  
pnpm add -D @angular-builders/custom-webpack

### Tests mínimos por servicio

-   `ApiService`: construcción de URLs y params.
-   `AuthStore`: set/get/clear; hasRole.
-   `AuthService`: login guarda tokens; logout limpia.
-   Guards: redirigen según estado.

### Tests mínimos por componente

-   `LoginComponent`: valida form; envía al servicio; redirige.
-   `ProductosListado`: llama al servicio; muestra items.
-   `BuscarComponent`: debounce; llama a `/iniciar`.

### Criterio de cierre

`pnpm test -- --coverage` con cobertura > 70 %.

## 📄 Fase 4.4 — Despliegue

### Objetivo

Frontend listo para producción.

### Opciones

| Opción           | Cuándo usar       |
| ---------------- | ----------------- |
| Vercel / Netlify | Demo rápida       |
| Firebase Hosting | Ecosistema Google |
| Nginx + Docker   | VPS propio        |
| Cloudflare Pages | CDN global        |

### Configuración mínima

-   `pnpm build --configuration production`.
-   Redirección SPA: cualquier ruta desconocida sirve `index.html`.
-   CORS en backend incluye el dominio del frontend.

### Criterio de cierre

URL pública funciona con HTTPS.

## 📄 Fase 4.5 — Documentación del frontend

### Objetivo

README del frontend.

### Secciones

1.  Descripción.
2.  Stack (Angular 22, Node 26, pnpm).
3.  Requisitos.
4.  Instalación con pnpm.
5.  Comandos.
6.  Estructura.
7.  Cómo agregar una feature.
8.  Convenciones.
9.  Variables de entorno.

### Criterio de cierre

Un desarrollador nuevo levanta el frontend en < 10 min.

## 📅 Cronograma sugerido

| Bloque                                | Sesiones |
| ------------------------------------- | -------- |
| 1. Setup (1.1 - 1.5)                  | 5        |
| 2. Auth HTTP y navegación (2.1 - 2.3) | 3        |
| 3. Features (3.1 - 3.9)               | 9        |
| 4. PWA + cierre (4.1 - 4.5)           | 5        |
| Total                                 | 22       |

## 📋 Checklist final del frontend

-   □  
    Login con los 6 usuarios sintéticos.
-   □  
    Recarga mantiene sesión.
-   □  
    Token refresh funciona.
-   □  
    Todos los endpoints del backend tienen UI.
-   □  
    Escáner QR funciona en móvil.
-   □  
    Flujo de búsqueda completo con tiempo registrado.
-   □  
    Dashboard muestra indicadores.
-   □  
    Comparativa muestra mejora > 50 %.
-   □  
    PWA instalable.
-   □  
    Tests con cobertura > 70 %.
-   □  
    Build de producción sin errores.
-   □  
    URL pública funcionando.

## 🚦 Reglas de avance

-   **No se avanza de fase** sin verificación al 100 %.
-   **Un commit por fase**, mensaje `feat(frontend-X.Y): descripción`.
-   **Toda feature nueva** crea su carpeta dentro de `features/`.
-   **Toda decisión** que se aparte del plan se documenta en `DECISIONS.md`.