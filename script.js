const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const money = value => (Number(value) || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toLocaleDateString('en-CA');

const initialData = {
  projects: [],
  tasks: [],
  materials: [],
  tests: [],
  entries: [],
  reports: {}
};

let data;

try {
  data = JSON.parse(localStorage.getItem('cleberlab_data_v2')) || initialData;
} catch {
  data = JSON.parse(JSON.stringify(initialData));
}

let modalSave = null;
let reportImages = [];
let notebookImages = [];
let compareImageA = '';
let compareImageB = '';

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 3000);
}

function save() {
  try {
    localStorage.setItem('cleberlab_data_v2', JSON.stringify(data));
    refresh();
  } catch (error) {
    toast('O armazenamento está cheio. Remova algumas fotos e tente novamente.');
  }
}

function findProject(id) {
  return data.projects.find(project => project.id === id);
}

function projectTasks(id) {
  return data.tasks.filter(task => task.project === id);
}

function progress(id) {
  const tasks = projectTasks(id);

  if (!tasks.length) return 0;

  return Math.round(
    tasks.filter(task => task.status === 'done').length / tasks.length * 100
  );
}

function statusBadge(status) {
  const className = status === 'Concluído'
    ? 'green'
    : status === 'Em andamento'
      ? 'orange'
      : '';

  return `<span class="tag ${className}">${escapeHTML(status)}</span>`;
}

function projectOptions(selected = '') {
  return data.projects.map(project => `
    <option value="${project.id}" ${project.id === selected ? 'selected' : ''}>
      ${escapeHTML(project.name)}
    </option>
  `).join('');
}

function fillProjectSelect(selector) {
  const element = $(selector);
  if (!element) return;

  const oldValue = element.value;

  element.innerHTML = data.projects.length
    ? projectOptions()
    : '<option value="">Crie um projeto primeiro</option>';

  if (data.projects.some(project => project.id === oldValue)) {
    element.value = oldValue;
  } else if (data.projects.length) {
    element.value = data.projects[0].id;
  }
}

/* =========================
   PROJETOS
========================= */

function projectCard(project) {
  return `
    <article class="project-card">
      ${project.image
        ? `<img class="project-image" src="${project.image}" alt="Foto de ${escapeHTML(project.name)}">`
        : `<div class="project-image-placeholder"><i class="fa-solid fa-flask"></i></div>`
      }

      <div class="project-content">
        ${statusBadge(project.status)}
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.description || 'Ainda não foi adicionada uma descrição.')}</p>

        <div class="project-progress">
          <span style="width:${progress(project.id)}%"></span>
        </div>

        <div class="project-meta">
          <span>${progress(project.id)}% concluído</span>
          <span>${projectTasks(project.id).length} tarefas</span>
        </div>

        <div class="project-actions">
          <button class="btn soft" data-edit-project="${project.id}">
            <i class="fa-solid fa-pen"></i> Editar
          </button>

          <button class="btn outline" data-project-tasks="${project.id}">
            <i class="fa-solid fa-list-check"></i> Tarefas
          </button>

          <button class="btn danger" data-delete-project="${project.id}" aria-label="Excluir projeto">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderProjects() {
  const query = ($('#projectSearch').value || '').toLowerCase();

  const projects = data.projects.filter(project =>
    project.name.toLowerCase().includes(query)
  );

  $('#projectGrid').innerHTML = projects.map(projectCard).join('');
  $('#emptyProjects').hidden = projects.length > 0;

  $('#dashboardProjects').innerHTML =
    data.projects.slice(0, 3).map(projectCard).join('');

  $('#dashboardEmpty').hidden = data.projects.length > 0;
}

function newProject(existing = null) {
  openModal(existing ? 'Editar projeto' : 'Criar um projeto', `
    <p class="field-help">Dê um nome à sua ideia e explique o que você quer construir.</p>

    <div class="field">
      <label>Nome do projeto *</label>
      <input name="name" required maxlength="100"
        value="${escapeHTML(existing?.name || '')}"
        placeholder="Ex.: Lixeira inteligente">
    </div>

    <div class="field">
      <label>O que é esse projeto?</label>
      <textarea name="description"
        placeholder="Explique a ideia com suas palavras...">${escapeHTML(existing?.description || '')}</textarea>
    </div>

    <div class="field">
      <label>Qual problema ele pretende resolver?</label>
      <textarea name="goal"
        placeholder="Ex.: Facilitar o descarte de lixo.">${escapeHTML(existing?.goal || '')}</textarea>
    </div>

    <div class="field">
      <label>Em qual etapa ele está?</label>
      <select name="status">
        ${['Planejamento', 'Em andamento', 'Concluído'].map(status => `
          <option ${existing?.status === status ? 'selected' : ''}>${status}</option>
        `).join('')}
      </select>
    </div>

    <div class="field">
      <label>Foto do projeto ou protótipo</label>
      <p class="field-help">Escolha uma imagem do computador. A foto aparecerá no cartão do projeto.</p>
      <input name="imageFile" type="file" accept="image/*" id="projectImageFile">
      <div class="image-preview" id="projectImagePreview">
        ${existing?.image ? `<div class="preview-item"><img src="${existing.image}" alt="Foto atual"></div>` : ''}
      </div>
      <button type="button" class="btn outline" id="removeProjectImage">
        <i class="fa-solid fa-trash"></i> Remover foto
      </button>
    </div>
  `, async values => {
    const file = $('#projectImageFile')?.files[0];
    let image = existing?.image || '';

    if (window.removeProjectImage) image = '';
    else if (file) image = await compressImage(file);

    const record = {
      id: existing?.id || uid(),
      name: values.name.trim(),
      description: values.description.trim(),
      goal: values.goal.trim(),
      status: values.status,
      image,
      created: existing?.created || today()
    };

    if (existing) {
      Object.assign(existing, record);
    } else {
      data.projects.unshift(record);
    }

    save();
    toast('Projeto salvo com sucesso!');
  });

  window.removeProjectImage = false;

  $('#projectImageFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const image = await compressImage(file);
      $('#projectImagePreview').innerHTML = `
        <div class="preview-item"><img src="${image}" alt="Prévia da foto"></div>
      `;
      window.pendingProjectImage = image;
    } catch {
      toast('Não foi possível abrir essa imagem.');
    }
  });

  $('#removeProjectImage').addEventListener('click', () => {
    window.removeProjectImage = true;
    window.pendingProjectImage = '';
    $('#projectImageFile').value = '';
    $('#projectImagePreview').innerHTML = '<span class="field-help">Nenhuma foto selecionada.</span>';
  });
}

/* =========================
   TAREFAS
========================= */

function renderTasks() {
  fillProjectSelect('#taskProjectSelect');

  const projectId = $('#taskProjectSelect').value;

  const columns = [
    ['todo', 'A fazer', 'Ainda não começou'],
    ['doing', 'Em andamento', 'Você está trabalhando nisso'],
    ['done', 'Concluído', 'Tarefa finalizada']
  ];

  $('#kanbanBoard').innerHTML = columns.map(([status, title, description]) => {
    const tasks = data.tasks.filter(task =>
      task.project === projectId && task.status === status
    );

    return `
      <div class="kanban-col">
        <div class="kanban-head">
          <div>${title}<div class="field-help">${description}</div></div>
          <span>${tasks.length}</span>
        </div>

        ${tasks.map(task => `
          <div class="task">
            <div class="task-title">${escapeHTML(task.title)}</div>
            <small>Responsável: ${escapeHTML(task.assignee || 'Não informado')}</small>

            <div class="task-actions">
              <button data-toggle-task="${task.id}" title="Mudar etapa">
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button data-edit-task="${task.id}" title="Editar tarefa">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button data-delete-task="${task.id}" title="Excluir tarefa">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('') || '<p class="field-help">Nenhuma tarefa nesta etapa.</p>'}
      </div>
    `;
  }).join('');
}

function newTask(existing = null) {
  if (!data.projects.length) {
    toast('Primeiro, crie um projeto.');
    return;
  }

  openModal(existing ? 'Editar tarefa' : 'Adicionar uma tarefa', `
    <p class="field-help">Escreva uma atividade pequena e clara que precisa ser feita.</p>

    <div class="field">
      <label>Projeto</label>
      <select name="project">${projectOptions(existing?.project || $('#taskProjectSelect').value)}</select>
    </div>

    <div class="field">
      <label>O que precisa ser feito? *</label>
      <input name="title" required value="${escapeHTML(existing?.title || '')}"
        placeholder="Ex.: Montar o circuito">
    </div>

    <div class="field">
      <label>Quem vai fazer?</label>
      <input name="assignee" value="${escapeHTML(existing?.assignee || '')}"
        placeholder="Nome do integrante">
    </div>

    <div class="field">
      <label>Qual é a etapa?</label>
      <select name="status">
        <option value="todo" ${existing?.status === 'todo' ? 'selected' : ''}>A fazer</option>
        <option value="doing" ${existing?.status === 'doing' ? 'selected' : ''}>Em andamento</option>
        <option value="done" ${existing?.status === 'done' ? 'selected' : ''}>Concluído</option>
      </select>
    </div>
  `, values => {
    if (existing) Object.assign(existing, values);
    else data.tasks.push({ id: uid(), ...values });

    save();
    toast('Tarefa salva!');
  });
}

/* =========================
   MATERIAIS
========================= */

function renderMaterials() {
  fillProjectSelect('#materialProjectSelect');

  const id = $('#materialProjectSelect').value;
  const materials = data.materials.filter(material => material.project === id);

  $('#materialCount').textContent = materials.length;
  $('#materialTotal').textContent = money(
    materials.reduce((sum, material) => sum + material.quantity * material.price, 0)
  );

  $('#materialsTable').innerHTML = materials.length ? `
    <table>
      <thead><tr>
        <th>Material</th><th>Quantidade</th><th>Preço unitário</th>
        <th>Total</th><th>Ações</th>
      </tr></thead>
      <tbody>
        ${materials.map(material => `
          <tr>
            <td>${escapeHTML(material.name)}</td>
            <td>${material.quantity}</td>
            <td>${money(material.price)}</td>
            <td>${money(material.quantity * material.price)}</td>
            <td class="table-actions">
              <button data-edit-material="${material.id}" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
              <button data-delete-material="${material.id}" aria-label="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  $('#emptyMaterials').hidden = materials.length > 0;
}

function newMaterial(existing = null) {
  if (!data.projects.length) return toast('Primeiro, crie um projeto.');

  openModal(existing ? 'Editar material' : 'Adicionar material', `
    <div class="field">
      <label>Em qual projeto esse material será usado?</label>
      <select name="project">${projectOptions(existing?.project || $('#materialProjectSelect').value)}</select>
    </div>

    <div class="field">
      <label>Nome do material *</label>
      <input name="name" required value="${escapeHTML(existing?.name || '')}"
        placeholder="Ex.: Sensor ultrassônico">
    </div>

    <div class="field">
      <label>Quantidade de unidades</label>
      <input name="quantity" type="number" min="1" required value="${existing?.quantity || 1}">
    </div>

    <div class="field">
      <label>Preço de uma unidade (R$)</label>
      <input name="price" type="number" min="0" step="0.01" required value="${existing?.price ?? 0}">
    </div>
  `, values => {
    values.quantity = Number(values.quantity);
    values.price = Number(values.price);

    if (existing) Object.assign(existing, values);
    else data.materials.push({ id: uid(), ...values });

    save();
    toast('Material salvo!');
  });
}

/* =========================
   IMAGENS
========================= */

// Reduz as imagens antes de guardar para economizar espaço.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Arquivo não é uma imagem.'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Erro ao ler imagem.'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('Imagem inválida.'));

      img.onload = () => {
        const maxSize = 1000;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function readImages(files) {
  const selected = [...files];

  if (selected.length > 8) {
    toast('Selecione no máximo 8 fotos por vez.');
    selected.length = 8;
  }

  const images = [];

  for (const file of selected) {
    try {
      images.push(await compressImage(file));
    } catch {
      toast(`Não foi possível carregar ${file.name}.`);
    }
  }

  return images;
}

function previewImages(selector, images, removeCallback) {
  const container = $(selector);

  container.innerHTML = images.map((image, index) => `
    <div class="preview-item">
      <img src="${image}" alt="Prévia da imagem ${index + 1}">
      <button type="button" data-remove-image="${index}" aria-label="Remover foto">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-image]').forEach(button => {
    button.addEventListener('click', () => {
      removeCallback(Number(button.dataset.removeImage));
    });
  });
}

function savedImages(images = []) {
  if (!images.length) return '';

  return `
    <div class="saved-images">
      ${images.map((image, index) => `
        <img src="${image}" alt="Foto do registro ${index + 1}">
      `).join('')}
    </div>
  `;
}

function previewSingleImage(selector, image) {
  $(selector).innerHTML = image
    ? `<div class="preview-item"><img src="${image}" alt="Prévia do protótipo"></div>`
    : '';
}

/* =========================
   TESTES
========================= */

function renderTests() {
  fillProjectSelect('#testProjectSelect');

  const id = $('#testProjectSelect').value;
  const tests = data.tests.filter(test => test.project === id);

  $('#testList').innerHTML = tests.map(test => `
    <article class="entry">
      <div class="entry-meta">${escapeHTML(test.date)} · ${escapeHTML(test.result)}</div>
      <h3>${escapeHTML(test.title)}</h3>
      <p>${escapeHTML(test.description)}</p>
      ${savedImages(test.images)}
      <div class="entry-actions">
        <button class="btn danger" data-delete-test="${test.id}">
          <i class="fa-solid fa-trash"></i> Excluir teste
        </button>
      </div>
    </article>
  `).join('');

  $('#emptyTests').hidden = tests.length > 0;
}

function newTest() {
  if (!data.projects.length) return toast('Primeiro, crie um projeto.');

  openModal('Registrar um teste', `
    <p class="field-help">Conte o que você testou e o que aconteceu.</p>

    <div class="field">
      <label>Projeto</label>
      <select name="project">${projectOptions($('#testProjectSelect').value)}</select>
    </div>

    <div class="field">
      <label>Nome do teste *</label>
      <input name="title" required placeholder="Ex.: Teste do sensor">
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
      <label>O que aconteceu?</label>
      <textarea name="description" required placeholder="Explique o resultado e o que pode melhorar..."></textarea>
    </div>

    <div class="field">
      <label>Fotos do teste</label>
      <input type="file" id="testImageFiles" accept="image/*" multiple>
      <div class="image-preview" id="testImagePreview"></div>
    </div>
  `, async values => {
    const images = await readImages($('#testImageFiles').files);

    data.tests.unshift({
      id: uid(),
      ...values,
      images
    });

    save();
    toast('Teste registrado!');
  });

  $('#testImageFiles').addEventListener('change', async event => {
    const images = await readImages(event.target.files);
    previewImages('#testImagePreview', images, index => {
      images.splice(index, 1);
      previewImages('#testImagePreview', images, () => {});
    });
    window.testImagesDraft = images;
  });
}

/* =========================
   RELATÓRIO TÉCNICO
========================= */

function reportData() {
  const id = $('#technicalProjectSelect').value;

  if (!data.reports[id]) data.reports[id] = { images: [] };

  return data.reports[id];
}

function renderTechnical() {
  fillProjectSelect('#technicalProjectSelect');

  const id = $('#technicalProjectSelect').value;
  const p = findProject(id);

  if (!p) {
    $('#technicalPreview').innerHTML = '<p>Crie um projeto antes de montar seu relatório.</p>';
    return;
  }

  const r = data.reports[id] || { images: [] };

  $('#reportTeam').value = r.team || '';
  $('#reportInstitution').value = r.institution || '';
  $('#reportObjective').value = r.objective || p.goal || '';
  $('#reportMethod').value = r.method || '';
  $('#reportResults').value = r.results || '';
  $('#reportLimits').value = r.limits || '';

  reportImages = [...(r.images || [])];
  previewImages('#reportImagePreview', reportImages, index => {
    reportImages.splice(index, 1);
    previewImages('#reportImagePreview', reportImages, removeImage);
  });

  makeReportPreview();
}

function makeReportPreview() {
  const id = $('#technicalProjectSelect').value;
  const p = findProject(id);

  if (!p) return;

  const r = data.reports[id] || {};
  const materials = data.materials.filter(m => m.project === id);
  const tests = data.tests.filter(t => t.project === id);
  const tasks = projectTasks(id);

  $('#technicalPreview').innerHTML = `
    <img class="report-logo" src="logo-cleberlab.jpg" alt="CleberLab">
    <h2>RELATÓRIO TÉCNICO</h2>
    <p style="text-align:center">CleberLab — Desenvolvimento de projetos e protótipos</p>
    <hr>

    <h3>Identificação do projeto</h3>
    <p><b>Nome:</b> ${escapeHTML(p.name)}</p>
    <p><b>Equipe:</b> ${escapeHTML(r.team || 'Não informado')}</p>
    <p><b>Instituição:</b> ${escapeHTML(r.institution || 'Não informada')}</p>

    <h3>1. Objetivo</h3>
    <p>${escapeHTML(r.objective || 'Preencha o objetivo no formulário acima.')}</p>

    <h3>2. Materiais e metodologia</h3>
    <p>${escapeHTML(r.method || 'Descreva os materiais utilizados e como o projeto foi desenvolvido.')}</p>

    <p><b>Materiais cadastrados:</b></p>
    <ul>
      ${materials.map(m => `
        <li>${escapeHTML(m.name)} — ${m.quantity} unidade(s) — ${money(m.price * m.quantity)}</li>
      `).join('') || '<li>Nenhum material cadastrado.</li>'}
    </ul>

    <p><b>Custo estimado:</b> ${money(materials.reduce((sum, m) => sum + m.price * m.quantity, 0))}</p>

    <h3>3. Resultados</h3>
    <p>${escapeHTML(r.results || 'Descreva os resultados obtidos.')}</p>
    <p><b>Tarefas concluídas:</b> ${tasks.filter(t => t.status === 'done').length} de ${tasks.length} (${progress(id)}%).</p>

    ${tests.map(test => `
      <p><b>${escapeHTML(test.title)}:</b> ${escapeHTML(test.result)}. ${escapeHTML(test.description)}</p>
      ${savedImages(test.images)}
    `).join('')}

    <h3>4. Fotos do projeto</h3>
    ${savedImages(r.images || []) || '<p>Nenhuma foto foi adicionada ao relatório.</p>'}

    <h3>5. Problemas e melhorias</h3>
    <p>${escapeHTML(r.limits || 'Descreva as dificuldades encontradas e o que pode ser melhorado.')}</p>

    <hr>
    <p class="report-caption">Documento organizado com o sistema CleberLab.</p>
  `;
}

function removeImage(index) {
  reportImages.splice(index, 1);
  previewImages('#reportImagePreview', reportImages, removeImage);
}

$('#reportImages').addEventListener('change', async event => {
  const images = await readImages(event.target.files);
  reportImages = reportImages.concat(images).slice(0, 8);
  previewImages('#reportImagePreview', reportImages, removeImage);
  event.target.value = '';
});

$('#technicalProjectSelect').addEventListener('change', renderTechnical);

$('#technicalForm').addEventListener('submit', event => {
  event.preventDefault();

  const id = $('#technicalProjectSelect').value;
  if (!id) return toast('Crie um projeto primeiro.');

  data.reports[id] = {
    team: $('#reportTeam').value,
    institution: $('#reportInstitution').value,
    objective: $('#reportObjective').value,
    method: $('#reportMethod').value,
    results: $('#reportResults').value,
    limits: $('#reportLimits').value,
    images: [...reportImages]
  };

  save();
  makeReportPreview();
  toast('Relatório atualizado!');
});

/* =========================
   DIÁRIO DE BORDO
========================= */

function renderNotebook() {
  fillProjectSelect('#notebookProjectSelect');

  const id = $('#notebookProjectSelect').value;

  const entries = data.entries
    .filter(entry => entry.project === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  $('#notebookList').innerHTML = entries.map(entry => `
    <article class="entry">
      <div class="entry-meta">${escapeHTML(entry.date)} · ${escapeHTML(entry.type)}</div>
      <h3>${escapeHTML(entry.title)}</h3>
      <p><b>Responsável:</b> ${escapeHTML(entry.author || 'Não informado')}</p>
      <p><b>O que foi feito:</b>\n${escapeHTML(entry.description)}</p>
      ${entry.next ? `<p><b>Próximos passos:</b>\n${escapeHTML(entry.next)}</p>` : ''}
      ${savedImages(entry.images)}
      <div class="entry-actions">
        <button class="btn danger" data-delete-entry="${entry.id}">
          <i class="fa-solid fa-trash"></i> Excluir registro
        </button>
      </div>
    </article>
  `).join('');

  $('#emptyNotebook').hidden = entries.length > 0;
}

$('#notebookDate').value = today();

$('#notebookImages').addEventListener('change', async event => {
  const images = await readImages(event.target.files);
  notebookImages = notebookImages.concat(images).slice(0, 8);

  previewImages('#notebookImagePreview', notebookImages, index => {
    notebookImages.splice(index, 1);
    previewImages('#notebookImagePreview', notebookImages, removeNotebookImage);
  });

  event.target.value = '';
});

function removeNotebookImage(index) {
  notebookImages.splice(index, 1);
  previewImages('#notebookImagePreview', notebookImages, removeNotebookImage);
}

$('#notebookForm').addEventListener('submit', event => {
  event.preventDefault();

  const projectId = $('#notebookProjectSelect').value;

  if (!projectId) return toast('Crie um projeto primeiro.');

  data.entries.unshift({
    id: uid(),
    project: projectId,
    date: $('#notebookDate').value,
    type: $('#notebookType').value,
    title: $('#notebookTitle').value.trim(),
    author: $('#notebookAuthor').value.trim(),
    description: $('#notebookDescription').value.trim(),
    next: $('#notebookNext').value.trim(),
    images: [...notebookImages]
  });

  notebookImages = [];
  $('#notebookImagePreview').innerHTML = '';

  save();

  event.target.reset();
  $('#notebookDate').value = today();

  toast('Página salva no diário de bordo!');
});

/* =========================
   COMPARAÇÃO DE PROTÓTIPOS
========================= */

$('#versionAImage').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    compareImageA = await compressImage(file);
    previewSingleImage('#versionAImagePreview', compareImageA);
  } catch {
    toast('Não foi possível carregar a foto.');
  }
});

$('#versionBImage').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    compareImageB = await compressImage(file);
    previewSingleImage('#versionBImagePreview', compareImageB);
  } catch {
    toast('Não foi possível carregar a foto.');
  }
});

function comparePrototypes() {
  const a = {
    name: $('#versionAName').value || 'Versão A',
    cost: Number($('#versionACost').value) || 0,
    accuracy: Number($('#versionAAccuracy').value) || 0,
    resistance: Number($('#versionAResistance').value) || 0
  };

  const b = {
    name: $('#versionBName').value || 'Versão B',
    cost: Number($('#versionBCost').value) || 0,
    accuracy: Number($('#versionBAccuracy').value) || 0,
    resistance: Number($('#versionBResistance').value) || 0
  };

  const rows = [
    ['Custo', money(a.cost), money(b.cost), a.cost === b.cost ? 'Empate' : a.cost < b.cost ? a.name : b.name],
    ['Precisão', `${a.accuracy}%`, `${b.accuracy}%`, a.accuracy === b.accuracy ? 'Empate' : a.accuracy > b.accuracy ? a.name : b.name],
    ['Resistência', `${a.resistance}%`, `${b.resistance}%`, a.resistance === b.resistance ? 'Empate' : a.resistance > b.resistance ? a.name : b.name]
  ];

  const scoreA = a.accuracy + a.resistance;
  const scoreB = b.accuracy + b.resistance;

  $('#comparisonResult').hidden = false;

  $('#comparisonResult').innerHTML = `
    <h3>Resultado da comparação</h3>
    <p class="field-help">O menor custo é melhor. Para precisão e resistência, o valor mais alto é melhor.</p>

    <div class="saved-images">
      <div>
        ${compareImageA ? `<img src="${compareImageA}" alt="Versão A">` : '<p>Versão A sem foto.</p>'}
        <p><b>${escapeHTML(a.name)}</b></p>
      </div>
      <div>
        ${compareImageB ? `<img src="${compareImageB}" alt="Versão B">` : '<p>Versão B sem foto.</p>'}
        <p><b>${escapeHTML(b.name)}</b></p>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Critério</th><th>Versão A</th><th>Versão B</th><th>Melhor neste critério</th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>${row.map(value => `<td>${escapeHTML(value)}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <p><b>Conclusão:</b> ${scoreA === scoreB
      ? 'As duas versões têm a mesma soma de precisão e resistência.'
      : `A ${escapeHTML(scoreA > scoreB ? a.name : b.name)} tem a maior soma de precisão e resistência.`}
    </p>

    <p class="field-help">Essa soma é apenas uma comparação simples. Considere também o custo, a segurança e os resultados reais dos testes antes de escolher uma versão.</p>

    <button class="btn primary" data-action="print-compare">
      <i class="fa-solid fa-print"></i> Imprimir comparação
    </button>
  `;
}

/* =========================
   JANELA DE CADASTRO
========================= */

function openModal(title, fields, onSave) {
  $('#modalTitle').textContent = title;
  $('#modalFields').innerHTML = fields;
  modalSave = onSave;
  $('#modalBackdrop').classList.add('show');
}

function closeModal() {
  $('#modalBackdrop').classList.remove('show');
  $('#modalForm').reset();
  $('#modalFields').innerHTML = '';
  modalSave = null;
  window.removeProjectImage = false;
  window.pendingProjectImage = '';
}

$('#modalClose').addEventListener('click', closeModal);
$('#modalCancel').addEventListener('click', closeModal);

$('#modalBackdrop').addEventListener('click', event => {
  if (event.target.id === 'modalBackdrop') closeModal();
});

$('#modalForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!modalSave) return;

  const values = Object.fromEntries(new FormData(event.target).entries());

  try {
    await modalSave(values);
    closeModal();
  } catch (error) {
    console.error(error);
    toast('Não foi possível salvar. Verifique os campos e as fotos.');
  }
});

/* =========================
   NAVEGAÇÃO
========================= */

const pageTitles = {
  dashboard: 'Início',
  projects: 'Meus projetos',
  tasks: 'Minhas tarefas',
  materials: 'Materiais e custos',
  tests: 'Testes e melhorias',
  technical: 'Relatório técnico',
  notebook: 'Diário de bordo',
  compare: 'Comparar protótipos'
};

function go(page) {
  $$('.page').forEach(section => {
    section.classList.toggle('active', section.id === `page-${page}`);
  });

  $$('.nav-link').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });

  $('#pageTitle').textContent = pageTitles[page] || 'CleberLab';
  $('#sidebar').classList.remove('open');

  if (page === 'technical') renderTechnical();
  if (page === 'notebook') renderNotebook();
}

$$('.nav-link').forEach(button => {
  button.addEventListener('click', () => go(button.dataset.page));
});

$('#mobileMenu').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
});

$('#projectSearch').addEventListener('input', renderProjects);
$('#taskProjectSelect').addEventListener('change', renderTasks);
$('#materialProjectSelect').addEventListener('change', renderMaterials);
$('#testProjectSelect').addEventListener('change', renderTests);
$('#notebookProjectSelect').addEventListener('change', renderNotebook);

$('#technicalProjectSelect').addEventListener('change', () => {
  reportImages = [];
  renderTechnical();
});

/* =========================
   BOTÕES E AÇÕES
========================= */

document.addEventListener('click', event => {
  const pageButton = event.target.closest('[data-page]');

  if (pageButton && !pageButton.classList.contains('nav-link')) {
    go(pageButton.dataset.page);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  const action = actionButton?.dataset.action;

  if (action === 'new-project') return newProject();
  if (action === 'new-task') return newTask();
  if (action === 'new-material') return newMaterial();
  if (action === 'new-test') return newTest();
  if (action === 'compare') return comparePrototypes();

  if (action === 'print-technical') {
    makeReportPreview();
    printPage('technical');
    return;
  }

  if (action === 'print-notebook') {
    printPage('notebook');
    return;
  }

  if (action === 'print-compare') {
    printPage('compare');
    return;
  }

  const editProject = event.target.closest('[data-edit-project]');

  if (editProject) {
    return newProject(findProject(editProject.dataset.editProject));
  }

  const deleteProject = event.target.closest('[data-delete-project]');

  if (deleteProject) {
    if (!confirm('Deseja excluir esse projeto e os registros relacionados?')) return;

    const id = deleteProject.dataset.deleteProject;

    data.projects = data.projects.filter(p => p.id !== id);
    data.tasks = data.tasks.filter(item => item.project !== id);
    data.materials = data.materials.filter(item => item.project !== id);
    data.tests = data.tests.filter(item => item.project !== id);
    data.entries = data.entries.filter(item => item.project !== id);
    delete data.reports[id];

    save();
    toast('Projeto excluído.');
    return;
  }

  const projectTasksButton = event.target.closest('[data-project-tasks]');

  if (projectTasksButton) {
    go('tasks');
    $('#taskProjectSelect').value = projectTasksButton.dataset.projectTasks;
    renderTasks();
    return;
  }

  const toggleTask = event.target.closest('[data-toggle-task]');

  if (toggleTask) {
    const task = data.tasks.find(t => t.id === toggleTask.dataset.toggleTask);

    if (task) {
      task.status = task.status === 'todo'
        ? 'doing'
        : task.status === 'doing'
          ? 'done'
          : 'todo';

      save();
    }

    return;
  }

  const editTask = event.target.closest('[data-edit-task]');

  if (editTask) {
    return newTask(data.tasks.find(t => t.id === editTask.dataset.editTask));
  }

  const deleteTask = event.target.closest('[data-delete-task]');

  if (deleteTask) {
    if (!confirm('Deseja excluir essa tarefa?')) return;

    data.tasks = data.tasks.filter(t => t.id !== deleteTask.dataset.deleteTask);
    save();
    return;
  }

  const editMaterial = event.target.closest('[data-edit-material]');

  if (editMaterial) {
    return newMaterial(data.materials.find(m => m.id === editMaterial.dataset.editMaterial));
  }

  const deleteMaterial = event.target.closest('[data-delete-material]');

  if (deleteMaterial) {
    if (!confirm('Deseja excluir esse material?')) return;

    data.materials = data.materials.filter(m => m.id !== deleteMaterial.dataset.deleteMaterial);
    save();
    return;
  }

  const deleteTest = event.target.closest('[data-delete-test]');

  if (deleteTest) {
    if (!confirm('Deseja excluir esse teste?')) return;

    data.tests = data.tests.filter(t => t.id !== deleteTest.dataset.deleteTest);
    save();
    return;
  }

  const deleteEntry = event.target.closest('[data-delete-entry]');

  if (deleteEntry) {
    if (!confirm('Deseja excluir essa página do diário?')) return;

    data.entries = data.entries.filter(e => e.id !== deleteEntry.dataset.deleteEntry);
    save();
  }
});

function printPage(page) {
  const sections = $$('.page');

  sections.forEach(section => section.classList.remove('printing'));

  const selected = $(`#page-${page}`);
  if (!selected) return;

  selected.classList.add('printing');

  window.print();

  setTimeout(() => selected.classList.remove('printing'), 500);
}

function renderStats() {
  $('#statActive').textContent =
    data.projects.filter(p => p.status !== 'Concluído').length;

  $('#statPending').textContent =
    data.tasks.filter(t => t.status !== 'done').length;

  $('#statDone').textContent =
    data.tasks.filter(t => t.status === 'done').length;

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

function init() {
  $('#notebookDate').value = today();

  fillProjectSelect('#taskProjectSelect');
  fillProjectSelect('#materialProjectSelect');
  fillProjectSelect('#testProjectSelect');
  fillProjectSelect('#technicalProjectSelect');
  fillProjectSelect('#notebookProjectSelect');

  refresh();
}

init();