/* Nepsis AI Coach — one-question-at-a-time conversation. */
(function (window, document) {
  "use strict";
  const core = window.NepsisCoachCore;
  const $ = (id) => document.getElementById(id);
  const SUPABASE_URL = "https://emhukqvetlhjgadgskbl.supabase.co";
  const SUPABASE_KEY = "sb_publishable_sdWqagLvXYQsmveUrmmw9g_neLoRMCl";
  const CRISIS_EL = "Είμαι AI, όχι υπηρεσία έκτακτης ανάγκης. Σταματώ τη ροή μελέτης επειδή αυτό που έγραψες μπορεί να σημαίνει ότι χρειάζεσαι υποστήριξη τώρα. Στην Ελλάδα μπορείς να καλέσεις το 1018 (ΚΛΙΜΑΚΑ, γραμμή παρέμβασης για την αυτοκτονία, όλο το 24ωρο), το 10306 (δωρεάν και ανώνυμη ψυχοκοινωνική υποστήριξη, όλο το 24ωρο) ή το 112 αν κινδυνεύεις άμεσα. Επικοινώνησε επίσης με κάποιον άνθρωπο που εμπιστεύεσαι και ζήτησέ του να μείνει μαζί σου.";
  const CRISIS_EN = "I’m an AI, not an emergency service. I’m stopping the study flow because what you wrote may mean you need support now. In Greece, call 1018 (Klimaka suicide intervention line, 24/7), 10306 (free and anonymous psychosocial support, 24/7), or 112 if you are in immediate danger. Please contact someone you trust and ask them to stay with you.";
  let lang = "el", step = 0, choice = "", answers = { task: "", timeMinutes: 40, obstacle: "" }, plan = null;
  const q = {
    el: ["Τι δουλεύεις σήμερα; (μάθημα ή εργασία)", "Πόσο χρόνο έχεις διαθέσιμο; Γράψε λεπτά από 5 έως 180.", "Τι σε δυσκολεύει αυτή τη στιγμή; Διάλεξε μία επιλογή και, αν θέλεις, πρόσθεσε λίγες λέξεις."],
    en: ["What are you working on today? (subject or task)", "How much time do you have? Enter 5 to 180 minutes.", "What is getting in the way? Choose an option and add a few words if you want."]
  };
  const choices = {
    el: [{v:"notifications",t:"Ειδοποιήσεις ή κινητό"},{v:"exam_anxiety",t:"Άγχος εξετάσεων"},{v:"starting",t:"Δεν ξέρω από πού να αρχίσω"},{v:"energy",t:"Χαμηλή ενέργεια"},{v:"other",t:"Κάτι άλλο"}],
    en: [{v:"notifications",t:"Notifications or phone"},{v:"exam_anxiety",t:"Exam anxiety"},{v:"starting",t:"I do not know where to start"},{v:"energy",t:"Low energy"},{v:"other",t:"Something else"}]
  };
  function tr(elText,enText){return lang==="en"?enText:elText;}
  function addMessage(text, who) {
    const item=document.createElement("div"); item.className="coach-chat-message "+(who==="user"?"is-user":"is-coach");
    const label=document.createElement("span"); label.className="coach-chat-speaker"; label.textContent=who==="user"?tr("Εσύ","You"):tr("AI Coach","AI Coach");
    const body=document.createElement("p"); body.textContent=text; item.append(label,body); $("chatMessages").appendChild(item);
    $("chatMessages").scrollTop=$("chatMessages").scrollHeight;
  }
  function updateCount(){const input=$("coachInput");$("coachCharCount").textContent=Array.from(input.value).length+" / 1000";}
  function showPrompt() {
    $("coachChoices").hidden=step!==2;
    $("coachConsentRow").hidden=step!==2;
    if(step===2)$("coachConsent").checked=false;
    $("coachForm").hidden=false;
    $("coachInput").value="";
    $("coachInput").type="text";
    $("coachInput").placeholder=step===1?tr("π.χ. 40","e.g. 40"):tr("Γράψε την απάντησή σου…","Write your answer…");
    $("coachInputLabel").textContent=tr("Η απάντησή σου","Your answer");
    $("coachInput").setAttribute("aria-label",q[lang][step]);
    $("coachInput").setAttribute("maxlength","1000");
    $("coachInput").rows=step===1?1:2;
    $("coachSend").textContent=tr("Συνέχεια","Continue");
    $("coachInput").inputMode=step===1?"numeric":"text";
    if(step===2) renderChoices();
    else $("coachChoices").innerHTML="";
    $("coachInput").focus();
    updateCount();
  }
  function renderChoices(){
    const box=$("coachChoices");box.innerHTML="";
    choices[lang].forEach(item=>{
      const button=document.createElement("button");button.type="button";button.className="coach-choice-pill";button.textContent=item.t;
      button.setAttribute("aria-pressed",String(choice===item.v));
      button.addEventListener("click",()=>{choice=item.v;box.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed","false"));button.setAttribute("aria-pressed","true");$("coachInput").focus();});
      box.appendChild(button);
    });
  }
  function addPrompt(){addMessage(q[lang][step],"coach");showPrompt();}
  function stopForCrisis(){
    $("coachChatCard").hidden=true;$("coachPlan").hidden=true;$("coachOffTopic").hidden=true;$("coachReflection").hidden=true;
    $("coachCrisis").hidden=false;$("coachCrisisText").textContent=lang==="en"?CRISIS_EN:CRISIS_EL;
  }
  function stopOffTopic(){
    $("coachChatCard").hidden=true;$("coachPlan").hidden=true;$("coachOffTopic").hidden=false;
    $("coachOffTopicText").textContent=tr("Μπορώ να βοηθήσω μόνο με οργάνωση μελέτης και συγκέντρωσης. Ξεκίνα ξανά γράφοντας το μάθημα ή την εργασία που θέλεις να κάνεις.","I can help only with study planning and focus. Start again by telling me the subject or task you want to work on.");
  }
  function showCrisis(){stopForCrisis();}
  async function callCoach(action, adjustment){
    const response=await fetch(SUPABASE_URL+"/functions/v1/ai-study-coach",{
      method:"POST",
      headers:{"content-type":"application/json","apikey":SUPABASE_KEY,"authorization":"Bearer "+SUPABASE_KEY},
      body:JSON.stringify({action,language:lang,task:answers.task,timeMinutes:answers.timeMinutes,obstacle:answers.obstacle,adjustment:adjustment||"",consent:true})
    });
    const data=await response.json().catch(()=>({}));
    if(response.status===429)throw new Error(data.error==="ip_rate_limit_reached"?"rate_limit":"monthly_limit");
    if(!response.ok)throw new Error("ai_unavailable");
    return data;
  }
  async function requestPlan(){
    $("coachForm").hidden=true;$("coachChoices").hidden=true;
    $("coachStatus").textContent=tr("Ο AI Coach ετοιμάζει το πλάνο σου…","The AI Coach is preparing your plan…");
    try{
      const data=await callCoach("plan","");
      if(data.crisis){showCrisis();return;}
      if(data.offTopic){stopOffTopic();return;}
      renderPlan(data);
    }catch(error){
      $("coachStatus").textContent=error.message==="rate_limit"?tr("Έχουν γίνει πολλές αιτήσεις από αυτή τη σύνδεση. Περίμενε λίγα λεπτά και δοκίμασε ξανά.","Too many requests from this connection. Wait a few minutes and try again."):error.message==="monthly_limit"?tr("Το μηνιαίο όριο AI έχει συμπληρωθεί.","The monthly AI limit has been reached."):tr("Ο AI Coach δεν είναι προσωρινά διαθέσιμος. Δοκίμασε ξανά αργότερα.","The AI Coach is temporarily unavailable. Please try again later.");
      $("coachForm").hidden=false;
    }
  }
  function renderPlan(data){
    plan={focusMinutes:data.focusMinutes,blockMinutes:data.blockMinutes,breakMinutes:data.breakMinutes};
    $("coachChatCard").hidden=true;$("coachPlan").hidden=false;$("coachStatus").textContent="";
    $("coachPlanPill").textContent=plan.focusMinutes+" "+tr("λεπτά εστίασης","min focus");
    const message=$("coachPlanMessage");message.innerHTML="";
    [data.message,data.researchReason,data.adjustOffer].filter(Boolean).forEach(text=>{const p=document.createElement("p");p.textContent=text;message.appendChild(p);});
    const blocks=core.buildBlocks(plan.focusMinutes,plan.blockMinutes,plan.breakMinutes);
    $("coachPlanBlocks").textContent=blocks.map(item=>tr(item.focusMinutes+"′ εστίαση",""+item.focusMinutes+" min focus")+(item.breakAfterMinutes?" → "+tr(item.breakAfterMinutes+"′ διάλειμμα",item.breakAfterMinutes+" min break"):"")).join(" · ");
    const start=new URL("practice.html",window.location.href);
    start.searchParams.set("custom","1");start.searchParams.set("coachStart",String(blocks[0].focusMinutes));
    start.searchParams.set("customTotal",String(plan.focusMinutes));start.searchParams.set("customBlock",String(plan.blockMinutes));
    start.searchParams.set("customBreak",String(plan.breakMinutes));start.searchParams.set("customRemaining",String(plan.focusMinutes));
    start.searchParams.set("customTopic",answers.task);start.hash="stage-"+blocks[0].focusMinutes;
    $("coachPlanStart").href=start.href;
    const suggestion=$("coachLibrarySuggestion");suggestion.hidden=true;suggestion.innerHTML="";
    if(core.isValidLibraryId(data.libraryId)){
      const item=document.createElement("a");item.href="library.html?item="+encodeURIComponent(data.libraryId);item.textContent=tr("Σχετικό άρθρο στη Βιβλιοθήκη: ","Related Library item: ")+String(data.libraryReason||data.libraryId);
      suggestion.appendChild(item);suggestion.hidden=false;
    }
  }
  async function adjustPlan(event){
    event.preventDefault();const text=$("coachAdjustInput").value.trim();if(!text)return;
    if(core.detectCrisis(text)){showCrisis();return;}
    if(!core.isWithinInputLimit(text)){$("coachAdjustStatus").textContent=tr("Μέχρι 1.000 χαρακτήρες.","Up to 1,000 characters.");return;}
    $("coachAdjustStatus").textContent=tr("Γίνεται προσαρμογή…","Adjusting…");
    try{
      const data=await callCoach("adjust",text);
      if(data.crisis){showCrisis();return;}if(data.offTopic){$("coachAdjustStatus").textContent=data.message;return;}
      renderPlan(data);$("coachAdjustInput").value="";
    }catch(e){$("coachAdjustStatus").textContent=tr("Δεν ήταν δυνατή η προσαρμογή. Δοκίμασε ξανά.","The plan could not be adjusted. Please try again.");}
  }
  function sendAnswer(event){
    event.preventDefault();const raw=$("coachInput").value.trim();if(!raw&&!(step===2&&choice))return;
    if(core.detectCrisis(raw)){addMessage(raw,"user");showCrisis();return;}
    if(!core.isWithinInputLimit(raw)){$("coachStatus").textContent=tr("Μέχρι 1.000 χαρακτήρες.","Up to 1,000 characters.");return;}
    if(step===0&&core.isClearlyOffTopic(raw)){addMessage(raw,"user");stopOffTopic();return;}
    if(step===0){answers.task=raw;addMessage(raw,"user");step=1;addPrompt();return;}
    if(step===1){
      const value=Number(raw.replace(",","."));
      if(!Number.isInteger(value)||value<5||value>180){$("coachStatus").textContent=tr("Γράψε έναν ακέραιο αριθμό από 5 έως 180 λεπτά.","Enter a whole number from 5 to 180 minutes.");return;}
      answers.timeMinutes=value;addMessage(value+" "+tr("λεπτά","minutes"),"user");step=2;addPrompt();return;
    }
    const selected=choices[lang].find(item=>item.v===choice);
    if(!selected&&!raw){$("coachStatus").textContent=tr("Διάλεξε μια επιλογή ή γράψε τι σε δυσκολεύει.","Choose an option or describe what is getting in the way.");return;}
    if(!$("coachConsent").checked){$("coachStatus").textContent=tr("Χρειάζεται η συγκατάθεσή σου πριν σταλούν οι απαντήσεις.","Your consent is required before your answers are sent.");return;}
    answers.obstacle=(selected?selected.t:"")+(selected&&raw?" — ":"")+raw;
    addMessage(answers.obstacle,"user");requestPlan();
  }
  function setLanguage(next){
    const changed=lang!==(next==="en"?"en":"el");
    lang=next==="en"?"en":"el";document.documentElement.lang=lang;
    try{localStorage.setItem("nepsis-lang",lang);}catch(e){}
    document.querySelectorAll("[data-el][data-en]").forEach(el=>{el.textContent=lang==="en"?el.dataset.en:el.dataset.el;});
    document.querySelectorAll("[data-set-lang]").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.setLang===lang));b.classList.toggle("active",b.dataset.setLang===lang);});
    $("coachInput").placeholder=lang==="en"?"Write your answer…":"Γράψε την απάντησή σου…";
    if(changed&&step<3&&!$("coachChatCard").hidden){$("chatMessages").innerHTML="";addPrompt();}
  }
  function initReflection(){
    const params=new URLSearchParams(window.location.search);if(params.get("reflect")!=="1")return;
    $("coachChatCard").hidden=true;$("coachPlan").hidden=true;$("coachReflection").hidden=false;
    const mins=Number(params.get("minutes"));$("coachReflectionContext").textContent=Number.isInteger(mins)?tr("Ολοκλήρωσες "+mins+" λεπτά συγκέντρωσης.","You completed "+mins+" minutes of focus."):"";
    $("coachReflectionForm").addEventListener("submit",e=>{e.preventDefault();if(!$("coachReflectionInput").value.trim())return;$("coachReflectionForm").hidden=true;$("coachReflectionThanks").hidden=false;});
  }
  document.addEventListener("DOMContentLoaded",function(){
    document.querySelectorAll("[data-set-lang]").forEach(b=>b.addEventListener("click",()=>setLanguage(b.dataset.setLang)));
    $("coachInput").addEventListener("input",updateCount);
    $("coachForm").addEventListener("submit",sendAnswer);
    $("coachAdjustForm").addEventListener("submit",adjustPlan);
    $("coachRestart").addEventListener("click",()=>window.location.href="coach.html");
    try{const saved=localStorage.getItem("nepsis-lang");if(saved==="en")lang="en";}catch(e){}
    setLanguage(lang);
    initReflection();
    if(!new URLSearchParams(window.location.search).has("reflect"))addPrompt();
  });
})(window,document);
