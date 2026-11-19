# Manual técnico · TechFlow

Node.js 24 o superior. Ejecutar npm start o INICIAR.cmd desde esta carpeta. No se requiere npm install para SQLite local. Puerto 3002. Se puede copiar esta carpeta sola a otra máquina con Node.js.

## Estructura

- server.mjs: arranque exclusivo de TechFlow.
- domain.mjs: reglas de negocio.
- core/server.mjs: HTTP, sesiones y permisos.
- core/store.mjs: agregado cifrado en SQLite/PostgreSQL.
- core/security.mjs y core/backup.mjs: hash, cifrado y respaldos.
- core/public/: frontend propio.
- tests/: pruebas exclusivas del proyecto.
- scripts/: configuración y respaldo propios.

## Datos y variables

Los datos se crean en data/. No copies datos ni claves entre proyectos. DATA_DIR cambia la carpeta; DATABASE_URL activa PostgreSQL; APP_KEY define una clave AES de 64 caracteres hexadecimales; ADMIN_PASSWORD se aplica solo al crear las cuentas por primera vez. El modo local no carga .env automáticamente. Docker Compose sí lo carga.

Las sesiones vencen tras 15 minutos de inactividad. Cinco fallos bloquean la cuenta cinco minutos. Las cuentas de laboratorio se crean con Demo2026!! y cada usuario puede cambiar su contraseña. No se incluye recuperación por correo ni MFA. La clave local queda en data/.key para facilitar el laboratorio; acceso completo a la carpeta implica acceso a esa clave.

## Respaldo local

Detén este servidor. En PowerShell, desde esta carpeta:

```powershell
$env:BACKUP_PASSWORD = 'elige-una-clave-de-al-menos-12-caracteres'
node scripts/backup.mjs backup techflow
node scripts/backup.mjs restore techflow backups/techflow-FECHA.enc
```

El respaldo se cifra y la restauración reemplaza el estado. La contraseña incorrecta o un archivo alterado se rechazan. Guarda el respaldo anterior antes de restaurar. Los datos de n8n, si se usa, requieren un respaldo adicional de su base y clave de cifrado.

## Pruebas

npm test. Las pruebas usan datos temporales propios; no alteran data/. Resultado: 24 aprobadas, 0 fallidas.
