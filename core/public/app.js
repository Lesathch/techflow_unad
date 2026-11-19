'use strict';
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
let config,
  me,
  state,
  page = 'dashboard',
  query = '',
  toastTimer;
const name = () => 'TechFlow',
  canManage = () => me.role !== 'consulta',
  isAdmin = () => ['propietario', 'admin'].includes(me.role),
  money = (v) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(v),
  date = (v) => new Date(v).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
  badge = (v, type = '') => '<span class="badge ' + type + '">' + esc(v) + '</span>';
function toast(message, error = !1) {
  (clearTimeout(toastTimer),
    ($('#toast').textContent = message),
    ($('#toast').className = 'show' + (error ? ' error-toast' : '')),
    (toastTimer = setTimeout(() => ($('#toast').className = ''), 5500)));
}
async function api(url, body, method) {
  const r = await fetch(url, {
      method: method || (body ? 'POST' : 'GET'),
      headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': me?.csrf || '' } : {},
      body: body ? JSON.stringify(body) : void 0,
    }),
    data = await r.json();
  if (!r.ok)
    throw (
      r.status === 401 && url !== '/api/login' && url !== '/api/me' && ((me = null), login()),
      Error(data.error || 'No fue posible completar la operaci\xF3n')
    );
  return data;
}
const button = (label, action, cls = '', id = '') =>
  '<button type="button" class="' +
  cls +
  '" data-action="' +
  action +
  '"' +
  (id ? ' data-id="' + esc(id) + '"' : '') +
  '>' +
  label +
  '</button>';
function field(label, key, type = 'text', value = '', extra = '') {
  return (
    '<div class="field"><label for="f-' +
    key +
    '">' +
    label +
    '</label><input id="f-' +
    key +
    '" name="' +
    key +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" ' +
    extra +
    ' required></div>'
  );
}
function select(label, key, options, value = '') {
  return (
    '<div class="field"><label for="f-' +
    key +
    '">' +
    label +
    '</label><select id="f-' +
    key +
    '" name="' +
    key +
    '"' +
    (key === 'supplierId' ? '' : ' required') +
    '>' +
    options
      .map(
        ([v, l]) =>
          '<option value="' +
          esc(v) +
          '"' +
          (v === value ? ' selected' : '') +
          '>' +
          esc(l) +
          '</option>',
      )
      .join('') +
    '</select></div>'
  );
}
function modal(title, intro, fields, submit, onSubmit) {
  (($('#modal-body').innerHTML =
    '<h2>' +
    title +
    '</h2><p class="dialog-intro">' +
    intro +
    '</p><form id="dialog-form">' +
    fields +
    '<p class="error" id="form-error" role="alert"></p><div class="form-footer">' +
    button('Cancelar', 'close', 'secondary') +
    '<button type="submit">' +
    submit +
    '</button></div></form>'),
    $('#modal').showModal(),
    ($('#dialog-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      btn.disabled = !0;
      try {
        (await onSubmit(new FormData(e.target)),
          $('#modal').close(),
          me
            ? (await refresh(), toast('Operaci\xF3n completada'))
            : (login(), toast('Contrase\xF1a actualizada. Inicia sesi\xF3n de nuevo.')));
      } catch (err) {
        $('#form-error').textContent = err.message;
      } finally {
        btn.disabled = !1;
      }
    }));
}
function login() {
  ((document.title = name() + ' \xB7 Acceso'),
    ($('#app').innerHTML =
      '<main class="login"><section class="login-story"><div class="brand"><span class="brand-mark">\u2197</span>' +
      name() +
      '</div><h1>Cada documento,<br>en su lugar.</h1><p>Del ingreso al archivo: un recorrido organizado, visible y trazable para tus documentos.</p><p class="eyebrow">Proyecto de grado \xB7 UNAD \xB7 Fase 4</p></section><section class="login-form"><div class="login-box"><p class="eyebrow">Bienvenido a ' +
      name() +
      '</p><h2>Inicia sesi\xF3n</h2><p class="muted">Accede a tu espacio de trabajo.</p><form id="login-form">' +
      field('Usuario', 'username', 'text', '', 'autocomplete="username" maxlength="50"') +
      field(
        'Contrase\xF1a',
        'password',
        'password',
        '',
        'autocomplete="current-password" maxlength="200"',
      ) +
      '<p id="login-error" class="error" role="alert"></p><button class="full" type="submit">Ingresar al sistema \u2192</button></form>' +
      (config.demo
        ? '<div class="demo"><strong>Cuentas de demostraci\xF3n</strong><br>Usuarios: <code>admin \xB7 gestor \xB7 consulta</code><br>Contrase\xF1a inicial: <code>Demo2026!!</code><br>Usa datos ficticios para la exposici\xF3n.</div>'
        : '') +
      '</div></section></main>'),
    ($('#login-form').onsubmit = async (e) => {
      (e.preventDefault(), (e.submitter.disabled = !0));
      try {
        const f = new FormData(e.target);
        (await api('/api/login', Object.fromEntries(f)),
          (me = await api('/api/me')),
          (page = 'dashboard'),
          await refresh());
      } catch (err) {
        (($('#login-error').textContent = err.message), (e.submitter.disabled = !1));
      }
    }));
}
function navItems() {
  return [
    ['dashboard', '\u25A6', 'Resumen'],
    ['documents', '\u25A4', 'Documentos'],
    ['review', '\u25C9', 'Revisi\xF3n manual'],
    ['flows', '\u21E2', 'Flujos'],
    ['notifications', '\u2667', 'Notificaciones'],
    ['reports', '\u2197', 'Reportes'],
    ...(isAdmin()
      ? [
          ['audit', '\u2261', 'Auditor\xEDa'],
          ['users', '\u2659', 'Usuarios'],
        ]
      : []),
    ['account', '\u2699', 'Mi cuenta'],
  ];
}
function shell(content) {
  const items = navItems(),
    current = items.find((i) => i[0] === page)?.[2] || 'Resumen';
  ((document.title = name() + ' \xB7 ' + current),
    ($('#app').innerHTML =
      '<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark">\u2197</span><div>' +
      name() +
      '<small>GESTI\xD3N DOCUMENTAL</small></div></div><p class="nav-label">ESPACIO DE TRABAJO</p><nav class="nav" aria-label="Navegaci\xF3n principal">' +
      items
        .map(
          ([id, icon, label]) =>
            '<button data-page="' +
            id +
            '" class="' +
            (page === id ? 'active' : '') +
            '"' +
            (page === id ? ' aria-current="page"' : '') +
            '><span class="nav-icon" aria-hidden="true">' +
            icon +
            '</span>' +
            label +
            '</button>',
        )
        .join('') +
      '</nav><div class="sidebar-footer"><strong>Proyecto de grado \xB7 UNAD</strong>Fase 4 / Pr\xE1ctica simulada<br>' +
      (config.demo ? 'Entorno de demostraci\xF3n' : 'Entorno de validaci\xF3n') +
      '</div></aside><main class="main"><header class="topbar"><span>' +
      name() +
      ' <span aria-hidden="true"> / </span> ' +
      current +
      '</span><div class="profile"><span class="avatar">' +
      esc(me.name.slice(0, 1)) +
      '</span><div><strong>' +
      esc(me.name) +
      '</strong><small>' +
      esc(me.role) +
      '</small></div>' +
      button('Salir', 'logout', 'ghost') +
      '</div></header><div class="main-content">' +
      content +
      '</div></main></div>'));
}
function heading(title, description, actions = '') {
  return (
    '<section class="page-heading"><div><p class="eyebrow">CENTRO DOCUMENTAL</p><h1>' +
    title +
    '</h1><p class="muted">' +
    description +
    '</p></div><div class="actions">' +
    actions +
    '</div></section>'
  );
}
function card(title, subtitle, body, actions = '') {
  return (
    '<section class="card"><div class="card-head"><div><h2>' +
    title +
    '</h2>' +
    (subtitle ? '<p>' + subtitle + '</p>' : '') +
    '</div>' +
    actions +
    '</div>' +
    body +
    '</section>'
  );
}
function table(headers, rows, empty = 'Todav\xEDa no hay registros.') {
  return rows.length
    ? '<div class="table-wrap"><table><thead><tr>' +
        headers.map((x) => '<th scope="col">' + x + '</th>').join('') +
        '</tr></thead><tbody>' +
        rows
          .map((row) => '<tr>' + row.map((c) => '<td>' + c + '</td>').join('') + '</tr>')
          .join('') +
        '</tbody></table></div>'
    : '<div class="empty">' + empty + '</div>';
}
function metrics(items) {
  return (
    '<section class="metrics" aria-label="Indicadores">' +
    items
      .map(
        ([label, value, hint, icon]) =>
          '<article class="metric"><span class="icon" aria-hidden="true">' +
          icon +
          '</span><span class="label">' +
          label +
          '</span><strong>' +
          esc(value) +
          '</strong><small>' +
          hint +
          '</small></article>',
      )
      .join('') +
    '</section>'
  );
}
function docStatus(d) {
  return badge(
    d.status,
    d.status === 'revision' ? 'warn' : d.status === 'completado' ? '' : 'gray',
  );
}
function docTable(list, review = !1) {
  return table(
    ['Documento', 'Tipo / \xE1rea', 'Estado', 'Fecha', 'Acciones'],
    list.map((d) => [
      '<strong class="file-title">' +
        esc(d.filename) +
        '</strong><small>' +
        esc(d.subject) +
        '</small>',
      esc(d.type) + '<small>' + esc(d.area) + '</small>',
      docStatus(d),
      date(d.date),
      '<a class="link" href="/api/download?id=' +
        esc(d.id) +
        '">Descargar</a> ' +
        (review && canManage() ? button('Resolver', 'review', 'ghost', d.id) : ''),
    ]),
    review
      ? 'No hay documentos pendientes de revisi\xF3n.'
      : 'Carga tu primer documento para iniciar el recorrido.',
  );
}
function render() {
  let html = '';
  const s = state.stats;
  if (
    (page === 'dashboard' &&
      (html =
        heading(
          'Todo sigue su curso',
          'Acompa\xF1a cada documento desde su recepci\xF3n hasta el archivo.',
          canManage() ? button('Cargar documento', 'upload') : '',
        ) +
        metrics([
          ['Documentos recibidos', s.total, 'Archivo documental', '\u25A4'],
          ['Procesados', s.completed, 'Recorrido completado', '\u2713'],
          ['En revisi\xF3n', s.review, 'Requieren una decisi\xF3n', '\u25C9'],
          ['Notificaciones', s.notifications, 'Entregadas en la bandeja interna', '\u2667'],
        ]) +
        flowCards() +
        '<div class="grid"><div>' +
        card(
          '\xDAltimos documentos',
          'Recepci\xF3n y clasificaci\xF3n',
          docTable(state.documents.slice(0, 4)),
          button('Ver todos', 'go-documents', 'ghost'),
        ) +
        '</div><div>' +
        card(
          'Actividad reciente',
          'Pasos del procesamiento',
          timeline(state.executions.slice(0, 4)),
        ) +
        '</div></div>'),
    page === 'documents')
  ) {
    const list = state.documents.filter((d) =>
      (d.filename + ' ' + d.type + ' ' + d.area + ' ' + d.subject)
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    html =
      heading(
        'Archivo documental',
        'Busca, consulta y descarga tus documentos.',
        canManage() ? button('Cargar documento', 'upload') : '',
      ) +
      searchBar('Buscar archivo, tipo o \xE1rea\u2026') +
      card('Documentos', list.length + ' archivos registrados', docTable(list));
  }
  (page === 'review' &&
    (html =
      heading(
        'Bandeja de revisi\xF3n',
        'Resuelve documentos desconocidos o con clasificaci\xF3n ambigua.',
      ) +
      card(
        'Pendientes de clasificaci\xF3n',
        'Selecciona un tipo para continuar autom\xE1ticamente el recorrido.',
        docTable(
          state.documents.filter((d) => d.status === 'revision'),
          !0,
        ),
      ) +
      card(
        'Motivos de revisi\xF3n',
        'Cada incidencia queda registrada.',
        table(
          ['Documento', 'Motivo'],
          state.documents
            .filter((d) => d.status === 'revision')
            .map((d) => [esc(d.filename), esc(d.reason)]),
        ),
      )),
    page === 'flows' &&
      (html =
        heading('El recorrido de un documento', 'Cinco etapas visibles y trazables.') +
        flowCards() +
        card(
          'Reglas de clasificaci\xF3n',
          'Se eval\xFAan el nombre del archivo y el asunto.',
          table(
            ['Tipo', '\xC1rea responsable', 'Palabras clave'],
            state.rules.map((r) => [esc(r.type), esc(r.area), esc(r.words.join(', '))]),
          ),
        ) +
        card(
          'Ejecuciones',
          'El historial muestra cada etapa y sus resultados.',
          table(
            ['Fecha', 'Etapa', 'Resultado', 'Detalle'],
            state.executions.map((e) => [
              date(e.date),
              String(e.step),
              badge(e.status, e.status === 'revision' ? 'warn' : ''),
              esc(e.detail),
            ]),
          ),
        )),
    page === 'notifications' &&
      (html =
        heading(
          'Bandeja de notificaciones',
          'Avisos internos para el \xE1rea responsable de cada documento.',
        ) +
        card(
          'Notificaciones',
          'Los avisos se generan durante la etapa 4.',
          table(
            ['Mensaje', '\xC1rea', 'Fecha', 'Estado'],
            state.notifications.map((n) => [
              esc(n.message),
              esc(n.area),
              date(n.date),
              n.read ? badge('Le\xEDda', 'gray') : button('Marcar le\xEDda', 'read', 'ghost', n.id),
            ]),
          ),
        )),
    page === 'reports' &&
      (html =
        heading(
          'Reportes documentales',
          'Consulta el resultado del procesamiento.',
          canManage() ? button('Generar corte', 'report') : '',
        ) +
        '<div class="notice">Descarga el archivo documental: <a class="link" href="/api/report.csv">Exportar CSV \u2192</a></div>' +
        card(
          'Cortes del procesamiento',
          'Generados manualmente o desde el flujo programado de n8n.',
          table(
            ['Fecha', 'Recibidos', 'Completados', 'En revisi\xF3n'],
            state.reports.map((r) => [
              date(r.date),
              String(r.total),
              String(r.completed),
              String(r.review),
            ]),
          ),
        )),
    page === 'audit' &&
      (html =
        heading('Auditor\xEDa', 'Consulta las acciones registradas con usuario y fecha.') +
        card(
          'Trazabilidad del sistema',
          'Acceso reservado al administrador.',
          table(
            ['Fecha', 'Usuario', 'Acci\xF3n', 'Detalle'],
            state.audit.map((a) => [
              date(a.date),
              esc(a.user),
              badge(a.action, 'gray'),
              esc(a.detail),
            ]),
          ),
        )),
    page === 'users' &&
      (html =
        heading(
          'Usuarios y permisos',
          'Cuentas disponibles para validar los distintos niveles de acceso.',
        ) +
        card(
          'Cuentas del sistema',
          'Cada usuario cuenta con una contrase\xF1a protegida.',
          table(
            ['Nombre', 'Usuario', 'Rol'],
            state.users.map((u) => [esc(u.name), esc(u.username), badge(u.role)]),
          ),
        )),
    page === 'account' &&
      (html =
        heading('Mi cuenta', 'Revisa tu acceso y actualiza tu contrase\xF1a.') +
        card(
          'Datos de acceso',
          esc(me.username),
          '<div class="card-body"><p>Rol asignado: ' +
            badge(me.role) +
            '</p><p class="muted">La sesi\xF3n se cierra tras 15 minutos sin actividad. Cinco intentos fallidos bloquean la cuenta durante cinco minutos.</p><p>' +
            button('Cambiar contrase\xF1a', 'password', 'secondary') +
            '</p></div>',
        )),
    shell(html));
  const search = $('#search');
  search &&
    ((search.value = query),
    search.addEventListener('input', (e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      (render(), $('#search').focus(), $('#search').setSelectionRange(pos, pos));
    }));
}
function searchBar(placeholder) {
  return (
    '<div class="toolbar"><label class="sr-only" for="search">Buscar</label><input class="search" id="search" type="search" placeholder="' +
    placeholder +
    '"><span class="muted">Datos actualizados al consultar</span></div>'
  );
}
function timeline(list) {
  return list.length
    ? '<div class="card-body"><div class="timeline">' +
        list
          .map(
            (e) =>
              '<article><h3>Etapa ' +
              e.step +
              ' ' +
              badge(e.status, e.status === 'revision' ? 'warn' : '') +
              '</h3><p>' +
              esc(e.detail) +
              '</p><small>' +
              date(e.date) +
              '</small></article>',
          )
          .join('') +
        '</div></div>'
    : '<div class="empty">Las ejecuciones aparecer\xE1n al cargar documentos.</div>';
}
function flowCards() {
  return (
    '<div class="notice">' +
    (config.orchestration === 'n8n'
      ? 'Orquestaci\xF3n con n8n conectada. Consulta las ejecuciones en el editor de flujos.'
      : 'Modo local de demostraci\xF3n. Las cinco etapas se ejecutan en esta aplicaci\xF3n; los flujos n8n est\xE1n incluidos para el despliegue Docker.') +
    '</div><section class="flow" aria-label="Etapas documentales">' +
    [
      ['Recepci\xF3n', 'Valida formato, tama\xF1o y duplicados.'],
      ['Clasificaci\xF3n', 'Asigna tipo y \xE1rea por palabras clave.'],
      ['Almacenamiento', 'Conserva el archivo y su identificador.'],
      ['Notificaci\xF3n', 'Informa en la bandeja interna.'],
      ['Auditor\xEDa', 'Completa la trazabilidad del recorrido.'],
    ]
      .map(
        ([title, desc], i) =>
          '<article class="flow-step"><span class="num">0' +
          (i + 1) +
          '</span><strong>' +
          title +
          '</strong><p>' +
          desc +
          '</p></article>',
      )
      .join('') +
    '</section><p></p>'
  );
}
async function refresh() {
  ((state = await api('/api/state')), render());
}
function uploadDialog() {
  modal(
    'Cargar documento',
    'Archivos TXT o PDF hasta 1 MB. El nombre y el asunto determinan la clasificaci\xF3n.',
    '<div class="upload-box">' +
      field('Selecciona un archivo', 'file', 'file', '', 'accept=".txt,.pdf"') +
      '<p>Prueba con los archivos de techflow / ejemplos.</p></div>' +
      field('Asunto', 'subject', 'text', '', 'maxlength="250"'),
    'Procesar documento',
    async (f) => {
      const file = f.get('file');
      if (!file.size || file.size > 1048576) throw Error('Selecciona un archivo de hasta 1 MB');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let content = '';
      for (let i = 0; i < bytes.length; i += 8192)
        content += String.fromCharCode(...bytes.subarray(i, i + 8192));
      (
        await api(config.orchestration === 'n8n' ? '/api/dispatch' : '/api/documents', {
          filename: file.name,
          content: btoa(content),
          subject: f.get('subject'),
          source: 'manual',
        })
      ).status === 'revision' && toast('Documento recibido. Requiere revisi\xF3n manual.');
    },
  );
}
(document.addEventListener('click', async (e) => {
  const nav = e.target.closest('[data-page]');
  if (nav) {
    ((page = nav.dataset.page), (query = ''));
    try {
      await refresh();
    } catch (err) {
      toast(err.message, !0);
    }
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action,
    id = btn.dataset.id;
  try {
    if (action === 'close') return $('#modal').close();
    if (action === 'logout') return (await api('/api/logout', {}), (me = null), login());
    if (action.startsWith('go-')) return ((page = action.slice(3)), await refresh());
    if (action === 'upload') return uploadDialog();
    if (action === 'review') {
      const d = state.documents.find((d2) => d2.id === id);
      return modal(
        'Resolver documento',
        esc(d.filename) + ' \xB7 ' + esc(d.reason),
        select(
          'Tipo documental',
          'type',
          state.rules.map((r) => [r.type, r.type + ' \u2192 ' + r.area]),
        ),
        'Clasificar y continuar',
        (f) => api('/api/documents/review', { id, type: f.get('type') }),
      );
    }
    if (action === 'read')
      return (
        await api('/api/notifications/read', { id }),
        await refresh(),
        toast('Notificaci\xF3n marcada como le\xEDda')
      );
    if (action === 'report')
      return (await api('/api/reports/generate', {}), await refresh(), toast('Corte generado'));
    if (action === 'password')
      return modal(
        'Cambiar contrase\xF1a',
        'Usa 10 caracteres o m\xE1s, con may\xFAscula, min\xFAscula y n\xFAmero. Se cerrar\xE1n tus sesiones.',
        field(
          'Contrase\xF1a actual',
          'currentPassword',
          'password',
          '',
          'autocomplete="current-password"',
        ) +
          field(
            'Nueva contrase\xF1a',
            'newPassword',
            'password',
            '',
            'minlength="10" autocomplete="new-password"',
          ),
        'Actualizar contrase\xF1a',
        async (f) => {
          (await api('/api/password', Object.fromEntries(f)), (me = null));
        },
      );
  } catch (err) {
    toast(err.message, !0);
  }
}),
  (async () => {
    try {
      ((config = await api('/api/config')), (document.body.className = config.app));
      try {
        me = await api('/api/me');
      } catch {}
      me ? await refresh() : login();
    } catch (err) {
      $('#app').textContent = err.message;
    }
  })());
