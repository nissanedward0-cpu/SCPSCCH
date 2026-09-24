const { createClient } = window.supabase;
const sb = supabaseClient;

let currentUser = null;
let currentProfile = null;
let users = [];
let tasks = [];
let selectedTaskId = null;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fmtDate(d){if(!d)return 'No date'; return new Date(d+'T00:00:00').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}

async function init(){
  const {data:{session}} = await sb.auth.getSession();
  if(session){ await loadCurrentUser(session.user.id); }
  if(currentUser) showApp(); else showAuth();

  document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>switchAuth(b.dataset.auth));
  document.getElementById('loginForm').onsubmit=login;
  document.getElementById('registerForm').onsubmit=register;
  document.getElementById('logoutBtn').onclick=logout;
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll('[data-view-link]').forEach(b=>b.onclick=()=>showView(b.dataset.viewLink));
  document.getElementById('dashboardCreateBtn').onclick=()=>showView('create');
  document.getElementById('taskForm').onsubmit=createTask;
  document.getElementById('statusFilter').onchange=renderTasks;
  document.getElementById('closeModal').onclick=closeModal;
  document.getElementById('saveReply').onclick=saveReply;
  document.getElementById('statusAction').onclick=changeStatus;
  window.onclick=e=>{if(e.target.id==='taskModal')closeModal()};

  sb.auth.onAuthStateChange(async (_event,session)=>{
    if(session){ await loadCurrentUser(session.user.id); showApp(); }
    else { currentUser=null; currentProfile=null; showAuth(); }
  });
}

async function loadCurrentUser(id){
  const {data,error}=await sb.from('profiles').select('*').eq('id',id).single();
  if(error){console.error(error); toast('Could not load your profile'); return}
  currentUser={id:data.id,email:data.email,name:data.full_name,role:data.role};
  currentProfile=data;
  await loadUsers();
  await loadTasks();
}

async function loadUsers(){
  const {data,error}=await sb.from('profiles').select('id,full_name,email,role').order('full_name');
  if(error){console.error(error);return}
  users=data||[];
}

async function loadTasks(){
  let query=sb.from('tasks').select(`
    id,title,description,assignee_id,due_date,status,created_by,created_at,
    assignee:profiles!tasks_assignee_id_fkey(id,full_name,email,role),
    replies(id,user_id,message,created_at,user:profiles!task_replies_user_id_fkey(full_name))
  `).order('created_at',{ascending:false});
  if(currentUser.role!=='manager') query=query.eq('assignee_id',currentUser.id);
  const {data,error}=await query;
  if(error){console.error(error);toast('Could not load tasks');return}
  tasks=(data||[]).map(t=>({
    ...t,
    assigneeId:t.assignee_id,
    due:t.due_date,
    replies:(t.replies||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  }));
}

function showAuth(){document.getElementById('authScreen').classList.remove('hidden');document.getElementById('appScreen').classList.add('hidden')}
function showApp(){document.getElementById('authScreen').classList.add('hidden');document.getElementById('appScreen').classList.remove('hidden');setupUserUI();showView('dashboard')}
function setupUserUI(){
  document.getElementById('userName').textContent=currentUser.name;
  document.getElementById('userRole').textContent=currentUser.role;
  document.getElementById('avatar').textContent=currentUser.name[0].toUpperCase();
  document.getElementById('welcomeText').textContent=`Here’s your work overview, ${currentUser.name.split(' ')[0]}.`;
  document.querySelectorAll('.manager-only').forEach(el=>el.classList.toggle('hidden',currentUser.role!=='manager'));
  populateAssignees(); renderTeam();
}
function switchAuth(mode){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.auth===mode));
  document.getElementById('loginForm').classList.toggle('hidden',mode!=='login');
  document.getElementById('registerForm').classList.toggle('hidden',mode!=='register');
}
async function login(e){
  e.preventDefault();
  const email=document.getElementById('loginEmail').value.trim(),pass=document.getElementById('loginPassword').value;
  const {error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error){toast(error.message);return}
  toast('Welcome back!');
}
async function register(e){
  e.preventDefault();
  const name=document.getElementById('regName').value.trim(),email=document.getElementById('regEmail').value.trim(),pass=document.getElementById('regPassword').value;
  // Public registration always creates a worker. A manager role should be assigned
  // manually by an authorized admin in Supabase.
  const {data,error}=await sb.auth.signUp({email,password:pass,data:{full_name:name}});
  if(error){toast(error.message);return}
  if(data.session){toast('Account created!');}
  else {toast('Account created. Check your email to confirm it.');}
}
async function logout(){await sb.auth.signOut();}

async function showView(view){
  if(view==='create'&&currentUser.role!=='manager')view='dashboard';
  await loadTasks();
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  document.getElementById(view+'View').classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.getElementById('pageTitle').textContent={dashboard:'Dashboard',tasks:'Tasks',create:'Create Task',team:'Team'}[view];
  if(view==='dashboard')renderDashboard();
  if(view==='tasks')renderTasks();
  if(view==='team')renderTeam();
}

function visibleTasks(){return tasks}
function renderDashboard(){
  const list=visibleTasks();
  document.getElementById('statTotal').textContent=list.length;
  document.getElementById('statPending').textContent=list.filter(t=>t.status==='pending').length;
  document.getElementById('statProgress').textContent=list.filter(t=>t.status==='in-progress').length;
  document.getElementById('statCompleted').textContent=list.filter(t=>t.status==='completed').length;
  document.getElementById('recentTasks').innerHTML=list.slice(0,5).map(taskHTML).join('')||emptyHTML('No tasks yet.');
  bindTaskClicks();
}
function renderTasks(){
  const filter=document.getElementById('statusFilter').value,list=visibleTasks().filter(t=>filter==='all'||t.status===filter);
  document.getElementById('allTasks').innerHTML=list.map(taskHTML).join('')||emptyHTML('No matching tasks.');
  bindTaskClicks();
}
function taskHTML(t){
  const assignee=t.assignee;
  return `<button class="task-item" data-task="${t.id}">
    <div class="task-main"><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p></div>
    <div class="task-side"><span class="badge ${t.status}">${t.status.replace('-',' ')}</span>
    <small>${currentUser.role==='manager'?'Assigned to '+esc(assignee?.full_name||'Unknown'):fmtDate(t.due)}</small></div>
  </button>`;
}
function emptyHTML(msg){return `<div class="task-item"><div class="task-main"><h4>${msg}</h4></div></div>`}
function bindTaskClicks(){document.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>openTask(el.dataset.task))}

function openTask(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  selectedTaskId=id;
  document.getElementById('modalTitle').textContent=t.title;
  document.getElementById('modalDescription').textContent=t.description;
  document.getElementById('modalAssignee').textContent=t.assignee?.full_name||'Unknown';
  document.getElementById('modalDue').textContent=fmtDate(t.due);
  document.getElementById('modalStatus').textContent=t.status.replace('-',' ');
  document.getElementById('replyText').value='';
  document.getElementById('statusAction').textContent=t.status==='completed'?'Reopen task':currentUser.role==='worker'?'Mark as completed':'Set in progress';
  renderReplies(t);
  document.getElementById('taskModal').classList.remove('hidden');
}
function renderReplies(t){
  document.getElementById('replyHistory').innerHTML=t.replies?.length?t.replies.map(r=>
    `<div class="reply"><strong>${esc(r.user?.full_name||'User')}</strong><div>${esc(r.message)}</div><small>${new Date(r.created_at).toLocaleString()}</small></div>`
  ).join(''):'<div class="reply"><small>No replies yet.</small></div>';
}
function closeModal(){document.getElementById('taskModal').classList.add('hidden');selectedTaskId=null}

async function saveReply(){
  const text=document.getElementById('replyText').value.trim();if(!text)return toast('Write a reply first');
  const {error}=await sb.from('task_replies').insert({task_id:selectedTaskId,user_id:currentUser.id,message:text});
  if(error){toast(error.message);return}
  await loadTasks();const t=tasks.find(x=>x.id===selectedTaskId);renderReplies(t);
  document.getElementById('replyText').value='';toast('Reply sent');
}
async function changeStatus(){
  const t=tasks.find(x=>x.id===selectedTaskId);if(!t)return;
  let next;
  if(currentUser.role==='worker') next=t.status==='completed'?'in-progress':'completed';
  else next=t.status==='completed'?'in-progress':t.status==='in-progress'?'completed':'in-progress';
  const {error}=await sb.from('tasks').update({status:next}).eq('id',t.id);
  if(error){toast(error.message);return}
  await loadTasks();openTask(t.id);renderDashboard();renderTasks();toast('Task status updated');
}
function populateAssignees(){
  const select=document.getElementById('taskAssignee');if(!select)return;
  select.innerHTML=users.filter(u=>u.role==='worker').map(u=>`<option value="${u.id}">${esc(u.full_name)} — ${esc(u.email)}</option>`).join('');
}
async function createTask(e){
  e.preventDefault();
  const payload={
    title:document.getElementById('taskTitle').value.trim(),
    description:document.getElementById('taskDescription').value.trim(),
    assignee_id:document.getElementById('taskAssignee').value,
    due_date:document.getElementById('taskDue').value,
    status:'pending',
    created_by:currentUser.id
  };
  const {error}=await sb.from('tasks').insert(payload);
  if(error){toast(error.message);return}
  e.target.reset();await loadTasks();toast('Task created');showView('tasks');
}
function renderTeam(){
  const list=document.getElementById('teamList');if(!list)return;
  list.innerHTML=users.map(u=>`<div class="team-card"><div class="avatar">${esc(u.full_name[0].toUpperCase())}</div><h3>${esc(u.full_name)}</h3><p>${esc(u.email)}</p><p>${u.role}</p></div>`).join('');
}
init();
