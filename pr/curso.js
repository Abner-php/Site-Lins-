const modules = [
  ['01','Primeiros sons','Conheça a guitarra, afinação e postura.'],['02','Acordes essenciais','Os acordes que abrem um universo de músicas.'],['03','Ritmo e levadas','Faça os acordes soarem como música.'],['04','Seu primeiro repertório','Aprenda canções do começo ao fim.'],['05','Escalas sem mistério','Encontre notas e comece a improvisar.'],['06','Técnica que funciona','Palhetada, digitação e independência.'],['07','Harmonia prática','Entenda por que as músicas soam bem.'],['08','Riffs e solos','Construa frases que têm a sua cara.'],['09','Tocando com outros','Tempo, dinâmica e presença musical.'],['10','Seu próximo capítulo','Monte sua rotina e continue evoluindo.']
];
document.querySelector('#module-list').innerHTML = modules.map(([number,title,text]) => `<article class="module"><span class="module-num">${number}</span><div><h3>${title}</h3><p>${text}</p></div><span>aulas</span></article>`).join('');
const modal = document.querySelector('#auth-modal'), loginView = document.querySelector('#login-view'), checkoutView = document.querySelector('#checkout-view');
const show = view => { loginView.hidden = view !== 'login'; checkoutView.hidden = view !== 'checkout'; modal.showModal(); };
document.querySelectorAll('.login-trigger').forEach(button => button.addEventListener('click', () => show('login')));
document.querySelectorAll('.enroll-trigger,.show-checkout').forEach(button => button.addEventListener('click', () => show('checkout')));
document.querySelector('.show-login').addEventListener('click', () => show('login'));
document.querySelector('.close').addEventListener('click', () => modal.close());
const config = window.COURSE_CONFIG;
const configured = config && !config.supabaseUrl.startsWith('COLE_') && !config.supabaseAnonKey.startsWith('COLE_');
let supabase;
if (configured) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
}
const message = text => alert(text);
document.querySelector('#login-button').addEventListener('click', async () => {
  if (!configured) return message('O login será ativado assim que as chaves do Supabase forem cadastradas.');
  const inputs = loginView.querySelectorAll('input');
  const { error } = await supabase.auth.signInWithPassword({ email: inputs[0].value, password: inputs[1].value });
  if (error) return message(error.message);
  window.location.href = 'aluno.html';
});
document.querySelector('#payment-button').addEventListener('click', async () => {
  if (!configured) return message('O pagamento será ativado assim que as chaves do Supabase forem cadastradas.');
  const inputs = checkoutView.querySelectorAll('input');
  const { data: signup, error: signupError } = await supabase.auth.signUp({ email: inputs[1].value, password: inputs[2].value, options: { data: { full_name: inputs[0].value } } });
  if (signupError) return message(signupError.message);
  if (!signup.session) return message('Conta criada. Confirme o e-mail enviado e entre com sua senha para continuar o pagamento.');
  const { data, error } = await supabase.functions.invoke('create-payment', { body: { courseSlug: config.courseSlug } });
  if (error || !data?.checkoutUrl) return message(error?.message || data?.error || 'Não foi possível iniciar o pagamento.');
  window.location.href = data.checkoutUrl;
});
