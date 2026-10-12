# Despliegue — SmartWarehouse

**Producción:** https://smartwarehouse.inode.cloud

- **Frontend:** `https://github.com/FredyDelarosa/smartwarehouse.git`
- **Backend:** `https://github.com/FredyDelarosa/smartwarehouse-back.git`
- **Instancia:** EC2 Ubuntu 26.04 · `50.16.208.204` · `172.31.38.123`
- **Base de datos:** TiDB Cloud (`gateway01…tidbcloud.com:4000`)

---

## Arquitectura

```
Usuario ──HTTPS──> Cloudflare ──HTTPS──> nginx (50.16.208.204:443)
                                             ├── /            → /var/www/smartwarehouse  (Angular)
                                             ├── /api/…       → 127.0.0.1:8000          (FastAPI)
                                             └── /ngsw-worker.js  (no cacheado)
```

- **El backend no está expuesto a internet.** Escucha en `127.0.0.1:8000`; solo
  entra nginx. En la instancia solo hay abiertos 22, 80 y 443.
- **El dominio va por detrás de Cloudflare** (los A resuelven a IPs de
  Cloudflare, no a la IP elástica). Cloudflare sirve al visitante y conecta al
  origen en `:443`.

---

## Desplegar un cambio

Todo está automatizado en el servidor:

```bash
ssh -i <clave> ubuntu@50.16.208.204
sudo deploy-smartwarehouse            # backend + frontend
sudo deploy-smartwarehouse backend    # solo API
sudo deploy-smartwarehouse frontend   # solo UI
```

El script hace `git pull`, reinstala dependencias, recompila, reinicia el
servicio y **verifica que el servicio levantó**; si no, imprime el journal y
sale con error.

> El `git pull` ocurre **en el servidor**. Si hay commits sin subir, el
> despliegue usa la versión antigua sin avisar. Sube antes de desplegar.

---

## Servicios

| Servicio | Unidad systemd | Qué hace |
|---|---|---|
| API | `smartwarehouse-api.service` | uvicorn, 2 workers, `127.0.0.1:8000` |
| Web | `nginx.service` | SPA + proxy + TLS |
| TLS | `certbot.timer` | Renovación automática del certificado |

```bash
sudo systemctl status smartwarehouse-api
sudo journalctl -u smartwarehouse-api -f        # logs en vivo
sudo nginx -t && sudo systemctl reload nginx
```

---

## Decisiones que no son obvias

### Python 3.12 instalado con `uv`, no el del sistema

La instancia llega con **Python 3.14**. El backend depende de `asyncmy`, una
extensión C sin ruedas para 3.14. Se instaló `uv` y su Python 3.12 en
`/opt/uv/python` (**fuera de `/home/ubuntu`**), porque el usuario del servicio
no puede atravesar el home de `ubuntu` y un venv creado desde ahí apuntaría a
un intérprete que no puede leer:

```bash
/opt/uv/python/cpython-3.12.15-linux-x86_64-gnu/bin/python3.12 -m venv .venv
```

### `SECRET_KEY` generada en el servidor

El `.env` local tenía `SECRET_KEY=genera-una-clave-real-con-openssl-rand-hex-32`
—un **placeholder**, no una clave. Con ella, cualquiera podía falsificar un JWT
de administrador. En producción se generó con `openssl rand -hex 32` **dentro de
la instancia**, para que nunca pasara por un canal intermedio.

El `.env` del servidor tiene permisos `600` y **no está en el repo**.

> Si más adelante se sincroniza el `.env` entre entornos, la clave **no** debe
> copiarse: cada entorno necesita la suya.

### TLS y Cloudflare

Cloudflare estaba en modo "Full" y devolvía **521** porque el origen no tenía
certificado. Se resolvió por HTTP-01 con `certbot --webroot`, que funciona
porque Cloudflare reenvía el reto ACME al origen. Por eso el `location` del
reto en el puerto 80 va **antes** que la redirección a HTTPS.

Se añadió un **hook de post-renovación**: con `--webroot`, certbot renueva el
fichero pero **no recarga nginx**, así que sin el hook se seguiría sirviendo el
certificado viejo. Verificado con `certbot renew --dry-run`.

Cloudflare debería estar en **Full (strict)**, no Flexible: con el origen ya
tiene certificado válido, no hay motivo para aceptar cifrado débil en el salto.

### Cacheo: por qué `index.html` y `ngsw-worker.js` no se cachean

```nginx
location = /index.html       { add_header Cache-Control "no-cache, no-store…" }
location = /ngsw-worker.js   { add_header Cache-Control "no-cache, no-store…" }
location ~* \.(js|css|woff2…)$ { add_header Cache-Control "public, max-age=31536000, immutable" }
```

Los bundles llevan hash en el nombre (`main-JQGNHECI.js`), así que su contenido
solo cambia si cambia el nombre: caché de un año es segura. `index.html` es el
que apunta a esos nombres, y el service worker es el que decide qué versión
sirve. Cachear cualquiera de los dos rompe las actualizaciones.

### Hardening del servicio

- Usuario dedicado `smartwarehouse`, nunca root ni `ubuntu`.
- `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome`.
- `Restart=always`: si el proceso muere, systemd lo levanta solo.

---

## Verificación

```bash
# Flujo completo
curl -s https://smartwarehouse.inode.cloud/ -o /dev/null -w '%{http_code}\n'        # 200
curl -s -X POST https://smartwarehouse.inode.cloud/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana.torres@xyz.com","password":"Demo1234!"}'                            # token

# El SPA sirve rutas profundas directamente
curl -s -o /dev/null -w '%{http_code}\n' https://smartwarehouse.inode.cloud/productos/1

# El certificado del origen (no el de Cloudflare)
echo | openssl s_client -connect 50.16.208.204:443 -servername smartwarehouse.inode.cloud 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

---

## Puntos pendientes

1. **Rotar la clave de la instancia EC2.** Se usó una clave privada compartida
   durante el despliegue; debe rotarse y eliminarse la copia local.
2. **Cloudflare en "Full (strict)"** en vez de "Flexible".
3. **Rotar `SECRET_KEY` del entorno local**: sigue siendo un placeholder.
4. El backend tiene un `Dockerfile` y un `docker-compose.yml` en el repo que
   **no se usan**: el despliegue es con systemd, que es más simple de operar
   para un servicio único. Conviene decidir si se quedan o se borran para que
   no den a entender lo contrario.