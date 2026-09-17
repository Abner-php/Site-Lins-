const config = window.COURSE_CONFIG;
const panel = document.querySelector('#student-courses'), message = document.querySelector('#access-message');
if (!config || config.supabaseUrl.startsWith('COLE_')) {
  message.textContent = 'A área do aluno será ativada quando o Supabase for configurado.';
} else {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.replace('curso.html');
  else {
    document.querySelector('#student-name').textContent = user.user_metadata.full_name || user.email.split('@')[0];
    const { data: enrollments } = await supabase.from('enrollments').select('status,courses(title,slug)').eq('user_id', user.id);
    const active = enrollments?.filter(item => item.status === 'active') ?? [];
    if (!active.length) message.textContent = 'Você ainda não possui cursos liberados. Assim que o pagamento for aprovado, eles aparecerão aqui.';
    else { message.textContent = 'Seus cursos liberados:'; panel.innerHTML = active.map(item => `<article class="student-course"><span>ACESSO LIBERADO</span><h2>${item.courses.title}</h2><a href="curso.html#modulos">Ver módulos →</a></article>`).join(''); }
  }
  document.querySelector('#logout').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.replace('curso.html'); });
}
