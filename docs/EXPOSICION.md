# Manual de usuario y exposición · TechFlow

Inicia con INICIAR.cmd dentro de esta carpeta. También: npm start. URL http://127.0.0.1:3002. Usuario admin; contraseña inicial Demo2026!!.

## TechFlow · recorrido de 8:30

Antes: abre ejemplos. En modo local, la pantalla informa que las etapas se ejecutan en Node.js. Para demostrar n8n se debe preparar y validar primero docs/DESPLIEGUE.md; no presentar el modo local como si n8n hubiera ejecutado los workflows.

| Tiempo | Mostrar | Idea para explicar |
|---|---|---|
| 0:00–0:40 | Acceso y resumen | Problema: documentos sin clasificación ni seguimiento. Objetivo: recepción y archivo trazables. |
| 0:40–2:10 | Cargar factura-001.txt | Asunto Factura de compra. Explicar las cinco etapas. El documento termina en Contabilidad, tipo Factura, estado completado. |
| 2:10–3:00 | Documentos y Notificaciones | Descargar y comparar el texto con el original. Mostrar el aviso interno con área y fecha. |
| 3:00–3:45 | Repetir la misma factura | El hash del contenido detecta el duplicado; no crea otro archivo ni otro aviso. |
| 3:45–4:45 | Cargar memorando.txt | Usar asunto Memorando general. No tiene regla: entra en revisión. Resolver como Solicitud; continúa y notifica a Operaciones. |
| 4:45–5:30 | Cargar factura-contrato.txt | Mostrar clasificación ambigua y motivo de revisión. No se adivina una categoría. |
| 5:30–6:10 | Rol consulta | Entrar como consulta. Puede buscar y descargar; no cargar ni resolver documentos. |
| 6:10–7:10 | Flujos, auditoría y reportes | Volver a admin. Mostrar las reglas, cinco etapas y un corte. En Docker, enseñar además las ejecuciones reales de n8n. |
| 7:10–8:00 | Diseño y pruebas | Las reglas están en domain.mjs; n8n coordina APIs autenticadas; los archivos se persisten cifrados. |
| 8:00–8:30 | Cierre | Exponer resultados técnicos y plan de validación con colaboradores. No afirmar resultados de campo sin evidencia. |

Clasificación: se usan nombre y asunto. Tipos iniciales: Factura → Contabilidad; Contrato → Jurídica; Solicitud → Operaciones. Los archivos PDF requieren una firma PDF válida; no se hace OCR. El límite es 1 MB y solo se aceptan TXT/PDF.


Presenta solo este proyecto y sus participantes. Duración objetivo: 8–9 minutos, máximo 10. La validación de usuarios para TRL 5 permanece pendiente.
