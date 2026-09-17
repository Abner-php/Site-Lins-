const config = window.COURSE_CONFIG;
const statusText = document.querySelector('#admin-status');
const cell = text => `<td>${text}</td>`;
const esc = text => String(text ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
if (!config || config.supabaseUrl.startsWith('COLE_')) {
  statusText.textContent = 'Conecte o Supabase para ativar este painel.';
  ['#bookings-table','#students-table'].forEach(id => document.querySelector(id).innerHTML = '<tr><td colspan="5">O painel aparece aqui após configurar o Supabase.</td></tr>');
} else {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.replace('curso.html');
  else {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'teacher') window.location.replace('aluno.html');
    else {
      statusText.textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date());
      const [{ data: enrollments }, { data: bookings }, { data: modules }] = await Promise.all([
        supabase.from('enrollments').select('user_id,status,created_at,courses(title,price_cents)').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('starts_at', { ascending: true }).limit(8),
        supabase.from('modules').select('position,title,description,is_published').order('position')
      ]);
      const active = (enrollments ?? []).filter(item => item.status === 'active');
      const { data: profiles } = active.length ? await supabase.from('profiles').select('id,full_name').in('id', active.map(item => item.user_id)) : { data: [] };
      const profileNames = Object.fromEntries((profiles ?? []).map(item => [item.id, item.full_name]));
      document.querySelector('#stat-students').textContent = active.length;
      document.querySelector('#stat-sales').textContent = active.length;
      document.querySelector('#stat-bookings').textContent = (bookings ?? []).filter(item => item.status === 'pending').length;
      document.querySelector('#stat-revenue').textContent = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(active.reduce((sum,item) => sum + (item.courses?.price_cents ?? 0), 0) / 100);
      document.querySelector('#student-count').textContent = `${active.length} aluno${active.length === 1 ? '' : 's'}`;
      document.querySelector('#bookings-table').innerHTML = bookings?.length ? bookings.map(item => `<tr>${cell(esc(item.student_name))}${cell(esc(item.instrument))}${cell(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.starts_at)))}${cell(`<span class="status ${item.status}">${item.status === 'confirmed' ? 'Confirmada' : 'Pendente'}</span>`)}${cell(item.status === 'pending' ? `<button class="confirm-booking" data-id="${item.id}">Confirmar</button>` : '')}</tr>`).join('') : '<tr><td colspan="5">Nenhum agendamento por enquanto.</td></tr>';
      document.querySelector('#students-table').innerHTML = active.length ? active.map(item => `<tr>${cell(esc(profileNames[item.user_id] || 'Aluno'))}${cell(esc(item.courses?.title || 'Curso'))}${cell('<span class="status confirmed">Liberado</span>')}${cell(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(item.created_at)))}</tr>`).join('') : '<tr><td colspan="4">Nenhum aluno com acesso liberado ainda.</td></tr>';
      document.querySelector('#modules-grid').innerHTML = modules?.map(item => `<article><span>MÓDULO ${String(item.position).padStart(2,'0')}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><b>${item.is_published ? 'Publicado' : 'Rascunho'}</b></article>`).join('') || '<p>Nenhum módulo criado ainda.</p>';
      document.querySelectorAll('.confirm-booking').forEach(button => button.addEventListener('click', async () => { await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', button.dataset.id); window.location.reload(); }));
    }
  }
  document.querySelector('#admin-logout').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.replace('curso.html'); });
}
document.querySelector('#new-module').addEventListener('click', () => alert('A criação de módulos será a próxima etapa: aqui Jonas poderá informar título, descrição e link do vídeo.'));
