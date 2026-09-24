const config = window.COURSE_CONFIG;
const API = (config?.apiUrl || 'http://localhost:8080').replace(/\/$/, '');
const COURSE_ID = config?.courseId || '4b39feb9-0a46-41a7-90f7-cb14d5bb91a1';
const token = localStorage.getItem('course_token');
const statusText = document.querySelector('#admin-status');
const grid = document.querySelector('#modules-grid');
const dialog = document.querySelector('#module-dialog');
const form = document.querySelector('#module-form');
const errorBox = document.querySelector('#module-error');
const cell = text => `<td>${text}</td>`;
const esc = text => String(text ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const saoPauloDateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const supabaseConfigured = config && !config.supabaseUrl.startsWith('COLE_') && !config.supabaseAnonKey.startsWith('COLE_');
let supabase;
let modules = [];
let draggedId = null;

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),
      ...options.headers
    }
  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('course_token');
    localStorage.removeItem('course_role');
    window.location.replace('curso.html');
    throw new Error('Sessão encerrada.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.detail || 'A operação não pôde ser concluída.');
  }
  return response.status === 204 ? null : response.json();
}

function renderModules() {
  grid.innerHTML = modules.length ? modules.map((module, index) => `
    <article class="module-admin-card" draggable="true" data-id="${module.id}">
      <span>MÓDULO ${String(module.position).padStart(2,'0')}</span>
      <h3>${esc(module.title)}</h3><p>${esc(module.description)}</p>
      <div class="module-meta"><b class="${module.published ? 'published' : ''}">${module.published ? 'Publicado' : 'Rascunho'}</b><small>${module.videoUploadStatus === 'READY' ? esc(module.videoOriginalName) : 'Sem vídeo'}</small></div>
      <div class="module-actions"><button data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="down" ${index === modules.length - 1 ? 'disabled' : ''}>↓</button><button data-action="edit">Editar</button><button data-action="publish">${module.published ? 'Despublicar' : 'Publicar'}</button><button data-action="delete">Excluir</button></div>
    </article>`).join('') : '<p>Nenhum módulo criado. Clique em “Novo módulo”.</p>';
}

async function loadModules() {
  if (!token) {
    window.location.replace('curso.html');
    return;
  }
  try {
    modules = await api(`/api/admin/courses/${COURSE_ID}/modules`);
    renderModules();
    statusText.textContent = 'API conectada';
  } catch (error) {
    grid.innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
  }
}

async function loadDashboard() {
  if (!supabaseConfigured) {
    ['#bookings-table','#students-table'].forEach(id => document.querySelector(id).innerHTML = '<tr><td colspan="5">Conecte o Supabase para carregar estes dados.</td></tr>');
    return;
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'teacher') return;

  const [{ data: enrollments }, { data: bookings }] = await Promise.all([
    supabase.from('enrollments').select('user_id,status,created_at,courses(title,price_cents)').order('created_at', { ascending: false }),
    supabase.from('bookings').select('*').order('starts_at', { ascending: true }).limit(8)
  ]);
  const active = (enrollments ?? []).filter(item => item.status === 'active');
  const { data: profiles } = active.length ? await supabase.from('profiles').select('id,full_name').in('id', active.map(item => item.user_id)) : { data: [] };
  const profileNames = Object.fromEntries((profiles ?? []).map(item => [item.id, item.full_name]));
  document.querySelector('#stat-students').textContent = active.length;
  document.querySelector('#stat-sales').textContent = active.length;
  document.querySelector('#stat-bookings').textContent = (bookings ?? []).filter(item => item.status === 'pending').length;
  document.querySelector('#stat-revenue').textContent = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(active.reduce((sum,item) => sum + (item.courses?.price_cents ?? 0), 0) / 100);
  document.querySelector('#student-count').textContent = `${active.length} aluno${active.length === 1 ? '' : 's'}`;
  document.querySelector('#bookings-table').innerHTML = bookings?.length ? bookings.map(item => `<tr>${cell(esc(item.student_name))}${cell(esc(item.instrument))}${cell(saoPauloDateTime.format(new Date(item.starts_at)))}${cell(`<span class="status ${item.status}">${item.status === 'confirmed' ? 'Confirmada' : 'Pendente'}</span>`)}${cell(item.status === 'pending' ? `<button class="confirm-booking" data-id="${item.id}">Confirmar</button>` : '')}</tr>`).join('') : '<tr><td colspan="5">Nenhum agendamento por enquanto.</td></tr>';
  document.querySelector('#students-table').innerHTML = active.length ? active.map(item => `<tr>${cell(esc(profileNames[item.user_id] || 'Aluno'))}${cell(esc(item.courses?.title || 'Curso'))}${cell('<span class="status confirmed">Liberado</span>')}${cell(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(item.created_at)))}</tr>`).join('') : '<tr><td colspan="4">Nenhum aluno com acesso liberado ainda.</td></tr>';
  document.querySelectorAll('.confirm-booking').forEach(button => button.addEventListener('click', async () => {
    const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', button.dataset.id);
    if (error) return alert('Não foi possível confirmar o agendamento.');
    window.location.reload();
  }));
}

function openForm(module = null) {
  form.reset();
  errorBox.textContent = '';
  document.querySelector('#module-id').value = module?.id || '';
  document.querySelector('#module-title').value = module?.title || '';
  document.querySelector('#module-description').value = module?.description || '';
  document.querySelector('#module-dialog-kicker').textContent = module ? 'EDITAR MÓDULO' : 'NOVO MÓDULO';
  document.querySelector('#module-dialog-title').textContent = module ? 'Editar módulo' : 'Criar módulo';
  document.querySelector('#upload-progress').hidden = true;
  dialog.showModal();
}

function validateVideo(file) {
  if (!file) return;
  if (!['video/mp4','video/webm'].includes(file.type)) throw new Error('Use um vídeo MP4 ou WebM.');
  if (file.size > 500 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 500 MB.');
}

function uploadVideo(moduleId, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    const container = document.querySelector('#upload-progress');
    const bar = document.querySelector('#upload-progress-bar');
    const label = document.querySelector('#upload-progress-label');
    body.append('video', file);
    container.hidden = false;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        const percent = Math.round(event.loaded / event.total * 100);
        bar.value = percent;
        label.textContent = `Enviando ${percent}%`;
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else {
        let message = 'Falha no envio.';
        try { message = JSON.parse(xhr.responseText).error || message; } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('A conexão falhou durante o upload.'));
    xhr.open('POST', `${API}/api/admin/modules/${moduleId}/video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(body);
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorBox.textContent = '';
  const submit = document.querySelector('#save-module');
  const id = document.querySelector('#module-id').value;
  const file = document.querySelector('#module-video').files[0];
  const payload = { title: document.querySelector('#module-title').value.trim(), description: document.querySelector('#module-description').value.trim() };
  let createdId = null;
  try {
    if (payload.title.length < 3) throw new Error('O título deve ter pelo menos 3 caracteres.');
    validateVideo(file);
    submit.disabled = true;
    submit.textContent = 'Salvando...';
    const module = id
      ? await api(`/api/admin/modules/${id}`, {method:'PATCH', body:JSON.stringify(payload)})
      : await api(`/api/admin/courses/${COURSE_ID}/modules`, {method:'POST', body:JSON.stringify(payload)});
    if (!id) createdId = module.id;
    if (file) await uploadVideo(module.id, file);
    dialog.close();
    await loadModules();
  } catch (error) {
    if (createdId) await api(`/api/admin/modules/${createdId}`, {method:'DELETE'}).catch(() => {});
    errorBox.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Salvar módulo';
  }
});

grid.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const card = button.closest('[data-id]');
  const module = modules.find(item => item.id === card.dataset.id);
  const index = modules.indexOf(module);
  try {
    if (button.dataset.action === 'edit') return openForm(module);
    if (button.dataset.action === 'delete') {
      if (!confirm(`Excluir o módulo “${module.title}”?`)) return;
      await api(`/api/admin/modules/${module.id}`, {method:'DELETE'});
      return loadModules();
    }
    if (button.dataset.action === 'publish') {
      await api(`/api/admin/modules/${module.id}/publish`, {method:'PATCH', body:JSON.stringify({published:!module.published})});
      return loadModules();
    }
    const targetIndex = button.dataset.action === 'up' ? index - 1 : index + 1;
    [modules[index], modules[targetIndex]] = [modules[targetIndex], modules[index]];
    renderModules();
    await saveOrder();
  } catch (error) {
    alert(error.message);
    await loadModules();
  }
});

async function saveOrder() {
  await api(`/api/admin/courses/${COURSE_ID}/modules/order`, {method:'PUT', body:JSON.stringify({moduleIds:modules.map(item => item.id)})});
  await loadModules();
}

grid.addEventListener('dragstart', event => { draggedId = event.target.closest('[data-id]')?.dataset.id || null; });
grid.addEventListener('dragover', event => event.preventDefault());
grid.addEventListener('drop', async event => {
  event.preventDefault();
  const targetId = event.target.closest('[data-id]')?.dataset.id;
  if (!draggedId || !targetId || draggedId === targetId) return;
  const from = modules.findIndex(item => item.id === draggedId);
  const to = modules.findIndex(item => item.id === targetId);
  const [moved] = modules.splice(from, 1);
  modules.splice(to, 0, moved);
  renderModules();
  try { await saveOrder(); } catch (error) { alert(error.message); await loadModules(); }
});

document.querySelector('#new-module').addEventListener('click', () => openForm());
document.querySelector('#close-module-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#admin-logout').addEventListener('click', async () => {
  localStorage.removeItem('course_token');
  localStorage.removeItem('course_role');
  if (supabase) await supabase.auth.signOut();
  window.location.replace('curso.html');
});

await Promise.allSettled([loadModules(), loadDashboard()]);
