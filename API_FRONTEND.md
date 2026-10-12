# Documentación API para Frontend

Este documento describe todas las rutas disponibles en el backend de SmartWarehouse y cómo integrarlas en el frontend.

## Configuración Base

### URL Base

```
Desarrollo: http://localhost:8000
Producción: https://tu-dominio.com
```

Todas las rutas están bajo el prefijo `/api/v1`.

### Headers Comunes

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}` // Token obtenido del login
};
```

### Manejo de Errores

Todas las respuestas de error tienen el siguiente formato:

```json
{
  "error_code": "ERROR_CODE",
  "message": "Descripción del error",
  "details": {} // Opcional
}
```

Códigos de estado HTTP utilizados:
- `200` - OK
- `201` - Creado
- `204` - Sin contenido (eliminación exitosa)
- `400` - Solicitud inválida
- `401` - No autenticado (token inválido o expirado)
- `403` - No autorizado (rol insuficiente)
- `404` - No encontrado
- `409` - Conflicto (duplicado, stock insuficiente)
- `422` - Error de validación

---

## Autenticación

### POST /api/v1/auth/login

Inicia sesión y devuelve tokens de acceso y refresco.

**Request:**
```json
{
  "email": "ana.torres@xyz.com",
  "password": "Demo1234!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 28800
}
```

**Ejemplo de uso en frontend:**
```typescript
async function login(email: string, password: string) {
  const response = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    throw new Error('Credenciales inválidas');
  }
  
  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data;
}
```

### POST /api/v1/auth/refresh

Renueva el access token usando el refresh token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 28800
}
```

### GET /api/v1/auth/me

Obtiene los datos del usuario autenticado.

**Response (200):**
```json
{
  "id": 1,
  "nombre": "Ana Torres",
  "email": "ana.torres@xyz.com",
  "rol_id": 1,
  "nombre_rol": "Administrador",
  "activo": true,
  "fecha_creacion": "2024-01-01T00:00:00",
  "ultimo_acceso": "2024-01-15T10:30:00"
}
```

### POST /api/v1/auth/change-password

Cambia la contraseña del usuario autenticado.

**Request:**
```json
{
  "current_password": "Demo1234!",
  "new_password": "NuevaPassword123!"
}
```

**Response:** 204 No Content

---

## Productos

### GET /api/v1/productos/

Lista productos con paginación.

**Query Parameters:**
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `skip` | int | 0 | Número de registros a omitir |
| `limit` | int | 50 | Máximo 100 |
| `categoria_id` | int | null | Filtrar por categoría |
| `solo_activos` | bool | false | Solo productos activos |

**Response (200):** Array de productos
```json
[
  {
    "id": 1,
    "codigo": "T001",
    "nombre": "Tornillos 1/4",
    "descripcion": "Tornillos de acero",
    "categoria_id": 1,
    "unidad_medida": "pieza",
    "stock_minimo": 50,
    "foto_url": null,
    "activo": true,
    "fecha_creacion": "2024-01-01T00:00:00",
    "fecha_actualizacion": "2024-01-01T00:00:00"
  }
]
```

**Ejemplo de uso:**
```typescript
async function getProducts(page: number = 1, categoriaId?: number) {
  const params = new URLSearchParams({
    skip: String((page - 1) * 50),
    limit: '50',
    ...(categoriaId && { categoria_id: String(categoriaId) })
  });
  
  const response = await fetch(`/api/v1/productos/?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.json();
}
```

### GET /api/v1/productos/buscar

Busca productos por nombre o código.

**Query Parameters:**
| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `termino` | string | Sí | Término de búsqueda (1-150 caracteres) |
| `limit` | int | No | Default 20, máximo 100 |

**Response (200):** Array de productos encontrados

### GET /api/v1/productos/{id}

Obtiene un producto por su ID.

**Response (200):** Objeto producto

### POST /api/v1/productos/

Crea un nuevo producto. **Requiere rol: Administrador o Supervisor.**

**Request:**
```json
{
  "codigo": "T001",
  "nombre": "Tornillos 1/4",
  "descripcion": "Tornillos de acero inoxidable",
  "categoria_id": 1,
  "unidad_medida": "pieza",
  "stock_minimo": 50,
  "foto_url": "https://ejemplo.com/imagen.jpg",
  "activo": true
}
```

**Response (201):** Producto creado

### PATCH /api/v1/productos/{id}

Actualiza un producto existente. **Requiere rol: Administrador o Supervisor.**

**Request (todos los campos opcionales):**
```json
{
  "nombre": "Tornillos 1/4 Actualizado",
  "stock_minimo": 100
}
```

**Response (200):** Producto actualizado

### DELETE /api/v1/productos/{id}

Da de baja un producto (baja lógica). **Requiere rol: Administrador.**

**Response:** 204 No Content

---

## Ubicaciones

### GET /api/v1/ubicaciones/

Lista todas las ubicaciones.

**Query Parameters:**
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `almacen_id` | int | null | Filtrar por almacén |
| `solo_activas` | bool | true | Solo ubicaciones activas |
| `skip` | int | 0 | Paginación |
| `limit` | int | 100 | Máximo 500 |

**Response (200):** Array de ubicaciones
```json
[
  {
    "id": 1,
    "almacen_id": 1,
    "pasillo": "P1",
    "estante": "A",
    "nivel": "1",
    "codigo_ubicacion": "P1-A-01",
    "codigo_qr": "QR-P1-A-01",
    "coordenada_x": "10.5",
    "coordenada_y": "20.3",
    "activo": true,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

### GET /api/v1/ubicaciones/{id}

Obtiene una ubicación por su ID.

### POST /api/v1/ubicaciones/

Crea una nueva ubicación. **Requiere rol: Administrador.**

**Request:**
```json
{
  "almacen_id": 1,
  "pasillo": "P9",
  "estante": "Z",
  "nivel": "99",
  "codigo_ubicacion": "P9-Z-99",
  "codigo_qr": "QR-P9-Z-99",
  "coordenada_x": "99.9",
  "coordenada_y": "99.9",
  "activo": true
}
```

### GET /api/v1/ubicaciones/qr/{codigo_qr}

Escanea un código QR y devuelve la ubicación con sus productos.

**Response (200):**
```json
{
  "ubicacion": {
    "id": 1,
    "codigo_ubicacion": "P3-A-01",
    "pasillo": "P3",
    "estante": "A",
    "nivel": "01",
    ...
  },
  "productos": [
    {
      "producto_id": 1,
      "codigo": "T001",
      "nombre": "Tornillos 1/4",
      "cantidad": 350
    }
  ]
}
```

### GET /api/v1/ubicaciones/almacen/{almacen_id}

Lista ubicaciones de un almacén específico.

---

## Inventario

### GET /api/v1/inventario/producto/{producto_id}

Consulta el stock consolidado de un producto en todas sus ubicaciones.

**Response (200):**
```json
{
  "producto_id": 1,
  "codigo": "T001",
  "nombre": "Tornillos 1/4",
  "unidad_medida": "pieza",
  "stock_minimo": 50,
  "stock_total": 470,
  "requiere_alerta": false,
  "distribucion": [
    {
      "ubicacion_id": 1,
      "codigo_ubicacion": "P3-A-01",
      "pasillo": "P3",
      "estante": "A",
      "nivel": "01",
      "cantidad": 350
    },
    {
      "ubicacion_id": 2,
      "codigo_ubicacion": "P3-B-02",
      "pasillo": "P3",
      "estante": "B",
      "nivel": "02",
      "cantidad": 120
    }
  ]
}
```

### GET /api/v1/inventario/alertas

Lista productos con stock por debajo del mínimo.

**Response (200):**
```json
[
  {
    "producto_id": 5,
    "codigo": "G001",
    "nombre": "Guantes de seguridad",
    "unidad_medida": "par",
    "stock_total": 25,
    "stock_minimo": 50,
    "faltante": 25
  }
]
```

---

## Movimientos

### POST /api/v1/movimientos/entrada

Registra una entrada de producto. **Requiere rol: Almacenero o Supervisor.**

**Request:**
```json
{
  "tipo": "ENTRADA",
  "producto_id": 1,
  "cantidad": 100,
  "ubicacion_destino_id": 1,
  "referencia": "OC-2024-001",
  "observaciones": "Entrada desde proveedor"
}
```

**Response (201):**
```json
{
  "id": 1,
  "tipo": "ENTRADA",
  "producto_id": 1,
  "cantidad": 100,
  "ubicacion_destino_id": 1,
  "usuario_id": 1,
  "fecha": "2024-01-15T10:30:00",
  "referencia": "OC-2024-001",
  "observaciones": "Entrada desde proveedor"
}
```

### POST /api/v1/movimientos/salida

Registra una salida de producto. **Requiere rol: Almacenero o Supervisor.**

**Request:**
```json
{
  "tipo": "SALIDA",
  "producto_id": 1,
  "cantidad": 50,
  "ubicacion_origen_id": 1,
  "referencia": "PEDIDO-001"
}
```

### POST /api/v1/movimientos/traslado

Registra un traslado entre ubicaciones. **Requiere rol: Almacenero o Supervisor.**

**Request:**
```json
{
  "tipo": "TRASLADO",
  "producto_id": 1,
  "cantidad": 30,
  "ubicacion_origen_id": 1,
  "ubicacion_destino_id": 2,
  "observaciones": "Traslado por reorganización"
}
```

### GET /api/v1/movimientos/

Lista movimientos con filtros.

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `producto_id` | int | Filtrar por producto |
| `ubicacion_id` | int | Filtrar por ubicación |
| `usuario_id` | int | Filtrar por usuario |
| `tipo` | string | ENTRADA, SALIDA, TRASLADO, AJUSTE |
| `skip` | int | Paginación |
| `limit` | int | Default 100, máximo 500 |

---

## Búsquedas

### POST /api/v1/busquedas/iniciar

Inicia una búsqueda de producto (flujo principal del trabajador).

**Request:**
```json
{
  "termino_busqueda": "Tornillos 1/4",
  "producto_id": null
}
```

**Response (201):**
```json
{
  "busqueda_id": 1,
  "producto": {
    "id": 1,
    "codigo": "T001",
    "nombre": "Tornillos 1/4",
    ...
  },
  "stock_total": 470,
  "ubicaciones": [
    {
      "ubicacion_id": 1,
      "codigo_ubicacion": "P3-A-01",
      "pasillo": "P3",
      "estante": "A",
      "nivel": "01",
      "cantidad": 350
    }
  ]
}
```

**Ejemplo de flujo completo en frontend:**
```typescript
// 1. Iniciar búsqueda
async function iniciarBusqueda(termino: string) {
  const response = await fetch('/api/v1/busquedas/iniciar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ termino_busqueda: termino })
  });
  
  const data = await response.json();
  sessionStorage.setItem('busqueda_id', data.busqueda_id);
  return data; // Muestra producto + ubicaciones
}

// 2. Finalizar búsqueda
async function finalizarBusqueda(ubicacionId: number) {
  const busquedaId = sessionStorage.getItem('busqueda_id');
  
  const response = await fetch(`/api/v1/busquedas/${busquedaId}/finalizar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ubicacion_encontrada_id: ubicacionId })
  });
  
  return response.json(); // { exito: true, tiempo_busqueda_segundos: 12 }
}
```

### POST /api/v1/busquedas/{busqueda_id}/finalizar

Finaliza una búsqueda registrando el tiempo y la ubicación encontrada.

**Request:**
```json
{
  "ubicacion_encontrada_id": 1,
  "observaciones": "Producto encontrado correctamente"
}
```

### GET /api/v1/busquedas/historial

Historial de búsquedas del usuario autenticado.

**Query Parameters:**
| Parámetro | Tipo | Default |
|-----------|------|---------|
| `skip` | int | 0 |
| `limit` | int | 50 |

---

## Incidencias

### GET /api/v1/incidencias/

Lista incidencias con filtros.

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `tipo` | string | MAL_UBICADO, FALTANTE, DANADO, OTRO |
| `resuelta` | bool | Filtrar por estado |
| `producto_id` | int | Filtrar por producto |
| `desde` | datetime | Fecha inicio (ISO 8601) |
| `hasta` | datetime | Fecha fin (ISO 8601) |
| `skip` | int | Paginación |
| `limit` | int | Default 100, máximo 500 |

### POST /api/v1/incidencias/

Crea una incidencia. **Requiere autenticación.**

**Request:**
```json
{
  "tipo": "MAL_UBICADO",
  "producto_id": 1,
  "ubicacion_id": 1,
  "descripcion": "Producto encontrado en ubicación incorrecta"
}
```

**Response (201):**
```json
{
  "id": 1,
  "tipo": "MAL_UBICADO",
  "producto_id": 1,
  "ubicacion_id": 1,
  "usuario_id": 1,
  "fecha": "2024-01-15T10:30:00",
  "descripcion": "Producto encontrado en ubicación incorrecta",
  "resuelta": false,
  "fecha_resolucion": null
}
```

### POST /api/v1/incidencias/{id}/resolver

Marca una incidencia como resuelta. **Requiere rol: Almacenero o Supervisor.**

**Response (200):** Incidencia actualizada

---

## Métricas

### GET /api/v1/metricas/tiempo-promedio

Tiempo promedio de búsqueda global.

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `desde` | datetime | Fecha inicio |
| `hasta` | datetime | Fecha fin |

**Response (200):**
```json
{
  "desde": null,
  "hasta": null,
  "total_busquedas": 65,
  "promedio_segundos": 82.5,
  "promedio_minutos": 1.38,
  "exitosas": 60,
  "fallidas": 5
}
```

### GET /api/v1/metricas/comparativa

Compara dos periodos de búsquedas (para demostrar mejora).

**Query Parameters (todos obligatorios):**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `desde_anterior` | datetime | Inicio periodo anterior |
| `hasta_anterior` | datetime | Fin periodo anterior |
| `desde_actual` | datetime | Inicio periodo actual |
| `hasta_actual` | datetime | Fin periodo actual |

**Response (200):**
```json
{
  "periodo_actual": {
    "total_busquedas": 30,
    "promedio_segundos": 82.5
  },
  "periodo_anterior": {
    "total_busquedas": 35,
    "promedio_segundos": 517.3
  },
  "mejora_segundos": 434.8,
  "mejora_porcentaje": 84.02
}
```

### GET /api/v1/metricas/incidencias

Resumen de incidencias.

**Response (200):**
```json
{
  "total": 12,
  "abiertas": 1,
  "resueltas": 11,
  "por_tipo": {
    "MAL_UBICADO": 5,
    "FALTANTE": 3,
    "DANADO": 3,
    "OTRO": 1
  }
}
```

### GET /api/v1/metricas/movimientos

Resumen de movimientos.

**Response (200):**
```json
{
  "total": 45,
  "por_tipo": {
    "ENTRADA": 20,
    "SALIDA": 15,
    "TRASLADO": 8,
    "AJUSTE": 2
  },
  "total_piezas_movidas": 1250
}
```

### GET /api/v1/metricas/dashboard

Dashboard con indicadores clave del proyecto.

**Response (200):**
```json
{
  "total_productos": 50,
  "total_ubicaciones": 150,
  "productos_stock_bajo": 2,
  "total_incidencias_abiertas": 1,
  "tiempo_promedio_busqueda_segundos": 82.5,
  "tiempo_promedio_busqueda_minutos": 1.38,
  "total_busquedas": 65
}
```

**Ejemplo de Dashboard en frontend:**
```typescript
async function loadDashboard() {
  const response = await fetch('/api/v1/metricas/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  // Mostrar en tarjetas
  renderCard('Productos', data.total_productos);
  renderCard('Ubicaciones', data.total_ubicaciones);
  renderCard('Stock Bajo', data.productos_stock_bajo, 'warning');
  renderCard('Incidencias Abiertas', data.total_incidencias_abiertas);
  renderCard('Tiempo Promedio', `${data.tiempo_promedio_busqueda_minutos} min`);
  renderCard('Total Búsquedas', data.total_busquedas);
}
```

---

## Roles y Permisos

| Rol | Descripción |
|-----|-------------|
| `Administrador` | Acceso total (incluye crear/eliminar productos) |
| `Supervisor` | Crear/editar productos, resolver incidencias, registrar movimientos |
| `Almacenero` | Registrar movimientos, resolver incidencias, crear incidencias |

---

## Usuarios de Prueba

| Email | Contraseña | Rol |
|-------|------------|-----|
| ana.torres@xyz.com | Demo1234! | Administrador |
| carlos.ruiz@xyz.com | Demo1234! | Supervisor |
| luis.mendoza@xyz.com | Demo1234! | Almacenero |

---

## Ejemplo de Servicio en TypeScript

```typescript
// api.ts
const API_BASE = 'http://localhost:8000/api/v1';

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(url: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error en la solicitud');
    }

    if (response.status === 204) return null;
    return response.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Productos
  getProducts(skip = 0, limit = 50, categoriaId?: number) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (categoriaId) params.append('categoria_id', String(categoriaId));
    return this.request(`/productos/?${params}`);
  }

  searchProductos(termino: string) {
    return this.request(`/productos/buscar?termino=${encodeURIComponent(termino)}`);
  }

  // Búsquedas
  iniciarBusqueda(termino: string) {
    return this.request('/busquedas/iniciar', {
      method: 'POST',
      body: JSON.stringify({ termino_busqueda: termino }),
    });
  }

  finalizarBusqueda(busquedaId: number, ubicacionId: number) {
    return this.request(`/busquedas/${busquedaId}/finalizar`, {
      method: 'POST',
      body: JSON.stringify({ ubicacion_encontrada_id: ubicacionId }),
    });
  }

  // Métricas
  getDashboard() {
    return this.request('/metricas/dashboard');
  }
}

export const api = new ApiService();
```
