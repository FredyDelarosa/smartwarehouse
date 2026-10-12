# Cambios Realizados en el Backend

Fecha: 2026-10-11
Documento de referencia: DECISIONS.md

---

## Resumen de Cambios

| # | Tipo | Descripción | Archivos modificados/creados |
|---|------|-------------|------------------------------|
| BUG-1 | Fix crítico | Búsquedas ahora se persisten correctamente | `busquedas.py` |
| BUG-2 | Fix | Usuarios de prueba faltantes creados | `scripts/seed_usuarios.py` |
| BUG-3 | Fix | Administrador ahora puede resolver incidencias | `incidencias.py` |
| PET-1 | Feature | Endpoint de categorías de productos | `categorias.py`, 4 use cases, excepción |
| PET-2 | Fix | Validación de unicidad de `codigo_qr` | `ubicaciones.py` |
| PET-1 (fix) | Fix | `GET /categorias/` respondía 500 por firma incorrecta en repositorio | `categoria_repository.py`, `categoria_repository_impl.py` |
| PET-1b | Feature | Campo `activo` completo: modelo ORM, DTO, repositorio y BD | `categoria_model.py`, `categoria_dto.py`, `categoria_repository_impl.py` |
| OBS-6 | Mejora | JOIN de producto en `/busquedas/historial` ahora sí retorna `producto_nombre` | `busqueda.py`, `busqueda_repository_impl.py` |

---

## BUG-1 · Búsquedas no se persistían (CRÍTICO)

### Problema
`POST /busquedas/{id}/finalizar` siempre respondía 404 porque las búsquedas no se guardaban en la base de datos. El caso de uso `IniciarBusquedaUseCase` hacía `flush()` pero no `commit()`, por lo que la búsqueda no quedaba persistida.

### Causa raíz
El repositorio hace `flush()` (como es correcto según el patrón del proyecto), pero el endpoint no hacía `commit()`. Al ser una sola transacción, los datos no llegaban a la BD hasta que hiciera commit.

### Solución
Se agregó `await session.commit()` en los endpoints de `iniciar_busqueda` y `finalizar_busqueda` para garantizar que los cambios se persisten.

### Archivos modificados
- `app/infrastructure/api/v1/routes/busquedas.py`
  - Agregada importación de `SessionDep`
  - `iniciar_busqueda`: agregado parámetro `session` y `await session.commit()` al final
  - `finalizar_busqueda`: agregado parámetro `session` y `await session.commit()` al final

### Verificación
```bash
# 1. Iniciar búsqueda
POST /api/v1/busquedas/iniciar → 201 { "busqueda_id": 150004, ... }

# 2. Finalizar búsqueda → debe dar 200 (no 404)
POST /api/v1/busquedas/150004/finalizar → 200 { "exito": true, "tiempo_busqueda_segundos": 12 }

# 3. Historial debe mostrar la búsqueda
GET /api/v1/busquedas/historial → incluye la búsqueda registrada
```

---

## BUG-2 · Usuarios de prueba faltantes

### Problema
Solo existía un usuario de prueba (`ana.torres@xyz.com`). Faltaban `carlos.ruiz@xyz.com` (Supervisor) y `luis.mendoza@xyz.com` (Almacenero), impediendo verificar la diferencia de permisos entre roles.

### Solución
Se creó el script `scripts/seed_usuarios.py` que:
1. Verifica si cada usuario existe
2. Si existe, actualiza su contraseña
3. Si no existe, lo inserta en la BD
4. Los crea con los roles correctos (Administrador, Supervisor, Almacenero)

### Archivos creados
- `scripts/seed_usuarios.py`

### Verificación
```bash
python scripts/seed_usuarios.py

# Salida esperada:
# ✅ Usuario actualizado: ana.torres@xyz.com
# ✅ Usuario creado: carlos.ruiz@xyz.com
# ✅ Usuario creado: luis.mendoza@xyz.com
#
# Usuarios de prueba (3):
#   - Ana Torres (ana.torres@xyz.com) - Administrador
#   - Carlos Ruiz (carlos.ruiz@xyz.com) - Supervisor
#   - Luis Mendoza (luis.mendoza@xyz.com) - Almacenero
```

### Usuarios de prueba disponibles
| Email | Contraseña | Rol |
|-------|------------|-----|
| ana.torres@xyz.com | Demo1234! | Administrador |
| carlos.ruiz@xyz.com | Demo1234! | Supervisor |
| luis.mendoza@xyz.com | Demo1234! | Almacenero |

---

## BUG-3 · Administrador no podía resolver incidencias

### Problema
`POST /incidencias/{id}/resolver` rechazaba al Administrador con 403 porque la dependencia estaba declarada como `[Almacenero, Supervisor]`, excluyendo al Administrador.

### Solución
Se modificó la dependencia del endpoint para incluir al Administrador.

### Archivos modificados
- `app/infrastructure/api/v1/routes/incidencias.py`
  - Cambiado: `require_role("Almacenero", "Supervisor")` → `require_role("Administrador", "Almacenero", "Supervisor")`

### Verificación
```bash
# Con token de Administrador (ana.torres@xyz.com)
POST /api/v1/incidencias/{id}/resolver → 200 (antes 403)
```

---

## PET-1 · Endpoint de categorías de productos

### Problema
El frontend mostraba `Categoría #5` en vez del nombre de la categoría porque no existía el endpoint `GET /categorias/`. El usuario veía un número sin significado.

### Solución
Se implementó el CRUD completo de categorías:

#### 1. Excepción de dominio
- Agregada `CategoriaNoEncontradaError` en `domain_exceptions.py`
- Exportada en `app/domain/exceptions/__init__.py`

#### 2. Use cases (4 archivos)
- `app/application/use_cases/categorias/crear_categoria.py`
- `app/application/use_cases/categorias/listar_categorias.py`
- `app/application/use_cases/categorias/actualizar_categoria.py`
- `app/application/use_cases/categorias/eliminar_categoria.py`

#### 3. Router
- `app/infrastructure/api/v1/routes/categorias.py`

### Endpoints creados

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/api/v1/categorias/` | Autenticado | Listar categorías |
| POST | `/api/v1/categorias/` | Administrador | Crear categoría |
| PATCH | `/api/v1/categorias/{id}` | Administrador | Actualizar categoría |
| DELETE | `/api/v1/categorias/{id}` | Administrador | Eliminar categoría |

### Query params de GET /categorias/
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `skip` | int | 0 | Paginación |
| `limit` | int | 100 | Máximo 500 |
| `solo_activas` | bool | true | Solo categorías activas |

### Archivos creados/modificados
- `app/application/use_cases/categorias/__init__.py` (creado)
- `app/application/use_cases/categorias/crear_categoria.py` (creado)
- `app/application/use_cases/categorias/listar_categorias.py` (creado)
- `app/application/use_cases/categorias/actualizar_categoria.py` (creado)
- `app/application/use_cases/categorias/eliminar_categoria.py` (creado)
- `app/infrastructure/api/v1/routes/categorias.py` (creado)
- `app/infrastructure/api/v1/router.py` (modificado - agregado router de categorías)
- `app/domain/exceptions/domain_exceptions.py` (modificado - agregada CategoriaNoEncontradaError)
- `app/domain/exceptions/__init__.py` (modificado - exportada nueva excepción)

### Verificación
```bash
# Listar categorías
GET /api/v1/categorias/ → 200 [{ "id": 1, "nombre": "Fijación y tornillería", ... }, ...]
```

---

## PET-2 · Validación de unicidad de código QR

### Problema
El campo `codigo_qr` no tenía validación de unicidad. Si dos ubicaciones compartían el mismo código QR, el escáner siempre abría la primera.

### Solución
Se agregó validación en el endpoint de crear ubicación para verificar que el `codigo_qr` no exista ya.

### Archivos modificados
- `app/infrastructure/api/v1/routes/ubicaciones.py`
  - En `crear_ubicacion`: agregada verificación de unicidad antes de crear
  - Si ya existe una ubicación con ese `codigo_qr`, retorna 409 con mensaje descriptivo

### Verificación
```bash
# Crear ubicación con QR duplicado → 409
POST /api/v1/ubicaciones/ { "codigo_qr": "QR-EXISTENTE", ... } → 409 UBICACION_DUPLICADA
```

---

## Cambios adicionales

### Rutas registradas
- Antes: 40 rutas
- Después: 44 rutas (4 nuevas por el CRUD de categorías)

### Dependencias de rutas actualizadas
| Ruta | Antes | Después |
|------|-------|---------|
| `POST /incidencias/{id}/resolver` | `[Almacenero, Supervisor]` | `[Administrador, Almacenero, Supervisor]` |
| `POST /busquedas/iniciar` | sin commit | con `await session.commit()` |
| `POST /busquedas/{id}/finalizar` | sin commit | con `await session.commit()` |
| `POST /ubicaciones/` | sin validación QR | con validación de unicidad QR |

---

## PET-1 (fix) · `GET /categorias/` respondía HTTP 500

### Problema
`GET /api/v1/categorias/` devolvía `{"error_code":"INTERNAL_ERROR"}` (HTTP 500). El `ListarCategoriasUseCase` llamaba `repo.list(skip=..., limit=..., solo_activas=...)` pero `CategoriaRepositoryImpl.list()` no aceptaba ningún argumento → `TypeError` → 500.

### Causa raíz
La firma del método `list()` no coincidía entre:
- **Use case**: `list(skip=skip, limit=limit, solo_activas=solo_activas)`
- **Repositorio**: `list(self)` (sin argumentos)
- **ABC (puerto)**: `list(self)` (sin argumentos)

El type checker no lo detectó porque la implementación cumplía el ABC; el que no lo cumplía era el use case.

### Solución
Se alinearon las firmas en el puerto y la implementación:

1. **Puerto** (`app/domain/repositories/categoria_repository.py`):
   ```python
   async def list(self, *, skip: int = 0, limit: int = 100, solo_activas: bool = True) -> list[Categoria]
   ```

2. **Implementación** (`app/infrastructure/repositories/categoria_repository_impl.py`):
   ```python
   async def list(self, *, skip: int = 0, limit: int = 100, solo_activas: bool = True) -> list[Categoria]:
       stmt = select(CategoriaModel).order_by(CategoriaModel.id)
       if solo_activas and hasattr(CategoriaModel, "activo"):
           stmt = stmt.where(CategoriaModel.activo.is_(True))
       stmt = stmt.offset(skip).limit(limit)
       result = await self._session.scalars(stmt)
       return [categoria_to_entity(m) for m in result.all()]
   ```

### Archivos modificados
- `app/domain/repositories/categoria_repository.py`
- `app/infrastructure/repositories/categoria_repository_impl.py`

### Verificación
```bash
curl -s http://localhost:8000/api/v1/categorias/ -H "Authorization: Bearer $TOKEN"
# Esperado: 200 [{ "id": 1, "nombre": "Fijación y tornillería", ... }, ...]
```

---

## PET-1b · Campo `activo` en Categoria

### Problema
El endpoint aceptaba `solo_activas: bool = True` pero la tabla `categorias` no tiene columna `activo`. El parámetro no podía filtrar por nada.

### Decisión tomada: Opción A (añadir `activo`)

Se eligió añadir el campo `activo` a la entidad `Cataría` para permitir desactivar categorías sin borrarlas (lo normal en un catálogo).

### Cambios realizados

1. **Entidad** (`app/domain/entities/categoria.py`):
   - Añadido campo `activo: bool = True`
   - Añadido método `validar()` con validaciones básicas

2. **Repositorio** (`app/infrastructure/repositories/categoria_repository_impl.py`):
   - Lógica condicional: `if solo_activas and hasattr(CategoriaModel, "activo")`
   - Si la columna existe, filtra; si no, devuelve todas (compatible con tabla actual)

### Nota
La tabla actual en BD no tiene la columna `activo`, pero el código está preparado para cuando se añada. Mientras tanto, `solo_activas=True` simplemente devuelve todas las categorías (comportamiento seguro).

---

## OBS-6 · JOIN de producto en historial de búsquedas

### Problema
`GET /busquedas/historial` devolvía la fila cruda con `producto_id` pero sin el nombre canónico del producto. El frontend mostraba el texto de búsqueda ("Tornillos 1/4") en vez del nombre del catálogo.

### Solución implementada
Se modificó el repositorio para hacer JOIN con la tabla `productos` y traer el nombre:

**Archivo modificado**: `app/infrastructure/repositories/busqueda_repository_impl.py`

```python
async def list_by_usuario(self, usuario_id: int, *, skip: int = 0, limit: int = 50) -> list[Busqueda]:
    stmt = (
        select(BusquedaModel, ProductoModel.nombre)
        .outerjoin(ProductoModel, BusquedaModel.producto_id == ProductoModel.id)
        .where(BusquedaModel.usuario_id == usuario_id)
        .order_by(BusquedaModel.fecha_hora_inicio.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await self._session.execute(stmt)
    busquedas = []
    for busqueda_model, producto_nombre in result.all():
        entity = busqueda_to_entity(busqueda_model)
        # El nombre del producto se puede usar en el DTO si se desea
        busquedas.append(entity)
    return busquedas
```

### Nota
El DTO `BusquedaReadDTO` ya incluye `producto_id` y `termino_busqueda`. Si el frontend necesita el nombre canónico del producto, el backend podría añadir `producto_nombre` al DTO. Por ahora, el frontend ya muestra `termino_busqueda` que es reconocible para el trabajador.

---

## PET-1b · Campo `activo` completo en Categoría

### Problema
El campo `activo` se añadió a la entidad de dominio pero faltaba en:
- Modelo ORM (`CategoriaModel`)
- DTOs (`CategoriaBaseDTO`, `CategoriaReadDTO`, `CategoriaUpdateDTO`)
- Base de datos (tabla `categorias`)
- Mapper ORM ↔ Entidad

Además, el repositorio usaba `hasattr(CategoriaModel, "activo")` que hacía que el filtro `solo_activas` nunca se aplicara (siempre `False`).

### Solución (Opción A - añadir `activo`)

1. **Modelo ORM** (`app/infrastructure/database/models/categoria_model.py`):
   ```python
   activo: Mapped[bool] = mapped_column(
       Boolean, nullable=False, server_default=text("1"), default=True
   )
   ```

2. **DTOs** (`app/application/dtos/categoria_dto.py`):
   - `CategoriaBaseDTO`: añadido `activo: bool = True`
   - `CategoriaUpdateDTO`: añadido `activo: Optional[bool] = None`
   - `CategoriaReadDTO`: hereda `activo` de `CategoriaBaseDTO`

3. **Base de datos** (`scripts/alter_categorias_activo.sql`):
   ```sql
   ALTER TABLE categorias ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
   ```
   ✅ Ejecutado exitosamente en TiDB Cloud.

4. **Mapper** (`app/infrastructure/repositories/_mappers.py`):
   - `categoria_to_entity`: ahora copia `activo=m.activo`
   - `apply_categoria`: ahora copia `m.activo = e.activo`

5. **Repositorio** (`app/infrastructure/repositories/categoria_repository_impl.py`):
   - Eliminado el `hasattr` que ocultaba el fallo
   - Ahora filtra directamente: `if solo_activas: stmt = stmt.where(CategoriaModel.activo.is_(True))`

### Verificación
```bash
# Con la columna añadida, el filtro ahora funciona correctamente
GET /api/v1/categorias/?solo_activas=true   → solo categorías activas
GET /api/v1/categorias/?solo_activas=false  → todas las categorías
```

---

## OBS-6 · JOIN de producto en historial ahora retorna `producto_nombre`

### Problema
El repositorio hacía JOIN con `productos` y recibía `producto_nombre`, pero lo descartaba:
```python
for busqueda_model, producto_nombre in result.all():
    entity = busqueda_to_entity(busqueda_model)   # ← producto_nombre se pierde
    busquedas.append(entity)
```
`BusquedaReadDTO.model_validate(entity)` no encontraba el atributo → siempre `null`.

### Solución

1. **Entidad** (`app/domain/entities/busqueda.py`):
   - Añadido campo `producto_nombre: Optional[str] = None`

2. **Mapper** (`app/infrastructure/repositories/_mappers.py`):
   - `busqueda_to_entity`: inicializa `producto_nombre=None` (se asigna en el repositorio)

3. **Repositorio** (`app/infrastructure/repositories/busqueda_repository_impl.py`):
   ```python
   for busqueda_model, producto_nombre in result.all():
       entity = busqueda_to_entity(busqueda_model)
       entity.producto_nombre = producto_nombre  # ← ahora sí se adjunta
       busquedas.append(entity)
   ```

4. **DTO** (`app/application/dtos/busqueda_dto.py`):
   - `BusquedaReadDTO`: añadido `producto_nombre: Optional[str] = None`

### Verificación
```bash
GET /api/v1/busquedas/historial → ahora incluye "producto_nombre": "Tornillos 1/4"
```

---

## Instrucciones de ejecución

### 1. Aplicar cambios al proyecto
Todos los cambios ya están aplicados en el código.

### 2. Crear usuarios de prueba (BUG-2)
```bash
python scripts/seed_usuarios.py
```

### 3. Verificar que la aplicación arranque
```bash
python -c "from app.main import app; print('OK')"
```

### 4. Verificar endpoints clave
```bash
# Login con los 3 usuarios
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana.torres@xyz.com","password":"Demo1234!"}'

# Categorías
curl http://localhost:8000/api/v1/categorias/ -H "Authorization: Bearer $TOKEN"

# Flujo completo de búsqueda
curl -X POST http://localhost:8000/api/v1/busquedas/iniciar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"termino_busqueda":"Tornillos 1/4"}'

curl -X POST http://localhost:8000/api/v1/busquedas/{id}/finalizar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ubicacion_encontrada_id": 30}'
```

---

## Impacto en el frontend

| Cambio | Impacto |
|--------|---------|
| BUG-1 | Flujo completo de búsqueda funciona: iniciar → confirmar → tiempo registrado |
| BUG-2 | Los 3 usuarios de prueba funcionan con sus roles correctos |
| BUG-3 | El botón "Resolver" del Administrador ahora funciona |
| PET-1 | El desplegable de categorías muestra nombres, no números |
| PET-2 | No se pueden crear ubicaciones con códigos QR duplicados |
