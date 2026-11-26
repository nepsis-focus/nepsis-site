/* Community page logic. All server writes go through the community_* RPC functions.
   Every piece of user text is written with textContent, never innerHTML. */
(() => {
  "use strict";

  const SB_URL = "https://emhukqvetlhjgadgskbl.supabase.co";
  const SB_KEY = "sb_publishable_sdWqagLvXYQsmveUrmmw9g_neLoRMCl";
  const sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SB_URL, SB_KEY, window.NepsisGoogleAuth ? window.NepsisGoogleAuth.clientOptions() : {})
    : null;

  const $ = (id) => document.getElementById(id);
  const state = { me: null, friends: [], selected: new Map(), team: null, members: new Map(), channel: null, seen: new Set() };

  const ERRORS = {
    handle_not_found: "Δεν βρέθηκε αυτό το tag.",
    cannot_add_self: "Δεν μπορείς να προσθέσεις τον εαυτό σου.",
    team_full: "Η ομάδα είναι γεμάτη.",
    not_a_friend: "Στην ομάδα μπορείς να προσθέσεις μόνο φίλους.",
    invite_invalid: "Η πρόσκληση έχει λήξει ή έχει εξαντληθεί.",
    rate_limited: "Στέλνεις πολύ γρήγορα. Περίμενε λίγο.",
    invalid_message_length: "Το μήνυμα πρέπει να έχει από 1 έως 2000 χαρακτήρες.",
    invalid_team_name: "Το όνομα ομάδας πρέπει να έχει από 1 έως 40 χαρακτήρες.",
    invalid_expiry: "Η πρόσκληση δεν μπορεί να έχει αυτή τη διάρκεια."
  };

  function friendly(err) {
    const text = (err && err.message) || "";
    for (const key of Object.keys(ERRORS)) if (text.includes(key)) return ERRORS[key];
    return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
  }

  function say(text, isError) {
    const box = $("communityMessage");
    box.textContent = text || "";
    box.className = "message" + (isError ? " is-error" : "");
  }

  function initials(name, handle) {
    const base = (name || (handle || "?").split("#")[0] || "?").trim();
    return (base.slice(0, 2) || "?").toUpperCase();
  }

  function avatar(name, handle) {
    const a = document.createElement("span");
    a.className = "community-avatar";
    a.setAttribute("aria-hidden", "true");
    a.textContent = initials(name, handle);
    return a;
  }

  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(label, className, onClick) {
    const b = node("button", className || "btn secondary", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function pageUrl(params) {
    const u = new URL("community.html", location.href);
    u.search = new URLSearchParams(params).toString();
    return u.href;
  }

  // ---------- profile ----------
  async function loadProfile() {
    const { data, error } = await sb.from("community_profiles").select("handle, display_name").eq("user_id", state.me).maybeSingle();
    if (error) throw error;
    $("claimBlock").hidden = !!data;
    $("profileBlock").hidden = !data;
    if (data) {
      state.handle = data.handle;
      $("myHandle").textContent = data.handle;
    }
  }

  $("claimForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("claimName").value.trim();
    if (name.length < 1) return say("Γράψε ένα όνομα.", true);
    try {
      await sb.rpc("community_claim_handle", { p_name: name });
      say("Το tag σου είναι έτοιμο.");
      await loadProfile();
    } catch (err) { say(friendly(err), true); }
  });

  $("copyHandle").addEventListener("click", async () => {
    const ok = await copyText(state.handle || "");
    say(ok ? "Το tag αντιγράφηκε." : "Αντίγραψε το tag χειροκίνητα.", !ok);
  });

  $("copyInviteLink").addEventListener("click", async () => {
    const link = pageUrl({ add: state.handle || "" });
    const ok = await copyText(link);
    say(ok ? "Ο σύνδεσμος φιλίας αντιγράφηκε." : link, !ok);
  });

  // ---------- friends ----------
  async function loadFriends() {
    const { data, error } = await sb.rpc("community_list_friends");
    if (error) throw error;
    state.friends = data || [];
    renderFriends();
  }

  function renderFriends() {
    const incomingBox = $("incomingList");
    const friendBox = $("friendList");
    incomingBox.replaceChildren();
    friendBox.replaceChildren();
    state.selected.forEach((_, id) => {
      if (!state.friends.some(f => f.friend_id === id && f.friend_status === "accepted")) state.selected.delete(id);
    });

    const incoming = state.friends.filter(f => f.friend_status === "pending" && f.requested_by_id !== state.me);
    const outgoing = state.friends.filter(f => f.friend_status === "pending" && f.requested_by_id === state.me);
    const accepted = state.friends.filter(f => f.friend_status === "accepted");

    incoming.forEach(f => {
      const li = node("li", "community-item");
      li.append(avatar(f.friend_name, f.friend_handle));
      const meta = node("div", "community-meta");
      meta.append(node("div", "community-name", f.friend_name || f.friend_handle), node("div", "community-sub", f.friend_handle));
      li.append(meta);
      const actions = node("div", "community-actions");
      actions.append(
        button("Αποδοχή", "btn btn-primary", () => respond(f.friend_id, true)),
        button("Απόρριψη", "btn secondary", () => respond(f.friend_id, false))
      );
      li.append(actions);
      incomingBox.append(li);
    });
    $("incomingBlock").hidden = incoming.length === 0;

    outgoing.forEach(f => {
      const li = node("li", "community-item");
      li.append(avatar(f.friend_name, f.friend_handle));
      const meta = node("div", "community-meta");
      meta.append(node("div", "community-name", f.friend_name || f.friend_handle), node("div", "community-sub", "Αναμονή αποδοχής"));
      li.append(meta);
      incomingBox.append(li);
    });

    if (accepted.length === 0) {
      friendBox.append(node("li", "community-muted", "Ακόμα δεν έχεις φίλους. Πρόσθεσε κάποιον με το tag του."));
    }
    accepted.forEach(f => {
      const isSelected = state.selected.has(f.friend_id);
      const li = node("li", "community-item" + (isSelected ? " is-selected" : ""));
      li.draggable = true;
      li.dataset.id = f.friend_id;
      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", f.friend_id);
        e.dataTransfer.effectAllowed = "copy";
      });
      li.append(avatar(f.friend_name, f.friend_handle));
      const meta = node("div", "community-meta");
      meta.append(node("div", "community-name", f.friend_name || f.friend_handle), node("div", "community-sub", f.friend_handle));
      li.append(meta);
      const actions = node("div", "community-actions");
      actions.append(
        button(isSelected ? "Αφαίρεση από ομάδα" : "Στην ομάδα", "btn secondary", () => toggleSelected(f)),
        button("Μπλοκ", "btn secondary", () => block(f))
      );
      li.append(actions);
      friendBox.append(li);
    });
    renderSelected();
  }

  async function respond(userId, accept) {
    try {
      await sb.rpc("community_respond_friend_request", { p_user: userId, p_accept: accept });
      await loadFriends();
    } catch (err) { say(friendly(err), true); }
  }

  async function block(friend) {
    if (!window.confirm("Να μπλοκάρω αυτόν τον χρήστη; Θα χάσετε τη φιλία και δεν θα βλέπεις τα μηνύματά του.")) return;
    try {
      await sb.rpc("community_block_user", { p_user: friend.friend_id });
      state.selected.delete(friend.friend_id);
      await loadFriends();
      say("Ο χρήστης μπλοκαρίστηκε.");
    } catch (err) { say(friendly(err), true); }
  }

  $("addFriendForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const handle = $("friendHandle").value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}#[0-9]{4}$/.test(handle)) return say("Γράψε το tag ακριβώς, όπως π.χ. maria#4821.", true);
    try {
      await sb.rpc("community_send_friend_request", { p_handle: handle });
      $("friendHandle").value = "";
      say("Το αίτημα στάλθηκε.");
      await loadFriends();
    } catch (err) { say(friendly(err), true); }
  });

  // ---------- team composer (drag friends or tap them) ----------
  function toggleSelected(friend) {
    if (state.selected.has(friend.friend_id)) state.selected.delete(friend.friend_id);
    else state.selected.set(friend.friend_id, friend);
    renderFriends();
  }

  function renderSelected() {
    const box = $("teamSelected");
    box.replaceChildren();
    if (state.selected.size === 0) {
      box.append(node("span", "community-muted", "Σύρε φίλους εδώ, ή πάτα «Στην ομάδα» στη λίστα."));
      return;
    }
    state.selected.forEach((f, id) => {
      const chip = node("button", "community-chip", f.friend_name || f.friend_handle);
      chip.type = "button";
      chip.title = "Αφαίρεση";
      chip.addEventListener("click", () => { state.selected.delete(id); renderFriends(); });
      box.append(chip);
    });
  }

  const drop = $("teamDrop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-over");
    const id = e.dataTransfer.getData("text/plain");
    const friend = state.friends.find(f => f.friend_id === id && f.friend_status === "accepted");
    if (friend) { state.selected.set(id, friend); renderFriends(); }
  });

  $("newTeamBtn").addEventListener("click", () => {
    const open = $("teamForm").hidden;
    $("teamForm").hidden = !open;
    if (open) $("teamName").focus();
  });

  $("teamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("teamName").value.trim();
    if (!name) return say("Γράψε όνομα για την ομάδα.", true);
    try {
      const teamId = await sb.rpc("community_create_team", { p_name: name, p_member_ids: Array.from(state.selected.keys()) });
      if (teamId.error) throw teamId.error;
      $("teamName").value = "";
      state.selected.clear();
      $("teamForm").hidden = true;
      renderFriends();
      await loadTeams();
      say("Η ομάδα δημιουργήθηκε.");
      openTeam(teamId.data);
    } catch (err) { say(friendly(err), true); }
  });

  // ---------- teams ----------
  async function loadTeams() {
    const { data, error } = await sb.from("community_teams").select("id, name, owner_id").order("created_at", { ascending: true });
    if (error) throw error;
    const box = $("teamList");
    box.replaceChildren();
    if (!data || data.length === 0) {
      box.append(node("li", "community-muted", "Δεν είσαι σε καμία ομάδα ακόμα."));
      return;
    }
    data.forEach(t => {
      const li = node("li", "community-item");
      const meta = node("div", "community-meta");
      meta.append(node("div", "community-name", t.name), node("div", "community-sub", t.owner_id === state.me ? "Εσύ είσαι ο δημιουργός" : "Μέλος"));
      li.append(meta);
      li.append(button("Άνοιγμα", "btn secondary", () => openTeam(t.id)));
      box.append(li);
    });
  }

  async function openTeam(teamId) {
    state.team = teamId;
    state.seen = new Set();
    $("teamView").hidden = false;
    $("teamView").dataset.team = teamId;
    const { data: team } = await sb.from("community_teams").select("name").eq("id", teamId).maybeSingle();
    $("teamTitle").textContent = team ? team.name : "Ομάδα";
    $("inviteOut").hidden = true;
    await loadMembers(teamId);
    await loadMessages(teamId);
    subscribe(teamId);
    $("teamView").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadMembers(teamId) {
    const { data, error } = await sb.rpc("community_list_team_members", { p_team: teamId });
    if (error) throw error;
    state.members = new Map((data || []).map(m => [m.member_id, m]));
    const box = $("memberList");
    box.replaceChildren();
    (data || []).forEach(m => {
      const chip = node("span", "community-chip", (m.member_name || m.member_handle) + (m.member_role === "owner" ? " · δημιουργός" : ""));
      box.append(chip);
    });
  }

  async function loadMessages(teamId) {
    const { data, error } = await sb.from("community_messages")
      .select("id, sender_id, body, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const box = $("messages");
    box.replaceChildren();
    (data || []).slice().reverse().forEach(addMessage);
    box.scrollTop = box.scrollHeight;
  }

  function addMessage(row) {
    if (state.seen.has(row.id)) return;
    state.seen.add(row.id);
    const box = $("messages");
    const member = state.members.get(row.sender_id);
    const wrap = node("div", "community-msg");
    const head = node("div", "community-msg-head");
    head.append(
      node("span", "", member ? (member.member_name || member.member_handle) : "Μέλος"),
      node("span", "", new Date(row.created_at).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" }))
    );
    wrap.append(head, node("div", "community-msg-body", row.body));
    if (row.sender_id !== state.me) {
      const rep = node("button", "community-msg-report", "Αναφορά");
      rep.type = "button";
      rep.addEventListener("click", () => report(row.id));
      wrap.append(rep);
    }
    box.append(wrap);
  }

  async function report(messageId) {
    const reason = window.prompt("Γιατί αναφέρεις αυτό το μήνυμα;");
    if (!reason || !reason.trim()) return;
    try {
      await sb.rpc("community_report_message", { p_message: messageId, p_reason: reason.trim() });
      say("Η αναφορά στάλθηκε. Ευχαριστούμε.");
    } catch (err) { say(friendly(err), true); }
  }

  function subscribe(teamId) {
    if (state.channel) { sb.removeChannel(state.channel); state.channel = null; }
    state.channel = sb.channel("community-team-" + teamId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter: "team_id=eq." + teamId }, (payload) => {
        if (!state.members.has(payload.new.sender_id)) loadMembers(teamId).catch(() => {});
        addMessage(payload.new);
        const box = $("messages");
        box.scrollTop = box.scrollHeight;
      })
      .subscribe();
  }

  $("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("chatBody");
    const body = input.value.trim();
    if (!body || !state.team) return;
    try {
      const id = await sb.rpc("community_send_message", { p_team: state.team, p_body: body });
      if (id.error) throw id.error;
      input.value = "";
      if (id.data) addMessage({ id: id.data, sender_id: state.me, body, created_at: new Date().toISOString() });
      const box = $("messages");
      box.scrollTop = box.scrollHeight;
    } catch (err) { say(friendly(err), true); }
  });

  $("inviteBtn").addEventListener("click", async () => {
    if (!state.team) return;
    try {
      const { data, error } = await sb.rpc("community_create_invite", { p_team: state.team, p_hours: 24, p_max_uses: 10 });
      if (error) throw error;
      const link = pageUrl({ join: data });
      $("inviteLink").value = link;
      $("inviteOut").hidden = false;
      say("Η πρόσκληση δημιουργήθηκε. Ισχύει 24 ώρες, για έως 10 άτομα.");
    } catch (err) { say(friendly(err), true); }
  });

  $("copyInvite").addEventListener("click", async () => {
    const ok = await copyText($("inviteLink").value);
    say(ok ? "Η πρόσκληση αντιγράφηκε." : "Αντίγραψε τον σύνδεσμο χειροκίνητα.", !ok);
  });

  // ---------- links: ?add=tag (friend link) and ?join=token (team invite) ----------
  async function handleLinks() {
    const params = new URLSearchParams(location.search);
    const join = params.get("join");
    const add = params.get("add");
    if (add) {
      $("friendHandle").value = add.toLowerCase();
      say("Πάτα «Στείλε αίτημα» για να προσθέσεις αυτό το tag.");
    }
    if (join) {
      try {
        const { data, error } = await sb.rpc("community_join_with_invite", { p_token: join });
        if (error) throw error;
        history.replaceState(null, "", location.pathname);
        await loadTeams();
        say("Μπήκες στην ομάδα.");
        openTeam(data);
      } catch (err) { say(friendly(err), true); }
    }
  }

  // ---------- start ----------
  async function start() {
    if (!sb) { $("communityGate").hidden = false; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { $("communityGate").hidden = false; return; }
    state.me = session.user.id;
    $("communityGate").hidden = true;
    $("communityApp").hidden = false;
    try {
      await loadProfile();
      await loadFriends();
      await loadTeams();
      await handleLinks();
    } catch (err) { say(friendly(err), true); }
  }

  if (sb) {
    sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") location.reload();
    });
  }
  start();
})();
