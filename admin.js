(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const cfg=window.STUDYPILOT_CONFIG||{};
const configured=/^https:\/\/.+\.supabase\.co\/?$/.test(String(cfg.SUPABASE_URL||''))&&String(cfg.SUPABASE_PUBLIC_KEY||'').length>20&&!String(cfg.SUPABASE_URL).includes('PASTE_');
let client=null, session=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=(el,msg,error=false)=>{el.textContent=msg;el.classList.toggle('error',error)};

const adminThemeButton=$('#adminThemeToggle');
function applyAdminTheme(theme){document.body.dataset.theme=theme; if(adminThemeButton)adminThemeButton.textContent=theme==='dark'?'☀ Light':'☾ Dark';try{localStorage.setItem('studypilot-theme',theme)}catch(e){}}
let initialAdminTheme='light';try{initialAdminTheme=localStorage.getItem('studypilot-theme')||'light'}catch(e){}applyAdminTheme(initialAdminTheme);
adminThemeButton?.addEventListener('click',()=>applyAdminTheme(document.body.dataset.theme==='dark'?'light':'dark'));

function showApp(user){session=user;$('#loginPanel').hidden=true;$('#adminApp').hidden=false;$('#signOutBtn').hidden=false;$('#adminIdentity').textContent=user.email||'Administrator';loadOverview();loadSubjects()}
function showLogin(msg='',error=false){$('#loginPanel').hidden=false;$('#adminApp').hidden=true;$('#signOutBtn').hidden=true;say($('#loginMessage'),msg,error)}
async function verifyAdmin(user){
  const {data,error}=await client.rpc('studypilot_is_admin');
  if(error)throw error;
  if(data!==true)throw new Error('This account has not been authorised as a StudyPilot administrator.');
  showApp(user);
}
async function init(){
 if(!configured||!window.supabase?.createClient){showLogin('The site administrator must configure the Supabase URL and public key in config.js.',true);return}
 client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLIC_KEY);
 const {data,error}=await client.auth.getSession();
 if(error){showLogin(error.message,true);return}
 if(data.session){try{await verifyAdmin(data.session.user)}catch(e){await client.auth.signOut();showLogin(e.message,true)}}else showLogin('Sign in with your authorised administrator account.');
 client.auth.onAuthStateChange(async(event,s)=>{if(event==='SIGNED_OUT'){session=null;showLogin('You have signed out.')}else if(s?.user&&!session){try{await verifyAdmin(s.user)}catch(e){await client.auth.signOut();showLogin(e.message,true)}}});
}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const btn=e.submitter;btn.disabled=true;say($('#loginMessage'),'Signing in…');try{const {data,error}=await client.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error)throw error;await verifyAdmin(data.user)}catch(err){say($('#loginMessage'),err.message||'Sign-in failed.',true)}finally{btn.disabled=false}});
$('#signOutBtn').addEventListener('click',async()=>{if(client)await client.auth.signOut()});
$$('.tab').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
function activate(tab){$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${tab}`));({overview:loadOverview,curriculum:loadSubjects,bulk:loadSubjects,suggestions:loadSuggestions,notices:loadNotices,users:loadUsers,feedback:loadFeedback,support:loadSupport,resources:loadResources,audit:loadAudit}[tab]||(()=>{}))()}
async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data}
async function loadOverview(){if(!session)return;const box=$('#metricGrid');box.innerHTML='<div class="metric">Loading…</div>';try{const d=await rpc('studypilot_admin_overview');const items=[['Registered students',d.registered_users,'Excludes administrator accounts'],['Active in 30 days',d.active_users_30d,'Planner data updated'],['Subject selections',d.subject_selections,'Across all students'],['O Level subjects',d.o_level_subjects,'Published for students'],['A Level subjects',d.a_level_subjects,'Published for students'],['Official concepts',d.total_official_concepts,'Across the curriculum'],['Completed study sessions',d.concept_completions,'Recorded in student planner history'],['Pending concept suggestions',d.pending_suggestions,'Awaiting administrator review'],['Published notices',d.published_notices,'StudyPilot Noticeboard'],['Learning resources',d.resource_count,'Shared resource library'],['Open feedback',d.open_feedback,'New or reviewing'],['Open support reports',d.open_support_reports,'Open or investigating']];box.innerHTML=items.map(([label,val,note])=>`<div class="metric"><span>${esc(label)}</span><strong>${Number(val||0).toLocaleString()}</strong><small>${esc(note)}</small></div>`).join('')}catch(e){box.innerHTML=`<div class="item">Could not load overview: ${esc(e.message)}</div>`}}
$('#refreshOverview').addEventListener('click',loadOverview);
function parseCSV(text){
 text=String(text||'').replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(quoted){if(c==='"'&&n==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===','){row.push(field.trim());field=''}else if(c==='\n'){row.push(field.trim().replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}else field+=c}
 row.push(field.trim().replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);
 if(!rows.length)return[];const headers=rows.shift().map(h=>h.trim().toLowerCase().replace(/[\s_-]+/g,''));
 return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||'').trim()]))).filter(r=>Object.values(r).some(Boolean));
}
const csvAliases={topic:['topic'],subtopic:['subtopic'],concept:['concept','name'],description:['description'],difficulty:['difficulty'],importance:['importance'],learn_minutes:['learnminutes','learnmin'],review_minutes:['reviewminutes','reviewmin'],practice_minutes:['practiceminutes','practicemin'],target_repetitions:['targetrepetitions','targetreps'],target_questions:['targetquestions']};
function fieldOf(row,key){for(const alias of csvAliases[key]||[key])if(row[alias]!==undefined)return row[alias];return ''}
let pendingCurriculumRows=[];
function fillLevelSubjects(){
 const list=window._spSubjects||[];
 const fill=(id,level)=>{const el=$(id);if(!el)return;const options=list.filter(x=>x.level===level),prior=el.value;el.innerHTML='<option value="">Choose a subject</option>'+options.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');if(options.some(x=>x.id===prior))el.value=prior};
 fill('#manageSubject',$('#manageLevel')?.value||'O Level');
 fill('#bulkSubject',$('#bulkLevel')?.value||'O Level');
 const nsel=$('#noticeSubject');if(nsel){const nl=$('#noticeLevel')?.value||'all',noticeOpts=nl==='all'?list:list.filter(x=>x.level===nl);nsel.innerHTML='<option value="">All subjects / general</option>'+noticeOpts.map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.level)}</option>`).join('')}
}
async function loadSubjects(){
 if(!session)return;
 try{
  const {data,error}=await client.from('curriculum_subjects').select('id,name,level,curriculum,is_published,updated_at').eq('curriculum','UNEB').order('level').order('name');
  if(error)throw error;window._spSubjects=data||[];fillLevelSubjects();
  const list=$('#subjectList');if(list)list.innerHTML=data.length?`<table><thead><tr><th>Subject</th><th>Level</th><th>Status</th><th>Action</th></tr></thead><tbody>${data.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.level)}</td><td>${x.is_published?'Published':'Draft'}</td><td><button class="small-btn" data-publish="${x.id}" data-state="${x.is_published}">${x.is_published?'Unpublish':'Publish'}</button></td></tr>`).join('')}</tbody></table>`:'No O/A Level subjects yet.';
  list?.querySelectorAll('[data-publish]').forEach(b=>b.addEventListener('click',()=>togglePublish(b)));
  const subject=$('#manageSubject');if(subject?.value)await loadCurriculumTree();

 }catch(e){const tree=$('#curriculumTree');if(tree)tree.textContent='Could not load subjects: '+e.message}
}
async function loadCurriculumTree(){
 const subjectId=$('#manageSubject')?.value,el=$('#curriculumTree');if(!el)return;
 if(!subjectId){el.textContent='Choose a subject to view its curriculum.';return}
 el.textContent='Loading curriculum…';
 try{
  const {data:topics,error:te}=await client.from('curriculum_topics').select('id,name,display_order').eq('subject_id',subjectId).order('display_order').order('name');if(te)throw te;
  const tids=(topics||[]).map(x=>x.id);let subs=[];
  if(tids.length){const r=await client.from('curriculum_subtopics').select('id,topic_id,name,display_order').in('topic_id',tids).order('display_order').order('name');if(r.error)throw r.error;subs=r.data||[]}
  const sids=subs.map(x=>x.id);let concepts=[];
  if(sids.length){const r=await client.from('curriculum_concepts').select('id,subtopic_id,name,description').in('subtopic_id',sids).order('display_order').order('name');if(r.error)throw r.error;concepts=r.data||[]}
  if(!topics.length){el.textContent='No topics in this subject yet. Add a concept manually or use Bulk upload.';return}
  el.innerHTML=topics.map(t=>{const children=subs.filter(st=>st.topic_id===t.id);return `<article class="item"><strong>${esc(t.name)}</strong>${children.map(st=>`<div class="curriculum-subitem"><b>${esc(st.name)}</b><ul>${concepts.filter(c=>c.subtopic_id===st.id).map(c=>`<li class="admin-concept-row"><span>${esc(c.name)}</span><span class="small-actions"><button type="button" class="small-btn" data-edit-concept="${c.id}" data-name="${esc(c.name)}" data-description="${esc(c.description||'')}">Edit</button><button type="button" class="small-btn danger" data-delete-concept="${c.id}" data-name="${esc(c.name)}">Delete</button></span></li>`).join('')||'<li class="muted">No concepts</li>'}</ul><button type="button" class="small-btn" data-batch-subtopic="${st.id}" data-topic-name="${esc(t.name)}" data-subtopic-name="${esc(st.name)}">Add concepts here</button></div>`).join('')||'<p class="muted">No subtopics yet.</p>'}</article>`}).join('');
  el.querySelectorAll('[data-edit-concept]').forEach(b=>b.addEventListener('click',async()=>{const name=prompt('Edit concept name:',b.dataset.name);if(name===null)return;const clean=name.trim();if(!clean)return alert('Concept name cannot be empty.');const description=prompt('Edit description (optional):',b.dataset.description||'');if(description===null)return;try{const {error}=await client.from('curriculum_concepts').update({name:clean,description:description.trim()||null,updated_at:new Date().toISOString()}).eq('id',b.dataset.editConcept);if(error)throw error;await loadCurriculumTree()}catch(e){alert('Could not update concept: '+e.message)}}));
  el.querySelectorAll('[data-delete-concept]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm(`Delete the concept “${b.dataset.name}”? Student progress records linked to this concept may no longer display correctly. This cannot be undone.`))return;try{const {error}=await client.from('curriculum_concepts').delete().eq('id',b.dataset.deleteConcept);if(error)throw error;await loadCurriculumTree()}catch(e){alert('Could not delete concept: '+e.message)}}));
  el.querySelectorAll('[data-batch-subtopic]').forEach(b=>b.addEventListener('click',()=>{const names=prompt(`Add concepts under ${b.dataset.topicName} → ${b.dataset.subtopicName}. Enter one concept per line:`);if(names===null)return;addConceptBatch(b.dataset.batchSubtopic,names)}));
 }catch(e){el.textContent='Could not load curriculum: '+e.message}
}
async function addConceptBatch(subtopicId,raw){const names=[...new Set(String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(!names.length)return;try{const {data:existing,error:ee}=await client.from('curriculum_concepts').select('name').eq('subtopic_id',subtopicId);if(ee)throw ee;const seen=new Set((existing||[]).map(x=>x.name.toLowerCase()));const rows=names.filter(n=>!seen.has(n.toLowerCase())).map(name=>({subtopic_id:subtopicId,name}));if(!rows.length){alert('All entered concepts already exist in this subtopic.');return}const {error}=await client.from('curriculum_concepts').insert(rows);if(error)throw error;await loadCurriculumTree();say($('#manualBatchMessage'),`${rows.length} concept(s) added; ${names.length-rows.length} duplicate(s) skipped.`)}catch(e){alert('Could not add concepts: '+e.message)}}
$('#manualConceptBatchForm')?.addEventListener('submit',async e=>{e.preventDefault();const subtopicName=prompt('Enter the exact subtopic name to add these concepts under:');if(!subtopicName)return;const subjectId=$('#manageSubject').value;if(!subjectId){say($('#manualBatchMessage'),'Choose a subject first.',true);return}try{const {data:topics,error:te}=await client.from('curriculum_topics').select('id,name').eq('subject_id',subjectId);if(te)throw te;const topicName=prompt('Enter the exact topic name containing this subtopic:');if(!topicName)return;const topic=(topics||[]).find(t=>t.name.toLowerCase()===topicName.trim().toLowerCase());if(!topic)throw new Error('That topic was not found in the selected subject.');const {data:subs,error:se}=await client.from('curriculum_subtopics').select('id,name').eq('topic_id',topic.id);if(se)throw se;const sub=(subs||[]).find(x=>x.name.toLowerCase()===subtopicName.trim().toLowerCase());if(!sub)throw new Error('That subtopic was not found under the selected topic.');await addConceptBatch(sub.id,$('#manualConceptBatch').value);$('#manualConceptBatch').value=''}catch(err){say($('#manualBatchMessage'),err.message,true)}});
$('#manageLevel')?.addEventListener('change',()=>{fillLevelSubjects();$('#curriculumTree').textContent='Choose a subject to view its curriculum.'});
$('#manageSubject')?.addEventListener('change',loadCurriculumTree);
$('#refreshCurriculum')?.addEventListener('click',loadSubjects);
$('#addSubjectForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const name=$('#newSubjectName').value.trim(),level=$('#manageLevel').value;if(!name)return;
 const btn=e.currentTarget.querySelector('button');btn.disabled=true;
 try{const {error}=await client.from('curriculum_subjects').upsert({curriculum:'UNEB',level,name,is_published:false},{onConflict:'curriculum,level,name'});if(error)throw error;$('#newSubjectName').value='';await loadSubjects();say($('#manualConceptMessage'),`Added ${name} to ${level}. Publish it when it is ready for students.`)}
 catch(err){say($('#manualConceptMessage'),err.message,true)}finally{btn.disabled=false}
});
$('#manualConceptForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const subjectId=$('#manageSubject').value;if(!subjectId){say($('#manualConceptMessage'),'Choose a subject first.',true);return}
 const btn=e.currentTarget.querySelector('button');btn.disabled=true;
 try{
  const topicName=$('#manualTopic').value.trim(),subName=$('#manualSubtopic').value.trim(),conceptName=$('#manualConcept').value.trim();
  const topic=await client.from('curriculum_topics').upsert({subject_id:subjectId,name:topicName},{onConflict:'subject_id,name'}).select('id').single();if(topic.error)throw topic.error;
  const sub=await client.from('curriculum_subtopics').upsert({topic_id:topic.data.id,name:subName},{onConflict:'topic_id,name'}).select('id').single();if(sub.error)throw sub.error;
  const con=await client.from('curriculum_concepts').upsert({subtopic_id:sub.data.id,name:conceptName,description:$('#manualDescription').value.trim()||null},{onConflict:'subtopic_id,name'});if(con.error)throw con.error;
  e.currentTarget.reset();say($('#manualConceptMessage'),'Concept saved to the selected subject.');await loadCurriculumTree();
 }catch(err){say($('#manualConceptMessage'),err.message,true)}finally{btn.disabled=false}
});
$('#previewCsv')?.addEventListener('click',async()=>{
 const file=$('#curriculumFile').files[0],level=$('#bulkLevel').value,subjectId=$('#bulkSubject').value,box=$('#csvPreview');
 pendingCurriculumRows=[];if(!file||!subjectId){box.textContent='Choose a level, subject and CSV file first.';return}
 try{
  const raw=parseCSV(await file.text());if(!raw.length)throw new Error('The CSV is empty.');
  const required=['topic','subtopic'];if(!raw[0].topic||!(raw[0].concept!==undefined||raw[0].name!==undefined))throw new Error('Required headers are Topic, Subtopic and Concept.');
  const errors=[],seen=new Set(),dupes=[];raw.forEach((r,i)=>{const topic=fieldOf(r,'topic'),sub=fieldOf(r,'subtopic'),name=fieldOf(r,'concept');if(!topic||!sub||!name){errors.push(`Row ${i+2}: Topic, Subtopic and Concept must all be filled in.`);return}const k=[topic,sub,name].map(x=>x.toLowerCase()).join('|');if(seen.has(k)){dupes.push(i+2);return}seen.add(k);pendingCurriculumRows.push({topic,subtopic:sub,name,description:fieldOf(r,'description'),difficulty:num(fieldOf(r,'difficulty'),3),importance:num(fieldOf(r,'importance'),3),learn_minutes:num(fieldOf(r,'learn_minutes'),30),review_minutes:num(fieldOf(r,'review_minutes'),15),practice_minutes:num(fieldOf(r,'practice_minutes'),25),target_repetitions:num(fieldOf(r,'target_repetitions'),3),target_questions:num(fieldOf(r,'target_questions'),10)})});
  const subject=window._spSubjects.find(x=>x.id===subjectId);
  if(subject?.level!==level)errors.push('The selected subject does not match the selected academic level.');
  pendingCurriculumRows.forEach((r,i)=>{
    if(!Number.isFinite(r.difficulty)||r.difficulty<1||r.difficulty>5)errors.push(`Concept row ${i+2}: Difficulty must be between 1 and 5.`);
    if(!Number.isFinite(r.importance)||r.importance<1||r.importance>5)errors.push(`Concept row ${i+2}: Importance must be between 1 and 5.`);
    if(!Number.isFinite(r.learn_minutes)||r.learn_minutes<1||!Number.isFinite(r.review_minutes)||r.review_minutes<1||!Number.isFinite(r.practice_minutes)||r.practice_minutes<1)errors.push(`Concept row ${i+2}: learning, review and practice minutes must be positive numbers.`);
    if(!Number.isFinite(r.target_repetitions)||r.target_repetitions<1||!Number.isFinite(r.target_questions)||r.target_questions<0)errors.push(`Concept row ${i+2}: repetition target must be positive and question target cannot be negative.`);
  });
  if(errors.length){box.innerHTML=`<p class="error">${errors.map(esc).join('<br>')}</p>`;pendingCurriculumRows=[];return}
  // Compare against the existing hierarchy before enabling the import button.
  const {data:topics,error:topicErr}=await client.from('curriculum_topics').select('id,name').eq('subject_id',subjectId);if(topicErr)throw topicErr;
  const topicMap=new Map((topics||[]).map(t=>[t.name.toLowerCase(),t.id]));
  const topicIds=[...topicMap.values()];let subtopics=[];
  if(topicIds.length){const q=await client.from('curriculum_subtopics').select('id,topic_id,name').in('topic_id',topicIds);if(q.error)throw q.error;subtopics=q.data||[]}
  const subMap=new Map(subtopics.map(x=>[`${x.topic_id}|${x.name.toLowerCase()}`,x.id]));
  const subIds=[...subMap.values()];let concepts=[];
  if(subIds.length){const q=await client.from('curriculum_concepts').select('subtopic_id,name').in('subtopic_id',subIds);if(q.error)throw q.error;concepts=q.data||[]}
  const existing=new Set();
  concepts.forEach(c=>{const st=subtopics.find(x=>x.id===c.subtopic_id);const topic=topics.find(t=>t.id===st?.topic_id);if(topic&&st)existing.add([topic.name,st.name,c.name].map(x=>x.toLowerCase()).join('|'))});
  let already=0;pendingCurriculumRows.forEach(r=>{const tid=topicMap.get(r.topic.toLowerCase()),sid=tid?subMap.get(`${tid}|${r.subtopic.toLowerCase()}`):null;r.exists=Boolean(sid&&existing.has([r.topic,r.subtopic,r.name].map(x=>x.toLowerCase()).join('|')));if(r.exists)already++});
  box.innerHTML=`<p><strong>${pendingCurriculumRows.length} valid rows for ${esc(subject.name)} (${esc(level)}).</strong> ${already} already exist and ${dupes.length} repeated row(s) inside the CSV will be skipped.</p><div class="table-wrap"><table><thead><tr><th>Topic</th><th>Subtopic</th><th>Concept</th><th>Check</th></tr></thead><tbody>${pendingCurriculumRows.slice(0,50).map(r=>`<tr><td>${esc(r.topic)}</td><td>${esc(r.subtopic)}</td><td>${esc(r.name)}</td><td>${r.exists?'Already exists':'New'}</td></tr>`).join('')}</tbody></table></div><button id="commitCsv" class="primary" type="button">Import ${pendingCurriculumRows.length-already} new concepts</button>`;
  if(dupes.length)box.insertAdjacentHTML('beforeend',`<p class="muted">Repeated rows within the CSV skipped: ${dupes.join(', ')}.</p>`);
 }catch(err){box.textContent=err.message}
});
$('#csvPreview')?.addEventListener('click',async e=>{
 if(e.target.id!=='commitCsv')return;const btn=e.target,subjectId=$('#bulkSubject').value;btn.disabled=true;say($('#importMessage'),'Importing curriculum…');
 try{
  let added=0,duplicates=0;
  for(const r of pendingCurriculumRows){
   if(r.exists){duplicates++;continue}
   const tr=await client.from('curriculum_topics').upsert({subject_id:subjectId,name:r.topic},{onConflict:'subject_id,name'}).select('id').single();if(tr.error)throw tr.error;
   const sr=await client.from('curriculum_subtopics').upsert({topic_id:tr.data.id,name:r.subtopic},{onConflict:'topic_id,name'}).select('id').single();if(sr.error)throw sr.error;
   const existing=await client.from('curriculum_concepts').select('id').eq('subtopic_id',sr.data.id).eq('name',r.name).maybeSingle();if(existing.error)throw existing.error;
   if(existing.data){duplicates++;continue}
   const cr=await client.from('curriculum_concepts').insert({subtopic_id:sr.data.id,name:r.name,description:r.description||null,difficulty:r.difficulty,importance:r.importance,learn_minutes:r.learn_minutes,review_minutes:r.review_minutes,practice_minutes:r.practice_minutes,target_repetitions:r.target_repetitions,target_questions:r.target_questions});if(cr.error)throw cr.error;added++;
  }
  await rpc('studypilot_admin_log',{p_action:'curriculum_csv_import',p_target_type:'curriculum_subject',p_target_id:subjectId,p_details:{added,duplicates,level:$('#bulkLevel').value}});
  say($('#importMessage'),`Import complete: ${added} new concepts added; ${duplicates} existing concepts skipped. The subject remains unpublished until you publish it.`);
  pendingCurriculumRows=[];$('#csvPreview').innerHTML='';$('#curriculumFile').value='';await loadCurriculumTree();
 }catch(err){say($('#importMessage'),`Import stopped: ${err.message}. Rows saved before a connection error remain safe; re-importing will skip existing concepts.`,true)}finally{btn.disabled=false}
});
$('#bulkLevel')?.addEventListener('change',()=>{fillLevelSubjects();$('#bulkSubject').value=''});
$('#bulkSubject')?.addEventListener('focus',()=>{fillLevelSubjects()});
$('#noticeLevel')?.addEventListener('change',()=>{const lvl=$('#noticeLevel').value;const el=$('#noticeSubject');if(!el)return;const opts=lvl==='all'?window._spSubjects:window._spSubjects.filter(x=>x.level===lvl);el.innerHTML='<option value="">All subjects / general</option>'+opts.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')});
async function togglePublish(btn){btn.disabled=true;try{const id=btn.dataset.publish,next=btn.dataset.state!=='true';const {error}=await client.from('curriculum_subjects').update({is_published:next,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await rpc('studypilot_admin_log',{p_action:next?'publish_subject':'unpublish_subject',p_target_type:'curriculum_subject',p_target_id:id,p_details:{published:next}});await loadSubjects()}catch(e){alert('Could not update subject: '+e.message)}finally{btn.disabled=false}}

async function loadUsers(){const el=$('#usersList');el.textContent='Loading student accounts…';try{const [rowsResult,profilesResult]=await Promise.all([rpc('studypilot_admin_users',{p_limit:250}),client.from('student_academic_profiles').select('user_id,academic_level')]);if(profilesResult.error)throw profilesResult.error;const levels=new Map((profilesResult.data||[]).map(p=>[p.user_id,p.academic_level]));const rows=rowsResult;el.innerHTML=rows.length?`<table><thead><tr><th>Student</th><th>Email</th><th>Academic level</th><th>Registered</th><th>Last sign in</th><th>Planner updated</th><th>Concepts</th><th>Sessions</th><th>Completed</th><th>Subjects</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${esc(u.display_name||'—')}</td><td>${esc(u.email)}</td><td>${esc(levels.get(u.user_id)||'Not selected')}</td><td>${date(u.registered_at)}</td><td>${date(u.last_sign_in_at)}</td><td>${date(u.planner_updated_at)}</td><td>${Number(u.concepts_count||0)}</td><td>${Number(u.session_count||0)}</td><td>${Number(u.completed_sessions||0)}</td><td>${Number(u.selected_subjects_count||0)}</td></tr>`).join('')}</tbody></table>`:'No student accounts found.'}catch(e){el.textContent='Could not load accounts: '+e.message}}
$('#loadUsers').addEventListener('click',loadUsers);
function date(v){return v?new Date(v).toLocaleString():'—'}
async function loadFeedback(){const el=$('#feedbackList');el.textContent='Loading feedback…';try{const {data,error}=await client.from('studypilot_feedback').select('id,user_id,category,rating,message,status,admin_response,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;el.innerHTML=data.length?data.map(f=>`<article class="item"><div class="item-head"><strong>${esc(f.category.replace('_',' '))}${f.rating?` · ${f.rating}/5`:''}</strong><span class="muted">${date(f.created_at)}</span></div><p>${esc(f.message)}</p><div class="row-actions"><select data-feedback-status="${f.id}">${['new','reviewing','resolved','closed'].map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="small-btn" data-feedback-save="${f.id}">Save status & response</button></div><label class="muted">Administrator response<textarea data-feedback-response="${f.id}" rows="2" maxlength="3000" style="display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #dce2eb;border-radius:8px">${esc(f.admin_response||'')}</textarea></label></article>`).join(''):'No feedback received yet.';el.querySelectorAll('[data-feedback-save]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.feedbackSave,status=el.querySelector(`[data-feedback-status="${id}"]`).value,admin_response=el.querySelector(`[data-feedback-response="${id}"]`).value.trim();try{const {error}=await client.from('studypilot_feedback').update({status,admin_response,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await rpc('studypilot_admin_log',{p_action:'update_feedback_status',p_target_type:'feedback',p_target_id:id,p_details:{status}});await loadFeedback()}catch(e){alert(e.message)}}))}catch(e){el.textContent='Could not load feedback: '+e.message}}
$('#loadFeedback').addEventListener('click',loadFeedback);
async function loadSupport(){const el=$('#supportList');el.textContent='Loading support reports…';try{const {data,error}=await client.from('studypilot_support_reports').select('id,user_id,category,user_message,diagnostic_code,app_version,page_name,status,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;el.innerHTML=data.length?data.map(r=>`<article class="item"><div class="item-head"><strong>${esc(r.category)}</strong><span class="muted">${date(r.created_at)}</span></div><p>${esc(r.user_message)}</p><div class="muted">Diagnostic: ${esc(r.diagnostic_code||'—')} · Version: ${esc(r.app_version||'—')} · Page: ${esc(r.page_name||'—')}</div><div class="row-actions" style="margin-top:10px"><select data-support-status="${r.id}">${['open','investigating','resolved','closed'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="small-btn" data-support-save="${r.id}">Update status</button></div></article>`).join(''):'No support reports received.';el.querySelectorAll('[data-support-save]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.supportSave,status=el.querySelector(`[data-support-status="${id}"]`).value;try{const {error}=await client.from('studypilot_support_reports').update({status,resolved_at:status==='resolved'?new Date().toISOString():null}).eq('id',id);if(error)throw error;await rpc('studypilot_admin_log',{p_action:'update_support_status',p_target_type:'support_report',p_target_id:id,p_details:{status}});await loadSupport()}catch(e){alert(e.message)}}))}catch(e){el.textContent='Could not load reports: '+e.message}}
$('#loadSupport').addEventListener('click',loadSupport);

async function loadSuggestions(){
 const el=$('#suggestionsList');if(!el||!session)return;el.textContent='Loading concept suggestions…';
 try{
  const {data,error}=await client.from('studypilot_concept_suggestions').select('*').order('created_at',{ascending:false}).limit(200);if(error)throw error;
  el.innerHTML=data.length?data.map(x=>`<article class="item"><div class="item-head"><strong>${esc(x.concept_name)}</strong><span class="status">${esc(x.status)}</span></div><p class="muted">${esc(x.academic_level)} · ${esc(x.subject_name)} · ${esc(x.topic_name)}${x.subtopic_name?' · '+esc(x.subtopic_name):''}</p><p>${esc(x.description||'No description supplied.')}</p><small class="muted">Student account: ${esc(x.user_id)} · ${date(x.created_at)}</small><div class="row-actions"><select data-suggestion-status="${x.id}">${['pending','reviewing','approved','declined'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select><button class="small-btn" data-suggestion-save="${x.id}">Save status</button>${x.status!=='approved'?`<button class="small-btn" data-suggestion-approve="${x.id}">Approve into curriculum</button>`:''}</div></article>`).join(''):'No student concept suggestions yet.';
  el.querySelectorAll('[data-suggestion-save]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.suggestionSave,status=el.querySelector(`[data-suggestion-status="${id}"]`).value;try{const {error}=await client.from('studypilot_concept_suggestions').update({status,reviewed_at:['approved','declined'].includes(status)?new Date().toISOString():null}).eq('id',id);if(error)throw error;await loadSuggestions()}catch(e){alert(e.message)}}));
  el.querySelectorAll('[data-suggestion-approve]').forEach(b=>b.addEventListener('click',async()=>{const item=data.find(x=>x.id===b.dataset.suggestionApprove);b.disabled=true;try{
    const {data:subj,error:se}=await client.from('curriculum_subjects').select('id').eq('curriculum','UNEB').eq('level',item.academic_level).ilike('name',item.subject_name).maybeSingle();if(se)throw se;if(!subj)throw new Error('Create the matching subject in Curriculum Management before approving this suggestion.');
    const topic=await client.from('curriculum_topics').upsert({subject_id:subj.id,name:item.topic_name},{onConflict:'subject_id,name'}).select('id').single();if(topic.error)throw topic.error;
    const sub=await client.from('curriculum_subtopics').upsert({topic_id:topic.data.id,name:item.subtopic_name||'General'},{onConflict:'topic_id,name'}).select('id').single();if(sub.error)throw sub.error;
    const con=await client.from('curriculum_concepts').upsert({subtopic_id:sub.data.id,name:item.concept_name,description:item.description||null},{onConflict:'subtopic_id,name'});if(con.error)throw con.error;
    const upd=await client.from('studypilot_concept_suggestions').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',item.id);if(upd.error)throw upd.error;
    await rpc('studypilot_admin_log',{p_action:'approve_concept_suggestion',p_target_type:'concept_suggestion',p_target_id:item.id,p_details:{subject:item.subject_name,level:item.academic_level}});
    await loadSuggestions();await loadSubjects();
   }catch(e){alert('Could not approve suggestion: '+e.message)}finally{b.disabled=false}}));
 }catch(e){el.textContent='Could not load suggestions: '+e.message}
}
$('#loadSuggestions')?.addEventListener('click',loadSuggestions);

async function loadNotices(){
 const el=$('#noticesList');if(!el||!session)return;el.textContent='Loading notices…';
 try{
  const {data,error}=await client.from('studypilot_notices').select('*').order('created_at',{ascending:false}).limit(200);if(error)throw error;
  el.innerHTML=data.length?data.map(n=>`<article class="item"><div class="item-head"><strong>${esc(n.title)}</strong><span class="status ${n.is_published?'published':''}">${n.is_published?'Published':'Draft'}</span></div><p class="muted">${esc((n.category||'announcement').replace(/_/g,' '))} · ${esc(n.target_level==='all'?'All students':n.target_level)}${n.target_subject_id?' · Subject-specific':''} · ${date(n.created_at)}</p><p>${esc(n.body)}</p><button class="small-btn" data-notice-toggle="${n.id}" data-state="${n.is_published}">${n.is_published?'Unpublish':'Publish'}</button></article>`).join(''):'No notices have been created.';
  el.querySelectorAll('[data-notice-toggle]').forEach(b=>b.addEventListener('click',async()=>{const next=b.dataset.state!=='true';try{const {error}=await client.from('studypilot_notices').update({is_published:next,published_at:next?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',b.dataset.noticeToggle);if(error)throw error;await loadNotices()}catch(e){alert(e.message)}}));
 }catch(e){el.textContent='Could not load notices: '+e.message}
}
$('#loadNotices')?.addEventListener('click',loadNotices);
$('#noticeForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;say($('#noticeMessage'),'Publishing notice…');
 try{const target=$('#noticeLevel').value,subject=$('#noticeSubject').value||null;if(subject){const match=window._spSubjects.find(x=>x.id===subject);if(!match||(target!=='all'&&match.level!==target))throw new Error('The selected subject does not match the selected audience level.')}
  const {error}=await client.from('studypilot_notices').insert({title:$('#noticeTitle').value.trim(),body:$('#noticeBody').value.trim(),category:$('#noticeCategory').value,target_level:target,target_subject_id:subject,is_published:true,created_by:session.id,published_at:new Date().toISOString()});if(error)throw error;
  e.currentTarget.reset();say($('#noticeMessage'),'Notice published. Eligible students will see it in their StudyPilot Noticeboard.');await loadNotices();
 }catch(err){const msg=err.message||'Unknown error';say($('#noticeMessage'),/studypilot_notices|schema cache|does not exist/i.test(msg)?'Noticeboard database setup is missing or incomplete. Run the V4.1 Supabase migration, then refresh this page. Details: '+msg:msg,true)}finally{btn.disabled=false}
});
async function loadResources(){
 const el=$('#resourcesList');if(!el||!session)return;el.textContent='Loading resources…';
 try{const {data,error}=await client.from('resources').select('id,title,category,description,file_url,author,level,created_at').order('created_at',{ascending:false}).limit(250);if(error)throw error;
  el.innerHTML=data.length?`<table><thead><tr><th>Resource</th><th>Category</th><th>Level</th><th>Author</th><th>Link</th></tr></thead><tbody>${data.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.category||'—')}</td><td>${esc(r.level||'—')}</td><td>${esc(r.author||'—')}</td><td>${/^https?:\/\//i.test(r.file_url||'')?`<a href="${esc(r.file_url)}" target="_blank" rel="noopener">Open</a>`:'—'}</td></tr>`).join('')}</tbody></table>`:'No resources available.';
 }catch(e){el.textContent='Could not load resources: '+e.message}
}
$('#loadResources')?.addEventListener('click',loadResources);
$('#resourceForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;say($('#resourceMessage'),'Saving resource…');
 try{const title=$('#resourceTitle').value.trim(),url=$('#resourceUrl').value.trim();if(!/^https?:\/\//i.test(url))throw new Error('Resource links must begin with https:// or http://');const {error}=await client.from('resources').insert({title,category:$('#resourceCategory').value.trim(),description:$('#resourceDescription').value.trim()||null,file_url:url,author:$('#resourceAuthor').value.trim()||null,doi:$('#resourceDoi').value.trim()||null,level:$('#resourceLevel').value.trim()||'All'});if(error)throw error;e.currentTarget.reset();say($('#resourceMessage'),'Resource added to the library.');await loadResources();await rpc('studypilot_admin_log',{p_action:'add_resource',p_target_type:'resource',p_target_id:title,p_details:{}})}
 catch(err){say($('#resourceMessage'),err.message,true)}finally{btn.disabled=false}
});

async function loadAudit(){const el=$('#auditList');el.textContent='Loading audit log…';try{const {data,error}=await client.from('studypilot_admin_audit').select('id,admin_user_id,action,target_type,target_id,details,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;el.innerHTML=data.length?`<table><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>${data.map(a=>`<tr><td>${date(a.created_at)}</td><td>${esc(a.action)}</td><td>${esc(a.target_type||'')} ${esc(a.target_id||'')}</td><td>${esc(JSON.stringify(a.details||{}))}</td></tr>`).join('')}</tbody></table>`:'No audit records yet.'}catch(e){el.textContent='Could not load audit log: '+e.message}}
$('#loadAudit').addEventListener('click',loadAudit);
init();
})();