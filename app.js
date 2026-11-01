

const titles={dashboard:"Dashboard",enrollment:"New Enrollment",records:"Enrollment Records",trash:"Trash",print:"Print",logs:"Activity Logs",settings:"System Settings",users:"User Management",census:"Enrollment Census",logout:"Logout"};
const SESSION_KEY="tnhsCesSession",RECORDS_KEY="tnhsEnrollmentRecords",LOGS_KEY="tnhsActivityLogs",ACCOUNT_KEY="tnhsAdminAccount";
const DEFAULT_ACCOUNT={username:"tnhs.enrollment.admin@gmail.com",displayName:"TNHS Enrollment Admin"};
const SUPABASE_URL="https://yzmgiabfrapdjllhjfwe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_YDD0oNYQyCXur28qevC_qA_602uluWy";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let currentAuthUser=null;
let currentProfile=null;
const ROLE_LABELS={administrator:"Administrator",registrar:"Registrar",enrollment_staff:"Enrollment Staff",read_only:"Read-only"};
function canWrite(){return !!currentProfile&&["administrator","registrar","enrollment_staff"].includes(currentProfile.role)}
function canManageTrash(){return !!currentProfile&&["administrator","registrar","enrollment_staff"].includes(currentProfile.role)}
function canViewLogs(){return !!currentProfile&&["administrator","registrar"].includes(currentProfile.role)}
function canManageUsers(){return !!currentProfile&&currentProfile.role==="administrator"}
async function loadCurrentProfile(){if(!currentAuthUser)throw new Error("No authenticated account.");const {data,error}=await supabaseClient.from("user_profiles").select("user_id,display_name,role,is_active").eq("user_id",currentAuthUser.id).maybeSingle();if(error)throw error;if(!data||!data.is_active)throw new Error("This account has not been authorized for the TNHS enrollment system. Contact the system administrator.");currentProfile=data;}
const loginScreen=document.getElementById("loginScreen"),appShell=document.querySelector(".app");
const loginForm=document.getElementById("loginForm"),loginError=document.getElementById("loginError"),usernameInput=document.getElementById("username"),passwordInput=document.getElementById("password"),rememberMe=document.getElementById("rememberMe"),togglePassword=document.getElementById("togglePassword");
const enrollmentForm=document.getElementById("enrollmentForm");
let currentStep=1,lastSavedRecord=null,currentRecordId=null;
let recordsCurrentPage=1;

let selectedStudentPhoto=null, selectedStudentPhotoUrl="", currentPhotoPath="";
const photoUrlCache=new Map();
async function getStudentPhotoUrl(path){if(!path)return "";const cached=photoUrlCache.get(path);if(cached&&cached.expires>Date.now()+30000)return cached.url;const {data,error}=await supabaseClient.storage.from("student-photos").createSignedUrl(path,300);if(error)throw error;photoUrlCache.set(path,{url:data.signedUrl,expires:Date.now()+270000});return data.signedUrl;}
function photoMarkup(url,cls="student-photo-thumb"){return url?`<img class="${cls}" src="${esc(url)}" alt="Student photo">`:`<div class="${cls} photo-empty">No photo</div>`;}
let recordsCache=[];
let logsCache=[];
function getRecords(){return recordsCache}
function getActiveRecords(){return recordsCache.filter(r=>!r.deletedAt)}
function getTrashRecords(){return recordsCache.filter(r=>!!r.deletedAt)}
function getAccount(){return {...DEFAULT_ACCOUNT}}
function setAccount(v){}
function currentUser(){return currentProfile?.display_name||currentAuthUser?.email||DEFAULT_ACCOUNT.username}
function getLogs(){return logsCache}
function normalizeBool(v){return v===true||v==="Yes"}
function rowToRecord(r){return {
  recordId:r.record_id,photoPath:r.student_photo_path||"",status:r.status,createdAt:r.created_at,updatedAt:r.updated_at,createdBy:r.created_by_display_name||"—",deletedAt:r.deleted_at||null,
  schoolYear:r.school_year,gradeLevel:r.grade_level,sectionName:r.section_name||"",psa:r.psa_birth_certificate_no||"",lrn:r.lrn,lastName:r.last_name||"",firstName:r.first_name||"",middleName:r.middle_name||"",extensionName:r.extension_name||"",birthdate:r.birthdate,placeOfBirth:r.place_of_birth||"",
  currentAddress:{house:r.current_house_no_street||"",street:r.current_street_name||"",barangay:r.current_barangay||"",municipality:r.current_municipality_city||"",province:r.current_province||"",zip:r.current_zip_code||"",country:r.current_country||""},
  permanentAddressSame:r.permanent_same_as_current?"Yes":"No",permanentAddress:{house:r.permanent_house_no_street||"",street:r.permanent_street_name||"",barangay:r.permanent_barangay||"",municipality:r.permanent_municipality_city||"",province:r.permanent_province||"",zip:r.permanent_zip_code||""},
  father:{last:r.father_last_name||"",first:r.father_first_name||"",middle:r.father_middle_name||"",contact:r.father_contact_number||"",notProvided:!!r.father_not_provided},
  mother:{last:r.mother_last_name||"",first:r.mother_first_name||"",middle:r.mother_middle_name||"",contact:r.mother_contact_number||"",notProvided:!!r.mother_not_provided},
  age:r.age==null?"":String(r.age),motherTongue:r.mother_tongue||"",with:r.with_information==null?"":(r.with_information?"Yes":"No"),returning:r.returning_balik_aral==null?"":(r.returning_balik_aral?"Yes":"No"),sex:r.sex||"",ipCommunity:r.ip_community==null?"":(r.ip_community?"Yes":"No"),ipSpecification:r.ip_specification||"",fourPs:r.four_ps_beneficiary==null?"":(r.four_ps_beneficiary?"Yes":"No"),fourPsHouseholdId:r.four_ps_household_id||"",
  guardian:{last:r.guardian_last_name||"",first:r.guardian_first_name||"",middle:r.guardian_middle_name||"",contact:r.guardian_contact_number||""},lastGradeCompleted:r.shs_last_grade_level_completed||"",lastSchoolYear:r.shs_last_school_year_completed||"",lastSchoolAttended:r.shs_last_school_attended||"",schoolId:r.shs_school_id||"",semester:r.shs_semester||"",track:r.shs_track||"",strand:r.shs_strand||"",parentGuardianPrintedName:r.parent_guardian_printed_name||"",certificationDate:r.certification_date||"",modalities:r.learning_modalities||[]
}}
function recordToRow(r,createdById=null){return {record_id:r.recordId,student_photo_path:r.photoPath||null,school_year:r.schoolYear,grade_level:r.gradeLevel,section_name:r.sectionName||null,lrn:r.lrn,psa_birth_certificate_no:r.psa||null,last_name:r.lastName||null,first_name:r.firstName||null,middle_name:r.middleName||null,extension_name:r.extensionName||null,birthdate:r.birthdate,place_of_birth:r.placeOfBirth||null,age:r.age?Number(r.age):null,mother_tongue:r.motherTongue||null,sex:r.sex||null,with_information:r.with?normalizeBool(r.with):null,returning_balik_aral:r.returning?normalizeBool(r.returning):null,ip_community:r.ipCommunity?normalizeBool(r.ipCommunity):null,ip_specification:r.ipSpecification||null,four_ps_beneficiary:r.fourPs?normalizeBool(r.fourPs):null,four_ps_household_id:r.fourPsHouseholdId||null,current_house_no_street:r.currentAddress?.house||null,current_street_name:r.currentAddress?.street||null,current_barangay:r.currentAddress?.barangay||null,current_municipality_city:r.currentAddress?.municipality||null,current_province:r.currentAddress?.province||null,current_zip_code:r.currentAddress?.zip||null,current_country:r.currentAddress?.country||null,permanent_same_as_current:r.permanentAddressSame==="Yes",permanent_house_no_street:r.permanentAddress?.house||null,permanent_street_name:r.permanentAddress?.street||null,permanent_barangay:r.permanentAddress?.barangay||null,permanent_municipality_city:r.permanentAddress?.municipality||null,permanent_province:r.permanentAddress?.province||null,permanent_zip_code:r.permanentAddress?.zip||null,father_last_name:r.father?.last||null,father_first_name:r.father?.first||null,father_middle_name:r.father?.middle||null,father_contact_number:r.father?.contact||null,father_not_provided:!!r.father?.notProvided,mother_last_name:r.mother?.last||null,mother_first_name:r.mother?.first||null,mother_middle_name:r.mother?.middle||null,mother_contact_number:r.mother?.contact||null,mother_not_provided:!!r.mother?.notProvided,guardian_last_name:r.guardian?.last||null,guardian_first_name:r.guardian?.first||null,guardian_middle_name:r.guardian?.middle||null,guardian_contact_number:r.guardian?.contact||null,shs_last_grade_level_completed:r.lastGradeCompleted||null,shs_last_school_year_completed:r.lastSchoolYear||null,shs_last_school_attended:r.lastSchoolAttended||null,shs_school_id:r.schoolId||null,shs_semester:r.semester||null,shs_track:r.track||null,shs_strand:r.strand||null,learning_modalities:r.modalities||[],parent_guardian_printed_name:r.parentGuardianPrintedName||null,certification_date:r.certificationDate||null,status:r.status||"Active",created_by:createdById||null};}
async function loadRemoteData(){const jobs=[supabaseClient.from("enrollment_records").select("*").order("updated_at",{ascending:false})];if(canViewLogs()){jobs.push(supabaseClient.from("activity_logs").select("*").order("created_at",{ascending:false}));jobs.push(supabaseClient.from("enrollment_change_history").select("record_id,actor_display_name,change_type,changed_fields,changed_at").order("changed_at",{ascending:false}).limit(500));}const results=await Promise.all(jobs);const recordsResult=results[0],logsResult=results[1],historyResult=results[2];if(recordsResult.error)throw recordsResult.error;if(logsResult?.error)throw logsResult.error;if(historyResult?.error)throw historyResult.error;recordsCache=recordsResult.data.map(rowToRecord);const actionLogs=logsResult?.data?.map(x=>({timestamp:x.created_at,user:x.user_display_name||"—",action:x.action,recordId:x.record_id||"—",details:x.details||""}))||[];const changeLogs=historyResult?.data?.map(x=>({timestamp:x.changed_at,user:x.actor_display_name||"—",action:`Record ${x.change_type.replaceAll("_"," ")}`,recordId:x.record_id||"—",details:(x.changed_fields||[]).join(", ")}))||[];logsCache=[...actionLogs,...changeLogs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));}
async function insertActivity(action,recordId,details=""){const {error}=await supabaseClient.from("activity_logs").insert({record_id:recordId||null,action,user_display_name:currentUser(),details:details||null});if(error)throw error;logsCache.unshift({timestamp:new Date().toISOString(),user:currentUser(),action,recordId:recordId||"—",details});}
async function insertEnrollment(record){const row=recordToRow(record,currentAuthUser?.id||null);const {data,error}=await supabaseClient.from("enrollment_records").insert(row).select("*").single();if(error)throw error;const saved=rowToRecord(data);recordsCache.unshift(saved);return saved;}
async function updateEnrollment(recordId,record,expectedUpdatedAt){const row=recordToRow(record,currentAuthUser?.id||null);delete row.record_id;delete row.created_by;let query=supabaseClient.from("enrollment_records").update({...row,updated_at:new Date().toISOString()}).eq("record_id",recordId);if(expectedUpdatedAt)query=query.eq("updated_at",expectedUpdatedAt);const {data,error}=await query.select("*").maybeSingle();if(error)throw error;if(!data){const conflict=new Error("This record was changed by another user after you opened it. Your changes were not saved. Reload the record and try again.");conflict.code="CONCURRENT_EDIT";throw conflict;}const saved=rowToRecord(data);const i=recordsCache.findIndex(x=>x.recordId===recordId);if(i>=0)recordsCache[i]=saved;return saved;}
async function updateDeletedAt(recordId,deletedAt,expectedUpdatedAt){let query=supabaseClient.from("enrollment_records").update({deleted_at:deletedAt,status:"Active"}).eq("record_id",recordId);if(expectedUpdatedAt)query=query.eq("updated_at",expectedUpdatedAt);const {data,error}=await query.select("*").maybeSingle();if(error)throw error;if(!data){const conflict=new Error("This record changed after you opened it. No changes were made. Refresh the records list and try again.");conflict.code="CONCURRENT_EDIT";throw conflict;}const saved=rowToRecord(data);const i=recordsCache.findIndex(x=>x.recordId===recordId);if(i>=0)recordsCache[i]=saved;return saved;}
function formatTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString([],{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}
function formatDate(v){if(!v)return"—";const d=new Date(v+"T00:00:00");return Number.isNaN(d.getTime())?v:d.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}
function actionClass(a){a=(a||"").toLowerCase();return a.includes("created")?"created":a.includes("updated")?"updated":a.includes("generated")||a.includes("printed")?"printed":""}
function updateDashboard(){const r=getActiveRecords(),l=getLogs(),g11=r.filter(x=>String(x.gradeLevel||"")==="11").length,g12=r.filter(x=>String(x.gradeLevel||"")==="12").length,total=g11+g12;document.getElementById("totalRecords").textContent=r.length;document.getElementById("grade11Count").textContent=g11;document.getElementById("grade12Count").textContent=g12;const distributionTotal=document.getElementById("distributionTotal");if(distributionTotal)distributionTotal.textContent=total;const p11=total?Math.round(g11/total*100):0,p12=total?Math.round(g12/total*100):0;document.getElementById("grade11Percent").textContent=p11+"%";document.getElementById("grade12Percent").textContent=p12+"%";document.getElementById("grade11Bar").style.width=p11+"%";document.getElementById("grade12Bar").style.width=p12+"%";document.getElementById("distributionEmpty").style.display=total?"none":"flex";const cutoff=Date.now()-24*60*60*1000;const recent=l.filter(x=>{const t=new Date(x.timestamp||0).getTime();return Number.isFinite(t)&&t>=cutoff}).sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0)).slice(0,6);document.getElementById("recentActivityBody").innerHTML=recent.length?recent.map(x=>`<tr><td><span class="activity-badge ${actionClass(x.action)}">${esc(x.action||"Activity")}</span></td><td>${esc(x.recordId||"—")}</td><td>${formatTime(x.timestamp)}</td></tr>`).join(""):'<tr><td class="empty" colspan="3">No activity yet.</td></tr>'}
function resetModuleViews(){document.getElementById("recordsListView").style.display="block";document.getElementById("individualRecordView").style.display="none";document.getElementById("editRecordView").style.display="none"}
function showPage(id){if(id==="enrollment"&&!canWrite()){showToast("Your account has view-only access.");return}if(id==="trash"&&!canManageTrash()){showToast("Your account cannot manage Trash.");return}if(id==="logs"&&!canViewLogs()){showToast("Activity Logs are available to administrators and registrars.");return}if(id==="users"&&!canManageUsers()){showToast("User Management is available to administrators only.");return}document.querySelectorAll(".screen,.placeholder").forEach(x=>x.style.display=x.id===id?"block":"none");const recordsList=document.getElementById("recordsListView"),individual=document.getElementById("individualRecordView"),edit=document.getElementById("editRecordView");if(recordsList)recordsList.style.display=id==="records"?"block":"none";if(individual&&id!=="records")individual.style.display="none";if(edit&&id!=="records")edit.style.display="none";document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===id));document.querySelectorAll(".sidebar .nav[data-page]").forEach(x=>{if(x.dataset.page===id)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current")});document.getElementById("title").textContent=titles[id]||"Dashboard";if(id==="dashboard")updateDashboard();if(id==="census")renderCensus();if(id==="records"){resetModuleViews();renderRecords()}if(id==="trash"){renderTrash()}if(id==="print"){populatePrintRecords();renderSelectedPrint()}if(id==="logs")renderLogs();if(id==="users")renderUsers();if(id==="settings")renderSettings();if(id==="enrollment"){if(document.getElementById("saveSuccessView")?.style.display!=="none")resetEnrollment();showEnrollmentMode("form")}}
function setLoggedIn(u){const name=currentProfile?.display_name||u;loginScreen.style.display="none";appShell.style.display="flex";document.querySelector(".avatar").textContent=name.charAt(0).toUpperCase();const userName=document.querySelector(".user-name");if(userName)userName.textContent=name;const roleLabel=document.getElementById("userRoleLabel");if(roleLabel)roleLabel.textContent=ROLE_LABELS[currentProfile?.role]||"Unassigned";document.querySelectorAll('[data-page="enrollment"],#dashboardNewEnrollmentAction').forEach(el=>el.hidden=!canWrite());document.querySelectorAll('[data-page="trash"]').forEach(el=>el.hidden=!canManageTrash());document.querySelectorAll('[data-page="logs"]').forEach(el=>el.hidden=!canViewLogs());document.querySelectorAll('[data-page="users"]').forEach(el=>el.hidden=!canManageUsers());showPage("dashboard")}
function setLoggedOut(){currentProfile=null;currentAuthUser=null;localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);loginScreen.style.display="grid";appShell.style.display="none";usernameInput.value="";passwordInput.value="";rememberMe.checked=readRememberSetting();loginError.style.display="none"}
function saveSession(u){const p=JSON.stringify({username:u,loggedInAt:new Date().toISOString()});if(rememberMe.checked){localStorage.setItem(SESSION_KEY,p);sessionStorage.removeItem(SESSION_KEY)}else{sessionStorage.setItem(SESSION_KEY,p);localStorage.removeItem(SESSION_KEY)}}
function readSession(){try{const raw=localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw):null}catch{return null}}
loginForm.addEventListener("submit",async e=>{e.preventDefault();const u=usernameInput.value.trim(),p=passwordInput.value;loginError.style.display="none";try{const {data,error}=await supabaseClient.auth.signInWithPassword({email:u,password:p});if(error)throw error;saveSession(u);await activateSession(data.user)}catch(err){loginError.textContent="Invalid email or password.";loginError.style.display="block";passwordInput.focus()}});
togglePassword.addEventListener("click",()=>{const v=passwordInput.type==="text";passwordInput.type=v?"password":"text";togglePassword.textContent=v?"Show":"Hide"});
function setMobileNav(open){const shell=document.querySelector(".app"),toggle=document.getElementById("menuToggle"),scrim=document.getElementById("sidebarScrim");if(!shell||!toggle||!scrim)return;shell.classList.toggle("nav-open",open);toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"Close navigation menu":"Open navigation menu");scrim.hidden=!open;document.body.classList.toggle("nav-lock",open)}
document.getElementById("menuToggle")?.addEventListener("click",()=>setMobileNav(!document.querySelector(".app")?.classList.contains("nav-open")));
document.getElementById("sidebarScrim")?.addEventListener("click",()=>setMobileNav(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape")setMobileNav(false)});
document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",async()=>{const p=el.dataset.page;if(window.matchMedia("(max-width: 700px)").matches)setMobileNav(false);if(p==="logout"){await supabaseClient.auth.signOut();setLoggedOut();return}showPage(p)}));
document.getElementById("dashboardSearchBtn").addEventListener("click",()=>{const q=document.getElementById("dashboardSearch").value.trim();if(q){document.getElementById("recordsSearch").value=q;showPage("records")}else showPage("records")});
document.getElementById("dashboardSearch").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("dashboardSearchBtn").click()});
document.getElementById("dashboardSearchAction").addEventListener("click",()=>showPage("records"));document.getElementById("dashboardNewEnrollmentAction").addEventListener("click",()=>{resetEnrollment();showPage("enrollment")});document.getElementById("dashboardViewRecordsAction").addEventListener("click",()=>showPage("records"));document.getElementById("dashboardPrintAction").addEventListener("click",()=>showPage("print"));

function setFieldInvalid(id,on){const el=document.getElementById(id);if(!el)return;el.closest(".form-field")?.classList.toggle("invalid",on)}
function validateStep(step){let ok=true;const req=step===1?["schoolYear","gradeLevel","lrn","birthdate"]:[];req.forEach(id=>{const e=document.getElementById(id),bad=!e||!String(e.value).trim();setFieldInvalid(id,bad);if(bad)ok=false});if(step===1&&document.getElementById("lrn").value.trim()&&!/^\d{12}$/.test(document.getElementById("lrn").value.trim())){setFieldInvalid("lrn",true);ok=false}if(step===3){["fatherContact","motherContact","guardianContact"].forEach(id=>{const e=document.getElementById(id);if(!e||e.disabled)return;const v=String(e.value||"").trim();const bad=!!v&&!/^09\d{9}$/.test(v);setFieldInvalid(id,bad);if(bad)ok=false})}return ok}
function showStep(step){currentStep=Math.max(1,Math.min(5,step));document.querySelectorAll(".enroll-step").forEach(x=>x.style.display=Number(x.dataset.formStep)===currentStep?"block":"none");document.querySelectorAll(".step").forEach(x=>{const n=Number(x.dataset.step);x.classList.toggle("active",n===currentStep);x.classList.toggle("done",n<currentStep)});document.getElementById("prevStep").disabled=currentStep===1;document.getElementById("nextStep").textContent=currentStep===5?"Continue to Review":"Next"}
document.querySelectorAll(".step").forEach(b=>b.addEventListener("click",()=>{const t=Number(b.dataset.step);if(t<=currentStep||validateStep(currentStep))showStep(t)}));
document.getElementById("prevStep").addEventListener("click",()=>currentStep>1?showStep(currentStep-1):showPage("dashboard"));
document.getElementById("nextStep").addEventListener("click",()=>{if(!validateStep(currentStep))return;if(currentStep===1){const lrn=val("lrn"),existing=getActiveRecords().find(r=>r.lrn===lrn&&lrn);if(existing){const go=confirm(`Possible Duplicate Record\n\nA learner with this LRN already exists (${existing.recordId}).\n\nChoose OK to view the existing record, or Cancel to continue this enrollment.`);if(go){showPage("records");openRecord(existing.recordId);return}}}if(currentStep<5)showStep(currentStep+1);else buildReview()});
function conditional(name,wrap){document.querySelectorAll(`input[name="${name}"]`).forEach(r=>r.addEventListener("change",()=>{document.getElementById(wrap).style.display=r.checked&&r.value==="Yes"?"block":"none"}))}
conditional("ipCommunity","ipSpecifyWrap");conditional("fourPs","fourPsWrap");
function setupParentAvailability(){[["fatherNotProvided","fatherFields",["fatherLast","fatherFirst","fatherMiddle","fatherContact"]],["motherNotProvided","motherFields",["motherLast","motherFirst","motherMiddle","motherContact"]]].forEach(([check,wrap,fields])=>{const c=document.getElementById(check);if(!c)return;c.addEventListener("change",()=>{const off=c.checked;document.getElementById(wrap).style.opacity=off?".55":"1";fields.forEach(id=>{const el=document.getElementById(id);el.disabled=off;if(off)el.value=""})})})}
setupParentAvailability();
document.querySelectorAll('input[name="sameAddress"]').forEach(r=>r.addEventListener("change",()=>{const yes=document.querySelector('input[name="sameAddress"]:checked')?.value==="Yes";document.getElementById("permanentFields").style.display=yes?"none":"block";if(yes)copyAddress()}));
function copyAddress(){const map={curHouse:"permHouse",curStreet:"permStreet",curBarangay:"permBarangay",curMunicipality:"permMunicipality",curProvince:"permProvince",curZip:"permZip"};Object.entries(map).forEach(([a,b])=>document.getElementById(b).value=document.getElementById(a).value)}
["curHouse","curStreet","curBarangay","curMunicipality","curProvince","curZip"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{if(document.querySelector('input[name="sameAddress"]:checked')?.value==="Yes")copyAddress()}));

function val(id){return document.getElementById(id)?.value?.trim()||""}
function radio(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||""}
function checks(name){return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value)}
function collectFormData(){
  return {photoPath:currentPhotoPath||"",schoolYear:val("schoolYear"),gradeLevel:val("gradeLevel"),sectionName:val("sectionName"),psa:val("psa"),lrn:val("lrn"),lastName:val("lastName"),firstName:val("firstName"),middleName:val("middleName"),extensionName:val("extensionName"),birthdate:val("birthdate"),placeOfBirth:val("placeOfBirth"),
    currentAddress:{house:val("curHouse"),street:val("curStreet"),barangay:val("curBarangay"),municipality:val("curMunicipality"),province:val("curProvince"),zip:val("curZip"),country:val("curCountry")},
    permanentAddressSame:radio("sameAddress"),permanentAddress:{house:val("permHouse"),street:val("permStreet"),barangay:val("permBarangay"),municipality:val("permMunicipality"),province:val("permProvince"),zip:val("permZip")},
    father:{last:val("fatherLast"),first:val("fatherFirst"),middle:val("fatherMiddle"),contact:val("fatherContact"),notProvided:document.getElementById("fatherNotProvided")?.checked||false},mother:{last:val("motherLast"),first:val("motherFirst"),middle:val("motherMiddle"),contact:val("motherContact"),notProvided:document.getElementById("motherNotProvided")?.checked||false},
    age:val("age"),motherTongue:val("motherTongue"),with:radio("with"),returning:radio("returning"),sex:radio("sex"),ipCommunity:radio("ipCommunity"),ipSpecification:val("ipSpecification"),fourPs:radio("fourPs"),fourPsHouseholdId:val("fourPsHouseholdId"),
    guardian:{last:val("guardianLast"),first:val("guardianFirst"),middle:val("guardianMiddle"),contact:val("guardianContact")},lastGradeCompleted:val("lastGradeCompleted"),lastSchoolYear:val("lastSchoolYear"),lastSchoolAttended:val("lastSchoolAttended"),schoolId:val("schoolId"),semester:radio("semester"),track:val("track"),strand:val("strand"),
    parentGuardianPrintedName:val("parentGuardianPrintedName"),certificationDate:val("certificationDate"),modalities:checks("modalities")}}
async function uploadStudentPhoto(recordId){
 if(!selectedStudentPhoto)return currentPhotoPath||"";
 const ext=(selectedStudentPhoto.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
 const path=`${currentAuthUser.id}/${recordId}.${ext}`;
 const {error}=await supabaseClient.storage.from("student-photos").upload(path,selectedStudentPhoto,{upsert:true,contentType:selectedStudentPhoto.type,cacheControl:"3600"});
 if(error)throw new Error(`Student photo upload failed: ${error.message}`);
 currentPhotoPath=path;photoUrlCache.delete(path);selectedStudentPhoto=null;return path;
}
function showStudentPhoto(file){
 if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){alert("Please choose a JPG, PNG, or WEBP image.");return}
 if(file.size>5*1024*1024){alert("Photo must be 5 MB or smaller.");return}
 selectedStudentPhoto=file;selectedStudentPhotoUrl=URL.createObjectURL(file);
 document.getElementById("studentPhotoPreview").innerHTML=`<img alt="Selected student photo preview" src="${selectedStudentPhotoUrl}">`;
 document.getElementById("removeStudentPhoto").hidden=false;
}
document.getElementById("chooseStudentPhoto").addEventListener("click",()=>document.getElementById("studentPhotoUpload").click());
document.getElementById("captureStudentPhoto").addEventListener("click",openStudentCamera);
async function openStudentCamera(){
 if(!navigator.mediaDevices?.getUserMedia){alert("Camera capture is unavailable in this browser or page context. Use HTTPS or localhost, or upload a photo instead.");return;}
 let stream;const overlay=document.createElement("div");overlay.className="camera-overlay";overlay.innerHTML=`<div class="camera-dialog" role="dialog" aria-modal="true" aria-label="Capture student photo"><h3>Take Student Photo</h3><video id="studentCameraVideo" autoplay playsinline></video><canvas id="studentCameraCanvas" hidden></canvas><div class="camera-actions"><button type="button" class="btn" id="cancelStudentCamera">Cancel</button><button type="button" class="btn primary" id="takeStudentSnapshot">Capture Photo</button></div><p class="camera-help">Allow camera access when your browser asks. Your photo will only be selected until you save the enrollment record.</p></div>`;document.body.appendChild(overlay);
 const close=()=>{if(stream)stream.getTracks().forEach(t=>t.stop());overlay.remove();};overlay.querySelector("#cancelStudentCamera").onclick=close;
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"user"},width:{ideal:1280},height:{ideal:1280}},audio:false});const video=overlay.querySelector("video");video.srcObject=stream;await video.play();overlay.querySelector("#takeStudentSnapshot").onclick=()=>{const canvas=overlay.querySelector("canvas"),w=video.videoWidth,h=video.videoHeight;if(!w||!h){alert("Camera is not ready yet. Please try again.");return;}canvas.width=w;canvas.height=h;canvas.getContext("2d").drawImage(video,0,0,w,h);canvas.toBlob(blob=>{if(!blob){alert("Unable to capture the photo.");return;}const file=new File([blob],`student-photo-${Date.now()}.jpg`,{type:"image/jpeg"});showStudentPhoto(file);document.getElementById("studentPhotoUpload").value="";close();},"image/jpeg",0.9);};
 }catch(err){console.error("Camera access failed",err);close();alert(err.name==="NotAllowedError"?"Camera permission was denied. Allow camera access in your browser settings and try again.":`Unable to open the camera. ${err.message||err}`);}
}
document.getElementById("studentPhotoUpload").addEventListener("change",e=>showStudentPhoto(e.target.files?.[0]));
document.getElementById("studentPhotoCamera").addEventListener("change",e=>showStudentPhoto(e.target.files?.[0]));
document.getElementById("removeStudentPhoto").addEventListener("click",()=>{selectedStudentPhoto=null;currentPhotoPath="";document.getElementById("studentPhotoUpload").value="";document.getElementById("studentPhotoCamera").value="";document.getElementById("studentPhotoPreview").textContent="No photo selected";document.getElementById("removeStudentPhoto").hidden=true});
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function item(label,value){return `<div class="review-item"><span class="review-label">${esc(label)}</span><div class="review-value">${esc(value||"—")}</div></div>`}
function section(title,items,step){return `<div class="review-section"><div class="review-section-head"><strong>${esc(title)}</strong><button type="button" class="edit-section" data-edit-step="${step}">Edit</button></div><div class="review-grid">${items.join("")}</div></div>`}
function analyzeEnrollmentQuality(d){
  const warnings=[];
  const hasName=Boolean(String(d.lastName||"").trim()&&String(d.firstName||"").trim());
  if(!hasName)warnings.push("Learner's last name and first name should be checked.");
  const addressParts=[d.currentAddress?.house,d.currentAddress?.street,d.currentAddress?.barangay,d.currentAddress?.municipality,d.currentAddress?.province].filter(x=>String(x||"").trim()).length;
  if(addressParts<3)warnings.push("Current address has few completed parts. Check it against the submitted form.");
  if(d.permanentAddressSame!=="Yes"){
    const permanentParts=[d.permanentAddress?.house,d.permanentAddress?.street,d.permanentAddress?.barangay,d.permanentAddress?.municipality,d.permanentAddress?.province].filter(x=>String(x||"").trim()).length;
    if(permanentParts<3)warnings.push("Permanent address has few completed parts. Confirm whether the remaining fields should be filled.");
  }
  if(d.ipCommunity==="Yes"&&!String(d.ipSpecification||"").trim())warnings.push("IP Community is marked Yes, but the specification is blank.");
  if(d.fourPs==="Yes"&&!String(d.fourPsHouseholdId||"").trim())warnings.push("4Ps Beneficiary is marked Yes, but the household ID is blank.");
  if(!Array.isArray(d.modalities)||d.modalities.length===0)warnings.push("No learning modality is selected. Confirm the applicable option(s).");
  if(d.gradeLevel&&String(d.gradeLevel).toLowerCase().includes("12")&&!String(d.guardian?.first||"").trim()&&!String(d.guardian?.last||"").trim())warnings.push("Guardian name is blank. Check whether it is required for this learner.");
  if(d.birthdate){const date=new Date(d.birthdate+"T00:00:00");if(Number.isNaN(date.getTime())||date>new Date())warnings.push("Birthdate appears invalid or is in the future.");}
  return warnings;
}
function renderQualityCheck(d){
  const warnings=analyzeEnrollmentQuality(d);
  if(!warnings.length)return `<div class="quality-check quality-ok"><strong>Quality check</strong><p>No common completeness issues were detected. Review the submitted form before saving.</p></div>`;
  return `<div class="quality-check quality-warn"><strong>Review these items before saving</strong><p>This assistant flags possible issues only. It does not determine official enrollment eligibility, and it will not block saving.</p><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></div>`;
}
async function buildReview(){if(!validateStep(5))return;const d=collectFormData(),current=`${d.currentAddress.house}, ${d.currentAddress.street}, ${d.currentAddress.barangay}, ${d.currentAddress.municipality}, ${d.currentAddress.province}, ${d.currentAddress.zip}, ${d.currentAddress.country}`.replace(/^, |, $/g,""),permanent=d.permanentAddressSame==="Yes"?"Same as current address":`${d.permanentAddress.house}, ${d.permanentAddress.street}, ${d.permanentAddress.barangay}, ${d.permanentAddress.municipality}, ${d.permanentAddress.province}, ${d.permanentAddress.zip}`.replace(/^, |, $/g,"");document.getElementById("reviewBody").innerHTML=section("Enrollment & Learner Information",[item("School Year",d.schoolYear),item("Grade Level to Enroll",d.gradeLevel),item("Section",d.sectionName),item("PSA Birth Certificate No.",d.psa),item("LRN",d.lrn),item("Last Name",d.lastName),item("First Name",d.firstName),item("Middle Name",d.middleName),item("Extension Name",d.extensionName),item("Birthdate",d.birthdate),item("Place of Birth (Municipality/City)",d.placeOfBirth)],1)+section("Address Information",[item("Current Address",current),item("Permanent Address",permanent),item("Same as Current Address?",d.permanentAddressSame)],2)+section("Parent & Other Learner Information",[item("Father's Name",[d.father.last,d.father.first,d.father.middle].filter(Boolean).join(" ")),item("Father's Contact Number",d.father.contact),item("Mother's Maiden Name",[d.mother.last,d.mother.first,d.mother.middle].filter(Boolean).join(" ")),item("Mother's Contact Number",d.mother.contact),item("Age",d.age),item("Mother Tongue",d.motherTongue),item("With",d.with),item("Returning (Balik-Aral)",d.returning),item("Sex",d.sex),item("IP Community",d.ipCommunity),item("IP Specification",d.ipSpecification),item("4Ps Beneficiary",d.fourPs),item("4Ps Household ID",d.fourPsHouseholdId)],3)+section("Senior High School Information",[item("Guardian's Name",[d.guardian.last,d.guardian.first,d.guardian.middle].filter(Boolean).join(" ")),item("Guardian Contact Number",d.guardian.contact),item("Last Grade Level Completed",d.lastGradeCompleted),item("Last School Year Completed",d.lastSchoolYear),item("Last School Attended",d.lastSchoolAttended),item("School ID",d.schoolId),item("Semester",d.semester),item("Track",d.track),item("Strand",d.strand),item("Section",d.sectionName)],4)+section("Certification & Modality",[item("Signature Over Printed Name of Parent/Guardian",d.parentGuardianPrintedName),item("Date",d.certificationDate),item("Preferred Distance Learning Modality/ies",d.modalities.length?d.modalities.join(", "):"—")],5)+renderQualityCheck(d)+`<div class="confirm-box">Please review the information carefully before saving.</div>`;const photoPath=d.photoPath||currentPhotoPath;const photoUrl=selectedStudentPhotoUrl||(photoPath?await getStudentPhotoUrl(photoPath).catch(err=>{console.warn("Review photo unavailable",err);return ""}):"");const photoCard=document.createElement("div");photoCard.className="review-photo-card";photoCard.innerHTML=`<strong>Student Photo</strong>${photoMarkup(photoUrl,"review-student-photo")}`;document.getElementById("reviewBody").prepend(photoCard);document.querySelectorAll(".edit-section").forEach(b=>b.addEventListener("click",()=>{showEnrollmentMode("form");showStep(Number(b.dataset.editStep))}));showEnrollmentMode("review")}
function showEnrollmentMode(mode){const formShell=document.querySelector("#enrollment > .enroll-shell"),review=document.getElementById("reviewView"),success=document.getElementById("saveSuccessView");if(formShell)formShell.style.display=mode==="form"?"block":"none";review.style.display=mode==="review"?"block":"none";success.style.display=mode==="success"?"block":"none"}
function generateRecordId(){const year=new Date().getFullYear().toString();let n=recordsCache.filter(x=>String(x.recordId||"").startsWith(`TNHS-${year}-`)).length+1;while(recordsCache.some(x=>x.recordId===`TNHS-${year}-${String(n).padStart(5,"0")}`))n++;return`TNHS-${year}-${String(n).padStart(5,"0")}`}
document.getElementById("confirmSave").addEventListener("click",async()=>{const data=collectFormData(),now=new Date().toISOString(),recordId=generateRecordId(),record={recordId,status:"Active",createdAt:now,updatedAt:now,createdBy:currentUser(),...data};const btn=document.getElementById("confirmSave");btn.disabled=true;try{record.photoPath=await uploadStudentPhoto(recordId);const saved=await insertEnrollment(record);await insertActivity("Created enrollment record",saved.recordId);lastSavedRecord=saved;document.getElementById("savedRecordId").textContent=saved.recordId;showEnrollmentMode("success");refreshAllDataViews()}catch(err){console.error(err);alert(`Unable to save the enrollment record. ${err.message||err}`)}finally{btn.disabled=false}});
document.getElementById("backToForm").addEventListener("click",()=>showEnrollmentMode("form"));
document.getElementById("newEnrollmentAfterSave").addEventListener("click",()=>{resetEnrollment();showEnrollmentMode("form");showStep(1)});
document.getElementById("viewSavedRecord").addEventListener("click",()=>openRecord(lastSavedRecord?.recordId));
document.getElementById("printSavedRecord").addEventListener("click",()=>{if(lastSavedRecord)window.dispatchEvent(new CustomEvent("tnhs:print-record",{detail:lastSavedRecord}))});
function resetEnrollment(){selectedStudentPhoto=null;currentPhotoPath="";document.getElementById("studentPhotoUpload").value="";document.getElementById("studentPhotoCamera").value="";document.getElementById("studentPhotoPreview").textContent="No photo selected";document.getElementById("removeStudentPhoto").hidden=true;enrollmentForm.reset();populateStrandOptions("");document.getElementById("curCountry").value="Philippines";document.getElementById("fatherFields").style.display="grid";document.getElementById("motherFields").style.display="grid";document.querySelector('input[name="sameAddress"][value="No"]').checked=true;document.getElementById("permanentFields").style.display="block";document.getElementById("ipSpecifyWrap").style.display="none";document.getElementById("fourPsWrap").style.display="none";document.getElementById("fatherNotProvided").checked=false;document.getElementById("motherNotProvided").checked=false;document.getElementById("fatherNotProvided").dispatchEvent(new Event("change"));document.getElementById("motherNotProvided").dispatchEvent(new Event("change"));document.querySelectorAll(".form-field.invalid").forEach(x=>x.classList.remove("invalid"));showStep(1)}
window.addEventListener("tnhs:reset-enrollment",resetEnrollment);

function refreshAllDataViews(){updateDashboard();renderRecords();renderTrash();populatePrintRecords();renderLogs();renderCensus();if(document.getElementById("print")?.style.display!=="none")renderSelectedPrint()}

/* 13F — Records */
function fullName(r){return[r.lastName,r.firstName,r.middleName,r.extensionName].filter(Boolean).join(" ")}
function getFilteredRecords(){
  const q=(document.getElementById("recordsSearch").value||"").trim().toLowerCase(),g=document.getElementById("recordsGradeFilter").value,y=document.getElementById("recordsYearFilter").value,s=document.getElementById("recordsStatusFilter").value,strand=document.getElementById("recordsStrandFilter").value,section=document.getElementById("recordsSectionFilter").value;
  const all=getActiveRecords().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const years=[...new Set(all.map(x=>x.schoolYear).filter(Boolean))].sort().reverse(),ys=document.getElementById("recordsYearFilter"),old=ys.value;
  ys.innerHTML='<option value="">All School Years</option>'+years.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(years.includes(old))ys.value=old;else ys.value=y;
  const strands=[...new Set(all.map(x=>x.strand).filter(Boolean))].sort(),sections=[...new Set(all.map(x=>x.sectionName).filter(Boolean))].sort();
  const strandEl=document.getElementById("recordsStrandFilter"),sectionEl=document.getElementById("recordsSectionFilter"),oldStrand=strandEl.value,oldSection=sectionEl.value;
  strandEl.innerHTML='<option value="">All Strands</option>'+strands.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(strands.includes(oldStrand))strandEl.value=oldStrand;
  sectionEl.innerHTML='<option value="">All Sections</option>'+sections.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(sections.includes(oldSection))sectionEl.value=oldSection;
  return {all,rows:all.filter(r=>{const hay=[fullName(r),r.lrn,r.recordId,r.schoolYear,r.strand,r.sectionName].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!g||String(r.gradeLevel)===g)&&(!ys.value||r.schoolYear===ys.value)&&(!s||r.status===s)&&(!strand||r.strand===strandEl.value)&&(!section||r.sectionName===sectionEl.value)})};
}
async function renderRecords(){
  const {all,rows}=getFilteredRecords(),size=Math.max(1,Number(document.getElementById("recordsPageSize")?.value||10)),pages=Math.max(1,Math.ceil(rows.length/size));
  recordsCurrentPage=Math.min(Math.max(1,recordsCurrentPage),pages);const start=(recordsCurrentPage-1)*size,visible=rows.slice(start,start+size);
  document.getElementById("recordsCount").textContent=`${rows.length} matching · ${all.length} active record${all.length===1?"":"s"}`;
  document.getElementById("recordsEmpty").style.display=rows.length?"none":"block";
  const photoUrls=await Promise.all(visible.map(r=>r.photoPath?getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Record thumbnail unavailable",err);return ""}):Promise.resolve("")));
  document.getElementById("recordsTableBody").innerHTML=visible.map((r,i)=>`<tr><td><span class="record-id-link" data-record="${esc(r.recordId)}">${esc(r.recordId)}</span></td><td><div class="record-person-cell">${photoMarkup(photoUrls[i],"record-photo-thumb")}<div><div class="record-name">${esc(fullName(r)||"Unnamed learner")}</div><div class="record-sub">${esc(r.createdBy||"—")}</div></div></div></td><td>${esc(r.lrn||"—")}</td><td>Grade ${esc(r.gradeLevel||"—")}</td><td>${esc(r.strand||"—")}</td><td>${esc(r.sectionName||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td><span class="status-pill">${esc(r.status||"Active")}</span></td><td>${formatTime(r.updatedAt||r.createdAt)}</td><td><div class="row-actions"><button class="table-btn" data-action="view" data-record="${esc(r.recordId)}">View</button>${canWrite()?`<button class="table-btn" data-action="edit" data-record="${esc(r.recordId)}">Edit</button>`:""}${canManageTrash()?`<button class="table-btn danger-table-btn" data-action="trash" data-record="${esc(r.recordId)}">Move to Trash</button>`:""}</div></td></tr>`).join("");
  document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{const action=b.dataset.action;if(action==="view")openRecord(b.dataset.record);else if(action==="edit")openEditRecord(b.dataset.record);else moveToTrash(b.dataset.record)}));
  document.querySelectorAll(".record-id-link").forEach(b=>b.addEventListener("click",()=>openRecord(b.dataset.record)));
  const pageInfo=document.getElementById("recordsPageInfo"),pageNumber=document.getElementById("recordsPageNumber"),prev=document.getElementById("recordsPrevPage"),next=document.getElementById("recordsNextPage");
  if(pageInfo)pageInfo.textContent=rows.length?`Showing ${start+1}–${Math.min(start+size,rows.length)} of ${rows.length} matching records`:"Showing 0 records";
  if(pageNumber)pageNumber.textContent=`Page ${recordsCurrentPage} of ${pages}`;if(prev)prev.disabled=recordsCurrentPage<=1;if(next)next.disabled=recordsCurrentPage>=pages;
}
function csvCell(value){let s=String(value??"");if(/^[\s]*[=+@\-]/.test(s))s="\'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function exportFilteredRecordsCsv(){
  const {rows}=getFilteredRecords();if(!rows.length){showToast("There are no matching records to export.");return}
  const headers=["Record ID","Learner Name","LRN","Grade Level","Strand","Section","School Year","Status","Last Updated"];
  const lines=[headers,...rows.map(r=>[r.recordId,fullName(r),r.lrn,r.gradeLevel,r.strand,r.sectionName,r.schoolYear,r.status||"Active",r.updatedAt||r.createdAt].map(v=>v instanceof Date?v.toISOString():v))].map(row=>row.map(csvCell).join(","));
  const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`TNHS-enrollment-records-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast(`Exported ${rows.length} matching record${rows.length===1?"":"s"}.`);
}

async function moveToTrash(id){if(!canManageTrash()){showToast("Your account cannot manage Trash.");return}const r=getActiveRecords().find(x=>x.recordId===id);if(!r)return;if(!confirm(`Move ${r.recordId} to Trash?\n\nThe record will be removed from active Enrollment Records. You can restore it within 30 days. After that, it will be permanently deleted.`))return;const now=new Date().toISOString();try{await updateDeletedAt(id,now,r.updatedAt);await insertActivity("Moved enrollment record to Trash",id);refreshAllDataViews();showToast("Enrollment record moved to Trash.")}catch(err){console.error(err);alert(`Unable to move the record to Trash. ${err.message||err}`)}}
async function renderTrash(){const body=document.getElementById("trashTableBody"),empty=document.getElementById("trashEmpty"),count=document.getElementById("trashCount");if(!body)return;const rows=getTrashRecords().slice().sort((a,b)=>new Date(b.deletedAt)-new Date(a.deletedAt));count.textContent=`${rows.length} record${rows.length===1?"":"s"}`;empty.style.display=rows.length?"none":"block";const photoUrls=await Promise.all(rows.map(r=>r.photoPath?getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Trash thumbnail unavailable",err);return ""}):Promise.resolve("")));body.innerHTML=rows.map((r,i)=>`<tr><td>${esc(r.recordId)}</td><td><div class="record-person-cell">${photoMarkup(photoUrls[i],"record-photo-thumb")}<div><div class="record-name">${esc(fullName(r)||"Unnamed learner")}</div><div class="record-sub">${esc(r.createdBy||"—")}</div></div></div></td><td>${esc(r.lrn||"—")}</td><td>Grade ${esc(r.gradeLevel||"—")}</td><td>${esc(r.strand||"—")}</td><td>${esc(r.sectionName||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td><span class="trash-retention">In Trash</span></td><td>${formatTime(r.deletedAt)}</td><td><button class="table-btn" data-trash-action="restore" data-record="${esc(r.recordId)}">Restore</button></td></tr>`).join("");body.querySelectorAll("[data-trash-action]").forEach(b=>b.addEventListener("click",()=>restoreFromTrash(b.dataset.record)));}
async function restoreFromTrash(id){if(!canManageTrash()){showToast("Your account cannot manage Trash.");return}const r=getTrashRecords().find(x=>x.recordId===id);if(!r)return;if(!confirm(`Restore ${r.recordId} to Enrollment Records?`))return;try{await updateDeletedAt(id,null,r.updatedAt);await insertActivity("Restored enrollment record",id);refreshAllDataViews();showPage("trash");showToast("Enrollment record restored.")}catch(err){console.error(err);alert(`Unable to restore the record. ${err.message||err}`)}}

["recordsSearch","recordsGradeFilter","recordsYearFilter","recordsStatusFilter","recordsStrandFilter","recordsSectionFilter"].forEach(id=>document.getElementById(id).addEventListener(id==="recordsSearch"?"input":"change",()=>{recordsCurrentPage=1;renderRecords()}));
document.getElementById("recordsPageSize")?.addEventListener("change",()=>{recordsCurrentPage=1;renderRecords()});
document.getElementById("recordsPrevPage")?.addEventListener("click",()=>{if(recordsCurrentPage>1){recordsCurrentPage--;renderRecords()}});
document.getElementById("recordsNextPage")?.addEventListener("click",()=>{recordsCurrentPage++;renderRecords()});
document.getElementById("exportRecordsCsv")?.addEventListener("click",exportFilteredRecordsCsv);
document.getElementById("newEnrollmentFromRecords").addEventListener("click",()=>{resetEnrollment();showPage("enrollment")});

function addressString(a){if(!a)return"—";return[a.house,a.street,a.barangay,a.municipality,a.province,a.zip,a.country].filter(Boolean).join(", ")||"—"}
function detailItem(label,value){return`<div class="detail-item"><span class="label">${esc(label)}</span><div class="value">${esc(value||"—")}</div></div>`}
function detailSection(title,items){return`<section class="detail-section"><h3>${esc(title)}</h3><div class="detail-grid">${items.join("")}</div></section>`}
async function openRecord(id){
  const r=getRecords().find(x=>x.recordId===id);if(!r)return;
  currentRecordId=id;
  const name=fullName(r)||"Unnamed learner";const detailPhotoUrl=r.photoPath?await getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Detail photo unavailable",err);return ""}):"";
  document.getElementById("individualRecordView").innerHTML=`<div class="detail-shell">
    <div class="detail-head"><div><h2>${esc(name)}</h2><p>Enrollment record • ${esc(r.schoolYear||"—")} • Grade ${esc(r.gradeLevel||"—")}</p></div><div class="detail-meta"><span class="record-code">${esc(r.recordId)}</span><span class="detail-status status-pill">${esc(r.status||"Active")}</span></div></div>
    <div class="detail-actions"><button class="btn" id="backRecords">Back to Records</button><button class="btn" id="editCurrentRecord">Edit Record</button><button class="btn primary" id="printCurrentRecord">Print Form</button></div>
    <div class="detail-body">
      <div class="detail-photo-card"><strong>Student Photo</strong>${photoMarkup(detailPhotoUrl,"detail-student-photo")}</div>
      ${detailSection("Enrollment & Learner Information",[detailItem("School Year",r.schoolYear),detailItem("Grade Level to Enroll",r.gradeLevel),detailItem("PSA Birth Certificate No.",r.psa),detailItem("LRN",r.lrn),detailItem("Last Name",r.lastName),detailItem("First Name",r.firstName),detailItem("Middle Name",r.middleName),detailItem("Extension Name",r.extensionName),detailItem("Birthdate",r.birthdate),detailItem("Place of Birth (Municipality/City)",r.placeOfBirth)])}
      ${detailSection("Address Information",[detailItem("Current Address",addressString(r.currentAddress)),detailItem("Permanent Address",r.permanentAddressSame==="Yes"?"Same as current address":addressString(r.permanentAddress)),detailItem("Same as Current Address?",r.permanentAddressSame)])}
      ${detailSection("Parent & Other Learner Information",[detailItem("Father's Name",[r.father?.last,r.father?.first,r.father?.middle].filter(Boolean).join(" ")),detailItem("Father's Contact Number",r.father?.contact),detailItem("Mother's Maiden Name",[r.mother?.last,r.mother?.first,r.mother?.middle].filter(Boolean).join(" ")),detailItem("Mother's Contact Number",r.mother?.contact),detailItem("Age",r.age),detailItem("Mother Tongue",r.motherTongue),detailItem("With",r.with),detailItem("Returning (Balik-Aral)",r.returning),detailItem("Sex",r.sex),detailItem("IP Community",r.ipCommunity),detailItem("IP Specification",r.ipSpecification),detailItem("4Ps Beneficiary",r.fourPs),detailItem("4Ps Household ID",r.fourPsHouseholdId)])}
      ${detailSection("Senior High School Information",[detailItem("Guardian's Name",[r.guardian?.last,r.guardian?.first,r.guardian?.middle].filter(Boolean).join(" ")),detailItem("Guardian Contact Number",r.guardian?.contact),detailItem("Last Grade Level Completed",r.lastGradeCompleted),detailItem("Last School Year Completed",r.lastSchoolYear),detailItem("Last School Attended",r.lastSchoolAttended),detailItem("School ID",r.schoolId),detailItem("Semester",r.semester),detailItem("Track",r.track),detailItem("Strand",r.strand)])}
      ${detailSection("Certification & Modality",[detailItem("Signature Over Printed Name of Parent/Guardian",r.parentGuardianPrintedName),detailItem("Date",r.certificationDate),detailItem("Preferred Distance Learning Modality/ies",r.modalities?.join(", ")),detailItem("Created",formatTime(r.createdAt)),detailItem("Last Updated",formatTime(r.updatedAt)),detailItem("Created By",r.createdBy)])}
    </div></div>`;
  document.getElementById("recordsListView").style.display="none";document.getElementById("editRecordView").style.display="none";document.getElementById("individualRecordView").style.display="block";
  document.getElementById("backRecords").onclick=()=>{resetModuleViews();renderRecords()};
  document.getElementById("editCurrentRecord").hidden=!canWrite();document.getElementById("editCurrentRecord").onclick=()=>openEditRecord(id);
  document.getElementById("printCurrentRecord").onclick=()=>window.dispatchEvent(new CustomEvent("tnhs:print-record",{detail:r}));
}
function editField(label,id,value,type="text"){const contact=["fatherContact","motherContact","guardianContact"].includes(id);return`<div class="edit-field"><label for="edit_${id}">${esc(label)}</label><input id="edit_${id}" type="${type}" value="${esc(value||"")}"${contact?' inputmode="numeric" maxlength="11" placeholder="09XXXXXXXXX"':''}></div>`}
function editSelect(label,id,value,options){return`<div class="edit-field"><label for="edit_${id}">${esc(label)}</label><select id="edit_${id}">${options.map(o=>`<option value="${esc(o)}" ${String(o)===String(value||"")?"selected":""}>${esc(o||"Select")}</option>`).join("")}</select></div>`}
function editChecks(label,id,values,selected){return`<div class="edit-field edit-checks"><label>${esc(label)}</label><div class="edit-check-grid">${values.map(v=>`<label class="choice"><input type="checkbox" name="edit_${id}" value="${esc(v)}" ${selected?.includes(v)?"checked":""}> ${esc(v)}</label>`).join("")}</div></div>`}
function openEditRecord(id){
  const r=getRecords().find(x=>x.recordId===id);if(!r)return;currentRecordId=id;
  const father=r.father||{},mother=r.mother||{},guardian=r.guardian||{};
  document.getElementById("editRecordView").innerHTML=`<div class="edit-shell"><div class="edit-head"><h2>Edit Enrollment Record</h2><p>Record ID: ${esc(r.recordId)}. The Record ID remains unchanged after saving.</p></div>
  <div class="edit-body"><div class="edit-grid">
    <div class="edit-group-heading"><span>01</span><div><strong>Enrollment & Learner Information</strong><small>School year, learner identity, and basic details</small></div></div>
    ${editField("School Year","schoolYear",r.schoolYear)}${editSelect("Grade Level to Enroll","gradeLevel",r.gradeLevel,["","11","12"])}${editField("PSA Birth Certificate No.","psa",r.psa)}${editField("LRN","lrn",r.lrn)}${editField("Last Name","lastName",r.lastName)}${editField("First Name","firstName",r.firstName)}${editField("Middle Name","middleName",r.middleName)}${editField("Extension Name","extensionName",r.extensionName)}${editField("Birthdate","birthdate",r.birthdate,"date")}${editField("Place of Birth (Municipality/City)","placeOfBirth",r.placeOfBirth)}
    <div class="edit-group-heading"><span>02</span><div><strong>Address Information</strong><small>Current and permanent residence</small></div></div>
    ${editField("Current House No./Street","curHouse",r.currentAddress?.house)}${editField("Current Street Name","curStreet",r.currentAddress?.street)}${editField("Current Barangay","curBarangay",r.currentAddress?.barangay)}${editField("Current Municipality/City","curMunicipality",r.currentAddress?.municipality)}${editField("Current Province","curProvince",r.currentAddress?.province)}${editField("Current Zip Code","curZip",r.currentAddress?.zip)}${editField("Current Country","curCountry",r.currentAddress?.country)}${editSelect("Same as Current Address?","sameAddress",r.permanentAddressSame,["Yes","No"])}
    ${editField("Permanent House No./Street","permHouse",r.permanentAddress?.house)}${editField("Permanent Street Name","permStreet",r.permanentAddress?.street)}${editField("Permanent Barangay","permBarangay",r.permanentAddress?.barangay)}${editField("Permanent Municipality/City","permMunicipality",r.permanentAddress?.municipality)}${editField("Permanent Province","permProvince",r.permanentAddress?.province)}${editField("Permanent Zip Code","permZip",r.permanentAddress?.zip)}
    <div class="edit-group-heading"><span>03</span><div><strong>Parent & Learner Information</strong><small>Parent details, contact numbers, and learner classifications</small></div></div>
    <div class="edit-field"><label class="choice"><input type="checkbox" id="edit_fatherNotProvided" ${father.notProvided?"checked":""}> Father information not provided</label></div>${editField("Father's Last Name","fatherLast",father.last)}${editField("Father's First Name","fatherFirst",father.first)}${editField("Father's Middle Name","fatherMiddle",father.middle)}${editField("Father's Contact Number","fatherContact",father.contact)}<div class="edit-field"><label class="choice"><input type="checkbox" id="edit_motherNotProvided" ${mother.notProvided?"checked":""}> Mother information not provided</label></div>${editField("Mother's Maiden Last Name","motherLast",mother.last)}${editField("Mother's Maiden First Name","motherFirst",mother.first)}${editField("Mother's Maiden Middle Name","motherMiddle",mother.middle)}${editField("Mother's Contact Number","motherContact",mother.contact)}${editField("Age","age",r.age)}${editField("Mother Tongue","motherTongue",r.motherTongue)}
    ${editSelect("With","with",r.with,["","Yes","No"])}${editSelect("Returning (Balik-Aral)","returning",r.returning,["","Yes","No"])}${editSelect("Sex","sex",r.sex,["","Male","Female"])}${editSelect("IP Community","ipCommunity",r.ipCommunity,["","Yes","No"])}${editField("IP Specification","ipSpecification",r.ipSpecification)}${editSelect("4Ps Beneficiary","fourPs",r.fourPs,["","Yes","No"])}${editField("4Ps Household ID","fourPsHouseholdId",r.fourPsHouseholdId)}
    <div class="edit-group-heading"><span>04</span><div><strong>Senior High School Information</strong><small>Previous school, grade level, track, and strand</small></div></div>
    ${editField("Guardian's Last Name","guardianLast",guardian.last)}${editField("Guardian's First Name","guardianFirst",guardian.first)}${editField("Guardian's Middle Name","guardianMiddle",guardian.middle)}${editField("Guardian Contact Number","guardianContact",guardian.contact)}${editField("Last Grade Level Completed","lastGradeCompleted",r.lastGradeCompleted)}${editField("Last School Year Completed","lastSchoolYear",r.lastSchoolYear)}${editField("Last School Attended","lastSchoolAttended",r.lastSchoolAttended)}${editField("School ID","schoolId",r.schoolId)}${editSelect("Semester","semester",r.semester,["","1st Sem","2nd Sem"])}${editSelect("Track","track",r.track,["","Academic","TVL","ALS"])}${editSelect("Strand","strand",r.strand,["",...(r.track==="Academic"?["STEM","ASSH","HUMSS","ABM"]:r.track==="TVL"?["HE","BE","AFA","ICT","SMAW"]:r.track==="ALS"?["ALS"]:r.strand?[r.strand]:[])])}${editField("Section","sectionName",r.sectionName)}${editField("Parent/Guardian Printed Name","parentGuardianPrintedName",r.parentGuardianPrintedName)}${editField("Certification Date","certificationDate",r.certificationDate,"date")}
    <div class="edit-group-heading"><span>05</span><div><strong>Certification & Learning Modality</strong><small>Parent/guardian certification and applicable modalities</small></div></div>
    ${editChecks("Preferred Distance Learning Modality/ies","modalities",["Modular (Print)","Online","Radio-Based Instruction","Blended","Modular (Digital)","Educational Television","Homeschooling","Face to Face"],r.modalities||[])}
  </div></div><div class="edit-actions"><button class="btn" id="cancelEdit" type="button">Cancel</button><button class="btn primary" id="saveRecordEdit" type="button">Save Changes</button></div></div>`;
  document.getElementById("recordsListView").style.display="none";document.getElementById("individualRecordView").style.display="none";document.getElementById("editRecordView").style.display="block";
  document.getElementById("cancelEdit").onclick=()=>openRecord(id);document.getElementById("saveRecordEdit").onclick=()=>saveRecordEdit(id);if(!canWrite())document.getElementById("saveRecordEdit").hidden=true;
  document.getElementById("edit_sameAddress").addEventListener("change",e=>{const disabled=e.target.value==="Yes";["permHouse","permStreet","permBarangay","permMunicipality","permProvince","permZip"].forEach(k=>document.getElementById("edit_"+k).disabled=disabled);});
  document.getElementById("edit_sameAddress").dispatchEvent(new Event("change"));
  [["edit_fatherNotProvided",["fatherLast","fatherFirst","fatherMiddle","fatherContact"]],["edit_motherNotProvided",["motherLast","motherFirst","motherMiddle","motherContact"]]].forEach(([cid,fields])=>{const c=document.getElementById(cid);const sync=()=>fields.forEach(k=>{const el=document.getElementById("edit_"+k);el.disabled=c.checked;if(c.checked)el.value=""});c.addEventListener("change",sync);sync()});
}
function editVal(id){return document.getElementById("edit_"+id)?.value?.trim()||""}
async function saveRecordEdit(id){
  const r=getActiveRecords().find(x=>x.recordId===id);if(!r)return;
  const newLrn=editVal("lrn");
  if(!/^\d{12}$/.test(newLrn)){alert("LRN must contain exactly 12 digits.");return}
  for(const [label,key] of [["Father's Contact Number","fatherContact"],["Mother's Contact Number","motherContact"],["Guardian Contact Number","guardianContact"]]){const value=editVal(key);if(value&&!/^09\d{9}$/.test(value)){alert(`${label} must contain exactly 11 digits and start with 09.`);document.getElementById(`edit_${key}`)?.focus();return}}
  const duplicate=getActiveRecords().some(x=>x.recordId!==id&&x.lrn===newLrn&&newLrn);if(duplicate){alert("This LRN is already assigned to another enrollment record.");return}
  const now=new Date().toISOString(),same=editVal("sameAddress")||"No";
  const updated={...r,schoolYear:editVal("schoolYear"),gradeLevel:editVal("gradeLevel"),psa:editVal("psa"),lrn:newLrn,lastName:editVal("lastName"),firstName:editVal("firstName"),middleName:editVal("middleName"),extensionName:editVal("extensionName"),birthdate:editVal("birthdate"),placeOfBirth:editVal("placeOfBirth"),
    currentAddress:{...r.currentAddress,house:editVal("curHouse"),street:editVal("curStreet"),barangay:editVal("curBarangay"),municipality:editVal("curMunicipality"),province:editVal("curProvince"),zip:editVal("curZip"),country:editVal("curCountry")},
    permanentAddressSame:same,permanentAddress:{house:editVal("permHouse"),street:editVal("permStreet"),barangay:editVal("permBarangay"),municipality:editVal("permMunicipality"),province:editVal("permProvince"),zip:editVal("permZip")},
    father:{last:editVal("fatherLast"),first:editVal("fatherFirst"),middle:editVal("fatherMiddle"),contact:editVal("fatherContact"),notProvided:!!document.getElementById("edit_fatherNotProvided")?.checked},mother:{last:editVal("motherLast"),first:editVal("motherFirst"),middle:editVal("motherMiddle"),contact:editVal("motherContact"),notProvided:!!document.getElementById("edit_motherNotProvided")?.checked},age:editVal("age"),motherTongue:editVal("motherTongue"),with:editVal("with"),returning:editVal("returning"),sex:editVal("sex"),ipCommunity:editVal("ipCommunity"),ipSpecification:editVal("ipSpecification"),fourPs:editVal("fourPs"),fourPsHouseholdId:editVal("fourPsHouseholdId"),
    guardian:{last:editVal("guardianLast"),first:editVal("guardianFirst"),middle:editVal("guardianMiddle"),contact:editVal("guardianContact")},lastGradeCompleted:editVal("lastGradeCompleted"),lastSchoolYear:editVal("lastSchoolYear"),lastSchoolAttended:editVal("lastSchoolAttended"),schoolId:editVal("schoolId"),semester:editVal("semester"),track:editVal("track"),strand:editVal("strand"),sectionName:editVal("sectionName"),parentGuardianPrintedName:editVal("parentGuardianPrintedName"),certificationDate:editVal("certificationDate"),modalities:[...document.querySelectorAll('input[name="edit_modalities"]:checked')].map(x=>x.value),updatedAt:now};
  if(same==="Yes")updated.permanentAddress={...updated.currentAddress};
  const btn=document.getElementById("saveRecordEdit");if(btn)btn.disabled=true;
  try{const saved=await updateEnrollment(id,updated,r.updatedAt);await insertActivity("Updated enrollment record",id);lastSavedRecord=saved;refreshAllDataViews();showToast("Enrollment record updated.");openRecord(id)}catch(err){console.error(err);if(err.code==="CONCURRENT_EDIT"){try{await loadRemoteData();refreshAllDataViews()}catch(refreshError){console.error(refreshError)}}alert(`Unable to update the record. ${err.message||err}`)}finally{if(btn)btn.disabled=false}
}
function showToast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.style.display="none",2500)}


/* 13G — Print / Generate */
function populatePrintRecords(){
 const sel=document.getElementById("printRecordSelect"),records=getActiveRecords().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)),selected=sel.value;
 sel.innerHTML='<option value="">Select an enrollment record</option>'+records.map(r=>`<option value="${esc(r.recordId)}">${esc(r.recordId)} — ${esc(fullName(r)||"Unnamed learner")} — Grade ${esc(r.gradeLevel||"—")}</option>`).join("");
 if(records.some(r=>r.recordId===selected))sel.value=selected;
}
function bval(v){return esc(v||"—")}
function field(label,value,cls=""){return`<div class="bfield ${cls}"><span class="blabel">${esc(label)}</span><div class="bvalue">${bval(value)}</div></div>`}
function personName(p){if(p?.notProvided)return"Not provided";return[p?.last,p?.first,p?.middle].filter(Boolean).join(" ")||"—"}
function modalityRows(r){
 const options=["Modular (Print)","Online","Radio-Based Instruction","Blended","Modular (Digital)","Educational Television","Homeschooling","Face to Face"],chosen=r.modalities||[];
 return options.map(x=>`<div class="modality"><span class="box ${chosen.includes(x)?"checked":""}"></span>${esc(x)}</div>`).join("")
}
function makeBEEF(r,photoUrl=""){
 const cur=r.currentAddress||{},perm=r.permanentAddress||{},same=r.permanentAddressSame==="Yes";
 const permText=same?"Same with Current Address":addressString(perm);
 return `<div class="beef-page">
  ${photoUrl?`<div class="beef-photo-wrap"><img src="${photoUrl}" alt="Student 2x2 ID photo"></div>`:`<div class="beef-photo-wrap"><div class="beef-photo-placeholder">2 × 2<br>STUDENT PHOTO</div></div>`}
  <h1 class="beef-title">ENHANCED BASIC EDUCATION ENROLLMENT FORM</h1>
  <div class="beef-subtitle">Talugtug National High School</div><div class="beef-rule"></div>
  <div class="beef-grid three">${field("School Year",r.schoolYear)}${field("Grade Level to Enroll",r.gradeLevel)}${field("LRN",r.lrn)}</div>
  <div class="beef-section-title">LEARNER INFORMATION</div>
  <div class="beef-grid">${field("PSA Birth Certificate No. (if available)",r.psa)}${field("Birthdate",r.birthdate)}${field("Last Name",r.lastName)}${field("First Name",r.firstName)}${field("Middle Name",r.middleName)}${field("Extension Name",r.extensionName)}${field("Place of Birth (Municipality/City)",r.placeOfBirth)}${field("Current Address",addressString(cur),"wide")}</div>
  <div class="beef-section-title">ADDRESS INFORMATION</div>
  <div class="beef-grid">${field("House No./Street",cur.house)}${field("Street Name",cur.street)}${field("Barangay",cur.barangay)}${field("Municipality/City",cur.municipality)}${field("Province",cur.province)}${field("Zip Code",cur.zip)}${field("Country",cur.country)}${field("Permanent Address",permText,"wide")}</div>
  <div class="beef-grid three">${field("Permanent — House No./Street",perm.house)}${field("Permanent — Street Name",perm.street)}${field("Permanent — Barangay",perm.barangay)}${field("Permanent — Municipality/City",perm.municipality)}${field("Permanent — Province",perm.province)}${field("Permanent — Zip Code",perm.zip)}</div>
  <div class="beef-section-title">PARENT'S / GUARDIAN'S INFORMATION</div>
  <div class="beef-grid">${field("Father's Name",personName(r.father))}${field("Father's Contact Number",r.father?.contact)}${field("Mother's Maiden Name",personName(r.mother))}${field("Mother's Contact Number",r.mother?.contact)}${field("Guardian's Name",personName(r.guardian))}${field("Guardian's Contact Number",r.guardian?.contact)}</div>
  <div class="beef-section-title">OTHER LEARNER INFORMATION</div>
  <div class="beef-grid three">${field("Age",r.age)}${field("Mother Tongue",r.motherTongue)}${field("Sex",r.sex)}${field("With",r.with)}${field("Returning (Balik-Aral)",r.returning)}${field("IP Community",r.ipCommunity)}${field("IP Specification",r.ipSpecification)}${field("4Ps Beneficiary",r.fourPs)}${field("4Ps Household ID",r.fourPsHouseholdId)}</div>
  
 </div>
 <div class="beef-page">
  
  <h1 class="beef-title">FOR LEARNERS IN SENIOR HIGH SCHOOL</h1><div class="beef-subtitle">Enrollment Information</div><div class="beef-rule"></div>
  <div class="beef-section-title">SENIOR HIGH SCHOOL INFORMATION</div>
  <div class="beef-grid three">${field("Last Grade Level Completed",r.lastGradeCompleted)}${field("Last School Year Completed",r.lastSchoolYear)}${field("School ID",r.schoolId)}${field("Last School Attended",r.lastSchoolAttended)}${field("Semester",r.semester)}${field("Track",r.track)}${field("Strand",r.strand)}</div>
  <div class="beef-section-title">GUARDIAN INFORMATION</div>
  <div class="beef-grid">${field("Guardian's Name",personName(r.guardian))}${field("Guardian Contact Number",r.guardian?.contact)}</div>
  <div class="beef-section-title">SYSTEM RECORD REFERENCE</div>
  <div class="beef-grid three">${field("System Record ID",r.recordId)}${field("School Year",r.schoolYear)}${field("Grade Level",r.gradeLevel)}</div>
  
 </div>
 <div class="beef-page">
  
  <h1 class="beef-title">CERTIFICATION AND PREFERRED DISTANCE LEARNING MODALITY/IES</h1><div class="beef-rule"></div>
  <div class="cert-box">I hereby certify that the above information given are true and correct to the best of my knowledge and I authorize the Department of Education to use my child's details to create/update his/her learner profile in the Learner Information System. The Department of Education may use the information to facilitate the conduct of its programs, projects, and services, subject to the provisions of the Data Privacy Act of 2012.</div>
  <div class="sig-grid"><div><div class="sig-line">${bval(r.parentGuardianPrintedName)}</div><div class="sig-label">SIGNATURE OVER PRINTED NAME OF PARENT/GUARDIAN</div></div><div><div class="sig-line">${bval(r.certificationDate)}</div><div class="sig-label">DATE</div></div></div>
  <div class="beef-section-title">PREFERRED DISTANCE LEARNING MODALITY/IES</div>
  <div class="bform-note">Choose all that applies.</div>
  <div class="modality-grid">${modalityRows(r)}</div>
  <div class="beef-section-title">ENROLLMENT RECORD REFERENCE</div>
  <div class="beef-grid three">${field("Record ID",r.recordId)}${field("LRN",r.lrn)}${field("Last Updated",formatTime(r.updatedAt))}</div>
 </div>`;
}
async function renderSelectedPrint(){
 const id=document.getElementById("printRecordSelect").value,r=getRecords().find(x=>x.recordId===id),preview=document.getElementById("printPreview");
 if(!r){preview.innerHTML='<div class="print-empty"><strong>No record selected</strong>Select an enrollment record above to generate the three-page printable preview.</div>';return false}
 let photoUrl="";
 if(r.photoPath){
  try{photoUrl=await getStudentPhotoUrl(r.photoPath)}
  catch(error){console.warn("Unable to load private student photo",error)}
 }
 preview.innerHTML=makeBEEF(r,photoUrl);
 return true;
}
async function waitForPrintAssets(){
 if(document.fonts?.ready)await document.fonts.ready;
 const images=[...document.querySelectorAll("#printPreview img")];
 await Promise.all(images.map(img=>{
  if(img.complete)return Promise.resolve();
  return new Promise(resolve=>{img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true});setTimeout(resolve,2500)});
 }));
}
async function printSelectedEnrollment(id){
 const button=document.getElementById("printBEEFButton");
 if(!id){alert("Select an enrollment record first.");return}
 if(button)button.disabled=true;
 try{
  document.getElementById("printRecordSelect").value=id;
  const ready=await renderSelectedPrint();
  if(!ready)return;
  await waitForPrintAssets();
  insertActivity("Generated / printed enrollment form",id).catch(err=>console.error("Unable to record print activity",err));
  window.print();
 }catch(error){console.error("Enrollment form print failed",error);alert("The enrollment form could not be prepared for printing. Please try again.")}
 finally{if(button)button.disabled=false}
}
document.getElementById("printRecordSelect").addEventListener("change",renderSelectedPrint);
document.getElementById("printBEEFButton").addEventListener("click",()=>printSelectedEnrollment(document.getElementById("printRecordSelect").value));
window.addEventListener("tnhs:print-record",e=>{
 const id=e.detail?.recordId;if(!id)return;
 showPage("print");printSelectedEnrollment(id);
});


/* V4 Phase 5 — Administrator-only user management */
async function renderUsers(){
 const body=document.getElementById("usersTableBody"),count=document.getElementById("usersCount"),msg=document.getElementById("usersMessage");
 if(!canManageUsers()){body.innerHTML='<tr><td colspan="5">Administrator access required.</td></tr>';return}
 body.innerHTML='<tr><td colspan="5">Loading authorized accounts…</td></tr>';msg.textContent="";
 try{
  const {data,error}=await supabaseClient.from("user_profiles").select("user_id,display_name,role,is_active,created_at").order("display_name");
  if(error)throw error;
  count.textContent=`${data.length} authorized account${data.length===1?"":"s"}`;
  body.innerHTML=data.length?data.map(u=>{const self=u.user_id===currentAuthUser?.id;return `<tr><td>${esc(u.display_name||"—")}${self?' <strong>(you)</strong>':''}</td><td><code>${esc(u.user_id)}</code></td><td><select class="user-role-select" data-user-role="${esc(u.user_id)}" ${self?'disabled':''}><option value="administrator" ${u.role==="administrator"?"selected":""}>Administrator</option><option value="registrar" ${u.role==="registrar"?"selected":""}>Registrar</option><option value="enrollment_staff" ${u.role==="enrollment_staff"?"selected":""}>Enrollment Staff</option><option value="read_only" ${u.role==="read_only"?"selected":""}>Read-only</option></select></td><td>${u.is_active?"Active":"Inactive"}</td><td><button class="btn" data-user-save="${esc(u.user_id)}" ${self?'disabled':''}>Save</button> <button class="btn" data-user-toggle="${esc(u.user_id)}" data-active="${u.is_active}" ${self?'disabled':''}>${u.is_active?"Deactivate":"Activate"}</button></td></tr>`}).join(""):'<tr><td colspan="5">No authorized accounts found.</td></tr>';
  body.querySelectorAll("[data-user-save]").forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.userSave,role=body.querySelector(`[data-user-role="${id}"]`)?.value;if(!canManageUsers())return; b.disabled=true;try{const {error}=await supabaseClient.from("user_profiles").update({role,updated_at:new Date().toISOString()}).eq("user_id",id);if(error)throw error;msg.textContent="Role updated.";await renderUsers()}catch(e){msg.textContent=`Could not update role: ${e.message}`}finally{b.disabled=false}}));
  body.querySelectorAll("[data-user-toggle]").forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.userToggle,active=b.dataset.active!=="true";if(!canManageUsers()||id===currentAuthUser?.id)return;if(!confirm(`${active?"Activate":"Deactivate"} this account?`))return;b.disabled=true;try{const {error}=await supabaseClient.from("user_profiles").update({is_active:active,updated_at:new Date().toISOString()}).eq("user_id",id);if(error)throw error;msg.textContent=`Account ${active?"activated":"deactivated"}.`;await renderUsers()}catch(e){msg.textContent=`Could not change account status: ${e.message}`}finally{b.disabled=false}}));
 }catch(e){count.textContent="Unable to load accounts";body.innerHTML=`<tr><td colspan="5">${esc(e.message)}</td></tr>`;msg.textContent="Check that the existing administrator profile-management RLS policy permits administrators to read and update profiles."}
}
document.getElementById("refreshUsers")?.addEventListener("click",renderUsers);

/* 13H — Activity Logs + System Settings */
function renderLogs(){
 const q=(document.getElementById("logsSearch").value||"").trim().toLowerCase(),a=document.getElementById("logsActionFilter").value;
 const rows=getLogs().slice().sort((x,y)=>new Date(y.timestamp||0)-new Date(x.timestamp||0)).filter(x=>{
  const hay=[x.action,x.recordId,x.user,x.timestamp].join(" ").toLowerCase();
  return(!q||hay.includes(q))&&(!a||x.action===a)
 });
 document.getElementById("logsCount").textContent=`${rows.length} activit${rows.length===1?"y":"ies"}`;
 document.getElementById("logsEmpty").style.display=rows.length?"none":"block";
 document.getElementById("logsTableBody").innerHTML=rows.map(x=>`<tr><td>${esc(formatTime(x.timestamp))}</td><td>${esc(x.user||"—")}</td><td><span class="activity-badge ${actionClass(x.action)}">${esc(x.action||"Activity")}</span></td><td>${esc(x.recordId||"—")}</td><td>${esc(x.details||"—")}</td></tr>`).join("");
}
document.getElementById("logsSearch").addEventListener("input",renderLogs);
document.getElementById("logsActionFilter").addEventListener("change",renderLogs);
document.getElementById("refreshLogs").addEventListener("click",renderLogs);
function readRememberSetting(){const raw=localStorage.getItem("tnhsRememberSetting");return raw===null?true:raw==="true"}
function renderSettings(){const on=readRememberSetting(),toggle=document.getElementById("rememberSettingToggle");if(toggle){toggle.classList.toggle("on",on);toggle.setAttribute("aria-pressed",String(on))}const a=getAccount();const d=document.getElementById("accountDisplayName");const u=document.getElementById("accountUsername");if(d&&document.activeElement!==d)d.value=a.displayName||"";if(u&&document.activeElement!==u)u.value=a.username||""}
document.getElementById("rememberSettingToggle").addEventListener("click",()=>{const on=!readRememberSetting();localStorage.setItem("tnhsRememberSetting",String(on));rememberMe.checked=on;if(!on){localStorage.removeItem(SESSION_KEY)}renderSettings()});
document.getElementById("saveAccountSettings").addEventListener("click",()=>{showToast("Account details cannot be changed from this page.")});
document.getElementById("clearPrototypeData").addEventListener("click",()=>{alert("Enrollment records and activity logs are saved in the school database. Use Enrollment Records or Trash to manage individual records.")});

let activationPromise=null;async function activateSession(user){if(activationPromise)return activationPromise;activationPromise=(async()=>{currentAuthUser=user;try{await loadCurrentProfile();await loadRemoteData();setLoggedIn(user.email)}catch(err){console.error(err);await supabaseClient.auth.signOut();setLoggedOut();loginError.textContent=err.message||"This account is not authorized.";loginError.style.display="block"}})();try{return await activationPromise}finally{activationPromise=null}}
rememberMe.checked=readRememberSetting();appShell.style.display="none";loginScreen.style.display="grid";supabaseClient.auth.getSession().then(async({data})=>{if(data.session?.user)await activateSession(data.session.user);else setLoggedOut()});supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==="INITIAL_SESSION")return;if(session?.user){setTimeout(()=>activateSession(session.user),0)}else{recordsCache=[];logsCache=[];setLoggedOut()}});showStep(1);renderSettings();


// V4 correction: census is calculated from active records and grouped by grade, track, and strand.
function renderCensus(){
 const yearEl=document.getElementById("censusYear"); if(!yearEl)return;
 const records=getActiveRecords();
 const years=[...new Set(records.map(r=>r.schoolYear).filter(Boolean))].sort().reverse();
 const old=yearEl.value;
 yearEl.innerHTML='<option value="">All School Years</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");
 if(years.includes(old))yearEl.value=old;
 const selected=yearEl.value;
 const data=records.filter(r=>!selected||r.schoolYear===selected);
 const groups=new Map();
 for(const r of data){
  const grade=String(r.gradeLevel||"Unspecified"),track=String(r.track||"Unspecified"),strand=String(r.strand||"Unspecified");
  const key=[grade,track.toLowerCase(),strand.toLowerCase()].join("\u0000");
  if(!groups.has(key))groups.set(key,{grade,track,strand,male:0,female:0,other:0,total:0});
  const g=groups.get(key);g.total++;
  const sex=String(r.sex||"").trim().toLowerCase();
  if(sex==="male")g.male++;else if(sex==="female")g.female++;else g.other++;
 }
 const rows=[...groups.values()].sort((a,b)=>a.grade.localeCompare(b.grade,undefined,{numeric:true})||a.track.localeCompare(b.track)||a.strand.localeCompare(b.strand));
 const male=data.filter(r=>String(r.sex||"").trim().toLowerCase()==="male").length;
 const female=data.filter(r=>String(r.sex||"").trim().toLowerCase()==="female").length;
 const other=data.length-male-female,total=data.length;
 document.getElementById("censusSummary").innerHTML=[['Total Enrolled',total],['Male',male],['Female',female],['Other / Unspecified Sex',other]].map(([label,n])=>`<div class="census-stat"><small>${label}</small><strong>${n}</strong></div>`).join("");
 document.getElementById("censusTableBody").innerHTML=rows.length?rows.map(r=>`<tr><td>Grade ${esc(r.grade)}</td><td>${esc(r.track)}</td><td>${esc(r.strand)}</td><td>${r.male}</td><td>${r.female}</td><td>${r.other}</td><td><strong>${r.total}</strong></td></tr>`).join(""):'<tr><td colspan="7">No active enrollment records found for this selection.</td></tr>';
 document.getElementById("censusTableFoot").innerHTML=`<tr><th colspan="3">Overall Total</th><th>${male}</th><th>${female}</th><th>${other}</th><th>${total}</th></tr>`;
 const note=document.getElementById("censusPrintYear");if(note)note.textContent=selected||"All School Years";
}

const TRACK_STRANDS={Academic:["STEM","ASSH","HUMSS","ABM"],TVL:["HE","BE","AFA","ICT","SMAW"],ALS:["ALS"]};
function populateStrandOptions(trackValue,strandValue=""){const strand=document.getElementById("strand");if(!strand)return;const options=TRACK_STRANDS[trackValue]||[];strand.innerHTML='<option value="">'+(trackValue?"Select strand":"Select a track first")+'</option>'+options.map(v=>`<option value="${v}">${v}</option>`).join("");strand.disabled=!trackValue||!options.length;if(strandValue&&options.includes(strandValue))strand.value=strandValue;}
document.getElementById("track")?.addEventListener("change",e=>populateStrandOptions(e.target.value));
function calculateLearnerAge(birthdate){if(!birthdate)return "";const born=new Date(`${birthdate}T00:00:00`);if(Number.isNaN(born.getTime()))return "";const today=new Date();let age=today.getFullYear()-born.getFullYear();const beforeBirthday=today.getMonth()<born.getMonth()||(today.getMonth()===born.getMonth()&&today.getDate()<born.getDate());if(beforeBirthday)age--;return age>=0?String(age):"";}
document.getElementById("birthdate")?.addEventListener("change",e=>{const age=document.getElementById("age");if(age)age.value=calculateLearnerAge(e.target.value);});
document.getElementById("censusYear")?.addEventListener("change",renderCensus);document.getElementById("refreshCensus")?.addEventListener("click",renderCensus);
document.getElementById("printCensus")?.addEventListener("click",()=>{renderCensus();document.body.classList.add("census-printing");window.addEventListener("afterprint",()=>document.body.classList.remove("census-printing"),{once:true});window.print();});
