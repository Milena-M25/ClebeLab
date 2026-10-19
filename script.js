const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const money = n => (Number(n) || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

let currentProject = null;
let modalSave = null;

const demo = {
  projects: [
    {
      id: 'p1',
      name: 'Lixeira Inteligente',
      description: 'Protótipo de lixeira com sensor para automatizar a abertura.',
      goal: 'Facilitar o descarte e melhorar a higiene.',
      status: 'Em andamento',
      created: today()
    },
    {
      id: 'p2',
      name: 'Esteira de Segurança',
      description: 'Sistema de detecção de obstáculos para uma esteira industrial.',
      goal: 'Reduzir riscos e aumentar a segurança.',
      status: 'Planejamento',
      created: today()
    },
    {
      id: 'p3',
      name: 'Irrigação Automática',
      description: 'Sistema que monitora a umidade do solo para controlar a irrigação.',
      goal: 'Usar água de forma eficiente.',
      status: 'Em andamento',
      created: today()
    }
  ],

  tasks: [
    {
      id: uid(),
      project: 'p1',
      title: 'Pesquisar sensores disponíveis',
      status: 'done',
      assignee: 'Equipe'
    },
    {
      id: uid(),
      project: 'p1',
      title: 'Montar circuito inicial',
      status: 'doing',
      assignee: 'Equipe'
    },
    {
      id: uid(),
      project: 'p1',
      title: 'Testar abertura automática',
      status: 'todo',
      assignee: 'Equipe'
    },
    {
      id: uid(),
      project: 'p2',
      title: 'Definir posicionamento dos sensores',
      status: 'todo',
      assignee: 'Equipe'
    }
  ],

  materials: [
    {
      id: uid(),
      project: 'p1',
      name: 'Sensor ultrassônico',
      qty: 1,
      price: 25
    },
    {
      id: uid(),
      project: 'p1',
      name: 'Arduino',
      qty: 1,
      price: 55
    }
  ],

  tests: [],
  entries: [],
  reports: {}
};

let data;

try {
  data = JSON.parse(localStorage.getItem('cleberlab_data_v1')) || structuredClone(demo);
} catch (e) {
  data = JSON.parse(JSON.stringify(demo));
}

function save() {
  localStorage.setItem('cleberlab_data_v1', JSON.stringify(data));
  refresh();
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').classList.add('show');

  setTimeout(() => {
    $('#toast').classList.remove('show');
  }, 2300);
}

function project(id) {
  return data.projects.find(p => p.id === id);
}

function projectTasks(id) {
  return data.tasks.filter(t => t.project === id);
}

function pct(id) {
  const tasks = projectTasks(id);

  return tasks.length
    ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100)
    : 0;
}

function statusTag(s) {
  return `<span class="tag ${s === 'Concluído' ? 'green' : s === 'Em andamento' ? 'orange' : ''}">${esc(s)}</span>`;
}

function card(p) {
  return `
    <article class="project-card" data-open="${p.id}">
      <div class="project-top">
        <span class="project-symbol"><i class="fa-solid fa-flask"></i></span>
        ${statusTag(p.status)}
      </div>

      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description || 'Sem descrição.')}</p>

      <div class="progress">
        <span style="width:${pct(p.id)}%"></span>
      </div>

      <div class="meta">
        <span>${pct(p.id)}% concluído</span>
        <span>${projectTasks(p.id).length} tarefas</span>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:5px;margin-top:12px">
        <button class="btn soft" data-edit-project="${p.id}">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button class="btn danger" data-delete-project="${p.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </article>
  `;
}

function renderProjects() {
  const q = ($('#projectSearch')?.value || '').toLowerCase();

  const projects = data.projects.filter(p =>
    p.name.toLowerCase().includes(q)
  );

  $('#projectGrid').innerHTML = projects.map(card).join('');
  $('#emptyProjects').hidden = projects.length > 0;

  $('#dashboardProjects').innerHTML =
    data.projects.slice(0, 3).map(card).join('') ||
    '<div class="panel empty">Crie seu primeiro projeto para começar.</div>';
}

function populate(select, all = true) {
  if (!select) return;

  const old = select.value;

  select.innerHTML =
    (all ? '<option value="all">Todos os projetos</option>' : '') +
    data.projects.map(p =>
      `<option value="${p.id}">${esc(p.name)}</option>`
    ).join('');

  if ([...select.options].some(o => o.value === old)) {
    select.value = old;
  } else if (!all && data.projects.length) {
    select.value = data.projects[0].id;
  }
}

function renderTasks() {
  populate($('#taskProjectSelect'));

  const id = $('#taskProjectSelect').value;

  const statuses = [
    ['todo', 'A fazer'],
    ['doing', 'Em andamento'],
    ['done', 'Concluído']
  ];

  $('#kanbanBoard').innerHTML = statuses.map(([key, label]) => {
    const tasks = data.tasks.filter(t =>
      (id === 'all' || t.project === id) && t.status === key
    );

    return `
      <div class="kanban-col">
        <div class="kanban-head">
          ${label}<span>${tasks.length}</span>
        </div>

        ${tasks.map(t => `
          <div class="task">
            <div class="task-title">${esc(t.title)}</div>

            <small>
              <i class="fa-solid fa-user"></i>
              ${esc(t.assignee || 'Sem responsável')}
              · ${esc(project(t.project)?.name || 'Projeto removido')}
            </small>

            <div class="task-actions">
              <button title="Mover para próxima etapa" data-toggle-task="${t.id}">
                <i class="fa-solid fa-arrow-right"></i>
              </button>

              <button title="Editar" data-edit-task="${t.id}">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button title="Excluir" data-delete-task="${t.id}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('') || '<div class="muted" style="font-size:12px;padding:10px">Sem tarefas</div>'}
      </div>
    `;
  }).join('');
}

function renderMaterials() {
  populate($('#testProjectSelect'), false);

  const id = $('#testProjectSelect').value;
  const materials = data.materials.filter(m => m.project === id);

  $('#materialCount').textContent = materials.length;

  $('#materialTotal').textContent = money(
    materials.reduce((sum, m) => sum + m.qty * m.price, 0)
  );

  $('#materialProjectLabel').textContent = project(id)?.name || '';

  $('#materialsTable').innerHTML = materials.length ? `
    <table>
      <thead>
        <tr>
          <th>Material</th>
          <th>Quantidade</th>
          <th>Preço unitário</th>
          <th>Subtotal</th>
          <th>Ações</th>
        </tr>
      </thead>

      <tbody>
        ${materials.map(m => `
          <tr>
            <td>${esc(m.name)}</td>
            <td>${m.qty}</td>
            <td>${money(m.price)}</td>
            <td>${money(m.qty * m.price)}</td>
            <td>
              <button class="icon-btn" data-edit-material="${m.id}">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button class="icon-btn" data-delete-material="${m.id}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  $('#emptyMaterials').hidden = materials.length > 0;
}

function renderTests() {
  populate($('#testProjectSelect'), false);

  const id = $('#testProjectSelect').value;
  const tests = data.tests.filter(t => t.project === id);

  $('#testList').innerHTML = tests.map(t => `
    <div class="entry">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <h4>${esc(t.title)}</h4>
        <button class="icon-btn" data-delete-test="${t.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>

      <p>${esc(t.date)} · ${esc(t.result)}</p>
      <p>${esc(t.description)}</p>
    </div>
  `).join('');

  $('#emptyTests').hidden = tests.length > 0;
}

function renderNotebook() {
  populate($('#notebookProjectSelect'), false);

  const id = $('#notebookProjectSelect').value;

  const entries = data.entries
    .filter(e => e.project === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  $('#notebookList').innerHTML = entries.map(e => `
    <div class="entry">
      <div style="display:flex;justify-content:space-between">
        <h4>${esc(e.title)}</h4>
        <button class="icon-btn" data-delete-entry="${e.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>

      <p>${esc(e.date)} · ${esc(e.type)} · ${esc(e.author || 'Sem responsável')}</p>
      <p>${esc(e.description)}</p>
      ${e.next ? `<p><b>Próximos passos:</b> ${esc(e.next)}</p>` : ''}
    </div>
  `).join('');

  $('#emptyNotebook').hidden = entries.length > 0;
}

function renderTechnical() {
  populate($('#technicalProjectSelect'), false);

  const id = $('#technicalProjectSelect').value;
  const p = project(id);

  if (!p) {
    $('#technicalPreview').innerHTML = 'Crie um projeto para gerar o relatório.';
    return;
  }

  const materials = data.materials.filter(m => m.project === id);
  const tests = data.tests.filter(t => t.project === id);
  const tasks = projectTasks(id);
  const r = data.reports[id] || {};

  $('#reportTeam').value = r.team || $('#reportTeam').value;
  $('#reportInstitution').value = r.institution || $('#reportInstitution').value;
  $('#reportObjective').value = r.objective || p.goal || '';
  $('#reportMethod').value = r.method || '';
  $('#reportLimits').value = r.limits || '';

  $('#technicalPreview').innerHTML = `
    <div class="eyebrow">CLEBERLAB · DOCUMENTAÇÃO</div>
    <h2>Relatório técnico</h2>
    <h3>${esc(p.name)}</h3>

    <p><b>Descrição:</b> ${esc(p.description)}</p>
    <p><b>Equipe:</b> ${esc(r.team || 'Não informada')}</p>
    <p><b>Instituição:</b> ${esc(r.institution || 'Não informada')}</p>

    <hr>

    <h3>1. Objetivo</h3>
    <p>${esc(r.objective || p.goal || 'Não informado')}</p>

    <h3>2. Metodologia</h3>
    <p>${esc(r.method || 'Descreva os procedimentos realizados.')}</p>

    <h3>3. Materiais</h3>
    <ul>
      ${materials.map(m => `
        <li>${esc(m.name)} — ${m.qty} un. (${money(m.qty * m.price)})</li>
      `).join('') || '<li>Materiais ainda não cadastrados.</li>'}
    </ul>

    <p><b>Custo estimado:</b> ${money(materials.reduce((sum, m) => sum + m.qty * m.price, 0))}</p>

    <h3>4. Etapas e resultados</h3>
    <p>
      ${tasks.filter(t => t.status === 'done').length}
      de ${tasks.length} tarefas concluídas (${pct(id)}%).
      Foram registrados ${tests.length} testes.
    </p>

    ${tests.map(t => `
      <p><b>${esc(t.title)}:</b> ${esc(t.result)} — ${esc(t.description)}</p>
    `).join('')}

    <h3>5. Limitações e próximos passos</h3>
    <p>${esc(r.limits || 'Não informado')}</p>

    <p class="muted" style="margin-top:28px">
      Documento gerado pelo sistema CleberLab.
    </p>
  `;
}

function renderStats() {
  const tasks = data.tasks;

  $('#statActive').textContent =
    data.projects.filter(p => p.status !== 'Concluído').length;

  $('#statPending').textContent =
    tasks.filter(t => t.status !== 'done').length;

  $('#statDone').textContent =
    tasks.filter(t => t.status === 'done').length;

  $('#statTests').textContent = data.tests.length;
}

function refresh() {
  renderStats();
  renderProjects();
  renderTasks();
  renderMaterials();
  renderTests();
  renderNotebook();
  renderTechnical();
}

const titles = {
  dashboard: 'Visão geral',
  projects: 'Meus projetos',
  tasks: 'Tarefas',
  materials: 'Materiais e custos',
  tests: 'Testes e melhorias',
  technical: 'Relatório técnico',
  notebook: 'Diário de bordo',
  compare: 'Comparar protótipos'
};

function go(page) {
  $$('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + page)
  );

  $$('.nav-link').forEach(b =>
    b.classList.toggle('active', b.dataset.page === page)
  );

  $('#pageTitle').textContent = titles[page] || 'CleberLab';
  $('#sidebar').classList.remove('open');

  if (page === 'technical') renderTechnical();
}

function openModal(title, fields, onSave) {
  $('#modalTitle').textContent = title;
  $('#modalFields').innerHTML = fields;
  modalSave = onSave;
  $('#modalBackdrop').classList.add('show');
}

function closeModal() {
  $('#modalBackdrop').classList.remove('show');
  $('#modalForm').reset();
  modalSave = null;
}

function projectOptions(selected = '') {
  return data.projects.map(p => `
    <option value="${p.id}" ${p.id === selected ? 'selected' : ''}>
      ${esc(p.name)}
    </option>
  `).join('');
}

function newProject(p = null) {
  openModal(
    p ? 'Editar projeto' : 'Novo projeto',
    `
      <div class="field">
        <label>Nome do projeto *</label>
        <input name="name" required value="${esc(p?.name || '')}" placeholder="Ex.: Robô seguidor de linha">
      </div>

      <div class="field">
        <label>Descrição</label>
        <textarea name="description" placeholder="Explique brevemente a ideia">${esc(p?.description || '')}</textarea>
      </div>

      <div class="field">
        <label>Objetivo</label>
        <textarea name="goal" placeholder="Qual problema pretende resolver?">${esc(p?.goal || '')}</textarea>
      </div>

      <div class="field">
        <label>Status</label>
        <select name="status">
          ${['Planejamento', 'Em andamento', 'Concluído'].map(s =>
            `<option ${p?.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    `,
    values => {
      if (p) {
        Object.assign(p, values);
      } else {
        data.projects.unshift({
          id: uid(),
          created: today(),
          ...values
        });
      }

      save();
      toast('Projeto salvo!');
    }
  );
}

function newTask(t = null) {
  if (!data.projects.length) {
    return toast('Crie um projeto primeiro.');
  }

  openModal(
    t ? 'Editar tarefa' : 'Nova tarefa',
    `
      <div class="field">
        <label>Projeto</label>
        <select name="project">
          ${projectOptions(t?.project || currentProject || data.projects[0].id)}
        </select>
      </div>

      <div class="field">
        <label>Nome da tarefa *</label>
        <input name="title" required value="${esc(t?.title || '')}" placeholder="Ex.: Montar circuito">
      </div>

      <div class="field">
        <label>Responsável</label>
        <input name="assignee" value="${esc(t?.assignee || '')}" placeholder="Nome do integrante">
      </div>

      <div class="field">
        <label>Etapa</label>
        <select name="status">
          ${[['todo', 'A fazer'], ['doing', 'Em andamento'], ['done', 'Concluído']].map(([v, l]) =>
            `<option value="${v}" ${(t?.status || 'todo') === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
      </div>
    `,
    values => {
      if (t) {
        Object.assign(t, values);
      } else {
        data.tasks.push({ id: uid(), ...values });
      }

      save();
      toast('Tarefa salva!');
    }
  );
}

function newMaterial(m = null) {
  if (!data.projects.length) {
    return toast('Crie um projeto primeiro.');
  }

  openModal(
    m ? 'Editar material' : 'Adicionar material',
    `
      <div class="field">
        <label>Projeto</label>
        <select name="project">
          ${projectOptions(m?.project || data.projects[0].id)}
        </select>
      </div>

      <div class="field">
        <label>Nome do material *</label>
        <input name="name" required value="${esc(m?.name || '')}">
      </div>

      <div class="field-grid">
        <div class="field">
          <label>Quantidade</label>
          <input name="qty" type="number" min="1" value="${m?.qty || 1}" required>
        </div>

        <div class="field">
          <label>Preço unitário (R$)</label>
          <input name="price" type="number" min="0" step="0.01" value="${m?.price || 0}" required>
        </div>
      </div>
    `,
    values => {
      values.qty = Number(values.qty);
      values.price = Number(values.price);

      if (m) {
        Object.assign(m, values);
      } else {
        data.materials.push({ id: uid(), ...values });
      }

      save();
      toast('Material salvo!');
    }
  );
}

function newTest() {
  if (!data.projects.length) {
    return toast('Crie um projeto primeiro.');
  }

  openModal(
    'Registrar teste',
    `
      <div class="field">
        <label>Projeto</label>
        <select name="project">
          ${projectOptions(data.projects[0].id)}
        </select>
      </div>

      <div class="field">
        <label>Nome do teste *</label>
        <input name="title" required placeholder="Ex.: Teste de alcance do sensor">
      </div>

      <div class="field">
        <label>Data</label>
        <input name="date" type="date" value="${today()}" required>
      </div>

      <div class="field">
        <label>Resultado</label>
        <select name="result">
          <option>Funcionou</option>
          <option>Funcionou parcialmente</option>
          <option>Não funcionou</option>
          <option>Precisa de novos testes</option>
        </select>
      </div>

      <div class="field">
        <label>Descrição, falhas e melhorias</label>
        <textarea name="description" required></textarea>
      </div>
    `,
    values => {
      data.tests.unshift({ id: uid(), ...values });
      save();
      toast('Teste registrado!');
    }
  );
}

function compare() {
  const a = {
    name: $('#versionAName').value || 'Versão A',
    cost: Number($('#versionACost').value) || 0,
    accuracy: Number($('#versionAAccuracy').value) || 0,
    resistance: Number($('#versionAResistance').value) || 0,
    notes: $('#versionANotes').value
  };

  const b = {
    name: $('#versionBName').value || 'Versão B',
    cost: Number($('#versionBCost').value) || 0,
    accuracy: Number($('#versionBAccuracy').value) || 0,
    resistance: Number($('#versionBResistance').value) || 0,
    notes: $('#versionBNotes').value
  };

  $('#comparisonTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Critério</th>
          <th>${esc(a.name)}</th>
          <th>${esc(b.name)}</th>
          <th>Melhor resultado</th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>Custo</td>
          <td>${money(a.cost)}</td>
          <td>${money(b.cost)}</td>
          <td>${a.cost === b.cost ? 'Empate' : a.cost < b.cost ? esc(a.name) : esc(b.name)}</td>
        </tr>

        <tr>
          <td>Precisão</td>
          <td>${a.accuracy}%</td>
          <td>${b.accuracy}%</td>
          <td>${a.accuracy === b.accuracy ? 'Empate' : a.accuracy > b.accuracy ? esc(a.name) : esc(b.name)}</td>
        </tr>

        <tr>
          <td>Resistência</td>
          <td>${a.resistance}%</td>
          <td>${b.resistance}%</td>
          <td>${a.resistance === b.resistance ? 'Empate' : a.resistance > b.resistance ? esc(a.name) : esc(b.name)}</td>
        </tr>

        <tr>
          <td>Observações</td>
          <td>${esc(a.notes || '—')}</td>
          <td>${esc(b.notes || '—')}</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>
  `;

  const scoreA = a.accuracy + a.resistance;
  const scoreB = b.accuracy + b.resistance;

  $('#comparisonConclusion').textContent =
    scoreA === scoreB
      ? 'As versões têm a mesma pontuação combinada de precisão e resistência.'
      : `Considerando precisão e resistência igualmente, ${scoreA > scoreB ? a.name : b.name} apresenta a maior pontuação combinada. Avalie também o custo e os resultados reais dos testes.`;
}

/* Navegação e ações dos botões */

$$('.nav-link').forEach(button => {
  button.addEventListener('click', () => go(button.dataset.page));
});

document.addEventListener('click', event => {
  const pageButton = event.target.closest('[data-page]');

  if (pageButton && !pageButton.classList.contains('nav-link')) {
    go(pageButton.dataset.page);
  }

  const action = event.target.closest('[data-action]')?.dataset.action;

  if (action === 'new-project') newProject();
  if (action === 'new-task') newTask();
  if (action === 'new-material') newMaterial();
  if (action === 'new-test') newTest();
  if (action === 'print-technical') window.print();
  if (action === 'compare') compare();

  if (action === 'print-notebook') {
    const previous = $$('.page').map(p => [p, p.style.display]);

    $$('.page').forEach(p => {
      p.style.display = p.id === 'page-notebook' ? 'block' : 'none';
    });

    window.print();

    $$('.page').forEach(([p, display]) => {
      p.style.display = display;
    });
  }

  if (action === 'reset-compare') {
    $('#compareFormA').reset();
    $('#compareFormB').reset();
    $('#comparisonTable').innerHTML = '';
    $('#comparisonConclusion').textContent = '';
  }

  const opened = event.target.closest('[data-open]');

  if (opened) {
    currentProject = opened.dataset.open;
    go('tasks');
    $('#taskProjectSelect').value = currentProject;
    renderTasks();
  }

  const editProject = event.target.closest('[data-edit-project]');

  if (editProject) {
    event.stopPropagation();
    newProject(project(editProject.dataset.editProject));
  }

  const deleteProject = event.target.closest('[data-delete-project]');

  if (deleteProject) {
    event.stopPropagation();

    if (confirm('Excluir este projeto e todos os seus registros?')) {
      const id = deleteProject.dataset.deleteProject;

      data.projects = data.projects.filter(p => p.id !== id);

      ['tasks', 'materials', 'tests', 'entries'].forEach(key => {
        data[key] = data[key].filter(item => item.project !== id);
      });

      delete data.reports[id];

      save();
      toast('Projeto excluído.');
    }
  }

  const toggleTask = event.target.closest('[data-toggle-task]');

  if (toggleTask) {
    const task = data.tasks.find(t => t.id === toggleTask.dataset.toggleTask);

    task.status =
      task.status === 'todo' ? 'doing' :
      task.status === 'doing' ? 'done' : 'todo';

    save();
  }

  const editTask = event.target.closest('[data-edit-task]');

  if (editTask) {
    newTask(data.tasks.find(t => t.id === editTask.dataset.editTask));
  }

  const deleteTask = event.target.closest('[data-delete-task]');

  if (deleteTask && confirm('Excluir esta tarefa?')) {
    data.tasks = data.tasks.filter(t => t.id !== deleteTask.dataset.deleteTask);
    save();
  }

  const editMaterial = event.target.closest('[data-edit-material]');

  if (editMaterial) {
    newMaterial(data.materials.find(m => m.id === editMaterial.dataset.editMaterial));
  }

  const deleteMaterial = event.target.closest('[data-delete-material]');

  if (deleteMaterial && confirm('Excluir material?')) {
    data.materials = data.materials.filter(m => m.id !== deleteMaterial.dataset.deleteMaterial);
    save();
  }

  const deleteTest = event.target.closest('[data-delete-test]');

  if (deleteTest && confirm('Excluir registro de teste?')) {
    data.tests = data.tests.filter(t => t.id !== deleteTest.dataset.deleteTest);
    save();
  }

  const deleteEntry = event.target.closest('[data-delete-entry]');

  if (deleteEntry && confirm('Excluir registro do diário?')) {
    data.entries = data.entries.filter(e => e.id !== deleteEntry.dataset.deleteEntry);
    save();
  }
});

/* Modal */

$('#modalClose').onclick = closeModal;
$('#modalCancel').onclick = closeModal;

$('#modalBackdrop').addEventListener('click', event => {
  if (event.target.id === 'modalBackdrop') closeModal();
});

$('#modalForm').addEventListener('submit', event => {
  event.preventDefault();

  if (!modalSave) return;

  const values = Object.fromEntries(new FormData(event.target).entries());

  modalSave(values);
  closeModal();
});

/* Pesquisa, filtros e menu */

$('#projectSearch').addEventListener('input', renderProjects);
$('#taskProjectSelect').addEventListener('change', renderTasks);

$('#testProjectSelect').addEventListener('change', () => {
  renderMaterials();
  renderTests();
});

$('#technicalProjectSelect').addEventListener('change', renderTechnical);
$('#notebookProjectSelect').addEventListener('change', renderNotebook);

$('#mobileMenu').onclick = () => {
  $('#sidebar').classList.toggle('open');
};

/* Salvar relatório técnico */

$('#technicalForm').addEventListener('submit', event => {
  event.preventDefault();

  const id = $('#technicalProjectSelect').value;

  if (!id) return;

  data.reports[id] = {
    team: $('#reportTeam').value,
    institution: $('#reportInstitution').value,
    objective: $('#reportObjective').value,
    method: $('#reportMethod').value,
    limits: $('#reportLimits').value
  };

  save();
  toast('Relatório atualizado!');
});

/* Diário de bordo */

$('#notebookDate').value = today();

$('#notebookForm').addEventListener('submit', event => {
  event.preventDefault();

  const entry = {
    id: uid(),
    project: $('#notebookProjectSelect').value,
    date: $('#notebookDate').value,
    type: $('#notebookType').value,
    author: $('#notebookAuthor').value,
    title: $('#notebookTitle').value,
    description: $('#notebookDescription').value,
    next: $('#notebookNext').value
  };

  data.entries.unshift(entry);

  save();

  event.target.reset();
  $('#notebookDate').value = today();

  toast('Registro adicionado ao diário!');
});

/* Inicialização */

function init() {
  populate($('#taskProjectSelect'));
  populate($('#testProjectSelect'), false);
  populate($('#technicalProjectSelect'), false);
  populate($('#notebookProjectSelect'), false);

  refresh();
}

init();