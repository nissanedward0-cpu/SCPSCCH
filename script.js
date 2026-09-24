const KEY_USERS='taskflow_users_v1', KEY_TASKS='taskflow_tasks_v1', KEY_SESSION='taskflow_session_v1';

const seedUsers=[
 {id:'u1',name:'Demo Manager',email:'manager@demo.com',password:'123456',role:'manager'},
 {id:'u2',name:'Demo Worker',email:'worker@demo.com',password:'123456',role:'worker'},
 {id:'u3',name:'Alex Worker',email:'alex@demo.com',password:'123456',role:'worker'}
];
const seedTasks=[
 {id:'t1',title:'Prepare homepage banner',description:'Create the first draft of the homepage banner and submit it for review.',assigneeId:'u2',due:'2026-10-02',status:'in-progress',createdBy:'u1',replies:[{by:'u2',text:'I have started the first draft.',date:new Date().toISOString()}]},
 {id:'t2',title:'Check product information',description:'Review the product information and report anything that needs correction.',assigneeId:'u3',due:'2026-10-05',status:'pending',createdBy:'u1',replies:[]}
];

function load(key,fallback){try{const x=localStorage.getItem(key);return x?JSON.parse(x):fallback}catch(e){return fallback}}
let users=load(KEY_USERS,seedUsers);
let tasks=load(KEY_TASKS,seedTasks);
let currentUser=null;
let selectedTaskId=null;

function save(){localStorage.setItem(KEY_USERS,JSON.stringify(users));localStorage.setItem(KEY_TASKS,JSON.stringify(tasks))}
function uid(prefix){return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fmtDate(d){if(!d)return 'No date'; return new Date(d+'T00:00:00').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}

function init(){
 const session=localStorage.getItem(KEY_SESSION);
 if(session){currentUser=users.find(u=>u.id===session)||null}
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
 window.onclick=e=>{if(e.target.id==='taskModal')closeModal()}
}

function showAuth(){document.getElementById('authScreen').classList.remove('hidden');document.getElementById('appScreen').classList.add('hidden')}
function showApp(){document.getElementById('authScreen').classList.add('hidden');document.getElementById('appScreen').classList.remove('hidden');setupUserUI();showView('dashboard')}
function setupUserUI(){
 document.getElementById('userName').textContent=currentUser.name;
 document.getElementById('userRole').textContent=currentUser.role;
 document.getElementById('avatar').textContent=currentUser.name[0].toUpperCase();
 document.getElementById('welcomeText').textContent=`Here’s your work overview, ${currentUser.name.split(' ')[0]}.`;
 document.querySelectorAll('.manager-only').forEach(el=>el.classList.toggle('hidden',currentUser.role!=='manager'));
 populateAssignees();renderTeam();
}
function switchAuth(mode){
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.auth===mode));
 document.getElementById('loginForm').classList.toggle('hidden',mode!=='login');
 document.getElementById('registerForm').classList.toggle('hidden',mode!=='register');
}
function login(e){
 e.preventDefault();
 const email=document.getElementById('loginEmail').value.trim().toLowerCase(),pass=document.getElementById('loginPassword').value;
 const user=users.find(u=>u.email.toLowerCase()===email&&u.password===pass);
 if(!user){toast('Invalid email or password');return}
 currentUser=user;localStorage.setItem(KEY_SESSION,user.id);showApp();toast('Welcome back!')
}
function register(e){
 e.preventDefault();
 const name=document.getElementById('regName').value.trim(),email=document.getElementById('regEmail').value.trim().toLowerCase(),pass=document.getElementById('regPassword').value,role=document.getElementById('regRole').value;
 if(users.some(u=>u.email.toLowerCase()===email)){toast('An account with this email already exists');return}
 const user={id:uid('u'),name,email,password:pass,role};
 users.push(user);save();currentUser=user;localStorage.setItem(KEY_SESSION,user.id);showApp();toast('Account created!')
}
function logout(){localStorage.removeItem(KEY_SESSION);currentUser=null;showAuth();switchAuth('login')}
function showView(view){
 if(view==='create'&&currentUser.role!=='manager')view='dashboard';
 document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
 document.getElementById(view+'View').classList.remove('hidden');
 document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 document.getElementById('pageTitle').textContent={dashboard:'Dashboard',tasks:'Tasks',create:'Create Task',team:'Team'}[view];
 if(view==='dashboard')renderDashboard();
 if(view==='tasks')renderTasks();
 if(view==='team')renderTeam();
}
function visibleTasks(){
 return currentUser.role==='manager'?tasks:tasks.filter(t=>t.assigneeId===currentUser.id);
}
function renderDashboard(){
 const list=visibleTasks();
 document.getElementById('statTotal').textContent=list.length;
 document.getElementById('statPending').textContent=list.filter(t=>t.status==='pending').length;
 document.getElementById('statProgress').textContent=list.filter(t=>t.status==='in-progress').length;
 document.getElementById('statCompleted').textContent=list.filter(t=>t.status==='completed').length;
 document.getElementById('recentTasks').innerHTML=list.slice().sort((a,b)=>b.id.localeCompare(a.id)).slice(0,5).map(taskHTML).join('')||emptyHTML('No tasks yet.');
 bindTaskClicks();
}
function renderTasks(){
 const filter=document.getElementById('statusFilter').value,list=visibleTasks().filter(t=>filter==='all'||t.status===filter);
 document.getElementById('allTasks').innerHTML=list.map(taskHTML).join('')||emptyHTML('No matching tasks.');
 bindTaskClicks();
}
function taskHTML(t){
 const assignee=users.find(u=>u.id===t.assigneeId);
 return `<button class="task-item" data-task="${t.id}">
  <div class="task-main"><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p></div>
  <div class="task-side"><span class="badge ${t.status}">${t.status.replace('-',' ')}</span><small>${currentUser.role==='manager'?'Assigned to '+esc(assignee?.name||'Unknown'):fmtDate(t.due)}</small></div>
 </button>`;
}
function emptyHTML(msg){return `<div class="task-item"><div class="task-main"><h4>${msg}</h4></div></div>`}
function bindTaskClicks(){document.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>openTask(el.dataset.task))}
function openTask(id){
 const t=tasks.find(x=>x.id===id);if(!t)return;
 if(currentUser.role!=='manager'&&t.assigneeId!==currentUser.id){toast('You cannot access this task');return}
 selectedTaskId=id;
 const assignee=users.find(u=>u.id===t.assigneeId);
 document.getElementById('modalTitle').textContent=t.title;
 document.getElementById('modalDescription').textContent=t.description;
 document.getElementById('modalAssignee').textContent=assignee?.name||'Unknown';
 document.getElementById('modalDue').textContent=fmtDate(t.due);
 document.getElementById('modalStatus').textContent=t.status.replace('-',' ');
 document.getElementById('replyText').value='';
 document.getElementById('statusAction').textContent=t.status==='completed'?'Reopen task':currentUser.role==='worker'?'Mark as completed':'Set in progress';
 renderReplies(t);
 document.getElementById('taskModal').classList.remove('hidden');
}
function renderReplies(t){
 document.getElementById('replyHistory').innerHTML=t.replies?.length?t.replies.map(r=>{
  const u=users.find(x=>x.id===r.by);return `<div class="reply"><strong>${esc(u?.name||'User')}</strong><div>${esc(r.text)}</div><small>${new Date(r.date).toLocaleString()}</small></div>`
 }).join(''):'<div class="reply"><small>No replies yet.</small></div>';
}
function closeModal(){document.getElementById('taskModal').classList.add('hidden');selectedTaskId=null}
function saveReply(){
 const text=document.getElementById('replyText').value.trim();if(!text)return toast('Write a reply first');
 const t=tasks.find(x=>x.id===selectedTaskId);t.replies=t.replies||[];t.replies.push({by:currentUser.id,text,date:new Date().toISOString()});save();renderReplies(t);document.getElementById('replyText').value='';toast('Reply sent');
}
function changeStatus(){
 const t=tasks.find(x=>x.id===selectedTaskId);
 if(currentUser.role==='worker'){
  t.status=t.status==='completed'?'in-progress':'completed';
 }else{
  t.status=t.status==='completed'?'in-progress':t.status==='in-progress'?'completed':'in-progress';
 }
 save();openTask(t.id);renderDashboard();renderTasks();toast('Task status updated');
}
function populateAssignees(){
 const select=document.getElementById('taskAssignee');if(!select)return;
 select.innerHTML=users.filter(u=>u.role==='worker').map(u=>`<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join('');
}
function createTask(e){
 e.preventDefault();
 const task={id:uid('t'),title:document.getElementById('taskTitle').value.trim(),description:document.getElementById('taskDescription').value.trim(),assigneeId:document.getElementById('taskAssignee').value,due:document.getElementById('taskDue').value,status:'pending',createdBy:currentUser.id,replies:[]};
 tasks.unshift(task);save();e.target.reset();toast('Task created');showView('tasks');
}
function renderTeam(){
 const list=document.getElementById('teamList');if(!list)return;
 list.innerHTML=users.map(u=>`<div class="team-card"><div class="avatar">${esc(u.name[0].toUpperCase())}</div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p><p>${u.role}</p></div>`).join('');
}
init();
