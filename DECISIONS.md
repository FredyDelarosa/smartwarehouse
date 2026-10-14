# Registro de decisiones técnicas (DECISIONS.md)

Este documento registra **cada decisión que se aparta del `plan_trabajo.md`**,
con el motivo y las consecuencias. El plan es la referencia; aquí queda
constancia de lo que se cambió y por qué, para que ajustar el backend (o
revertir) sea fácil.

Fecha de implementación: 2026-10-11
Stack realmente instalado: Angular **22.2.2**, TypeScript 6.0, Tailwind **4.1**, Node 26.

---

# 📋 Índice: qué hay que hacer en el BACKEND

Si solo te interesa el backend, empieza aquí. El resto del documento son
decisiones de frontend.

**Verificado contra el backend real el 2026-10-12.** **Todo integrado y
funcionando**: frontend contra backend, sin bloqueantes pendientes.

Los siete puntos (BUG-1, BUG-2, BUG-3, PET-1, PET-1b, PET-2 y OBS-6) están
resueltos, más BUG-4 que apareció al verificar y también está corregido.

---

## ✅ YA RESUELTO Y VERIFICADO

Probado con `curl` y en el navegador contra `localhost:8000`.

| # | Qué se arregló | Cómo se comprobó |
|---|---|---|
| **BUG-1** | `finalizar` daba 404; las búsquedas no se persistían | Flujo completo en la UI: buscar → confirmar → **"Búsqueda registrada · 11 s"** |
| **BUG-2** | Faltaban Supervisor y Almacenero | Los 3 usuarios hacen login (200). Con Almacenero, "Métricas" desaparece del menú |
| **BUG-3** | `resolver` rechazaba al Administrador (403) | `POST /incidencias/30005/resolver` → **200** con token de Administrador |
| **PET-1** | `GET /categorias/` daba 500 | **200 con las 8 categorías.** El detalle muestra "Tornillería" y el desplegable lista los 8 nombres |
| **PET-2** | `codigo_qr` sin unicidad | `POST /ubicaciones/` con QR repetido → **409 `UBICACION_DUPLICADO`** |
| **PET-3** | Listado de ubicaciones sin productos | 🟡 Media | ~1 h | ✅ **Resuelto 2026-10-13** |
| **PET-1b** | `activo` added a las 4 capas | La columna llega en la respuesta y **el filtro funciona** (probado desactivando una fila en la BD: 7 vs 8) |
| **OBS-6** | `producto_nombre` siempre era `null` | Ahora devuelve el nombre canónico; la tabla distingue "Producto" de "Término" |
| **BUG-4** | `POST`/`PATCH`/`DELETE` de `/categorias` no persistían | Ciclo completo verificado: crear persiste, desactivar persiste y filtra, borrar borra |

---

## ✅ BUG-4 · `/categorias` no persistía nada — CORREGIDO

> **ESTADO: RESUELTO el 2026-10-12.** Añadido `SessionDep` + `await session.commit()`
> en POST, PATCH y DELETE de `app/infrastructure/api/v1/routes/categorias.py`.
> Verificado el ciclo completo: crear persiste, desactivar persiste y el filtro
> `solo_activas` por fin se puede alcanzar por la API, y borrar borra.

**Qué pasaba.** Es el **mismo error que BUG-1**, en `categorias.py`, donde no se
corrigió. El CRUD leía bien pero no escribía: el repositorio hace `flush()`, que
deja los cambios en la sesión sin llevarlos a la base de datos.
`get_session()` solo hace `rollback()` ante excepción, nunca commit, así que al
cerrarse la sesión todo se perdía.

**Lo grave era el código de respuesta**, que mentía:

```
POST  /categorias/ {"nombre":"PRUEBA-BUG4"}  → 201 {"id":30003, ...}
                                             → NO aparecía en el listado
PATCH /categorias/8 {"activo": false}       → 200 {"activo": false, ...}
                                             → en la BD seguía activo = 1
```

Un cliente que confíe en el 201/200 creería que la operación se hizo.

**El arreglo** (idéntico al que ya se aplicó en `busquedas.py`):

```python
from app.infrastructure.api.dependencies import CategoriaRepoDep, SessionDep, require_role

async def crear_categoria(payload, categoria_repo: CategoriaRepoDep = None,
                          session: SessionDep = None) -> CategoriaReadDTO:
    dto = await CrearCategoriaUseCase(categoria_repo).execute(payload)
    await session.commit()        # sin esto, flush() no llega a la BD
    return dto
```

Se aplicó en los tres endpoints de escritura. `SessionDep` y `CategoriaRepoDep`
comparten la **misma** `AsyncSession` porque FastAPI cachea las dependencias
(`get_categoria_repo` recibe `SessionDep`), así que el commit afecta a la sesión
que usó el repositorio.

**Verificación del ciclo completo:**

| Paso | Resultado |
|---|---|
| `POST /categorias/` | 201 y **aparece** en el listado |
| `PATCH /categorias/30003 {"activo": false}` | 200 y persiste |
| `?solo_activas=true` | 8 (excluye la desactivada) |
| `?solo_activas=false` | 9 (la incluye) |
| `DELETE /categorias/30003` | 204 y **desaparece** |

La BD quedó como estaba: 8 categorías, todas activas, sin restos de prueba.

### Preventing que vuelva a pasar

BUG-1 y BUG-4 son el **mismo error en dos sitios**, y el patrón está bien
declarado (`flush()` en el repositorio, commit en la ruta) pero se olvida
endpoint a endpoint. Dos salidas:

1. **Mover el commit a un `UoW` de dominio** invocado por los use cases. Ningún
   endpoint puede olvidarlo porque no es su responsabilidad.
2. **Un test por ruta con escritura** que compruebe el cambio leyendo por una
   **conexión distinta** (una sesión nueva). Es lo que habría detectado BUG-1 y
   BUG-4 automáticamente, y no cuesta más que escribirlo una vez por CRUD.

La segunda es la más barata y la que más valor da: un test que solo compruebe el
código de respuesta **no** detecta esto, porque la API responde 200/201 igual.

---

## ⚪ OPCIONAL — mejora, no bloquea nada

Nada de esto impide usar la aplicación.

| # | Qué | Por qué |
|---|---|---|
| **OBS-1** | Servir `/assets/products/…` o devolver `foto_url: null` | Todas las fotos dan 404; el frontend ya muestra un marcador |
| **OBS-3** | Endpoint de stock masivo (`?ids=1,2,3`) | El listado hace ~20 peticiones por página |
| **OBS-5** | `unidad_medida` como `Literal` o tabla | Hoy es texto libre: conviven "pieza", "piezas", "unid"… |

Detalle de cada una en la sección "Observaciones menores", más abajo.

> **No tocar sin avisar:** `/metricas/tiempo-promedio` y `/metricas/comparativa`
> devuelven `null` (no `0`) cuando un rango no tiene búsquedas. Es intencionado y
> el frontend depende de ello (ver OBS-2). Si se cambia a `0`, la comparativa
> prometerá mejoras del 100 % inexistentes.

---

## BLOQUE 1 — Setup

### 1.1 — Gestor de paquetes: npm en lugar de pnpm

| | |
|---|---|
| **Plan** | `pnpm` (preferencial), `pnpm-workspace.yaml`, un commit por fase |
| **Realidad** | `npm` |

**Motivo.** El proyecto ya estaba generado e instalado con npm
(`packageManager: "npm@12.0.2"`, `package-lock.json` y `node_modules` con ~700
paquetes resueltos). Migrar a pnpm obligaba a reinstalar el árbol completo sin
aportar nada al producto.

**Consecuencia.** Los comandos del README usan `npm`. Si el proyecto pasa a
monorepo, `pnpm-workspace.yaml` sigue siendo el camino de vuelta.

### 1.2 — SSR desactivado

| | |
|---|---|
| **Plan** | `--ssr=false` (crear el proyecto sin SSR) |
| **Realidad** | El scaffold traía SSR activo; se desactivó |

**Motivo.** Coincide con el plan. Además, la app es 100 % cliente: `localStorage`
para la sesión, `getUserMedia` para el escáner QR, `requestAnimationFrame` para
el detector. Con SSR habría que envolvier cada acceso en `isPlatformBrowser`.

**Qué se eliminó.** `src/server.ts`, `src/main.server.ts`,
`src/app/app.config.server.ts`, `src/app/app.routes.server.ts`, y del
`angular.json`: `server`, `outputMode`, `ssr` y `provideClientHydration()`.

**Consecuencia.** El build de producción es estático: se despliega en Vercel,
Netlify, Cloudflare Pages o Nginx sin Node en runtime.

### 1.3 — Sin Angular Material: Tailwind puro + componentes propios

| | |
|---|---|
| **Plan** | TailwindCSS v4 **+ Angular Material 22** (`provideAnimationsAsync`, tema prebuilt) |
| **Realidad** | Solo Tailwind v4 + biblioteca propia de ~12 componentes |

**Motivo.** El design system generado por la skill `ui-ux-pro-max`
(Flat Design + Data-Dense Dashboard) es explícitamente *plano, sin sombras
decorativas, tipografía Fira*, con una densidad alta. El tema prebuilt de
Material (elevaciones, ripple, tipografía Roboto) entra en conflicto directo con
esa dirección: obligaría a sobreescribir casi todo.

Además, Material añade ~350 kB al bundle por tres o cuatro controles que aquí
son triviales de construir.

**Qué se construyó en su lugar** (`src/app/shared/components/`):

| Componente | Sustituye a |
|---|---|
| `button.component.ts` | `mat-button`, `mat-raised-button` |
| `badge.component.ts` | `mat-chip` |
| `modal.component.ts` | `mat-dialog` (con focus trap, `aria-modal`, Escape, retorno de foco) |
| `toast-container.component.ts` | `MatSnackBar` |
| `empty-state.component.ts` | — (no existe en Material) |
| `skeleton*.component.ts` | `mat-progress-bar` / skeletons propios |
| `indicator-card.component.ts` | `mat-card` + KPI |
| `pagination.component.ts` | `mat-paginator` |
| `charts.ts` | `ng2-charts` (4 gráficos en SVG) |
| `icon.component.ts` | librería de iconos (SVG inline) |

**Consecuencia.** Si el proyecto debe adoptar Material, estos componentes son
la capa a sustituir; ninguna feature depende de ellos internamente.

### 1.4 — Sin `ng2-charts` / `chart.js`: gráficos en SVG propio

**Motivo.** El proyecto necesita exactamente 4 visualizaciones (barras
comparadas, línea de evolución, donut, lista de barras). `chart.js` pesa
~200 kB y hay que configurarlo aparte para que respete el design system.

**Qué se construyó** (`shared/components/charts.ts`): `BarChartComponent`,
`DonutChartComponent`, `BarListComponent`, `MejoraBadgeComponent`, todos SVG
accessibles (`role="img"` + `<title>`), responsivos con `viewBox` y temáticos
(variables CSS, no colores fijos).

### 1.5 — Sin `@zxing/ngx-scanner`: `BarcodeDetector` nativo

| | |
|---|---|
| **Plan** | `@zxing/ngx-scanner@22` + `@zxing/library` |
| **Realidad** | API nativa `BarcodeDetector` + entrada manual |

**Motivo.** `BarcodeDetector` existe en Chrome/Android, Edge y Safari 17+.
Evita ~80 kB y una dependencia que habría que mantener para cubrir navegadores
sin soporte nativo.

**Degradación.** Si `BarcodeDetector` no existe, la pantalla **no se rompe**:
ofrece escribir el código a mano. Esto no es un adorno — es el caso real cuando
la cámara está sucia, el lente roto o el usuario va con guantes.

**Consecuencia para el plan.** El `@defer (on interaction)` propuesto para
cargar el escáner no aplica: no hay chunk que diferir. La cámara tampoco se
solicita hasta que el usuario pulsa "Activar cámara".

### 1.6 — Sin `date-fns`

`Intl.DateTimeFormat` / `Intl.NumberFormat` cubren los 6 formatos necesarios
(es-CO, fecha, fecha-hora, número, decimal, duración). Añadir una librería de
fechas sería peso sin uso.

### 1.7 — Modelos: `type` en lugar de `interface`

**Coincide con el plan.** Además, se reorganizó el barrel: `core/models/index.ts`
re-exporta todos los modelos, y las features importan de ahí
(`import type { Producto } from '../../core/models'`).

### 1.8 — AuthStore: `resource()` no usado

| | |
|---|---|
| **Plan** | `resource({ loader: () => firstValueFrom(api.get('/auth/me')) })` |
| **Realidad** | `AuthService.bootstrap()` con `provideAppInitializer` |

**Motivo.** `resource()` crea un recurso que se ejecuta cada vez que cambia su request
signal, y no encaja con "ejecutar una sola vez al arrancar".
`provideAppInitializer` es el punto correcto para revalidar la sesión antes del
primer render de las rutas protegidas: si el token está caducado, la redirección
a `/login` ocurre sin destello.

El usuario se cachea en `localStorage` para que la topbar pueda pintar el nombre
y el rol sin esperar a la red (evita un parpadeo en cada recarga).

---

### 1.9 — Paleta institucional XYZ (sustituye a la de «industrial slate»)

A petición del cliente, la paleta pasa a sus tres colores corporativos:

| Color | Valor | Uso asignado |
|---|---|---|
| Azul Institucional (Pantone 294 C) | `#002F6C` | `primary`, botones, anillos, panel de marca |
| Gris Secundario (Cool Gray 10 C) | `#807E82` | **Estructural**: bordes, divisores, `--color-border-brand` |
| Negro | `#000000` | `foreground` en claro, `background` en oscuro |

Las escalas se derivan conservando el tono de cada color (azul 214°, gris 270°) y
los colores de marca caen donde les corresponde (`blue-700`, `gray-500`), de
modo que la rampa es una extensión coherente y no un parche. Verde, ámbar y rojo
se mantienen: son **colores semánticos de estado**, no de marca, y en un almacén
"pocas existencias" tiene que distinguirse de "muchas".

#### El gris de marca no puede ser color de texto

`#807E82` da **4.02:1** sobre blanco; WCAG 2.1 AA exige **4.5:1** para texto
normal. Asignado al gris secundario de la app, habría dejado fuera de norma
todo el texto secundario de la interfaz.

Por eso tiene papel **estructural** (bordes, divisores y elementos decorativos,
donde 3:1 basta) y el texto secundario usa `gray-600` `#666468` (**5.85:1**), un
paso más oscuro del mismo tono: visualmente casi indistinguible del gris de
marca, pero ahora se lee. Es la razón principal por la que los tres colores no
se usan los tres igual: un color de marca puede ser perfecto para líneas y
fallar en texto.

#### En tema oscuro `primary` sube, no se invierte

`#002F6C` sobre negro da **1.9:1**: literalmente invisible. La estrategia
anterior invertía `primary` a un tono claro en oscuro, lo que dejaba el azul de
marca solo en tema claro y le cambiaba el significado según el modo.

Aquí `primary` sube a `blue-400` `#3B88EC`, manteniendo la familia del azul. Así
la marca se conserva en los dos temas y el texto encima tiene **5.92:1**.

#### Token nuevo: `--color-accent-on-primary`

El acento `#0F64D2` da solo **2.32:1** sobre el panel de marca `#002F6C`, y el
texto grande necesita 3:1. Sobre superficies de marca se usa `#80B0F0`
(**5.78:1**). Afecta al titular del login, que era el único sitio donde el
acento caía sobre azul. En oscuro, donde el panel ya es claro, el acento sobre él
pasa a `#000B1A` (5.57:1).

Es un token aparte y no un cambio de `--color-accent` porque el acento sí es
válido sobre superficie clara (13.0:1). El problema es solo del contexto.

#### Contrastes verificados

Todos los pares semánticos de ambos temas pasan AA. La tabla completa está en
`design-system/smartwarehouse/MASTER.md`:

| Combinación | Ratio | Mínimo |
|---|---|---|
| `#000000` sobre `#FFFFFF` | 21.00:1 | 4.5 |
| `#666468` sobre `#FFFFFF` | 5.85:1 | 4.5 |
| `#FFFFFF` sobre `#002F6C` | 12.94:1 | 4.5 |
| `#3B88EC` sobre `#000000` | 5.92:1 | 4.5 |
| `#CCCBCD` sobre `#000000` | 12.99:1 | 4.5 |
| `#80B0F0` sobre `#002F6C` | 5.78:1 | 3.0 |

También se actualizaron el `theme-color` de `index.html`, el `manifest` y los
iconos PWA, que seguían con el slate anterior.

---

## BLOQUE 2 — Auth y navegación

### 2.1 — Interceptor de refresh: compartido, no por petición

El plan no especificaba cómo evitar una "tormenta de 401" (varias peticiones
que fallan a la vez y lanzan N refresh). Se implementó un refresh compartido:
la primera petición que detecta caducidad inicia `/auth/refresh`; las demás se
suman al mismo `Observable` y esperan al mismo resultado.

Además se añadió **refresh proactivo**: si el token caduca en menos de 30 s, se
renueva *antes* de enviar, evitando el 401 evitable.

### 2.2 — Orden de los interceptores: jwt → mock → error

```
jwtInterceptor → mockApiInterceptor (si está activo) → errorInterceptor
```

El orden no es cosmético. Al registrar el mock **antes** del JWT (primer
intento), el mock recibía las peticiones sin cabecera `Authorization`: el login
devolvía 200 y luego `GET /auth/me` fallaba con 401 porque el mock no podía
saber quién preguntaba. Síntoma: "correo o contraseña incorrectos" con
credenciales válidas.

Regla: **el interceptor que enriquece la petición va primero**; el que la
corta (mock), después; el de errores, siempre el último.

Además, `mock-api.interceptor.ts` normaliza `req.body` con `asRecord()`: con
`withFetch()` el cuerpo puede llegar ya serializado como string JSON según
cuándo lo procese el backend, y sin ese `JSON.parse` los campos salían
`undefined`.

### 2.3 — Manejo centralizado de errores: también 401 → redirección

`errorInterceptor` no solo muestra toasts. Cuando recibe un 401 limpia la
sesión y redirige a `/login` preservando la URL de destino (`returnUrl`), para
que el login devuelva al usuario donde estaba.

Los errores 4xx que el usuario puede resolver por sí mismo (409 duplicado,
422 validación) **sí** muestran toast con el mensaje del backend, porque ese
texto es más útil que cualquier genérico.

### 2.4 — Guard de rol: expulsa al panel, no a una pantalla de "prohibido"

`roleGuard` redirige a `/dashboard?acceso=denegado` cuando el rol no tiene
permiso. Una pantalla de "403" no aporta nada aquí: el usuario simplemente no
ve el enlace.

---

## BLOQUE 3 — Features

### 3.1 — Búsquedas: 2 pantallas en vez de 3

| | |
|---|---|
| **Plan** | `buscar/` → `resultado/` → `historial/` (3 componentes) |
| **Realidad** | `buscar/` (búsqueda + resultado + confirmación) y `historial/` |

**Motivo.** El resultado depende del `busqueda_id` que devuelve
`POST /busquedas/iniciar`. Ese id solo existe en memoria durante el mismo flujo.
Separarlo en otro componente obligaría aNavigation por la URL y volver a pedir
los datos al backend (o a mantener un store), con una recargación visual
justo en el momento en que el trabajador ya eligió.

El flujo queda: **buscar → ver ubicaciones → confirmar** en una sola pantalla,
que además es lo que pide el criterio de cierre ("flujo completo con tiempo
registrado").

### 3.2 — Métricas: comparativa con presets, no 4 campos de fecha sueltos

El endpoint `GET /metricas/comparativa` exige 4 parámetros de fecha y responde
422 si falta alguno. Cuatro inputs sueltos en pantalla se convierten en un
formulario que el usuario no entiende.

Se implementaron **3 presets** que cubren los casos del proyecto:
- *Julio → Septiembre* (el caso del proyecto.md: 8 min → 1.5 min)
- *Mes actual vs. mes anterior*
- *Últimos 30 días vs. 30 anteriores*

La UI muestra el porcentaje de mejora destacado cuando **ambos periodos tienen
búsquedas**: comparar contra un periodo vacío daría un porcentaje engañoso.

### 3.3 — Paginación: `limit + 1` en lugar de `total`

**Limitación real del backend.** Todos los listados devuelven arrays planos,
sin `total` ni envoltorio paginado. La API no permite saber cuántas páginas
existen.

**Estrategia adoptada.** Se pide `limit + 1`; si llega el elemento extra, existe
página siguiente y se descarta. Esto ya está encapsulado en
`core/utils/paginacion.ts` (`paginaParams`, `normalizarPagina`).

**Si el backend cambia:** cuando `GET /productos/` devuelva
`{ items: [...], total: N }`, basta reimplementar `normalizarPagina` y toda la
UI sigue funcionando sin tocar un solo componente. El tipo ya contempla esa
forma (`paginacion.model.ts`).

### 3.4 — Autenticación por autocomplete: `debounce` + `switchMap`

El plan pedía debounce de 250 ms en búsquedas. Se implementa además
`switchMap`, que el plan no mencionaba: sin él, escribir rápido genera
respuestas fuera de orden y el usuario ve resultados de un término anterior.

Helper reutilizable: `core/utils/async.ts` → `debounceInput(250)`.

### 3.5 — Permisos: ocultación por UI, no por seguridad

Las acciones se ocultan o deshabilitan según `AuthStore.can(permiso)`, con la
tabla de permisos en `core/models/rol.model.ts` (traducción de las restricciones
del servidor documentadas en la API).

> Esto es **UX, no autorización**. El backend sigue siendo la única fuente de
> verdad: un usuario sin permisos que forzara la llamada recibiría 403.

### 3.6 — Métricas restringidas a Administrador y Supervisor

La API **no** protege `/metricas/*` por rol. Aun así la ruta exige rol en el
frontend: son indicadores de gestión, no de operación, y mostrárselos a un
Almacenero que no puede actuar sobre ellos solo genera preguntas.

### 3.7 — Sin gráfico de línea por meses

El plan pide "Evolución mensual: línea con promedio de cada mes", pero la API
no tiene ningún endpoint de serie temporal. Solo ofrece `comparativa` (dos
periodos puntuales) y `tiempo-promedio` (un rango).

Opciones descartadas:
- **N llamadas a `comparativa`**, una por mes → 6 peticiones solo para pintar
  una gráfica, y el gráfico mentiría (cada punto sería una comparación contra
  un mes, no un promedio real).
- **Gravar el historial del cliente** con `GET /busquedas/historial` → obliga a
  descargar todo el historial y a agregarlo en el navegador; no es el
  trabajo del frontend.

**Lo que sí se implementó:** los 3 gráficos que la API soporta (comparativa
barras, donut de incidencias, barras de movimientos) más las cifras de
tiempo medio. Si el backend añade `GET /metricas/evolucion?desde=&hasta=`,
el `LineChartComponent` se incorpora en una sola línea de datos.

### 3.8 — Detalle de ubicación: dos llamadas encadenadas

`GET /ubicaciones/{id}` no incluye los productos. La pantalla encadena
`obtener(id)` → `porQr(codigo_qr)` para mostrar qué debería haber en el
estante. Cuando el backend incluya `productos[]` en el primer endpoint, esto
se reduce a una llamada.

### 3.9 — Mock de API disponible pero **desactivado** por defecto

`mockApiInterceptor` existe y replica el almacén de `proyecto.md`, pero
`useMockApi` es **`false`**: el backend real está disponible en
`localhost:8000` y la app debe hablar con él.

Para trabajar sin servidor (demos offline, capturas, CI):

```ts
// src/environments/environment.ts
useMockApi: true,
```

En producción es siempre `false`: la app nunca debe mostrar datos inventados
cuando el servidor falla.

---

## BLOQUE 4 — Cierre

### 4.0 — PWA (Fase 4.1 del plan)

La app es instalable y arranca sin red. Lo verificado: **con el servidor
apagado** (`curl` da `HTTP 000`) la app carga igual desde la caché del service
worker, enruta a `/dashboard` y el guard de auth la manda a `/login?returnUrl=…`
porque la API no responde. Ese comportamiento es exactamente el que se quiere.

| Pieza | Fichero | Decisión |
|---|---|---|
| Service worker | `provideServiceWorker` en `app.config.ts` | Solo en producción (`enabled: isDevMode() === false`). En `ng serve` cachearía el bundle y los cambios no se verían |
| Registro tardío | `registrationStrategy: 'registerWhenStable:30000'` | No compite por ancho de banda durante una sesión normal |
| Recursos cacheados | `ngsw-config.json` | Solo assets (`app`, `icons`). **Ninguna API** |
| Aviso de versión | `core/services/actualizacion.service.ts` | El usuario decide cuándo actualizar; nunca se recarga solo |

#### Por qué NO se cachea la API

Es la decisión más importante del `ngsw-config.json`, y el plan la pide
explícitamente ("no cachear API por defecto"). Los datos del almacén son estado
en vivo: un producto se mueve o se vende en otro terminal. Cachear un
`stock_total` haría que el trabajador recogiera en una estantería vacía, y en
un almacén eso no es un fallo pequeño: es una recogida equivocada.

Por eso el archivo **no tiene `dataGroups`**. Si algún día hiciera falta
resiliencia offline real, lo correcto sería un `dataGroup` con URLs de solo
lectura (`/productos/`, `/ubicaciones/`) y caducidad corta, **nunca** aplicado a
escrituras (`/movimientos`, `/busquedas/*/finalizar`, `/incidencias/*/resolver`).

#### Por qué la actualización la decide el usuario

Angular no activa la versión nueva hasta la siguiente carga completa, así que el
flujo —descarga en segundo plano → aviso → "Actualizar" → `activateUpdate()` →
`location.reload()`— nunca interrumpe una pantalla a medio hacer. La recarga
automática habría tirado por tierra el trabajo a medio hacer: una incidencia abierta, un
movimiento sin confirmar, media hora de rehacer.

`ActualizacionService` se apoya en `versionUpdates` (camino normal) y en
`checkForUpdate()` a los 4 s (red de seguridad para la carga en la que el SW se
instala, donde `versionUpdates` no emite).

#### Iconos generados, no dibujados

Los PNG salen de dos SVG (`icon.svg`, `icon-maskable.svg`) con
`npm run generar:iconos`, que usa `rsvg-convert`. Así hay una sola fuente de
verdad: si cambia el color de la marca se edita el SVG y se regenera.

El *maskable* lleva el contenido reescalado al 62 % y centrado, porque Android
recorta en círculo y todo lo que se salga del círculo interior del 80 % desaparece.

#### Detalle de la API de Angular 22

`SwUpdate` **no tiene `versionReady`** (existía en versiones anteriores) y
`appData` está tipado como `object`, no como `string`. La primera versión de
`ActualizacionService` falló al compilar por los dos. El código definitivo usa
`versionUpdates` + `checkForUpdate()`.

#### Budgets ajustados (Fase 4.2, parcialmente)

Los budgets por defecto (600 kB / 1 MB) no avisarían de nada con un bundle de
104 kB. Ahora: `initial` 500 kB warning / 650 kB error; `anyComponentStyle` se
queda en 8/16 kB; `any` va amplio (400/600 kB) porque aplica a **cada** fichero
por separado, incluido el bundle principal de 141 kB —ponerlo bajo lo rompe todo
sin sentido.



### 4.1 — Pendiente de implementar

Esta entrega cubre los **Bloques 1, 2 y 3** completos más el núcleo del
Bloque 4. Queda pendiente y está planificado:

| Fase | Estado |
|---|---|
| 4.1 PWA (`@angular/pwa`) | Pendiente |
| 4.3 Tests (Vitest) | Pendiente |
| 4.4 Despliegue | Pendiente |
| 4.5 Documentación | Parcial (este README + este archivo) |

### 4.2 — Mock de API (ver §3.9)

`mockApiInterceptor` replica `proyecto.md`: 5 pasillos, 4 estantes, 4 niveles =
80 ubicaciones, 50 productos, 3 usuarios, movimientos, incidencias y un
historial de búsquedas sembrado con la curva julio→septiembre.

Está **desactivado por defecto** porque el backend real está disponible. Se
registra en `app.config.ts` solo si `environment.useMockApi` es `true`, así que
ni siquiera entra en el bundle de producción.

---

# 🐛 Incidencias detectadas en el backend

Detectadas al verificar la app contra el backend real en `localhost:8000`
(2026-10-11). **Ninguna es culpa del frontend**, pero dos de ellas impiden que
el flujo principal del proyecto se cierre de punta a punta.

## ✅ BUG-1 · `POST /busquedas/{id}/finalizar` siempre respondía 404 (CRÍTICO)

> **ESTADO: RESUELTO y verificado el 2026-10-12.** El flujo completo funciona en
> la UI y `/busquedas/historial` devuelve filas. Se conserva la descripción
> original del problema y la solución sugerida como referencia.

**Síntoma**

```
POST /api/v1/busquedas/iniciar       → 201 { "busqueda_id": 150004, ... }
POST /api/v1/busquedas/150004/finalizar
    → 404 { "error_code": "BUSQUEDA_NO_ENCONTRADA",
            "details": { "busqueda_id": 150004 } }
```

Reproducible al instante, con y sin `producto_id`, para cualquier producto.

**Diagnóstico.** `iniciar` devuelve un id que **no queda persistido**: parece
sintetizarse (150002, 150003, 150004 — correlativo, no un id de base de datos),
y `finalizar` lo busca en el almacén y no lo encuentra. Además,
`GET /busquedas/historial` devuelve `[]` aunque
`GET /metricas/dashboard` reporta 66 búsquedas: confirma que las búsquedas no
se están registrando.

**Impacto.** El paso 2 del flujo principal ("Confirmar encontrado aquí") no
funciona, y con él **el indicador central del proyecto**: sin
`finalizar`, no se registra el tiempo de búsqueda y la comparativa
"antes vs. después" no tendrá datos reales.

**Corrección sugerida en el backend.** Dos endpoints y una tabla.

### Cambio 1 — `iniciar` debe persistir y devolver el id real

Hoy parece fabricar el id (150002, 150003, 150004 — correlativo). Debe insertar
la fila y devolver su `id` de base de datos.

Columnas mínimas de la tabla `busqueda`:

```
id                      PK
usuario_id              FK -> usuario.id
producto_id             FK -> producto.id  (nullable)
termino_busqueda        str
fecha_inicio            datetime   <-- arranca el cronómetro
fecha_fin               datetime   nullable
ubicacion_encontrada_id FK -> ubicacion.id  nullable
exito                   bool
tiempo_busqueda_segundos int      nullable
```

```python
@router.post("/busquedas/iniciar", status_code=201)
def iniciar(dto: IniciarBusquedaDTO, usuario = Depends(usuario_actual)):
    producto = resolver_producto(dto.termino_busqueda, dto.producto_id)
    fila = Busqueda(
        usuario_id=usuario.id,
        producto_id=producto.id if producto else None,
        termino_busqueda=dto.termino_busqueda,
        fecha_inicio=datetime.utcnow(),
    )
    db.add(fila)
    db.commit()
    db.refresh(fila)
    return ResultadoBusquedaDTO(
        busqueda_id=fila.id,          # <-- el id REAL, no un correlativo
        producto=producto,
        stock_total=stock_total(producto),
        ubicaciones=distribucion(producto),
    )
```

### Cambio 2 — `finalizar` debe cerrar esa misma fila

```python
@router.post("/busquedas/{busqueda_id}/finalizar")
def finalizar(busqueda_id: int, dto: FinalizarBusquedaDTO,
              usuario = Depends(usuario_actual)):
    fila = db.get(Busqueda, busqueda_id)
    if fila is None or fila.usuario_id != usuario.id:
        raise HTTPException(404, "Búsqueda no encontrada")

    fila.ubicacion_encontrada_id = dto.ubicacion_encontrada_id
    fila.fecha_fin = datetime.utcnow()
    fila.tiempo_busqueda_segundos = int((fila.fecha_fin - fila.fecha_inicio).total_seconds())
    fila.exito = True          # que el usuario confirme = se encontró
    db.commit()

    return BusquedaFinalizadaDTO(
        exito=True,
        tiempo_busqueda_segundos=fila.tiempo_busqueda_segundos,
    )
```

Tres detalles que importan:

1. **Filtrar por `usuario_id`.** Si no, quien adivine un id puede cerrar la
   búsqueda de otro, y además el 404 rightful se convierte en un 403 real.
2. **`exito` no lo manda el cliente.** Que el usuario confirme que encontró el
   producto ES el resultado exitoso.
3. **`tiempo_busqueda_segundos` como `int`.** La UI lo formatea y la
   comparativa lo agrega.

### Cambio 3 — `GET /busquedas/historial` debe devolver filas

Hoy devuelve `[]`. El frontend espera **exactamente** este shape (está tipado en
`src/app/core/models/busqueda.model.ts`; si cambia, hay que tocar el TypeScript):

```typescript
{
  id: number;                     // PK de la fila
  busqueda_id: number;            // mismo valor
  termino_busqueda: string;       // lo que escribió el usuario
  producto_id: number | null;
  producto_nombre: string | null; // JOIN con producto — sin esto se vería el id
  ubicacion_encontrada_id: number | null;
  exito: boolean;
  tiempo_busqueda_segundos: number | null;
  fecha: string;                  // ISO 8601
}
```

### Verificación

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana.torres@xyz.com","password":"Demo1234!"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')

# 1. iniciar
BID=$(curl -s -X POST http://localhost:8000/api/v1/busquedas/iniciar \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"termino_busqueda":"Tornillos 1/4"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["busqueda_id"])')

# 2. finalizar → debe dar 200 con tiempo_busqueda_segundos
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  "http://localhost:8000/api/v1/busquedas/$BID/finalizar" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"ubicacion_encontrada_id":30}'

# 3. el historial ya debe listar esa búsqueda
curl -s 'http://localhost:8000/api/v1/busquedas/historial?limit=1' \
  -H "Authorization: Bearer $TOKEN"

# 4. y el contador del dashboard debe subir en 1
curl -s http://localhost:8000/api/v1/metricas/dashboard -H "Authorization: Bearer $TOKEN"
```

**Cómo lo mitiga el frontend mientras tanto.** La UI trata el fallo como
recuperable: avisa por toast y conserva el resultado de la búsqueda en pantalla
(el trabajador no pierde la ubicación que ya estaba mirando). No reintenta
automáticamente para no generar ruido.

## ✅ BUG-2 · Solo existía una cuenta de usuario sembrada

> **ESTADO: RESUELTO y verificado el 2026-10-12.** Los tres usuarios hacen login
> y la UI se adapta al rol (con Almacenero, "Métricas" desaparece del menú).

`API_FRONTEND.md` documenta tres usuarios de prueba, pero
`POST /auth/login` solo acepta `ana.torres@xyz.com / Demo1234!`
(rol Administrador). `carlos.ruiz@xyz.com` y `luis.mendoza@xyz.com` responden
401.

**Impacto.** No se puede verificar en la UI la diferencia de permisos entre
roles (crear/editar/borrar productos, crear ubicaciones, ver métricas).

**Corrección sugerida.** Ejecutar el seed de usuarios inicial (o crearlos a
mano). Mientras tanto, el botón "Cuentas de demostración" del login incluye los
tres, así que en cuanto el backend los tenga funciona sin tocar el frontend.

```bash
# Debe dar 200 para los tres
for e in ana.torres carlos.ruiz luis.mendoza; do
  curl -s -o /dev/null -w "$e@xyz.com → %{http_code}\n" -X POST \
    http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
    -d "{\"email\":\"$e@xyz.com\",\"password\":\"Demo1234!\"}"
done
# esperado: 200, 200, 200
```

## ✅ BUG-3 · `POST /incidencias/{id}/resolver` excluía al Administrador (ALTA)

> **ESTADO: RESUELTO y verificado el 2026-10-12.** `POST /incidencias/30005/resolver`
> responde 200 con token de Administrador.

**Síntoma.** Con la sesión de `ana.torres@xyz.com` (rol_id 1, Administrador):

```
POST /api/v1/incidencias/1/resolver
    → 403 { "message": "Se requiere uno de los roles: Almacenero, Supervisor" }
```

El mismo token **sí** puede crear productos (201) y crear ubicaciones (201).

**Diagnóstico.** La dependencia del endpoint está declarada como
`[Almacenero, Supervisor]` en lugar de incluir `Administrador`. Contradice la
tabla de roles de `API_FRONTEND.md`, donde el Administrador tiene
"**Acceso total**".

**Impacto.** El Administrador no puede resolver ninguna incidencia, aunque la
tabla de permisos del frontend (`core/models/rol.model.ts`) le concede
`incidencias:resolver` y por eso le muestra el botón. El usuario ve un botón
que el servidor rechaza.

**Corrección sugerida.** Añadir `Administrador` a la lista de roles del
endpoint (o, mejor, definir una dependencia de "cualquier rol con el permiso
`incidencias:resolver`", para que el backend deje de codificar la tabla de
roles a mano en cada ruta).

**Cómo lo mitiga el frontend.** Muestra el mensaje del backend tal cual y
mantiene el diálogo abierto para que el usuario pueda reintentar o cancelar.
La UI no oculta el botón porque el permiso está bien según la documentación:
es el servidor el que discrepa.

```bash
# Con el token de ana.torres (rol Administrador) debe dar 200
curl -s -w '\nHTTP %{http_code}\n' -X POST \
  http://localhost:8000/api/v1/incidencias/1/resolver \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN"
# actual: 403 "Se requiere uno de los roles: Almacenero, Supervisor"
```

> Nota: esta corrección es de **una línea**, pero conviene revisar el patrón.
> Si el resto de endpoints codifica la tabla de roles a mano en cada ruta
> (`[Almacenero, Supervisor]` en una, `[Administrador]` en otra), el próximo
> olvido volverá a pasar. Una dependencia tipo
> `require_permiso("incidencias:resolver")` elimina la clase de bug.

## NO ES UN BUG · Detalle de la API verificada

- `GET /ubicaciones/{id}` **no** devuelve los productos de la ubicación. La
  única forma de obtener el contenido de un estante es
  `GET /ubicaciones/qr/{codigo_qr}`. La pantalla de detalle encadena ambas
  llamadas por eso (ver §3.8).
- Los listados devuelven arrays planos sin `total` (§3.3).
- La ruta real de métricas es `/metricas/...` sin barra final, tal como
  documenta `API_FRONTEND.md`.

---

# 📥 Cambios de backend necesarios

Peticiones que llegan tras probar la app, con el contrato exacto a implementar.
El frontend **ya está preparado**: en cuanto el endpoint exista, la UI funciona
sin tocar código.

---

> ⚠️ **2026-10-12: la lectura funciona (200 con las 8 categorías) y `activo` ya
> está en las 4 capas. PERO la escritura no persiste nada — ver BUG-4 en el
> índice del principio.**

## PET-1 — Categorías de producto · ALTA PRIORIDAD

> **Estado tras aplicar los cambios (verificado 2026-10-12):** ❌ **A medias.**
> La tabla existe con 8 categorías reales, la FK `productos.categoria_id` está
> puesta y las 4 rutas están registradas en el OpenAPI. Pero
> `GET /categorias/` responde **HTTP 500**. Falta un arreglo (10 min) para que
> el desplegable muestre nombres. Ver **"Diagnóstico del 500"** al final de esta
> sección.



### El problema (estado original, antes de los cambios)

El formulario pedía `categoria_id` con un input numérico y el detalle mostraba
`#5`. El usuario veía un número y no sabía qué significaba.

La causa nunca fue el frontend: **el backend no tenía noción de categoría**:

- No existía ninguna ruta `/categorias`.
- No existía ningún schema `Categoria*` en el OpenAPI.
- `ProductoReadDTO.categoria_id` era un `integer | null` sin relación con nada.
- Los ids 1–8 estaban en uso en los 50 productos, pero nadie sabía qué eran.

Un entero suelto no es una categoría: es un código interno. Mostrarlo obligaba
al usuario a un diccionario que no existía.

### Estado actual (2026-10-12)

Todo lo anterior **ya está resuelto en el backend**: existe la tabla `categorias`
con 8 categorías reales ("Tornillería", "Herramientas manuales", "EPP"…), la FK
`productos.categoria_id` está puesta y las 4 rutas del CRUD están registradas.

Lo que falla es la **ejecución**: `GET /categorias/` devuelve 500 por una firma
que no coincide entre el use case y el repositorio. El arreglo está en el índice
del principio, sección "🔴 PENDIENTE".

### Lo que ya está hecho en el frontend

| Archivo | Qué hace |
|---|---|
| `core/models/categoria.model.ts` | Tipos `Categoria` y `CategoriaOpcion`. |
| `core/services/categorias.service.ts` | Pide `GET /categorias/`, cachea, degrada a 404. |
| `features/productos/form/` | `<select>` con nombres; nunca un número escrito a mano. |
| `features/productos/detalle/` | Muestra el nombre, con `Categoría #5` como respaldo. |

Mientras el endpoint no exista, la UI:

- **No rompe**: el `<select>` se rellena con `— Sin categoría —` más una opción
  provisional `Categoría #5 (sin catálogo)` con el id real.
- **No pierde datos**: si un producto viene con `categoria_id = 5` y el
  catálogo no carga, la opción provisional conserva el 5 y al guardar se manda
  5. Sin este fallback, abrir y guardar un producto habría borrado su
  categoría.
- Muestra un aviso bajo el campo explicando por qué no hay nombres.

### Cambio 1 — Modelo `categoria`

```python
class CategoriaBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=255)
    activo: bool = True

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=255)
    activo: Optional[bool] = None

class CategoriaRead(CategoriaBase):
    id: int
```

### Cambio 2 — Rutas

```
GET    /api/v1/categorias/     → 200 [CategoriaRead]
POST   /api/v1/categorias/     → 201 CategoriaRead   (Administrador)
PATCH  /api/v1/categorias/{id} → 200 CategoriaRead   (Administrador)
DELETE /api/v1/categorias/{id} → 204                (Administrador)
```

Solo lectura es imprescindible; el resto es para que el catálogo sea
gestionable sin tocar la base de datos a mano.

**Query params opcionales** (los usa la UI a futuro):

| Param | Tipo | Default | Uso |
|---|---|---|---|
| `skip` | int | 0 | paginación |
| `limit` | int | 100 | paginación (máx. 500) |
| `solo_activas` | bool | true | el formulario filtra por `activo` |

### Cambio 3 — Mínimo, si no quieres crear la tabla aún

Un endpoint estático de 5 líneas resuelve el 90 % del problema de UX:

```python
@router.get("/categorias/", response_model=list[CategoriaRead])
def listar_categorias():
    return [
        CategoriaRead(id=1, nombre="Fijación y tornillería", descripcion=None, activo=True),
        CategoriaRead(id=2, nombre="Seguridad industrial", descripcion=None, activo=True),
        CategoriaRead(id=3, nombre="Embalaje", descripcion=None, activo=True),
        CategoriaRead(id=4, nombre="Pintura y acabados", descripcion=None, activo=True),
        CategoriaRead(id=5, nombre="Limpieza e higiene", descripcion=None, activo=True),
        CategoriaRead(id=6, nombre="Mantenimiento", descripcion=None, activo=True),
        CategoriaRead(id=7, nombre="Ferretería", descripcion=None, activo=True),
        CategoriaRead(id=8, nombre="Otros", descripcion=None, activo=True),
    ]
```

> ⚠️ Solo válido si esos ids **coinciden con los de tu base de datos**. Los 8
> salen de los productos actuales; conviene leer los nombres reales de la
> tabla `categoria` que ya exista en tu esquema y no inventarlos.

### Cambio 4 — (opcional pero recomendado) Validación de FK

Ahora `POST /productos` acepta `categoria_id: 9999` sin complaintear. Con la
tabla creada:

- `ForeignKey("categoria.id")` en el modelo de producto.
- `categoria_id` deja de ser `Optional` si toda categoría es obligatoria
  (eso es política de inventario, no del frontend).

Evita que el catálogo se contamine con ids inexistentes.

### Verificación

```bash
curl -s http://localhost:8000/api/v1/categorias/ -H "Authorization: Bearer $TOKEN"
# Esperado: [{ "id": 1, "nombre": "Fijación y tornillería", "descripcion": …, "activo": true }, …]
```

En cuanto responda 200 con ese shape, el desplegable se rellena solo.

---

### Diagnóstico del 500

> El diagnóstico completo vive en el **índice del principio** del documento
> (sección "🔴 PENDIENTE"). Se deja aquí una nota mínima para no perder el
> contexto al leer esta sección linealmente.
>
> Causa raíz: `ListarCategoriasUseCase` llama
> `repo.list(skip=…, limit=…, solo_activas=…)` y
> `CategoriaRepositoryImpl.list(self)` no acepta argumentos → `TypeError` → 500.
> Arreglo: alinear el puerto (`categoria_repository.py`) con el caso de uso.

---

## ✅ PET-3 · Stock por ubicación (listado de ubicaciones)

> **ESTADO: RESUELTO el 2026-10-13.** `GET /inventario/ubicaciones` implementado y
> desplegado. El listado muestra código, nombre y cantidad por ubicación.

**Petición.** Que el listado de ubicaciones muestre qué productos hay en cada
una, con su código.

**Por qué no se puede resolver solo en el frontend.** `GET /ubicaciones/`
devuelve la ubicación y nada más. Las dos rutas que sí traen productos son de
**una en una**:

| Ruta | Devuelve | Peticiones para 20 filas |
|---|---|---|
| `GET /ubicaciones/qr/{código}` | una ubicación con sus productos | 20 |
| `GET /inventario/producto/{id}` | un producto con su distribución | 50 (todas) |

Ninguna sirve para un listado. No es un problema de rendimiento: es que el
endpoint no existe. Con 150 ubicaciones serían 150 peticiones secuenciales por
recorrer el catálogo.

**Contrato que hay que implementar:**

```
GET /api/v1/inventario/ubicaciones?skip=0&limit=50&con_stock=true
```

```typescript
type UbicacionStock = {
  ubicacion_id: number;
  codigo_ubicacion: string;   // "P3-A-01"
  pasillo: string;
  estante: string;
  nivel: string;
  productos: { producto_id: number; codigo: string; nombre: string; cantidad: number }[];
  total_unidades: number;
};
```

Se pide `codigo` **y** `nombre`: el código es lo que está impreso en la etiqueta
del estante, y el nombre es lo que entiende el trabajador. Con solo el `id` no
se puede pintar nada legible.

**Implementado.** La columna "Productos" existe en escritorio y en
móvil y consume exactamente este shape. Mientras el endpoint devuelva 404, la
columna muestra `—` y el encabezado avisa de que no está disponible; el resto
del listado sigue funcionando. En cuanto exista, se rellena solo.

```python
@router.get("/inventario/ubicaciones")
async def stock_por_ubicacion(
    skip: int = 0, limit: int = Query(50, ge=1, le=500),
    con_stock: bool = True,
    repo: InventarioRepoDep = None,
):
    # SELECT i.ubicacion_id, u.codigo_ubicacion, u.pasillo, u.estante, u.nivel,
    #        p.id, p.codigo, p.nombre, i.cantidad
    #   FROM inventario i
    #   JOIN ubicaciones u ON u.id = i.ubicacion_id
    #   JOIN productos   p ON p.id = i.producto_id
    #  ORDER BY u.codigo_ubicacion, p.codigo
    return await repo.listar_con_productos(skip=skip, limit=limit, solo_con_stock=con_stock)
```

---

## ✅ PET-2 — Generar códigos QR

> **ESTADO: RESUELTO y verificado el 2026-10-12.** Crear una ubicación con un
> `codigo_qr` repetido responde **409 `UBICACION_DUPLICADO`**.

**No requiere cambios de backend.** La generación es 100 % cliente
(`qrcode-generator`, sin dependencias): el SVG se produce en el navegador a
partir del `codigo_qr` que la API ya devuelve.

Lo que sí conviene decidir en el servidor:

1. **La convención del contenido del QR es `codigo_qr`**, no
   `codigo_ubicacion`: es lo que acepta `GET /ubicaciones/qr/{codigo_qr}`, así
   que el mismo contenido sirve para escanear y para imprimir. Si cambiase,
   el escáner dejaría de entender las etiquetas ya pegadas en los estantes.

2. **`codigo_qr` debería ser único.** Hoy no se valida: si dos ubicaciones
   comparten código, el escáner abrirá siempre la primera. Recomendable un
   `UNIQUE` en la columna más un 409 en el POST, igual que ya se hace con
   `codigo_ubicacion`.

```python
# Columna
codigo_qr = Column(String(50), unique=True, nullable=False, index=True)

# En el POST, igual que ya se hace con codigo_ubicacion
if db.query(Ubicacion).filter(Ubicacion.codigo_qr == dto.codigo_qr).first():
    raise HTTPException(409, "UBICACION_QR_DUPLICADO")
```

---

## ⚪ Observaciones menores (no bloquean)

Detectadas durante la verificación. Ninguna impide trabajar; se listan para
que quede constancia de que el frontend ya se ha protegido de ellas.

### OBS-1 · `foto_url` apunta a assets que no existen

`ProductoReadDTO.foto_url` trae cosas como `/assets/products/T001.jpg`, pero
el servidor no sirve `/assets`. Todas las fotos dan 404.

**Frontend.** Ya degradado: cuando el `<img>` falla se muestra "La fotografía
indicada no está disponible" en vez del icono de imagen rota.
**Backend.** Servir los archivos en `/assets` o devolver `null`.

### OBS-2 · `null` vs `0` en las métricas — NO cambiar sin avisar

`/metricas/tiempo-promedio` y `/metricas/comparativa` devuelven
`promedio_segundos: null` (no `0`) cuando un rango no tiene búsquedas, y
`mejora_segundos`/`mejora_porcentaje` también.

**Esto es correcto y el frontend depende de ello**: es lo que le permite
distinguir "no hay datos" de "el tiempo fue cero" y no mostrar un porcentaje de
mejora engañoso al 100 %. Si se cambia a `0`, la pantalla de comparativa
pasará a prometer mejoras inexistentes.

### OBS-3 · No hay endpoint de stock masivo

`GET /inventario/producto/{id}` es de un solo producto. El listado de productos
lo pide uno por uno (~20 peticiones por página, cacheadas en cliente).

**Frontend.** Aceptable hoy; con 50 productos no se nota.
**Backend.** Opcional: `GET /inventario/producto/?ids=1,2,3…` o incluir el stock
total en `ProductoReadDTO` y evitaría el N+1.

### OBS-4 · `POST /auth/register` está publicado pero inaccesible

Aparece en el OpenAPI pero responde 401 sin token, así que no se puede usar
para crear usuarios (ni de semilla inicial, ni de alta real).

**Frontend.** No lo usa. Pero explica por qué BUG-2 no se puede resolver desde
la API: hay que hacerlo por seed o acceso directo a la base de datos.

### OBS-5 · `unidad_medida` es texto libre

`ProductoCreateDTO.unidad_medida` acepta cualquier string (`max_length=20`), así
que conviven "pieza", "piezas", "unid", "u"…

**Frontend.** El formulario ofrece una lista cerrada (pieza, par, unidad, caja,
rollo, litro, paquete) para que no se disperse.
**Backend.** Opcional: un `Literal[...]` o una tabla de unidades si quieres
garantizar consistencia en los reportes.

> ✅ **RESUELTO 2026-10-12:** el campo `producto_nombre` ya llega con valor y la
> tabla del historial lo usa. Se conserva la nota original como referencia.

### OBS-6 · `GET /busquedas/historial` devuelve la fila cruda, no un DTO

**El backend ya persiste búsquedas** (BUG-1 arreglado, verificado), pero el
historial devuelve la fila de la tabla tal cual:

```json
{
  "id": 210001, "usuario_id": 1, "producto_id": 1,
  "termino_busqueda": "Tornillos 1/4",
  "fecha_hora_inicio": "...", "fecha_hora_fin": "...",
  "tiempo_busqueda_segundos": 0,
  "ubicacion_encontrada_id": 30, "exito": true, "observaciones": null
}
```

Esto **no coincide** con lo que decía el contrato de DECISIONS.md (que pedía
`busqueda_id`, `producto_nombre` y un `fecha` único), pero es una información
*más* rica, no más pobre: trae inicio y fin por separado, que es justo lo que
sirve para medir tiempos.

**Frontend adaptado.** En vez de forzar al servidor a alterar su respuesta, se
separaron los dos niveles:

- `BusquedaHistorialApi` — la fila cruda del servidor.
- `BusquedaHistorial` — el modelo de vista, con `fecha = fecha_hora_fin ?? fecha_hora_inicio`.
- `normalizarBusqueda()` — el conversor, en `core/models/busqueda.model.ts`.

El servicio y el componente usan el mapeo, así que si algún día el backend
añade el JOIN y manda `producto_nombre`, solo hay que tocar una función.

**Lo que falta en el servidor (opcional):** un JOIN con `producto` para traer
`producto_nombre`. Ahora la tabla cae en el texto que escribió el usuario
("Tornillos 1/4"), que no es un id y para el trabajador es reconocible — pero el
nombre canónico del catálogo sería mejor.

---

### 3.10 — `withComponentInputBinding`: tres trampas con los route params

Costaron un rato de depuración, así que quedan escritas para que no se
reintroduzcan.

**Trampa 1 — el input debe llamarse EXACTAMENTE como el parámetro de ruta.**

`withComponentInputBinding` empareja por nombre. Si la ruta es `:id` y el
componente declara `ubicacionId = input()`, **nunca recibe el valor**: no hay
ningún error, el signal simplemente queda `undefined` y la pantalla se queda en
"Cargando" para siempre. Pasaba en el detalle de ubicación y en el formulario de
edición (abría en modo "editar" pero vacío).

**Trampa 2 — el router entrega `string`, aunque el input sea `number`.**

`input.required<number>()` NO coacciona. Llega `"1"` y `Number.isFinite("1")`
es `false` (a diferencia de `isNaN(Number("1"))`). El síntoma es un
"Ubicación no válida" con un id perfectamente válido.

**Trampa 3 — pedir datos en el constructor.**

Los inputs se asignan **después** de construir el componente. Un
`queueMicrotask(() => this.cargar())` en el constructor los pide antes de
tiempo, igual que un método de precarga que nadie llama.

**Patrón correcto** (el que usan ya los componentes con `:id`):

```ts
readonly id = input<string>();                    // 1. nombre = parámetro de ruta

protected readonly idNumero = computed(() => {    // 2. conversión explícita
  const bruto = this.id()?.trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isInteger(n) && n > 0 ? n : null;
});

constructor() {                                    // 3. reaccionar al signal
  afterRenderEffect(() => {
    const id = this.idNumero();
    if (id === null || id === this.idCargado) return;
    this.idCargado = id;
    this.cargar(id);
  });
}
```

`afterRenderEffect` y no `effect`: tras el render los inputs están asignados
con seguridad, y vuelve a disparar si el usuario navega de un id a otro sin
que se destruya el componente.

### 3.11 — `<select>` con Signal Forms entrega `string`

Igual que el router, un `<select>` con `[formField]` entrega siempre el `value`
del `<option>`, que es texto. `categoria_id` se modela como `string` en el
formulario y se convierte a `number` una sola vez, al construir el payload.
Intentar `[ngValue]` con `NgSelectOption` exigiría además importar
`FormsModule` (no es standalone) sin cambiar el resultado.

## ✅ PET-4 fase 2 — Alta de almacén con su administrador

### Lo que se añadió

`POST /api/v1/auth/onboarding` (público). Crea el almacén y su administrador en
una sola transacción y devuelve el token, para que el cliente entre
directamente sin escribir la contraseña otra vez.

```json
{
  "almacen": { "nombre": "Logística Norte", "direccion": "Calle Mayor 1" },
  "usuario": { "nombre": "Rita Gómez", "email": "rita@logisticanorte.es",
               "password": "Prueba1234!" }
}
```

Respuesta `201`:

```json
{
  "almacen": { "id": 30002, "nombre": "Logística Norte", ... },
  "usuario":  { "id": 120002, "email": "rita@...", "nombre_rol": "Administrador" },
  "token":    { "access_token": "...", "refresh_token": "..." }
}
```

### Decisiones

**El rol no se acepta en el cuerpo.** Quien da de alta el almacén es su
responsable: si se le asignara Supervisor o Almacenero, se quedaría sin poder
administrar su propio almacén. Admitirlo sería permitir autoasignarse permisos.

**`almacen_id` no viaja en el JWT.** Vive en `usuarios.almacen_id` y lo lee
`get_current_user` en cada petición. Meterlo en el token obligaría a invalidar
las sesiones de todos los usuarios cada vez que se moviera a alguien de
almacén.

**Riesgo conocido:** es la única ruta pública que escribe. Para cerrarla hace
falta un `rate limit` en nginx o Cloudflare sobre `/api/v1/auth/onboarding`.
No es un problema mientras sea una demo; sí lo sería en producción abierta.

**No se crear `POST /almacenes` a secas.** Un administrador de un almacén no
debe poder crear otro almacén: el alta siempre es con su administrador.

### Verificación

```
almacén nuevo: productos 0, ubicaciones 0, panel todo a 0
almacén 1:     productos 50, ubicaciones 150, busquedas 74   (sin cambios)
```

---

## 🐛 Lo que destapó la fase 2 — tres bugs que ya existían

### 1. Diez endpoints de escritura no guardaban nada — **el más grave**

`POST /movimientos/entrada` devolvía `201` con el movimiento `60001` y **no
escribía una fila**:

```
201  respuesta: id 60001, tipo ENTRADA, cantidad 7
     → movimientos: 45 (sigue 45)
     → stock T001: 470 (sigue 470)
```

El repositorio hace `flush()`, que solo manda el INSERT dentro de la
transacción abierta. `get_session()` no confirma al cerrarse, así que todo se
deshacía al terminar la petición. **La respuesta era correcta y el frontend
pintaba el éxito**: por eso llevaba tanto tiempo escondido. Lo único real eran
los datos del seed.

Afectaba a: `crear_producto`, `actualizar_producto`, `eliminar_producto`,
`crear_ubicacion`, `registrar_entrada`, `registrar_salida`,
`registrar_traslado`, `crear_incidencia`, `resolver_incidencia`.

Las tres de movimientos comparten ahora un helper, `_registrar_y_confirmar`,
porque un movimiento toca tres tablas (inventario origen, inventario destino y
movimientos) y el commit va **detrás** del `execute`: si algo fallara a mitad,
la rollback dejaría el stock intacto en vez de haber movido solo la mitad.

**Cómo se comprueba que está bien:**

```bash
POST /movimientos/entrada  -> 201
GET  /inventario/producto/1  -> stock 473 (antes 470)
GET  /movimientos/?limit=1    -> la entrada está ahí
```

Si el stock no se mueve, vuelve a faltar el commit.

### 2. Dos mappers con un `almacen_id` fantasma

`apply_almacen` y `apply_categoria` asignaban `m.almacen_id`, que **no existe ni
en el modelo ni en la entidad**. `POST /categorias` devolvía `500` con
`AttributeError`.

Esto explica por qué el BUG-4 parecía arreglado y no lo estaba: se añadió el
`commit` que faltaba, pero el mapper seguía roto. **Crear una categoría nunca
funcionó.**

### 3. `POST /ubicaciones` permitía escribir en el almacén de otro

`UbicacionCreateDTO` exigía `almacen_id` en el cuerpo y el caso de uso solo
comprobaba que el almacén **existiera**, no que fuera del usuario:

```
Ana   (almacén 1)  POST /ubicaciones {almacen_id: 30002, ...}  -> 201
Rita  (almacén 30002)  GET /ubicaciones  -> ve P9-A-01
```

El formulario del frontend mandaba `almacen_id: 1` hardcodeado, que era el
lado del cliente del mismo bug.

**Arreglo:** el almacén lo pone la ruta desde `current_user.almacen_id` y el
DTO ya no lo acepta. Pydantic descarta el campo si un cliente antiguo lo manda,
así que no rompe nada. En el frontend se quitó el campo del modelo del
formulario, su validación y el tipo `UbicacionCreate`.

---

## 🧪 Los tests de integración escribían en la base de datos real

Los tests usan `ASGITransport` contra la app entera, contra **la base de
producción** (TiDB Cloud `smart_warehouse`, la misma que usa el servidor).

Hasta ahora eso no se notaba porque los `commit` faltaban y sus escrituras se
descartaban solas. **Al arreglarlos, cada `pytest` empezó a escribir de verdad**:
tras dos pasadas el stock de T001 bajó de 470 a 460 y se acumulaban
movimientos, ubicaciones y búsquedas basura.

`tests/conftest.py` ahora envuelve cada test en una transacción que se deshace:

- `SesionDeTest` traduce `commit()` en `flush()` — la escritura llega a la
  conexión (para que los `refresh()` se comporten igual que en producción) pero
  nunca se confirma.
- El pool del engine se descarta entre tests. Sin eso, cada test con su propio
  event loop hereda una conexión atada al loop anterior y pytest falla con
  *"got Future attached to a different loop"*.

Además se reparó la suite, que estaba rota:

| Problema | Causa |
|---|---|
| 17 errores en cascada | fixture `event_loop`, que pytest-asyncio 1.4 ya no soporta |
| 3 fallos | expectativas desactualizadas contra la base real |
| 2 fallos (403) | los tests usaban `admin_token` y la ruta exige Almacenero o Supervisor |
| 1 fallo (TypeError) | comparaba julio y septiembre de **2024**, un año sin datos, contra un histórico sembrado de **2025** |

**35 tests en verde** y la base queda igual antes y después. Para comprobarlo:

```bash
.venv/bin/python -m pytest -q          # antes y después, los mismos números
```

### Si algún día quieres tests de verdad

Esto sigue siendo integración contra la base real, solo que sin escribir. Lo
correcto es una base `smart_warehouse_test`: cambiar `DB_NAME` en `.env` para
los tests y no tocar la de producción. Entonces se puede quitar el
`SesionDeTest` y dejar que commiten de verdad.

---

## 🛠️ El script de despliegue tenía dos fallos

**El repositorio del frontend tenía 150 objetos de git en propiedad de `root`**,
de un despliegue en el que el pull corrió como root. El resultado era:

```
error: insufficient permission for adding an object to repository database
fatal: failed to write object
```

Arreglado con `chown -R ubuntu:ubuntu /srv/smartwarehouse/frontend/.git`.

**El bloque de frontend del script no cambiaba de directorio.** Todo lo que
Sigue (el `md5sum` de `package-lock.json`, `npm ci`, `ng build`, la ruta de
`dist/`) asume que se está en el directorio del frontend, pero `pull_como_dueno`
usa `git -C`, que no cambia el directorio. Solo se notaba cuando el build
anterior había fallado, porque con `package-lock.json` sin cambios la ruta se
corta antes.

Añadido `cd "$FRONTEND"` justo después del pull.

**Patrón a recordar:** el `pull` va como el **dueño real** de cada repo
(backend = `smartwarehouse`, frontend = `ubuntu`), no como root, porque git
rechaza *dubious ownership*.

## ✅ PET-4 fases 3 y 4 — Cuestionario y generación de ubicaciones

### Qué hace

El usuario responde cinco preguntas y el sistema genera sus ubicaciones con su
código y su QR:

```
1. Almacén   → nombre, dirección
   Cuenta    → nombre, correo, contraseña (tú quedas como Administrador)
2. Pasillos  → cuántos hay y cuántos estantes en cada uno
3. Niveles   → cuántos niveles tiene cada estante
4. Fuera de servicio → qué estantes están obstruidos (opcional)
5. Confirmar → tabla con lo que se va a crear → «Crear»
```

Rutas: `/configuracion-inicial` (invitado, alta completa) y
`/almacen/configuracion` (Administrador que amplía el almacén que ya tiene).

### Endpoints

| Ruta | Sesión | Qué hace |
|---|---|---|
| `POST /configuracion/previsualizar` | **no hace falta** | Dice cuántas filas habría. No escribe |
| `POST /configuracion/generar` | Administrador | Crea las que falten |
| `GET /configuracion/almacen` | cualquiera | Estado actual del almacén |

### Por qué la previsualización no pide sesión

Porque el cálculo es puro: sale del cuestionario y no escribe nada. Exigir rol
de Administrador rompía el flujo, porque quien rellena el cuestionario todavía
**no tiene cuenta** —la cuenta se crea en el último paso—. Le devolvía 401, el
interceptor intentaba renovar un token inexistente y el mensaje que veía era
«No hay sesión para renovar» en lugar de su tabla de previsualización.

La ruta lee el usuario si viene, y solo para contar cuántas de esas
ubicaciones ya existen en su almacén y avisar antes de duplicarlas. Sin
sesión, `ya_existentes` es 0 porque no hay almacén al que mirar.

### El estante es UNA letra. 26, no 99

El código de ubicación es `P{pasillo}-{letra}-{nivel}` y lo valida
`CodigoUbicacion`, el mismo value object que usa para las ubicaciones creadas a
mano. Como el QR del almacén original ya está impreso con ese formato, cambiarlo
obligaría a reimprimir las etiquetas de los 150 estantes que ya existen.

El frontend replica el límite (26 letras, `LETRAS_ESTANTE`) para no mandar un
cuerpo que el servidor va a rechazar con un 422.

### Los estantes fuera de servicio se crean igual

Un estante obstruido no se borra: ocupa sitio y mañana vuelve a estar en
servicio. Marcarlo `activo=False` en vez de omitirlo deja el hueco visible y
hace que ponerlo en marcha sea cambiar un campo, no recrear 30 filas ni
reimprimir 30 etiquetas.

### Repetir la generación no falla

Las ubicaciones cuyo código ya existe se **omiten** en vez de devolver un
duplicado. Añadir un pasillo nuevo a un almacén ya configurado es el caso
normal, no un error.

---

## 🐛 Bugs encontrados al construir el cuestionario

### 1. `ubicaciones` tenía el código único en TODA la tabla

Igual que `productos` en la fase 1, pero esta tabla no se había migrado:

```
codigo_ubicacion   ÚNICO global   ← impedía que el almacén 2 tuviera un P1-A-01
codigo_qr          ÚNICO global   ← impedía repetir el QR del almacén 1
```

`scripts/alter_multialmacen.py` lo corrige: `uq_ubicaciones_almacen_codigo` y
`uq_ubicaciones_almacen_qr`, ambos por almacén. **Ejecutar en producción:**

```bash
cd /srv/smartwarehouse/backend && sudo -u smartwarehouse .venv/bin/python scripts/alter_multialmacen.py
```

Es idempotente y además imprime los índices resultantes para verificarlo.

### 2. `get_by_codigo` no filtraba por almacén

Consecuencia directa de lo anterior: al previsualizar un almacén nuevo vacío
decía que **las 87 ubicaciones ya existían** —las del almacén 1—. Además era
una fuga entre inquilinos. Ahora está acotado.

### 3. Vaciar un campo numérico borraba tu configuración

En el frontend, `type="number"` dispara `input` con `""` al borrar para
reescribir. `Math.trunc("")` es `NaN`, y convertir `NaN` en el mínimo borraba
los pasillos que el usuario ya había configurado. Se perdían datos por una
acción tan normal como seleccionar todo y teclear.

Ahora un campo vacío significa «no me lo cambies», no «ponle 1».

### 4. El `Set` y el array de fuera de servicio eran dos verdades

El store guardaba los estantes marcados en un `Set` aparte con la clave
`"2:D"` y también dentro de `PasilloConfig`. Al reducir los estantes de un
pasillo, el `Set` conservaba letras que ya no existían. Ahora solo hay una
fuente: el array del pasillo.

---

## Verificación

Caso de prueba: 4 pasillos · 8 estantes (P3 con 5) · 3 niveles · P2-D fuera de
servicio → **87 ubicaciones**, 84 en servicio y 3 fuera.

```
almacén nuevo: 87 creadas, 0 omitidas
               P2-D-01, P2-D-02, P2-D-03 marcadas inactivas
repetir:       todas ya existen → mensaje claro, no duplica
añadir P5:     12 creadas, 87 omitidas
aislamiento:    almacén 1 sigue con sus 150
                el mismo QR resuelve a un id distinto en cada almacén
permisos:       un Almacenero recibe 403 en /configuracion/generar
```

## Resumen de desviaciones

| # | Decisión | Plan | Realidad | Impacto |
|---|---|---|---|---|
| 1.1 | Gestor de paquetes | pnpm | npm | Bajo |
| 1.2 | SSR | `--ssr=false` | Desactivado (coincide) | — |
| 1.3 | UI Kit | Material + Tailwind | Tailwind puro | Medio (bundle −350 kB) |
| 1.4 | Gráficos | ng2-charts + chart.js | SVG propio | Bajo (bundle −200 kB) |
| 1.5 | Escáner QR | @zxing/ngx-scanner | BarcodeDetector nativo | Bajo (bundle −80 kB) |
| 1.6 | Fechas | date-fns | `Intl` nativo | Bajo |
| 1.8 | Carga de sesión | `resource()` | `provideAppInitializer` | Bajo |
| 2.1 | Refresh JWT | no especificado | Compartido + proactivo | **Positivo** |
| 3.1 | Pantallas de búsqueda | 3 | 2 | Medio (UX más fluido) |
| 3.2 | Comparativa | 4 campos de fecha | 3 presets | **Positivo** (UX) |
| 3.3 | Paginación | implícita | `limit + 1` | **Positivo** (robustez) |
| 4.2 | Datos de prueba | no especificado | Mock interceptor | **Positivo** |