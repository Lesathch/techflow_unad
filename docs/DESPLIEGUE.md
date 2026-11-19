# Despliegue independiente · TechFlow

Desde esta carpeta, con Docker Desktop y Compose:

```powershell
node scripts/setup-env.mjs
docker compose up -d --build
docker compose ps
```

Cada proyecto tiene su .env, base PostgreSQL, volúmenes, dependencias y Dockerfile. npm ci se usa en la imagen con el package-lock.json propio. No se ejecutó Docker en este entorno.

URL: https://techflow.localhost:3442. El proxy Caddy usa certificados locales. Exporta el certificado raíz con docker compose cp techflow-proxy:/data/caddy/pki/authorities/local/root.crt ./raiz-local.crt e instálalo tú mismo como autoridad de confianza de laboratorio. No omitas las advertencias del navegador. Usa HTTPS en Docker porque las cookies son Secure. HTTP en 3002 corresponde al modo local fuera de Docker o a diagnóstico.

Los secretos se generan al crear .env; no lo subas a Git. El script conserva archivos .env existentes. Para arrancar ambos desde la carpeta superior, genera primero el .env de cada proyecto y ejecuta docker compose up -d --build en la carpeta superior; sus includes requieren Docker Compose con soporte para include.

## n8n

Abre https://n8n.localhost:3442 y crea su propietario. Sus cuentas son diferentes de las de TechFlow. Crea una credencial Header Auth llamada TechFlow token: nombre de cabecera X-Workflow-Token, valor WORKFLOW_TOKEN del .env de este proyecto. Importa flows/flujo-*.json; selecciona esa credencial en cada Webhook y HTTP Request. Publica primero los workflows 2, 3, 4 y 5, y después el 1. Los IDs CONFIGURAR_CREDENCIAL son marcadores que debes sustituir al seleccionar la credencial.

Carga ejemplos/factura-001.txt desde la aplicación y comprueba las cinco ejecuciones. Memorando va a revisión. Los errores de etapas pueden dirigirse a revisión, y los reintentos no duplican notificaciones. El workflow 5 incluye un reporte diario a las 18:00, zona America/Bogota.

Webhook de producción: https://n8n.localhost:3442/webhook/techflow-receive. POST JSON con filename, subject, content base64 y source webhook; cabecera X-Workflow-Token.

Opcional: importa correo-adaptador.json, configura una credencial IMAP de un buzón de laboratorio y la credencial Header Auth. El adaptador descarga TXT/PDF y envía al recorrido principal; marca mensajes como leídos. No se conectó ningún correo real.

Fuentes: https://docs.n8n.io/workflows/export-import/ y https://docs.n8n.io/hosting/installation/docker/.
