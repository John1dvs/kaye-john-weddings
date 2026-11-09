
// KAYE & JOHN PRIVATE WEDDING PLANNER
// Supabase publishable key is safe for browser use.
// NEVER put a service_role or secret key in this file.

const SUPABASE_URL = "https://xypwetpywwxwnwplvtew.supabase.co";
const SUPABASE_KEY = "sb_publishable_XjxlObz5z3B-X7fH8dkweg_R4C-u51W";

const KEY = {
  guests: "kayeJohnGuests",
  expenses: "kayeJohnBudget",
  checklist: "kayeJohnChecklist",
  suppliers: "kayeJohnSuppliers",
  journals: "kayeJohnJournalEntries",
  migrated: "kayeJohnSupabaseMigrationV1"
};

const $ = id => document.getElementById(id);
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let user = null;

let state = {
  guests: [],
  expenses: [],
  checklist: [],
  suppliers: [],
  journals: [],
  totalBudget: 0
};

// HELPERS
function localList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function money(value) {
  return "₱" + Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function message(text, bad = false) {
  $("loginMessage").textContent = text;
  $("loginMessage").classList.toggle("error", bad);
}

function visibility(isLoggedIn) {
  $("loginScreen").hidden = isLoggedIn;
  $("plannerApp").hidden = !isLoggedIn;
}

// LOGIN
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  message("Signing in…");

  const { error } = await db.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  });

  if (error) {
    message(error.message, true);
  }
});

$("logoutButton").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    alert(error.message);
  }
});

// MIGRATE OLD LOCAL DATA ONCE
async function migrateLocalOnce() {
  if (localStorage.getItem(KEY.migrated)) return;

  const tables = [
    "wedding_guests",
    "wedding_expenses",
    "wedding_checklist",
    "wedding_journals",
    "wedding_suppliers"
  ];

  const counts = await Promise.all(
    tables.map(table =>
      db.from(table).select("id", { count: "exact", head: true })
    )
  );

  const problem = counts.find(result => result.error);

  if (problem) {
    throw problem.error;
  }

  // If cloud already has data, do not import again.
  if (counts.some(result => (result.count || 0) > 0)) {
    localStorage.setItem(KEY.migrated, "cloud-existing");
    return;
  }

  const guests = localList(KEY.guests)
    .map(item => ({
      name: String(item.name || "").trim(),
      status: ["Invited", "Confirmed", "Declined"].includes(item.status)
        ? item.status
        : "Invited"
    }))
    .filter(item => item.name);

  const expenses = localList(KEY.expenses)
    .map(item => ({
      name: String(item.name || "").trim(),
      amount: Number(item.amount || item.cost || 0),
      expense_date: item.date
        ? String(item.date).slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    }))
    .filter(item =>
      item.name &&
      Number.isFinite(item.amount) &&
      item.amount >= 0
    );

  const tasks = localList(KEY.checklist)
    .map(item => ({
      name: String(item.name || "").trim(),
      completed: !!item.completed
    }))
    .filter(item => item.name);

  let journals = localList(KEY.journals)
    .map(item => ({
      title: String(item.title || "Wedding Journal"),
      content: String(item.content || ""),
      created_at: item.date || new Date().toISOString(),
      updated_at: item.date || new Date().toISOString()
    }))
    .filter(item => item.content);

  const oldNotes = localStorage.getItem("kayeJohnNotes");

  if (oldNotes?.trim() && !journals.length) {
    journals = [{
      title: "My Previous Wedding Notes",
      content: oldNotes
    }];
  }

  const suppliers = localList(KEY.suppliers)
    .map(item => ({
      name: String(item.name || "").trim(),
      service: String(item.service || item.category || ""),
      contact: String(item.contact || "")
    }))
    .filter(item => item.name);

  const batches = [
    ["wedding_guests", guests],
    ["wedding_expenses", expenses],
    ["wedding_checklist", tasks],
    ["wedding_journals", journals],
    ["wedding_suppliers", suppliers]
  ];

  for (const [table, rows] of batches) {
    if (rows.length) {
      const { error } = await db.from(table).insert(rows);

      if (error) {
        throw new Error("Migration " + table + ": " + error.message);
      }
    }
  }

  const budget = Number(
    localStorage.getItem("kayeJohnTotalBudget") ||
    localStorage.getItem("totalBudget") ||
    0
  );

  if (Number.isFinite(budget) && budget >= 0) {
    const { error } = await db.from("wedding_settings").upsert({
      user_id: user.id,
      total_budget: budget
    });

    if (error) throw error;
  }

  localStorage.setItem(KEY.migrated, "done");
}

// LOAD DATA FROM SUPABASE
async function loadData() {
  const specs = [
    ["guests", "wedding_guests"],
    ["expenses", "wedding_expenses"],
    ["checklist", "wedding_checklist"],
    ["journals", "wedding_journals"],
    ["suppliers", "wedding_suppliers"]
  ];

  for (const [key, table] of specs) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("created_at", { ascending: key !== "journals" });

    if (error) throw error;

    state[key] = data || [];
  }

  const { data: setting, error } = await db
    .from("wedding_settings")
    .select("total_budget")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  state.totalBudget = Number(setting?.total_budget || 0);

  // Keep local browser copies as a safety snapshot.
  localStorage.setItem(KEY.guests, JSON.stringify(state.guests));
  localStorage.setItem(KEY.expenses, JSON.stringify(state.expenses));
  localStorage.setItem(KEY.checklist, JSON.stringify(state.checklist));
  localStorage.setItem(KEY.journals, JSON.stringify(state.journals));
  localStorage.setItem(KEY.suppliers, JSON.stringify(state.suppliers));

  renderAll();
}

async function start(currentUser) {
  user = currentUser;
  visibility(true);

  try {
    await migrateLocalOnce();
    await loadData();
  } catch (error) {
    console.error(error);
    alert(
      "Database connection issue: " +
      error.message +
      "\n\nYour old browser data has not been cleared."
    );
  }
}

// GUEST LIST
function renderGuests() {
  $("totalGuests").textContent = state.guests.length;

  $("confirmedGuests").textContent =
    state.guests.filter(item => item.status === "Confirmed").length;

  $("declinedGuests").textContent =
    state.guests.filter(item => item.status === "Declined").length;

  $("guestList").innerHTML = state.guests.length
    ? state.guests.map(item => `
      <tr>
        <td>${esc(item.name)}</td>
        <td>
          <select class="guest-status" data-id="${esc(item.id)}">
            <option ${item.status === "Invited" ? "selected" : ""}>Invited</option>
            <option ${item.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
            <option ${item.status === "Declined" ? "selected" : ""}>Declined</option>
          </select>
        </td>
        <td>
          <button class="delete-button" data-kind="guests" data-id="${esc(item.id)}">
            Delete
          </button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="3" class="empty-message">Your guest list is waiting for its first guest ♡</td></tr>';
}

// EXPENSES AND BUDGET
function renderExpenses() {
  const spent = state.expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  $("budgetAmount").textContent = money(state.totalBudget);
  $("expenseAmount").textContent = money(spent);
  $("remainingAmount").textContent = money(state.totalBudget - spent);
  $("totalBudget").value = state.totalBudget || "";

  $("expenseList").innerHTML = state.expenses.length
    ? state.expenses.map(item => `
      <tr>
        <td>${esc(item.expense_date || "")}</td>
        <td>${esc(item.name)}</td>
        <td class="expense-value">${money(item.amount)}</td>
        <td>
          <button class="delete-button" data-kind="expenses" data-id="${esc(item.id)}">
            Delete
          </button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="4" class="empty-message">Your expense history is waiting ♡</td></tr>';
}

// CHECKLIST
function renderTasks() {
  const done = state.checklist.filter(item => item.completed).length;

  $("totalTasks").textContent = state.checklist.length;
  $("completedTasks").textContent = done;
  $("remainingTasks").textContent = state.checklist.length - done;

  $("progressLabel").textContent = state.checklist.length
    ? Math.round(done / state.checklist.length * 100) + "% Complete"
    : "Just Beginning";

  $("taskList").innerHTML = state.checklist.length
    ? state.checklist.map(item => `
      <div class="checklist-item">
        <label>
          <input
            class="task-toggle"
            type="checkbox"
            data-id="${esc(item.id)}"
            ${item.completed ? "checked" : ""}
          >
          <span>${esc(item.name)}</span>
        </label>
        <button class="delete-button" data-kind="checklist" data-id="${esc(item.id)}">
          Delete
        </button>
      </div>
    `).join("")
    : '<p class="empty-message">Your wedding tasks will appear here ♡</p>';
}

// SUPPLIERS
function renderSuppliers() {
  $("supplierList").innerHTML = state.suppliers.length
    ? state.suppliers.map(item => `
      <div class="supplier-item">
        <div>
          <strong>${esc(item.name)}</strong>
          <p>${esc(item.service || "")}</p>
        </div>
        <button class="delete-button" data-kind="suppliers" data-id="${esc(item.id)}">
          Delete
        </button>
      </div>
    `).join("")
    : '<p class="empty-message">Your supplier list is waiting ♡</p>';
}

// JOURNALS
function renderJournals() {
  $("savedJournalList").innerHTML = state.journals.length
    ? state.journals.map(item => `
      <article class="saved-journal-card">
        <div class="saved-journal-details">
          <h4>${esc(item.title)}</h4>
          <p class="journal-date">
            ${esc(item.created_at ? new Date(item.created_at).toLocaleDateString() : "")}
          </p>
          <p>${esc(item.content).replace(/\n/g, "<br>")}</p>
        </div>
        <div class="saved-journal-buttons">
          <button class="open-journal-button" data-id="${esc(item.id)}">Open</button>
          <button class="delete-button" data-kind="journals" data-id="${esc(item.id)}">Delete</button>
        </div>
      </article>
    `).join("")
    : '<p class="empty-message">No saved journals yet ♡</p>';
}

function renderAll() {
  renderGuests();
  renderExpenses();
  renderTasks();
  renderSuppliers();
  renderJournals();
}

// DATABASE INSERT AND DELETE
async function insert(table, key, row) {
  const { data: created, error } = await db
    .from(table)
    .insert({ ...row, user_id: user.id })
    .select()
    .single();

  if (error) {
    alert("Save failed: " + error.message);
    return null;
  }

  state[key].push(created);
  renderAll();
  return created;
}

async function remove(table, key, id) {
  const { error } = await db
    .from(table)
    .delete()
    .eq("id", id);

  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }

  state[key] = state[key].filter(item => item.id !== id);
  renderAll();
}

// FORM EVENTS
$("guestForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("guestName").value.trim();

  if (
    name &&
    await insert("wedding_guests", "guests", {
      name,
      status: $("guestStatus").value
    })
  ) {
    event.target.reset();
  }
});

$("expenseForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("expenseName").value.trim();
  const amount = Number($("expenseCost").value);

  if (
    name &&
    amount > 0 &&
    await insert("wedding_expenses", "expenses", {
      name,
      amount,
      expense_date: new Date().toISOString().slice(0, 10)
    })
  ) {
    event.target.reset();
  }
});

$("totalBudget").addEventListener("change", async event => {
  const total = Number(event.target.value || 0);

  if (total < 0 || !Number.isFinite(total)) {
    alert("Enter a valid budget.");
    return;
  }

  const { error } = await db.from("wedding_settings").upsert({
    user_id: user.id,
    total_budget: total
  });

  if (error) {
    alert(error.message);
  } else {
    state.totalBudget = total;
    renderExpenses();
  }
});

$("taskForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("taskName").value.trim();

  if (
    name &&
    await insert("wedding_checklist", "checklist", {
      name,
      completed: false
    })
  ) {
    event.target.reset();
  }
});

$("supplierForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("supplierName").value.trim();
  const service = $("supplierService").value.trim();

  if (
    name &&
    await insert("wedding_suppliers", "suppliers", {
      name,
      service,
      contact: ""
    })
  ) {
    event.target.reset();
  }
});

// SAVE OR UPDATE JOURNAL
$("saveJournal").addEventListener("click", async () => {
  const title = $("journalTitle").value.trim();
  const content = $("weddingNotes").value.trim();

  if (!title || !content) {
    $("journalStatus").textContent =
      "Please enter a title and your journal entry first ♡";
    return;
  }

  const editing = $("saveJournal").dataset.editingId;

  if (editing) {
    const { data: updated, error } = await db
      .from("wedding_journals")
      .update({
        title,
        content,
        updated_at: new Date().toISOString()
      })
      .eq("id", editing)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    state.journals = state.journals.map(item =>
      item.id === editing ? updated : item
    );

    $("saveJournal").dataset.editingId = "";
  } else {
    const created = await insert("wedding_journals", "journals", {
      title,
      content
    });

    if (!created) return;
  }

  $("journalTitle").value = "";
  $("weddingNotes").value = "";

  $("journalStatus").textContent =
    "Your journal has been saved successfully ♡";

  renderJournals();
});

// DELETE AND OPEN JOURNAL BUTTONS
document.addEventListener("click", async event => {
  const del = event.target.closest("[data-kind][data-id]");

  if (del && del.dataset.kind) {
    const kind = del.dataset.kind;

    const table = {
      guests: "wedding_guests",
      expenses: "wedding_expenses",
      checklist: "wedding_checklist",
      suppliers: "wedding_suppliers",
      journals: "wedding_journals"
    }[kind];

    if (confirm("Are you sure you want to delete this item?")) {
      await remove(table, kind, del.dataset.id);
    }
  }

  const open = event.target.closest(".open-journal-button");

  if (open) {
    const item = state.journals.find(
      journal => journal.id === open.dataset.id
    );

    if (item) {
      $("journalTitle").value = item.title;
      $("weddingNotes").value = item.content;
      $("saveJournal").dataset.editingId = item.id;

      $("journalStatus").textContent =
        "Journal opened. You can edit and save it ♡";

      document.querySelector('a[href="#journal"]').click();
    }
  }
});

// UPDATE GUEST STATUS AND CHECKLIST
document.addEventListener("change", async event => {
  if (event.target.matches(".guest-status")) {
    const id = event.target.dataset.id;
    const status = event.target.value;

    const { error } = await db
      .from("wedding_guests")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      const item = state.guests.find(value => value.id === id);
      if (item) item.status = status;
      renderGuests();
    }
  }

  if (event.target.matches(".task-toggle")) {
    const id = event.target.dataset.id;
    const completed = event.target.checked;

    const { error } = await db
      .from("wedding_checklist")
      .update({ completed })
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      const item = state.checklist.find(value => value.id === id);
      if (item) item.completed = completed;
      renderTasks();
    }
  }
});

// NAVIGATION
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();

    const target = link.getAttribute("href").slice(1);

    document.querySelectorAll(".planner-section").forEach(section => {
      section.classList.remove("active");
    });

    if (target === "dashboard") {
      $("dashboard").classList.add("active");
      document.querySelector(".overview").classList.add("active");
    } else {
      $(target).classList.add("active");
    }

    document.querySelectorAll(".nav-link").forEach(nav => {
      nav.classList.toggle("active", nav === link);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// AUTH SESSION
db.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    setTimeout(() => start(session.user), 0);
  } else {
    user = null;
    visibility(false);

    if (event === "SIGNED_OUT") {
      message("You have signed out safely ♡");
    }
  }
});

// CHECK EXISTING LOGIN SESSION
(async () => {
  visibility(false);

  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error) {
    message(error.message, true);
  } else if (session?.user) {
    await start(session.user);
  }
})();
