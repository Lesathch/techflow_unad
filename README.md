# TechFlow

Sistema independiente de gestión documental, clasificación, revisión manual y flujos n8n.

## Ejecutar

Requiere Node.js 24 o superior. Abre INICIAR.cmd o ejecuta npm start desde esta carpeta. No requiere instalar dependencias para el modo local.

URL: http://127.0.0.1:3002

Usuario admin, contraseña inicial Demo2026!!
Otros usuarios: gestor y consulta.

## Independencia

Puedes copiar esta carpeta sola y ejecutarla. Incluye su propio frontend, servidor, seguridad, persistencia, scripts, dependencias, documentación y pruebas. No necesita la otra aplicación ni archivos compartidos de la carpeta superior. Los datos se crean en data/ y solo pertenecen a este sistema.

## Pruebas

npm test

## Docker y PostgreSQL

Ejecuta node scripts/setup-env.mjs y después docker compose up -d --build desde esta carpeta. URL HTTPS: https://techflow.localhost:3442. Cada proyecto tiene su propio servicio PostgreSQL y volúmenes. Configuración Docker preparada; ejecución no verificada aquí.

Para n8n: https://n8n.localhost:3442. Importa flows/flujo-*.json y configura Header Auth con X-Workflow-Token y el valor de WORKFLOW_TOKEN de tu .env. Publica primero los flujos 2 a 5 y al final el 1. Detalles de credenciales y validación en docs/DESPLIEGUE.md; sus rutas techflow/flows corresponden aquí a flows/.

## Manuales

- docs/EXPOSICION.md: sigue la sección TechFlow.
- docs/MANUAL-TECNICO.md: core/ reemplaza shared/; respaldos locales: node scripts/backup.mjs backup techflow.
- docs/ESTRUCTURA.md: organización independiente.

La validación con usuarios para TRL 5 sigue pendiente.

## Si abres el iniciador varias veces

Si el sistema ya está funcionando, el iniciador abre la página existente. No inicia otra copia ni muestra EADDRINUSE. Si el puerto lo ocupa otra aplicación, lo informa sin cerrarla.
