# Comprobaciones técnicas de construcción

- Node.js 25.0.0.
- TechFlow inició en 127.0.0.1:3002 desde su carpeta independiente.
- Sintaxis JavaScript revisada con node --check.
- compose.yaml parseado correctamente con PyYAML.
- Los secretos se generan con scripts/setup-env.mjs y se guardan en .env, excluido de Git.
- El respaldo y la restauración de TechFlow están cubiertos por las pruebas automatizadas.
- Pruebas automatizadas completas en pruebas.txt.
- La estructura de workflows se verificó; no se ejecutó n8n.
- No se ejecutó Docker/PostgreSQL/TLS ni IMAP por falta de entorno.
- Se verificaron la página y sus recursos mediante HTTP. La revisión visual completa sigue pendiente.
