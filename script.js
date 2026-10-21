
"use strict";

/* ==========================================
   CLEBERLAB — APLICATIVO DEMONSTRATIVO
   Cadastro local, projetos e documentação
========================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_USERS = "cleberlab_demo_users";
const STORAGE_SESSION = "cleberlab_demo_session";
const STORAGE_DATA_PREFIX = "cleberlab_data_v3_";

let currentUser = null;
let data = null;
let modalType = "";
let editingId = null;
let toastTimeout = null;
let reportImages = [];
let notebookImages = [];

const pageNames = {
  dashboard: "Visão geral",
  projects: "Meus projetos",
  tasks: "Tarefas",
  materials: "Materiais e custos",
  tests: "Testes e melhorias",
  ideas: "Gerador de ideias",
  technical: "Relatório técnico",
  notebook: "Diário de bordo",
  compare: "Comparar protótipos"
};

const taskStatuses = [
  { id: "todo", label: "A fazer" },
  { id: "doing", label: "Em andamento" },
  { id: "done", label: "Concluído" }
];

/* ==========================================
   FUNÇÕES GERAIS
========================================== */

function uid() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function money(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(value) {
  if (!value) return "Sem data";

  const date = new Date(value + "T12:00:00");

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("pt-BR");
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function showToast(message, isError = false) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function readUsers() {
  try {
    const result = JSON.parse(
      localStorage.getItem(STORAGE_USERS) || "[]"
    );

    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    return true;
  } catch {
    showToast("Não foi possível salvar os dados neste navegador.", true);
    return false;
  }
}

function saveData() {
  if (!currentUser || !data) return false;

  try {
    localStorage.setItem(
      STORAGE_DATA_PREFIX + currentUser.id,
      JSON.stringify(data)
    );

    return true;
  } catch {
    showToast(
      "O armazenamento do navegador está cheio. Tente remover algumas fotos.",
      true
    );

    return false;
  }
}

function emptyData() {
  return {
    projects: [],
    tasks: [],
    materials: [],
    tests: [],
    notebook: [],
    report: {
      projectId: "",
      team: "",
      institution: "",
      objective: "",
      method: "",
      limits: "",
      images: []
    }
  };
}

function loadData(user) {
  try {
    const stored = localStorage.getItem(
      STORAGE_DATA_PREFIX + user.id
    );

    if (!stored) return emptyData();

    const parsed = JSON.parse(stored);
    const defaults = emptyData();

    return {
      ...defaults,
      ...parsed,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      tests: Array.isArray(parsed.tests) ? parsed.tests : [],
      notebook: Array.isArray(parsed.notebook) ? parsed.notebook : [],
      report: { ...defaults.report, ...(parsed.report || {}) }
    };
  } catch {
    showToast("Alguns dados não puderam ser lidos.", true);
    return emptyData();
  }
}

/* ==========================================
   CADASTRO E LOGIN
========================================== */

function switchAuth(mode) {
  const isRegister = mode === "register";

  $("#loginForm").hidden = isRegister;
  $("#registerForm").hidden = !isRegister;

  $$("[data-auth-tab]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.authTab === mode
    );
  });
}

function startSession(user, remember = true) {
  currentUser = user;
  data = loadData(user);

  try {
    sessionStorage.removeItem(STORAGE_SESSION);
    localStorage.removeItem(STORAGE_SESSION);

    if (remember) {
      localStorage.setItem(STORAGE_SESSION, user.id);
    } else {
      sessionStorage.setItem(STORAGE_SESSION, user.id);
    }
  } catch {
    showToast("Não foi possível manter a sessão neste navegador.", true);
  }

  $("#authScreen").hidden = true;
  $("#app").hidden = false;

  $("#sidebarUserName").textContent = user.name;
  $("#sidebarUserEmail").textContent = user.email;
  $("#userAvatar").textContent = user.name.charAt(0).toUpperCase();
  $("#welcomeTitle").textContent =
    `Olá, ${user.name.split(" ")[0]}! Suas ideias merecem sair do papel.`;

  switchPage("dashboard");
  refreshEverything();

  showToast(`Olá, ${user.name.split(" ")[0]}! Você entrou no CleberLab.`);
}

function logout() {
  try {
    localStorage.removeItem(STORAGE_SESSION);
    sessionStorage.removeItem(STORAGE_SESSION);
  } catch {
    // O navegador pode bloquear o armazenamento.
  }

  currentUser = null;
  data = null;
  reportImages = [];
  notebookImages = [];

  $("#app").hidden = true;
  $("#authScreen").hidden = false;

  $("#loginForm").reset();
  $("#registerForm").reset();

  switchAuth("login");
  showToast("Você saiu da sua conta.");
}

$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const email = $("#loginEmail").value.trim().toLowerCase();
  const password = $("#loginPassword").value;

  const user = readUsers().find(item =>
    item.email.toLowerCase() === email &&
    item.password === password
  );

  if (!user) {
    showToast("E-mail ou senha incorretos. Confira os dados e tente novamente.", true);
    return;
  }

  startSession(user, $("#rememberMe").checked);
});

$("#registerForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#registerName").value.trim();
  const email = $("#registerEmail").value.trim().toLowerCase();
  const password = $("#registerPassword").value;
  const confirmation = $("#registerConfirm").value;

  if (name.length < 2) {
    showToast("Digite seu nome para continuar.", true);
    return;
  }

  if (password.length < 6) {
    showToast("Sua senha precisa ter pelo menos 6 caracteres.", true);
    return;
  }

  if (password !== confirmation) {
    showToast("As duas senhas estão diferentes.", true);
    return;
  }

  const users = readUsers();

  if (users.some(user => user.email.toLowerCase() === email)) {
    showToast("Este e-mail já está cadastrado. Tente entrar.", true);
    return;
  }

  const user = {
    id: uid(),
    name,
    email,
    password,
    createdAt: new Date().toISOString()
  };

  users.push(user);

  if (!saveUsers(users)) return;

  try {
    localStorage.setItem(
      STORAGE_DATA_PREFIX + user.id,
      JSON.stringify(emptyData())
    );
  } catch {
    showToast("Não foi possível preparar a conta. Verifique o espaço disponível.", true);
    return;
  }

  startSession(user, true);
});

$$("[data-auth-tab]").forEach(button => {
  button.addEventListener("click", () => {
    switchAuth(button.dataset.authTab);
  });
});

$$("[data-switch-auth]").forEach(button => {
  button.addEventListener("click", () => {
    switchAuth(button.dataset.switchAuth);
  });
});

$$("[data-toggle-password]").forEach(button => {
  button.addEventListener("click", () => {
    const input = $("#" + button.dataset.togglePassword);

    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";

    button.innerHTML = input.type === "password"
      ? '<i class="fa-regular fa-eye"></i>'
      : '<i class="fa-regular fa-eye-slash"></i>';
  });
});

/* ==========================================
   NAVEGAÇÃO
========================================== */

function switchPage(page) {
  if (!pageNames[page]) return;

  $$(".page").forEach(section => {
    section.classList.toggle(
      "active",
      section.id === `page-${page}`
    );
  });

  $$(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  $("#pageTitle").textContent = pageNames[page];

  $("#sidebar").classList.remove("open");

  if (page === "technical") renderReportPreview();
  if (page === "notebook") renderNotebook();
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");

  if (pageButton && pageButton.classList.contains("nav-link")) {
    switchPage(pageButton.dataset.page);
    return;
  }

  if (pageButton && pageButton.dataset.page) {
    switchPage(pageButton.dataset.page);
  }

  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) return;

  const action = actionButton.dataset.action;

  if (action === "logout") logout();
  if (action === "new-project") openProjectModal();
  if (action === "new-task") openTaskModal();
  if (action === "new-material") openMaterialModal();
  if (action === "new-test") openTestModal();
  if (action === "compare") compareVersions();
  if (action === "reset-compare") resetComparison();
  if (action === "print-technical") printPage("technical");
  if (action === "print-notebook") printPage("notebook");
});

$("#mobileMenu").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

document.addEventListener("click", event => {
  const sidebar = $("#sidebar");

  if (
    window.innerWidth <= 800 &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(event.target) &&
    !event.target.closest("#mobileMenu")
  ) {
    sidebar.classList.remove("open");
  }
});

/* ==========================================
   PROJETOS
========================================== */

function getProject(id) {
  return data?.projects.find(project => project.id === id);
}

function projectOptions(selectedId = "") {
  if (!data || data.projects.length === 0) {
    return '<option value="">Crie um projeto primeiro</option>';
  }

  return data.projects.map(project => `
    <option value="${escapeHTML(project.id)}"
      ${project.id === selectedId ? "selected" : ""}>
      ${escapeHTML(project.name)}
    </option>
  `).join("");
}

function updateProjectSelects() {
  if (!data) return;

  const selects = [
    "#taskProjectSelect",
    "#testProjectSelect",
    "#technicalProjectSelect",
    "#notebookProjectSelect"
  ];

  selects.forEach(selector => {
    const select = $(selector);
    if (!select) return;

    const oldValue = select.value;
    const preferred = getProject(oldValue)
      ? oldValue
      : data.projects[0]?.id || "";

    select.innerHTML = projectOptions(preferred);
    select.disabled = data.projects.length === 0;
  });

  const reportSelect = $("#technicalProjectSelect");

  if (reportSelect && data.report.projectId &&
      getProject(data.report.projectId)) {
    reportSelect.value = data.report.projectId;
  }
}

function openProjectModal(projectId = "") {
  if (!data) return;

  const project = getProject(projectId);

  modalType = "project";
  editingId = projectId || null;

  $("#modalTitle").textContent = project
    ? "Editar projeto"
    : "Criar novo projeto";

  $("#modalFields").innerHTML = `
    <div class="field">
      <label for="modalProjectName">Nome do projeto *</label>
      <input id="modalProjectName" required maxlength="100"
        placeholder="Ex.: Lixeira inteligente"
        value="${escapeHTML(project?.name || "")}">
    </div>
    <div class="field">
      <label for="modalProjectDescription">Descrição</label>
      <textarea id="modalProjectDescription" maxlength="1000"
        placeholder="O que você pretende criar ou resolver?">${escapeHTML(project?.description || "")}</textarea>
    </div>
    <div class="field">
      <label for="modalProjectStatus">Situação</label>
      <select id="modalProjectStatus">
        <option value="active">Em desenvolvimento</option>
        <option value="paused">Pausado</option>
        <option value="done">Concluído</option>
      </select>
    </div>
  `;

  $("#modalProjectStatus").value = project?.status || "active";
  openModal();
}

function renderProjectCard(project) {
  const tasks = data.tasks.filter(task => task.projectId === project.id);
  const done = tasks.filter(task => task.status === "done").length;
  const progress = tasks.length
    ? Math.round((done / tasks.length) * 100)
    : 0;

  const statusNames = {
    active: "Em desenvolvimento",
    paused: "Pausado",
    done: "Concluído"
  };

  return `
    <article class="project-card">
      <div class="project-top">
        <div class="project-symbol"><i class="fa-solid fa-flask"></i></div>
        <span class="tag">${statusNames[project.status] || "Em desenvolvimento"}</span>
      </div>
      <h3>${escapeHTML(project.name)}</h3>
      <p>${escapeHTML(project.description || "Projeto sem descrição.")}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      <div class="meta">
        <span><i class="fa-solid fa-list-check"></i> ${tasks.length} tarefas</span>
        <span><i class="fa-solid fa-chart-line"></i> ${progress}% concluído</span>
      </div>
      <div class="project-actions">
        <button class="btn soft" data-open-project-tasks="${escapeHTML(project.id)}">Ver tarefas</button>
        <button class="btn outline" data-edit-project="${escapeHTML(project.id)}" aria-label="Editar projeto"><i class="fa-solid fa-pen"></i></button>
        <button class="btn outline" data-delete-project="${escapeHTML(project.id)}" aria-label="Excluir projeto"><i class="fa-solid fa-trash"></i></button>
      </div>
    </article>
  `;
}

function renderProjects() {
  if (!data) return;

  const search = ($("#projectSearch")?.value || "").toLowerCase();

  const projects = [...data.projects].filter(project =>
    project.name.toLowerCase().includes(search) ||
    (project.description || "").toLowerCase().includes(search)
  );

  $("#projectGrid").innerHTML = projects.map(renderProjectCard).join("");
  $("#dashboardProjects").innerHTML = [...data.projects]
    .slice(-3)
    .reverse()
    .map(renderProjectCard)
    .join("");

  $("#emptyProjects").hidden = projects.length !== 0;
  $("#dashboardEmpty").hidden = data.projects.length !== 0;
}

$("#projectSearch").addEventListener("input", renderProjects);

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-project]");
  const remove = event.target.closest("[data-delete-project]");
  const openTasks = event.target.closest("[data-open-project-tasks]");

  if (edit) openProjectModal(edit.dataset.editProject);

  if (remove) {
    const project = getProject(remove.dataset.deleteProject);
    if (!project) return;

    const confirmed = confirm(
      `Excluir o projeto "${project.name}"?\n\nAs tarefas, materiais, testes e registros ligados a ele também serão excluídos.`
    );

    if (!confirmed) return;

    const id = project.id;

    data.projects = data.projects.filter(item => item.id !== id);
    data.tasks = data.tasks.filter(item => item.projectId !== id);
    data.materials = data.materials.filter(item => item.projectId !== id);
    data.tests = data.tests.filter(item => item.projectId !== id);
    data.notebook = data.notebook.filter(item => item.projectId !== id);

    if (data.report.projectId === id) data.report.projectId = "";

    saveData();
    refreshEverything();
    showToast("Projeto excluído.");
  }

  if (openTasks) {
    updateProjectSelects();
    $("#taskProjectSelect").value = openTasks.dataset.openProjectTasks;
    switchPage("tasks");
    renderTasks();
  }
});

/* ==========================================
   TAREFAS
========================================== */

function openTaskModal(taskId = "") {
  if (!data) return;

  if (!data.projects.length) {
    showToast("Primeiro crie um projeto para adicionar tarefas.", true);
    openProjectModal();
    return;
  }

  const task = data.tasks.find(item => item.id === taskId);
  const projectId = task?.projectId || $("#taskProjectSelect").value || data.projects[0].id;

  modalType = "task";
  editingId = taskId || null;

  $("#modalTitle").textContent = task ? "Editar tarefa" : "Nova tarefa";

  $("#modalFields").innerHTML = `
    <div class="field"><label for="modalTaskName">Nome da tarefa *</label>
      <input id="modalTaskName" required maxlength="120" placeholder="Ex.: Pesquisar sensores" value="${escapeHTML(task?.name || "")}">
    </div>
    <div class="field"><label for="modalTaskDescription">Descrição</label>
      <textarea id="modalTaskDescription" maxlength="1000" placeholder="O que precisa ser feito?">${escapeHTML(task?.description || "")}</textarea>
    </div>
    <div class="field"><label for="modalTaskProject">Projeto</label>
      <select id="modalTaskProject">${projectOptions(projectId)}</select>
    </div>
    <div class="field"><label for="modalTaskStatus">Etapa</label>
      <select id="modalTaskStatus">
        <option value="todo">A fazer</option>
        <option value="doing">Em andamento</option>
        <option value="done">Concluído</option>
      </select>
    </div>
  `;

  $("#modalTaskStatus").value = task?.status || "todo";
  openModal();
}

function renderTasks() {
  if (!data) return;

  const projectId = $("#taskProjectSelect").value;
  const tasks = data.tasks.filter(task => task.projectId === projectId);

  $("#kanbanBoard").innerHTML = taskStatuses.map(status => {
    const group = tasks.filter(task => task.status === status.id);

    return `
      <div class="kanban-col">
        <h3>${status.label}<span class="kanban-count">${group.length}</span></h3>
        ${group.length ? group.map(task => `
          <article class="task">
            <h4>${escapeHTML(task.name)}</h4>
            <p>${escapeHTML(task.description || "Sem descrição.")}</p>
            <small>${escapeHTML(getProject(task.projectId)?.name || "Projeto removido")}</small>
            <div class="task-actions">
              <button class="btn soft" data-edit-task="${escapeHTML(task.id)}">Editar</button>
              <button class="btn outline" data-next-task="${escapeHTML(task.id)}">
                ${task.status === "todo" ? "Iniciar" : task.status === "doing" ? "Concluir" : "Reabrir"}
              </button>
              <button class="btn outline" data-delete-task="${escapeHTML(task.id)}" aria-label="Excluir tarefa"><i class="fa-solid fa-trash"></i></button>
            </div>
          </article>
        `).join("") : '<p class="muted">Nenhuma tarefa nesta etapa.</p>'}
      </div>
    `;
  }).join("");

  if (!projectId) {
    $("#kanbanBoard").innerHTML =
      '<div class="panel empty"><h3>Comece criando um projeto</h3><p>Depois você poderá organizar as tarefas.</p><button class="btn primary" data-action="new-project">Criar projeto</button></div>';
  }
}

$("#taskProjectSelect").addEventListener("change", renderTasks);

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-task]");
  const remove = event.target.closest("[data-delete-task]");
  const next = event.target.closest("[data-next-task]");

  if (edit) openTaskModal(edit.dataset.editTask);

  if (remove) {
    if (!confirm("Deseja excluir esta tarefa?")) return;

    data.tasks = data.tasks.filter(task => task.id !== remove.dataset.deleteTask);
    saveData();
    refreshEverything();
    showToast("Tarefa excluída.");
  }

  if (next) {
    const task = data.tasks.find(item => item.id === next.dataset.nextTask);
    if (!task) return;

    task.status = task.status === "todo"
      ? "doing"
      : task.status === "doing"
        ? "done"
        : "todo";

    saveData();
    refreshEverything();
    showToast("Etapa da tarefa atualizada.");
  }
});

/* ==========================================
   MATERIAIS E CUSTOS
========================================== */

function openMaterialModal(materialId = "") {
  if (!data) return;

  if (!data.projects.length) {
    showToast("Crie um projeto antes de cadastrar materiais.", true);
    openProjectModal();
    return;
  }

  const material = data.materials.find(item => item.id === materialId);

  modalType = "material";
  editingId = materialId || null;

  $("#modalTitle").textContent = material ? "Editar material" : "Adicionar material";

  $("#modalFields").innerHTML = `
    <div class="field"><label for="modalMaterialName">Nome do material *</label>
      <input id="modalMaterialName" required maxlength="100" placeholder="Ex.: Sensor ultrassônico" value="${escapeHTML(material?.name || "")}">
    </div>
    <div class="field"><label for="modalMaterialProject">Projeto</label>
      <select id="modalMaterialProject">${projectOptions(material?.projectId || data.projects[0].id)}</select>
    </div>
    <div class="field"><label for="modalMaterialQuantity">Quantidade</label>
      <input id="modalMaterialQuantity" type="number" min="1" step="1" required value="${material?.quantity ?? 1}">
    </div>
    <div class="field"><label for="modalMaterialPrice">Preço por unidade (R$)</label>
      <input id="modalMaterialPrice" type="number" min="0" step="0.01" required value="${material?.price ?? 0}">
    </div>
  `;

  openModal();
}

function renderMaterials() {
  if (!data) return;

  const materials = data.materials;

  $("#materialCount").textContent = materials.length;
  $("#materialTotal").textContent = money(
    materials.reduce((sum, item) => sum + item.quantity * item.price, 0)
  );

  $("#materialProjectLabel").textContent =
    "Os materiais de todos os projetos estão sendo exibidos.";

  $("#materialsTable").innerHTML = materials.length ? `
    <table>
      <thead><tr><th>Material</th><th>Projeto</th><th>Qtd.</th><th>Preço unitário</th><th>Total</th><th>Ações</th></tr></thead>
      <tbody>${materials.map(item => `
        <tr>
          <td>${escapeHTML(item.name)}</td>
          <td>${escapeHTML(getProject(item.projectId)?.name || "Projeto removido")}</td>
          <td>${item.quantity}</td>
          <td>${money(item.price)}</td>
          <td><strong>${money(item.quantity * item.price)}</strong></td>
          <td>
            <button class="icon-btn" data-edit-material="${escapeHTML(item.id)}" aria-label="Editar material"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn" data-delete-material="${escapeHTML(item.id)}" aria-label="Excluir material"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join("")}</tbody>
    </table>
  ` : "";

  $("#emptyMaterials").hidden = materials.length > 0;
}

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-material]");
  const remove = event.target.closest("[data-delete-material]");

  if (edit) openMaterialModal(edit.dataset.editMaterial);

  if (remove) {
    if (!confirm("Deseja excluir este material?")) return;

    data.materials = data.materials.filter(item => item.id !== remove.dataset.deleteMaterial);
    saveData();
    renderMaterials();
    showToast("Material excluído.");
  }
});

/* ==========================================
   TESTES E MELHORIAS
========================================== */

function openTestModal(testId = "") {
  if (!data) return;

  if (!data.projects.length) {
    showToast("Crie um projeto antes de registrar testes.", true);
    openProjectModal();
    return;
  }

  const test = data.tests.find(item => item.id === testId);

  modalType = "test";
  editingId = testId || null;

  $("#modalTitle").textContent = test ? "Editar teste" : "Registrar teste";

  $("#modalFields").innerHTML = `
    <div class="field"><label for="modalTestTitle">O que você testou? *</label>
      <input id="modalTestTitle" required maxlength="120" placeholder="Ex.: Teste do sensor" value="${escapeHTML(test?.title || "")}">
    </div>
    <div class="field"><label for="modalTestProject">Projeto</label>
      <select id="modalTestProject">${projectOptions(test?.projectId || data.projects[0].id)}</select>
    </div>
    <div class="field"><label for="modalTestResult">Resultado</label>
      <textarea id="modalTestResult" maxlength="2000" placeholder="O que aconteceu durante o teste?">${escapeHTML(test?.result || "")}</textarea>
    </div>
    <div class="field"><label for="modalTestImprovement">O que pode melhorar?</label>
      <textarea id="modalTestImprovement" maxlength="2000" placeholder="Qual será o próximo passo?">${escapeHTML(test?.improvement || "")}</textarea>
    </div>
    <div class="field"><label for="modalTestDate">Data do teste</label>
      <input id="modalTestDate" type="date" value="${escapeHTML(test?.date || today())}">
    </div>
  `;

  openModal();
}

function renderTests() {
  if (!data) return;

  const projectId = $("#testProjectSelect").value;
  const tests = data.tests
    .filter(test => !projectId || test.projectId === projectId)
    .slice()
    .reverse();

  $("#testList").innerHTML = tests.map(test => `
    <article class="entry">
      <div class="project-top">
        <h3>${escapeHTML(test.title)}</h3>
        <span class="tag">${escapeHTML(formatDate(test.date))}</span>
      </div>
      <p><strong>Projeto:</strong> ${escapeHTML(getProject(test.projectId)?.name || "Projeto removido")}</p>
      <p><strong>Resultado:</strong><br>${escapeHTML(test.result || "Nenhum resultado registrado.")}</p>
      <p><strong>Melhoria:</strong><br>${escapeHTML(test.improvement || "Nenhuma melhoria descrita.")}</p>
      <div class="entry-actions">
        <button class="btn soft" data-edit-test="${escapeHTML(test.id)}">Editar</button>
        <button class="btn outline" data-delete-test="${escapeHTML(test.id)}">Excluir</button>
      </div>
    </article>
  `).join("");

  $("#emptyTests").hidden = tests.length > 0;
}

$("#testProjectSelect").addEventListener("change", renderTests);

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-test]");
  const remove = event.target.closest("[data-delete-test]");

  if (edit) openTestModal(edit.dataset.editTest);

  if (remove) {
    if (!confirm("Deseja excluir este teste?")) return;

    data.tests = data.tests.filter(test => test.id !== remove.dataset.deleteTest);
    saveData();
    refreshEverything();
    showToast("Teste excluído.");
  }
});

/* ==========================================
   JANELA DE CADASTRO
========================================== */

function openModal() {
  $("#modalBackdrop").classList.add("show");
}

function closeModal() {
  $("#modalBackdrop").classList.remove("show");
  $("#modalForm").reset();
  $("#modalFields").innerHTML = "";
  modalType = "";
  editingId = null;
}

$("#modalClose").addEventListener("click", closeModal);
$("#modalCancel").addEventListener("click", closeModal);

$("#modalBackdrop").addEventListener("click", event => {
  if (event.target === $("#modalBackdrop")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

$("#modalForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!data) return;

  if (modalType === "project") {
    const name = $("#modalProjectName").value.trim();

    if (!name) {
      showToast("Digite o nome do projeto.", true);
      return;
    }

    const project = {
      id: editingId || uid(),
      name,
      description: $("#modalProjectDescription").value.trim(),
      status: $("#modalProjectStatus").value,
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      const index = data.projects.findIndex(item => item.id === editingId);
      if (index !== -1) data.projects[index] = project;
    } else {
      data.projects.push(project);
    }

    saveData();
    closeModal();
    refreshEverything();
    showToast(editingId ? "Projeto atualizado!" : "Projeto criado!");
    return;
  }

  if (modalType === "task") {
    const name = $("#modalTaskName").value.trim();

    if (!name) {
      showToast("Digite o nome da tarefa.", true);
      return;
    }

    const task = {
      id: editingId || uid(),
      name,
      description: $("#modalTaskDescription").value.trim(),
      projectId: $("#modalTaskProject").value,
      status: $("#modalTaskStatus").value,
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      const index = data.tasks.findIndex(item => item.id === editingId);
      if (index !== -1) data.tasks[index] = task;
    } else {
      data.tasks.push(task);
    }

    saveData();
    closeModal();
    refreshEverything();
    showToast(editingId ? "Tarefa atualizada!" : "Tarefa adicionada!");
    return;
  }

  if (modalType === "material") {
    const quantity = Number($("#modalMaterialQuantity").value);
    const price = Number($("#modalMaterialPrice").value);
    const name = $("#modalMaterialName").value.trim();

    if (!name || !Number.isFinite(quantity) || quantity < 1 ||
        !Number.isFinite(price) || price < 0) {
      showToast("Confira o nome, a quantidade e o preço.", true);
      return;
    }

    const material = {
      id: editingId || uid(),
      name,
      projectId: $("#modalMaterialProject").value,
      quantity,
      price
    };

    if (editingId) {
      const index = data.materials.findIndex(item => item.id === editingId);
      if (index !== -1) data.materials[index] = material;
    } else {
      data.materials.push(material);
    }

    saveData();
    closeModal();
    renderMaterials();
    showToast("Material salvo!");
    return;
  }

  if (modalType === "test") {
    const title = $("#modalTestTitle").value.trim();

    if (!title) {
      showToast("Escreva o que você testou.", true);
      return;
    }

    const test = {
      id: editingId || uid(),
      title,
      projectId: $("#modalTestProject").value,
      result: $("#modalTestResult").value.trim(),
      improvement: $("#modalTestImprovement").value.trim(),
      date: $("#modalTestDate").value || today()
    };

    if (editingId) {
      const index = data.tests.findIndex(item => item.id === editingId);
      if (index !== -1) data.tests[index] = test;
    } else {
      data.tests.push(test);
    }

    saveData();
    closeModal();
    refreshEverything();
    showToast("Teste salvo!");
  }
});

/* ==========================================
   GERADOR DE IDEIAS
========================================== */

$("#ideaForm").addEventListener("submit", event => {
  event.preventDefault();

  const topic = $("#ideaTopic").value.trim();

  if (!topic) {
    showToast("Digite um tema para gerar ideias.", true);
    return;
  }

  const ideas = [
    {
      title: `Sistema inteligente para ${topic}`,
      problem: `Como melhorar a situação relacionada a ${topic}?`,
      solution: `Criar um protótipo com sensores ou regras automáticas para ajudar a resolver um problema ligado a ${topic}.`,
      materials: "Microcontrolador, sensores e materiais de montagem."
    },
    {
      title: `Projeto sustentável de ${topic}`,
      problem: `Como reduzir desperdícios e aproveitar melhor os recursos ligados a ${topic}?`,
      solution: `Desenvolver uma solução que reutilize materiais, economize recursos ou incentive hábitos melhores.`,
      materials: "Materiais reutilizados, recipientes e itens de medição."
    },
    {
      title: `Monitoramento de ${topic}`,
      problem: `Como observar e acompanhar mudanças relacionadas a ${topic}?`,
      solution: `Montar um protótipo que registre informações e ajude a identificar quando uma melhoria é necessária.`,
      materials: "Sensores, planilha de registros e placa eletrônica opcional."
    },
    {
      title: `Aplicativo educativo sobre ${topic}`,
      problem: `Como explicar e tornar mais fácil entender o tema ${topic}?`,
      solution: `Criar uma interface simples com orientações, registros e dicas para ajudar outras pessoas.`,
      materials: "Computador, editor de código e materiais para pesquisa."
    }
  ];

  $("#ideaResults").innerHTML = ideas.map((idea, index) => `
    <article class="idea-card">
      <span class="tag">IDEIA ${index + 1}</span>
      <h3>${escapeHTML(idea.title)}</h3>
      <p><strong>Problema:</strong> ${escapeHTML(idea.problem)}</p>
      <p><strong>Solução:</strong> ${escapeHTML(idea.solution)}</p>
      <p><strong>Materiais possíveis:</strong> ${escapeHTML(idea.materials)}</p>
      <button class="btn primary" data-use-idea="${index}">Transformar em projeto</button>
    </article>
  `).join("");

  $("#ideaChosen").hidden = true;

  showToast("Ideias geradas! Escolha a que mais combina com seu trabalho.");
});

document.addEventListener("click", event => {
  const button = event.target.closest("[data-use-idea]");
  if (!button) return;

  const topic = $("#ideaTopic").value.trim();
  const title = $("#ideaResults").children[
    Number(button.dataset.useIdea)
  ]?.querySelector("h3")?.textContent;

  if (!title) return;

  openProjectModal();

  $("#modalProjectName").value = title;
  $("#modalProjectDescription").value =
    `Tema: ${topic}\n\nIdeia inicial: ${title}.\n\nDescreva aqui como você pretende desenvolver essa solução.`;

  $("#ideaChosen").hidden = false;
  $("#ideaChosen").textContent =
    "Ideia selecionada. Revise os campos e salve para criar o projeto.";
});

/* ==========================================
   FOTOS: REDUZIR TAMANHO PARA ECONOMIZAR ESPAÇO
========================================== */

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Escolha apenas arquivos de imagem."));
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      reject(new Error("Cada imagem deve ter no máximo 12 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Não foi possível ler uma imagem."));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Esta imagem não pôde ser aberta."));

      image.onload = () => {
        const maxSide = 1000;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function readImageFiles(fileList) {
  const files = [...fileList];

  if (files.length > 8) {
    throw new Error("Escolha no máximo 8 fotos por vez.");
  }

  const results = [];

  for (const file of files) {
    results.push(await compressImage(file));
  }

  return results;
}

function renderImagePreview(selector, images) {
  const container = $(selector);
  if (!container) return;

  container.innerHTML = images.map((src, index) => `
    <div class="preview-item">
      <img src="${src}" alt="Foto selecionada ${index + 1}">
      <button type="button" class="icon-btn" data-remove-image="${index}" data-image-target="${selector}" aria-label="Remover foto">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join("");
}

$("#reportImages").addEventListener("change", async event => {
  try {
    reportImages = await readImageFiles(event.target.files);
    renderImagePreview("#reportImagePreview", reportImages);
    showToast("Fotos adicionadas à prévia do relatório.");
  } catch (error) {
    showToast(error.message || "Não foi possível carregar as fotos.", true);
    event.target.value = "";
  }
});

$("#notebookPhotos").addEventListener("change", async event => {
  try {
    notebookImages = await readImageFiles(event.target.files);
    renderImagePreview("#notebookPhotoPreview", notebookImages);
    showToast("Fotos adicionadas ao registro.");
  } catch (error) {
    showToast(error.message || "Não foi possível carregar as fotos.", true);
    event.target.value = "";
  }
});

document.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-image]");
  if (!button) return;

  const index = Number(button.dataset.removeImage);

  if (button.dataset.imageTarget === "#reportImagePreview") {
    reportImages.splice(index, 1);
    renderImagePreview("#reportImagePreview", reportImages);
  } else if (button.dataset.imageTarget === "#notebookPhotoPreview") {
    notebookImages.splice(index, 1);
    renderImagePreview("#notebookPhotoPreview", notebookImages);
  }
});

/* ==========================================
   RELATÓRIO TÉCNICO
========================================== */

function readReportForm() {
  return {
    projectId: $("#technicalProjectSelect").value,
    team: $("#reportTeam").value.trim(),
    institution: $("#reportInstitution").value.trim(),
    objective: $("#reportObjective").value.trim(),
    method: $("#reportMethod").value.trim(),
    limits: $("#reportLimits").value.trim(),
    images: reportImages
  };
}

function loadReportForm() {
  if (!data) return;

  const report = data.report;

  $("#reportTeam").value = report.team || "";
  $("#reportInstitution").value = report.institution || "";
  $("#reportObjective").value = report.objective || "";
  $("#reportMethod").value = report.method || "";
  $("#reportLimits").value = report.limits || "";

  reportImages = Array.isArray(report.images) ? [...report.images] : [];

  renderImagePreview("#reportImagePreview", reportImages);
  renderReportPreview();
}

function renderReportPreview() {
  if (!data) return;

  const report = readReportForm();
  const project = getProject(report.projectId);

  $("#technicalPreview").innerHTML = `
    <div class="eyebrow">CLEBERLAB · DOCUMENTAÇÃO</div>
    <h2>Relatório técnico</h2>
    <p><strong>Projeto:</strong> ${escapeHTML(project?.name || "Selecione um projeto")}</p>
    <p><strong>Equipe:</strong> ${escapeHTML(report.team || "Não informado")}</p>
    <p><strong>Instituição:</strong> ${escapeHTML(report.institution || "Não informada")}</p>
    <hr>
    <h3>1. Objetivo</h3>
    <p>${escapeHTML(report.objective || "O objetivo do projeto aparecerá aqui.")}</p>
    <h3>2. Metodologia</h3>
    <p>${escapeHTML(report.method || "As etapas de desenvolvimento aparecerão aqui.")}</p>
    <h3>3. Limitações e próximos passos</h3>
    <p>${escapeHTML(report.limits || "As limitações e melhorias aparecerão aqui.")}</p>
    ${report.images.length ? `<h3>4. Registros fotográficos</h3>${report.images.map(src => `<img src="${src}" alt="Foto do projeto">`).join("")}` : ""}
    <hr>
    <p><small>Documento elaborado no CleberLab.</small></p>
  `;
}

$("#technicalForm").addEventListener("input", renderReportPreview);
$("#technicalProjectSelect").addEventListener("change", renderReportPreview);

$("#technicalForm").addEventListener("submit", event => {
  event.preventDefault();

  data.report = readReportForm();

  if (!saveData()) return;

  renderReportPreview();
  showToast("Relatório atualizado e salvo!");
});

/* ==========================================
   DIÁRIO DE BORDO
========================================== */

$("#notebookDate").value = today();

$("#notebookForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!data) return;

  const projectId = $("#notebookProjectSelect").value;

  if (!projectId) {
    showToast("Crie um projeto antes de salvar registros.", true);
    return;
  }

  const entry = {
    id: uid(),
    projectId,
    date: $("#notebookDate").value,
    type: $("#notebookType").value,
    author: $("#notebookAuthor").value.trim(),
    title: $("#notebookTitle").value.trim(),
    description: $("#notebookDescription").value.trim(),
    next: $("#notebookNext").value.trim(),
    photos: [...notebookImages]
  };

  if (!entry.title || !entry.description) {
    showToast("Preencha o título e a descrição do registro.", true);
    return;
  }

  data.notebook.push(entry);

  if (!saveData()) {
    data.notebook.pop();
    return;
  }

  $("#notebookForm").reset();
  $("#notebookDate").value = today();
  notebookImages = [];
  $("#notebookPhotoPreview").innerHTML = "";

  renderNotebook();
  showToast("Registro salvo no diário de bordo!");
});

function renderNotebook() {
  if (!data) return;

  const entries = [...data.notebook].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  $("#notebookList").innerHTML = entries.map(entry => `
    <article class="entry">
      <div class="project-top">
        <span class="tag">${escapeHTML(entry.type)}</span>
        <small>${escapeHTML(formatDate(entry.date))}</small>
      </div>
      <h3>${escapeHTML(entry.title)}</h3>
      <p><strong>Projeto:</strong> ${escapeHTML(getProject(entry.projectId)?.name || "Projeto removido")}</p>
      <p><strong>Responsável:</strong> ${escapeHTML(entry.author || "Não informado")}</p>
      <p>${escapeHTML(entry.description)}</p>
      ${entry.next ? `<p><strong>Próximos passos:</strong><br>${escapeHTML(entry.next)}</p>` : ""}
      ${entry.photos?.length ? `<div class="entry-photos">${entry.photos.map(src => `<img src="${src}" alt="Foto do diário">`).join("")}</div>` : ""}
      <div class="entry-actions">
        <button class="btn outline" data-delete-entry="${escapeHTML(entry.id)}">Excluir registro</button>
      </div>
    </article>
  `).join("");

  $("#emptyNotebook").hidden = entries.length > 0;
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-entry]");
  if (!button) return;

  if (!confirm("Deseja excluir este registro do diário?")) return;

  data.notebook = data.notebook.filter(entry => entry.id !== button.dataset.deleteEntry);
  saveData();
  renderNotebook();
  showToast("Registro excluído.");
});

/* ==========================================
   COMPARAÇÃO DE PROTÓTIPOS
========================================== */

function getVersion(prefix) {
  return {
    name: $(`#version${prefix}Name`).value.trim(),
    cost: Number($(`#version${prefix}Cost`).value),
    accuracy: Number($(`#version${prefix}Accuracy`).value),
    resistance: Number($(`#version${prefix}Resistance`).value),
    notes: $(`#version${prefix}Notes`).value.trim()
  };
}

function compareVersions() {
  const a = getVersion("A");
  const b = getVersion("B");

  if (!a.name || !b.name) {
    showToast("Digite o nome das duas versões.", true);
    return;
  }

  for (const version of [a, b]) {
    if (!Number.isFinite(version.cost) || version.cost < 0 ||
        !Number.isFinite(version.accuracy) || version.accuracy < 0 || version.accuracy > 100 ||
        !Number.isFinite(version.resistance) || version.resistance < 0 || version.resistance > 100) {
      showToast("Confira os custos e as porcentagens. Os valores percentuais devem estar entre 0 e 100.", true);
      return;
    }
  }

  const rows = [
    { label: "Custo", av: money(a.cost), bv: money(b.cost), winner: a.cost === b.cost ? "Empate" : a.cost < b.cost ? a.name : b.name },
    { label: "Precisão", av: `${a.accuracy}%`, bv: `${b.accuracy}%`, winner: a.accuracy === b.accuracy ? "Empate" : a.accuracy > b.accuracy ? a.name : b.name },
    { label: "Resistência", av: `${a.resistance}%`, bv: `${b.resistance}%`, winner: a.resistance === b.resistance ? "Empate" : a.resistance > b.resistance ? a.name : b.name }
  ];

  $("#comparisonTable").innerHTML = `
    <table>
      <thead><tr><th>Característica</th><th>${escapeHTML(a.name)}</th><th>${escapeHTML(b.name)}</th><th>Melhor resultado</th></tr></thead>
      <tbody>${rows.map(row => `
        <tr><td>${row.label}</td><td>${row.av}</td><td>${row.bv}</td><td><strong>${escapeHTML(row.winner)}</strong></td></tr>
      `).join("")}</tbody>
    </table>
    <h3>Observações</h3>
    <p><strong>${escapeHTML(a.name)}:</strong> ${escapeHTML(a.notes || "Nenhuma observação.")}</p>
    <p><strong>${escapeHTML(b.name)}:</strong> ${escapeHTML(b.notes || "Nenhuma observação.")}</p>
  `;

  const cheaper = a.cost === b.cost
    ? "As duas versões têm o mesmo custo."
    : `${a.cost < b.cost ? a.name : b.name} tem o menor custo.`;

  const moreAccurate = a.accuracy === b.accuracy
    ? "As duas versões têm a mesma precisão."
    : `${a.accuracy > b.accuracy ? a.name : b.name} tem a maior precisão.`;

  const stronger = a.resistance === b.resistance
    ? "As duas versões têm a mesma resistência."
    : `${a.resistance > b.resistance ? a.name : b.name} tem a maior resistência.`;

  $("#comparisonConclusion").textContent =
    `${cheaper} ${moreAccurate} ${stronger} Considere também os objetivos do projeto e os resultados dos testes antes de escolher uma versão.`;

  showToast("Comparação concluída!");
}

function resetComparison() {
  $("#compareFormA").reset();
  $("#compareFormB").reset();

  $("#versionAName").value = "Protótipo A";
  $("#versionACost").value = 100;
  $("#versionAAccuracy").value = 70;
  $("#versionAResistance").value = 75;

  $("#versionBName").value = "Protótipo B";
  $("#versionBCost").value = 120;
  $("#versionBAccuracy").value = 85;
  $("#versionBResistance").value = 80;

  $("#comparisonTable").innerHTML = "";
  $("#comparisonConclusion").textContent = "";

  showToast("Comparação limpa.");
}

/* ==========================================
   IMPRESSÃO
========================================== */

function printPage(page) {
  const target = $(`#page-${page}`);

  if (!target) return;

  if (page === "technical") {
    data.report = readReportForm();
    saveData();
    renderReportPreview();
  }

  if (page === "notebook") {
    renderNotebook();
  }

  const previousPage = $(".page.active");
  const previousId = previousPage?.id;

  $$(".page").forEach(section => {
    section.classList.remove("active", "print-target");
  });

  target.classList.add("active", "print-target");

  const cleanup = () => {
    target.classList.remove("print-target", "active");

    if (previousId) {
      $(`#${previousId}`)?.classList.add("active");
    } else {
      $("#page-dashboard").classList.add("active");
    }

    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  window.print();

  // Também permite restaurar a tela caso o evento afterprint não ocorra.
  setTimeout(() => {
    if (target.classList.contains("print-target")) cleanup();
  }, 1000);
}

/* ==========================================
   ATUALIZAÇÃO DO PAINEL
========================================== */

function refreshEverything() {
  if (!data) return;

  updateProjectSelects();
  renderProjects();
  renderTasks();
  renderMaterials();
  renderTests();
  renderNotebook();
  renderReportPreview();
  updateStats();
}

function updateStats() {
  if (!data) return;

  $("#statActive").textContent =
    data.projects.filter(project => project.status === "active").length;

  $("#statPending").textContent =
    data.tasks.filter(task => task.status !== "done").length;

  $("#statDone").textContent =
    data.tasks.filter(task => task.status === "done").length;

  $("#statTests").textContent = data.tests.length;
}

/* ==========================================
   INICIALIZAÇÃO
========================================== */

function initialize() {
  switchAuth("login");

  let sessionId = null;

  try {
    sessionId =
      localStorage.getItem(STORAGE_SESSION) ||
      sessionStorage.getItem(STORAGE_SESSION);
  } catch {
    sessionId = null;
  }

  const user = readUsers().find(item => item.id === sessionId);

  if (user) {
    currentUser = user;
    data = loadData(user);

    $("#authScreen").hidden = true;
    $("#app").hidden = false;

    $("#sidebarUserName").textContent = user.name;
    $("#sidebarUserEmail").textContent = user.email;
    $("#userAvatar").textContent = user.name.charAt(0).toUpperCase();
    $("#welcomeTitle").textContent =
      `Olá, ${user.name.split(" ")[0]}! Suas ideias merecem sair do papel.`;

    switchPage("dashboard");
    refreshEverything();
  } else {
    $("#authScreen").hidden = false;
    $("#app").hidden = true;
  }
}

initialize();
