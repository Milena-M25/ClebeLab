
/* ==========================================
   CLEBERLAB — SISTEMA DE GESTÃO DE PROJETOS
   Versão com mensagens e orientações simples
========================================== */

'use strict';

const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => [...document.querySelectorAll(seletor)];

const STORAGE_KEY = 'cleberlab_data_v2';

const money = (valor) =>
  (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

const uid = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const escapeHTML = (valor = '') =>
  String(valor).replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caractere]);

const texto = valor => String(valor ?? '').trim();

const dataHoje = () => {
  const data = new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const dataBonita = valor => {
  if (!valor) return 'Data não informada';

  const partes = String(valor).split('-');

  if (partes.length !== 3) return escapeHTML(valor);

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const imagemPadrao = '';

// ==========================================
// 1. DADOS E SALVAMENTO
// ==========================================

function dadosVazios() {
  return {
    projects: [],
    tasks: [],
    materials: [],
    tests: [],
    notebook: [],
    reports: {},
    compare: null
  };
}

function carregarDados() {
  try {
    const guardados = localStorage.getItem(STORAGE_KEY);

    if (!guardados) return dadosVazios();

    const dados = JSON.parse(guardados);
    const padrao = dadosVazios();

    return {
      ...padrao,
      ...dados,
      projects: Array.isArray(dados.projects) ? dados.projects : [],
      tasks: Array.isArray(dados.tasks) ? dados.tasks : [],
      materials: Array.isArray(dados.materials) ? dados.materials : [],
      tests: Array.isArray(dados.tests) ? dados.tests : [],
      notebook: Array.isArray(dados.notebook) ? dados.notebook : [],
      reports: dados.reports && typeof dados.reports === 'object'
        ? dados.reports
        : {}
    };
  } catch (erro) {
    console.error('Não foi possível ler os dados salvos:', erro);
    return dadosVazios();
  }
}

let db = carregarDados();
let modalTipo = '';
let itemEditando = null;
let projetoAtual = '';
let toastTimeout;

function salvar() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (erro) {
    console.error('Não foi possível salvar:', erro);

    toast(
      'Não foi possível salvar os dados. O navegador pode estar sem espaço. Tente usar imagens menores.',
      'error'
    );

    return false;
  }
}

// ==========================================
// 2. AVISOS SIMPLES
// ==========================================

function toast(mensagem, tipo = 'success') {
  const elemento = $('#toast');

  if (!elemento) return;

  clearTimeout(toastTimeout);

  elemento.textContent = mensagem;
  elemento.className = `toast show ${tipo}`;

  toastTimeout = setTimeout(() => {
    elemento.className = 'toast';
  }, 3800);
}

function confirmar(mensagem) {
  return window.confirm(mensagem);
}

function pedirTexto(mensagem, valorAtual = '') {
  const resposta = window.prompt(mensagem, valorAtual);

  if (resposta === null) return null;

  return texto(resposta);
}

// ==========================================
// 3. PROJETOS
// ==========================================

function obterProjeto(id) {
  return db.projects.find(projeto => projeto.id === id);
}

function nomeProjeto(id) {
  return obterProjeto(id)?.name || 'Projeto não encontrado';
}

function progressoProjeto(id) {
  const tarefas = db.tasks.filter(tarefa => tarefa.projectId === id);

  if (!tarefas.length) return 0;

  const concluidas = tarefas.filter(
    tarefa => tarefa.status === 'done'
  ).length;

  return Math.round((concluidas / tarefas.length) * 100);
}

function abrirModal(tipo, itemId = null) {
  modalTipo = tipo;
  itemEditando = itemId;

  const modal = $('#modalBackdrop');
  const titulo = $('#modalTitle');
  const campos = $('#modalFields');

  if (!modal || !titulo || !campos) return;

  const item = itemId ? obterItem(tipo, itemId) : null;

  const configuracoes = {
    project: {
      novo: 'Criar um projeto',
      editar: 'Editar projeto',
      campos: `
        <div class="field">
          <label for="modalName">Nome do projeto *</label>
          <input id="modalName" maxlength="100" required
            placeholder="Ex.: Lixeira inteligente">
          <small class="help-text">
            Escolha um nome curto para identificar sua ideia.
          </small>
        </div>

        <div class="field">
          <label for="modalDescription">O que você pretende construir?</label>
          <textarea id="modalDescription" maxlength="1500"
            placeholder="Explique o problema e como pretende resolvê-lo."></textarea>
        </div>

        <div class="field">
          <label for="modalCategory">Categoria</label>
          <select id="modalCategory">
            <option>Tecnologia</option>
            <option>Robótica</option>
            <option>Sustentabilidade</option>
            <option>Automação</option>
            <option>Ciências</option>
            <option>Outro</option>
          </select>
        </div>

        <div class="field">
          <label for="modalStatus">Situação</label>
          <select id="modalStatus">
            <option value="active">Em desenvolvimento</option>
            <option value="paused">Pausado</option>
            <option value="done">Concluído</option>
          </select>
        </div>

        <div class="field">
          <label for="modalImage">Foto do projeto (opcional)</label>
          <input id="modalImage" type="file" accept="image/*">
          <small class="help-text">
            Você pode escolher uma foto do protótipo ou um desenho da ideia.
          </small>
          <div id="modalImagePreview" class="image-preview"></div>
        </div>
      `
    },

    task: {
      novo: 'Adicionar uma tarefa',
      editar: 'Editar tarefa',
      campos: `
        <div class="field">
          <label for="modalProject">A qual projeto pertence?</label>
          <select id="modalProject" required></select>
        </div>

        <div class="field">
          <label for="modalName">O que precisa ser feito? *</label>
          <input id="modalName" required maxlength="120"
            placeholder="Ex.: Montar o circuito elétrico">
        </div>

        <div class="field">
          <label for="modalDescription">Detalhes (opcional)</label>
          <textarea id="modalDescription"
            placeholder="Descreva o que precisa ser feito."></textarea>
        </div>

        <div class="field">
          <label for="modalStatus">Em que etapa está?</label>
          <select id="modalStatus">
            <option value="todo">A fazer</option>
            <option value="doing">Em andamento</option>
            <option value="done">Concluída</option>
          </select>
        </div>

        <div class="field">
          <label for="modalDue">Prazo (opcional)</label>
          <input id="modalDue" type="date">
        </div>
      `
    },

    material: {
      novo: 'Adicionar um material',
      editar: 'Editar material',
      campos: `
        <div class="field">
          <label for="modalProject">Projeto</label>
          <select id="modalProject" required></select>
        </div>

        <div class="field">
          <label for="modalName">Nome do material *</label>
          <input id="modalName" required maxlength="120"
            placeholder="Ex.: Sensor ultrassônico">
        </div>

        <div class="field">
          <label for="modalQuantity">Quantidade *</label>
          <input id="modalQuantity" type="number" min="1" step="1"
            value="1" required>
        </div>

        <div class="field">
          <label for="modalPrice">Preço por unidade (R$) *</label>
          <input id="modalPrice" type="number" min="0" step="0.01"
            value="0" required>
        </div>

        <small class="help-text">
          O custo total é calculado automaticamente: quantidade × preço unitário.
        </small>
      `
    },

    test: {
      novo: 'Registrar um teste',
      editar: 'Editar teste',
      campos: `
        <div class="field">
          <label for="modalProject">Projeto</label>
          <select id="modalProject" required></select>
        </div>

        <div class="field">
          <label for="modalName">O que você testou? *</label>
          <input id="modalName" required maxlength="120"
            placeholder="Ex.: Funcionamento do sensor">
        </div>

        <div class="field">
          <label for="modalDescription">O que você fez?</label>
          <textarea id="modalDescription"
            placeholder="Conte como o teste foi realizado."></textarea>
        </div>

        <div class="field">
          <label for="modalResult">Qual foi o resultado?</label>
          <textarea id="modalResult"
            placeholder="Conte o que aconteceu e se funcionou como esperado."></textarea>
        </div>

        <div class="field">
          <label for="modalImprovement">O que pode melhorar?</label>
          <textarea id="modalImprovement"
            placeholder="Registre o que precisa ser ajustado."></textarea>
        </div>

        <div class="field">
          <label for="modalImage">Foto do teste (opcional)</label>
          <input id="modalImage" type="file" accept="image/*">
          <div id="modalImagePreview" class="image-preview"></div>
        </div>
      `
    }
  };

  const config = configuracoes[tipo];

  if (!config) return;

  titulo.textContent = item
    ? config.editar
    : config.novo;

  campos.innerHTML = config.campos;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');

  preencherSelectProjetos('#modalProject');

  if (item) preencherCamposModal(tipo, item);

  prepararImagemModal(item);

  setTimeout(() => {
    const primeiro = campos.querySelector('input:not([type="file"]), select, textarea');
    primeiro?.focus();
  }, 50);
}

function obterItem(tipo, id) {
  const colecoes = {
    project: db.projects,
    task: db.tasks,
    material: db.materials,
    test: db.tests
  };

  return colecoes[tipo]?.find(item => item.id === id) || null;
}

function preencherCamposModal(tipo, item) {
  const colocar = (id, valor) => {
    const campo = $(`#${id}`);

    if (campo && valor !== undefined && valor !== null) {
      campo.value = valor;
    }
  };

  colocar('modalName', item.name);
  colocar('modalDescription', item.description);
  colocar('modalCategory', item.category);
  colocar('modalStatus', item.status);
  colocar('modalProject', item.projectId);
  colocar('modalDue', item.due);
  colocar('modalQuantity', item.quantity);
  colocar('modalPrice', item.price);
  colocar('modalResult', item.result);
  colocar('modalImprovement', item.improvement);
}

function fecharModal() {
  const modal = $('#modalBackdrop');

  if (!modal) return;

  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');

  $('#modalForm')?.reset();

  modalTipo = '';
  itemEditando = null;
}

function prepararImagemModal(item) {
  const input = $('#modalImage');
  const preview = $('#modalImagePreview');

  if (!input || !preview) return;

  preview.innerHTML = '';

  if (item?.image) {
    preview.innerHTML = `<img src="${item.image}" alt="Imagem atual" class="saved-image">`;
  }

  input.addEventListener('change', async () => {
    preview.innerHTML = '';

    const arquivo = input.files?.[0];

    if (!arquivo) return;

    try {
      const imagem = await comprimirImagem(arquivo);
      preview.innerHTML = `<img src="${imagem}" alt="Prévia da imagem">`;
    } catch {
      toast('Não foi possível abrir essa imagem. Tente outro arquivo.', 'error');
    }
  });
}

async function comprimirImagem(arquivo) {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('O arquivo escolhido não é uma imagem.');
  }

  if (arquivo.size > 12 * 1024 * 1024) {
    throw new Error('A imagem precisa ter menos de 12 MB.');
  }

  const original = await new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error('Erro ao ler a imagem.'));
    leitor.readAsDataURL(arquivo);
  });

  const imagem = await new Promise((resolve, reject) => {
    const elemento = new Image();

    elemento.onload = () => resolve(elemento);
    elemento.onerror = () => reject(new Error('Imagem inválida.'));
    elemento.src = original;
  });

  const limite = 1000;
  const escala = Math.min(1, limite / Math.max(imagem.width, imagem.height));

  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(imagem.width * escala));
  canvas.height = Math.max(1, Math.round(imagem.height * escala));

  const contexto = canvas.getContext('2d');

  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.75);
}

async function salvarItemModal(evento) {
  evento.preventDefault();

  if (!modalTipo) return;

  const tipo = modalTipo;
  const id = itemEditando;
  const itemAntigo = id ? obterItem(tipo, id) : null;

  const valor = campo => texto($(`#${campo}`)?.value);

  const nome = valor('modalName');

  if (!nome) {
    toast('Digite um nome antes de salvar.', 'error');
    $('#modalName')?.focus();
    return;
  }

  if (['task', 'material', 'test'].includes(tipo) && !db.projects.length) {
    toast('Primeiro crie um projeto para adicionar esse item.', 'error');
    fecharModal();
    abrirModal('project');
    return;
  }

  const item = {
    ...(itemAntigo || {}),
    id: itemAntigo?.id || uid(),
    updatedAt: new Date().toISOString()
  };

  if (tipo === 'project') {
    item.name = nome;
    item.description = valor('modalDescription');
    item.category = valor('modalCategory') || 'Tecnologia';
    item.status = valor('modalStatus') || 'active';
    item.createdAt = itemAntigo?.createdAt || new Date().toISOString();
  }

  if (tipo === 'task') {
    item.name = nome;
    item.description = valor('modalDescription');
    item.projectId = valor('modalProject');
    item.status = valor('modalStatus') || 'todo';
    item.due = valor('modalDue');

    if (!obterProjeto(item.projectId)) {
      toast('Escolha um projeto válido.', 'error');
      return;
    }
  }

  if (tipo === 'material') {
    item.name = nome;
    item.projectId = valor('modalProject');
    item.quantity = Number($('#modalQuantity')?.value);
    item.price = Number($('#modalPrice')?.value);

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      toast('A quantidade deve ser pelo menos 1.', 'error');
      return;
    }

    if (!Number.isFinite(item.price) || item.price < 0) {
      toast('Digite um preço válido.', 'error');
      return;
    }
  }

  if (tipo === 'test') {
    item.name = nome;
    item.projectId = valor('modalProject');
    item.description = valor('modalDescription');
    item.result = valor('modalResult');
    item.improvement = valor('modalImprovement');
    item.date = itemAntigo?.date || dataHoje();
  }

  const arquivoImagem = $('#modalImage')?.files?.[0];

  if (arquivoImagem) {
    try {
      item.image = await comprimirImagem(arquivoImagem);
    } catch (erro) {
      toast(erro.message || 'Não foi possível processar a imagem.', 'error');
      return;
    }
  }

  if (!item.image && itemAntigo?.image) {
    item.image = itemAntigo.image;
  }

  const colecoes = {
    project: 'projects',
    task: 'tasks',
    material: 'materials',
    test: 'tests'
  };

  const colecao = db[colecoes[tipo]];

  if (itemAntigo) {
    const indice = colecao.findIndex(registro => registro.id === id);
    colecao[indice] = item;
  } else {
    colecao.push(item);
  }

  if (tipo === 'project' && !projetoAtual) {
    projetoAtual = item.id;
  }

  if (!salvar()) return;

  fecharModal();
  renderizarTudo();

  const nomes = {
    project: 'Projeto',
    task: 'Tarefa',
    material: 'Material',
    test: 'Teste'
  };

  toast(
    `${nomes[tipo]} ${itemAntigo ? 'atualizado' : 'salvo'} com sucesso!`
  );
}

// ==========================================
// 4. EXCLUIR ITENS
// ==========================================

function excluirItem(tipo, id) {
  const item = obterItem(tipo, id);

  if (!item) return;

  const nomes = {
    project: 'projeto',
    task: 'tarefa',
    material: 'material',
    test: 'teste'
  };

  if (!confirmar(`Tem certeza de que deseja excluir este ${nomes[tipo]}? Essa ação não pode ser desfeita.`)) {
    return;
  }

  if (tipo === 'project') {
    db.projects = db.projects.filter(p => p.id !== id);
    db.tasks = db.tasks.filter(p => p.projectId !== id);
    db.materials = db.materials.filter(p => p.projectId !== id);
    db.tests = db.tests.filter(p => p.projectId !== id);
    db.notebook = db.notebook.filter(p => p.projectId !== id);
    delete db.reports[id];

    if (projetoAtual === id) {
      projetoAtual = db.projects[0]?.id || '';
    }
  }

  if (tipo === 'task') {
    db.tasks = db.tasks.filter(p => p.id !== id);
  }

  if (tipo === 'material') {
    db.materials = db.materials.filter(p => p.id !== id);
  }

  if (tipo === 'test') {
    db.tests = db.tests.filter(p => p.id !== id);
  }

  if (salvar()) {
    renderizarTudo();
    toast(`${nomes[tipo]} excluído.`);
  }
}

// ==========================================
// 5. NAVEGAÇÃO ENTRE PÁGINAS
// ==========================================

const titulosPaginas = {
  dashboard: 'Visão geral',
  projects: 'Meus projetos',
  tasks: 'Tarefas',
  materials: 'Materiais e custos',
  tests: 'Testes e melhorias',
  ideas: 'Gerador de ideias',
  technical: 'Relatório técnico',
  notebook: 'Diário de bordo',
  compare: 'Comparar protótipos'
};

function navegar(pagina) {
  if (!titulosPaginas[pagina]) return;

  $$('.page').forEach(secao => {
    secao.classList.toggle('active', secao.id === `page-${pagina}`);
  });

  $$('.nav-link[data-page]').forEach(botao => {
    botao.classList.toggle('active', botao.dataset.page === pagina);
  });

  const titulo = $('#pageTitle');

  if (titulo) titulo.textContent = titulosPaginas[pagina];

  $('#sidebar')?.classList.remove('open');

  if (pagina === 'technical') renderizarRelatorio();
  if (pagina === 'notebook') renderizarDiario();
  if (pagina === 'compare') carregarComparacao();
}

// ==========================================
// 6. LISTAS DE PROJETOS NOS FORMULÁRIOS
// ==========================================

function preencherSelectProjetos(seletor, selecionarId = '') {
  const campo = $(seletor);

  if (!campo) return;

  const selecionado = selecionarId || campo.value || projetoAtual;

  if (!db.projects.length) {
    campo.innerHTML = '<option value="">Crie um projeto primeiro</option>';
    campo.disabled = true;
    return;
  }

  campo.disabled = false;

  campo.innerHTML = db.projects.map(projeto => `
    <option value="${escapeHTML(projeto.id)}">
      ${escapeHTML(projeto.name)}
    </option>
  `).join('');

  if (db.projects.some(projeto => projeto.id === selecionado)) {
    campo.value = selecionado;
  } else {
    campo.value = db.projects[0].id;
  }
}

function atualizarSelects() {
  [
    '#taskProjectSelect',
    '#testProjectSelect',
    '#technicalProjectSelect',
    '#notebookProjectSelect'
  ].forEach(seletor => {
    preencherSelectProjetos(seletor);
  });
}

// ==========================================
// 7. MOSTRAR PROJETOS
// ==========================================

function renderizarProjetos() {
  const pesquisa = texto($('#projectSearch')?.value).toLowerCase();

  const projetos = db.projects.filter(projeto =>
    `${projeto.name} ${projeto.description} ${projeto.category}`
      .toLowerCase()
      .includes(pesquisa)
  );

  const html = projetos.map(projeto => {
    const progresso = progressoProjeto(projeto.id);
    const tarefas = db.tasks.filter(t => t.projectId === projeto.id).length;
    const statusTexto = {
      active: 'Em desenvolvimento',
      paused: 'Pausado',
      done: 'Concluído'
    }[projeto.status] || 'Em desenvolvimento';

    return `
      <article class="project-card">
        <div class="project-top">
          <div class="project-symbol">
            <i class="fa-solid fa-flask"></i>
          </div>
          <span class="tag ${projeto.status === 'done' ? 'green' : ''}">
            ${escapeHTML(statusTexto)}
          </span>
        </div>

        ${projeto.image ? `
          <img class="project-photo"
            src="${projeto.image}"
            alt="Foto do projeto ${escapeHTML(projeto.name)}">
        ` : ''}

        <h3>${escapeHTML(projeto.name)}</h3>
        <p>${escapeHTML(projeto.description || 'Adicione uma descrição para explicar sua ideia.')}</p>

        <span class="tag">${escapeHTML(projeto.category || 'Tecnologia')}</span>

        <div class="progress" aria-label="Progresso de ${progresso}%">
          <span style="width:${progresso}%"></span>
        </div>

        <div class="meta">
          <span>${tarefas} tarefa(s)</span>
          <strong>${progresso}% concluído</strong>
        </div>

        <div class="project-actions">
          <button data-edit="project" data-id="${projeto.id}">
            <i class="fa-solid fa-pen"></i> Editar
          </button>

          <button data-project-tasks="${projeto.id}">
            <i class="fa-solid fa-list-check"></i> Tarefas
          </button>

          <button class="delete-btn" data-delete="project" data-id="${projeto.id}">
            <i class="fa-solid fa-trash"></i> Excluir
          </button>
        </div>
      </article>
    `;
  }).join('');

  if ($('#projectGrid')) $('#projectGrid').innerHTML = html;

  if ($('#dashboardProjects')) {
    $('#dashboardProjects').innerHTML = db.projects.slice(0, 3).map(projeto => {
      const progresso = progressoProjeto(projeto.id);

      return `
        <article class="project-card">
          <div class="project-top">
            <div class="project-symbol">
              <i class="fa-solid fa-flask"></i>
            </div>
            <span class="tag">${progresso}% concluído</span>
          </div>

          <h3>${escapeHTML(projeto.name)}</h3>
          <p>${escapeHTML(projeto.description || 'Seu projeto está pronto para receber novas informações.')}</p>

          <div class="progress">
            <span style="width:${progresso}%"></span>
          </div>

          <div class="project-actions">
            <button data-project-tasks="${projeto.id}">
              Ver tarefas <i class="fa-solid fa-arrow-right"></i>
            </button>
            <button data-edit="project" data-id="${projeto.id}">
              Editar
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  $('#emptyProjects')?.toggleAttribute('hidden', projetos.length > 0);
  $('#dashboardEmpty')?.toggleAttribute('hidden', db.projects.length > 0);
}

// ==========================================
// 8. TAREFAS
// ==========================================

function renderizarTarefas() {
  atualizarSelects();

  const seletor = $('#taskProjectSelect');
  if (!seletor) return;

  const projectId = seletor.value;
  const quadro = $('#kanbanBoard');

  if (!quadro) return;

  if (!db.projects.length) {
    quadro.innerHTML = `
      <div class="panel empty">
        <i class="fa-solid fa-list-check"></i>
        <h3>Vamos criar sua primeira tarefa?</h3>
        <p>Primeiro crie um projeto. Depois você poderá dividir o trabalho em etapas.</p>
        <button class="btn primary" data-action="new-project">
          Criar projeto
        </button>
      </div>
    `;
    return;
  }

  const colunas = [
    { id: 'todo', nome: 'A fazer', dica: 'Atividades que ainda não começaram.' },
    { id: 'doing', nome: 'Em andamento', dica: 'Atividades em que você está trabalhando.' },
    { id: 'done', nome: 'Concluído', dica: 'Atividades que já foram finalizadas.' }
  ];

  quadro.innerHTML = colunas.map(coluna => {
    const tarefas = db.tasks.filter(
      tarefa => tarefa.projectId === projectId && tarefa.status === coluna.id
    );

    return `
      <div class="kanban-col">
        <div class="kanban-head">
          <span>${coluna.nome}</span>
          <span>${tarefas.length}</span>
        </div>

        <p class="help-text">${coluna.dica}</p>

        ${tarefas.length ? tarefas.map(tarefa => `
          <article class="task">
            <div class="task-title">${escapeHTML(tarefa.name)}</div>

            ${tarefa.description ? `<p>${escapeHTML(tarefa.description)}</p>` : ''}

            ${tarefa.due ? `<small><i class="fa-regular fa-calendar"></i> Prazo: ${dataBonita(tarefa.due)}</small>` : ''}

            <div class="task-actions">
              ${coluna.id !== 'todo' ? `
                <button title="Mover para A fazer"
                  data-task-status="todo" data-id="${tarefa.id}">
                  <i class="fa-solid fa-arrow-left"></i>
                </button>
              ` : ''}

              ${coluna.id !== 'doing' ? `
                <button title="Mover para Em andamento"
                  data-task-status="doing" data-id="${tarefa.id}">
                  <i class="fa-solid fa-play"></i>
                </button>
              ` : ''}

              ${coluna.id !== 'done' ? `
                <button title="Marcar como concluída"
                  data-task-status="done" data-id="${tarefa.id}">
                  <i class="fa-solid fa-check"></i>
                </button>
              ` : ''}

              <button data-edit="task" data-id="${tarefa.id}" title="Editar tarefa">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button class="delete-btn" data-delete="task" data-id="${tarefa.id}" title="Excluir tarefa">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </article>
        `).join('') : `
          <div class="empty">
            <i class="fa-regular fa-clipboard"></i>
            <p>Nenhuma tarefa nesta etapa.</p>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function mudarStatusTarefa(id, status) {
  const tarefa = db.tasks.find(item => item.id === id);

  if (!tarefa) return;

  tarefa.status = status;

  if (salvar()) {
    renderizarTudo();

    const nomes = {
      todo: 'A fazer',
      doing: 'Em andamento',
      done: 'Concluída'
    };

    toast(`Tarefa movida para "${nomes[status]}".`);
  }
}

// ==========================================
// 9. MATERIAIS E CUSTOS
// ==========================================

function renderizarMateriais() {
  const projectId = projetoAtual;
  const materiais = db.materials.filter(item => item.projectId === projectId);

  const total = materiais.reduce(
    (soma, item) => soma + Number(item.quantity) * Number(item.price),
    0
  );

  if ($('#materialCount')) {
    $('#materialCount').textContent = materiais.length;
  }

  if ($('#materialTotal')) {
    $('#materialTotal').textContent = money(total);
  }

  if ($('#materialProjectLabel')) {
    $('#materialProjectLabel').textContent = projectId
      ? `Materiais do projeto: ${nomeProjeto(projectId)}`
      : 'Crie um projeto para cadastrar materiais.';
  }

  if ($('#materialsTable')) {
    $('#materialsTable').innerHTML = materiais.length ? `
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Quantidade</th>
            <th>Preço unitário</th>
            <th>Total</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${materiais.map(item => `
            <tr>
              <td>${escapeHTML(item.name)}</td>
              <td>${Number(item.quantity)}</td>
              <td>${money(item.price)}</td>
              <td>${money(item.quantity * item.price)}</td>
              <td>
                <button class="btn soft" data-edit="material" data-id="${item.id}">
                  Editar
                </button>
                <button class="btn danger" data-delete="material" data-id="${item.id}">
                  Excluir
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';
  }

  $('#emptyMaterials')?.toggleAttribute('hidden', materiais.length > 0);
}

// ==========================================
// 10. TESTES E MELHORIAS
// ==========================================

function renderizarTestes() {
  atualizarSelects();

  const projectId = $('#testProjectSelect')?.value || '';
  const testes = db.tests
    .filter(item => item.projectId === projectId)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if ($('#testList')) {
    $('#testList').innerHTML = testes.map(item => `
      <article class="entry">
        <h4>${escapeHTML(item.name)}</h4>
        <p><strong>Projeto:</strong> ${escapeHTML(nomeProjeto(item.projectId))}</p>
        <p><strong>Data:</strong> ${dataBonita(item.date)}</p>

        ${item.description ? `<p><strong>O que foi feito:</strong> ${escapeHTML(item.description)}</p>` : ''}
        ${item.result ? `<p><strong>Resultado:</strong> ${escapeHTML(item.result)}</p>` : ''}
        ${item.improvement ? `<p><strong>Próxima melhoria:</strong> ${escapeHTML(item.improvement)}</p>` : ''}

        ${item.image ? `<div class="entry-photos"><img src="${item.image}" alt="Foto do teste"></div>` : ''}

        <div class="card-actions">
          <button data-edit="test" data-id="${item.id}">Editar teste</button>
          <button class="delete-btn" data-delete="test" data-id="${item.id}">Excluir teste</button>
        </div>
      </article>
    `).join('');
  }

  $('#emptyTests')?.toggleAttribute('hidden', testes.length > 0);
}

// ==========================================
// 11. DIÁRIO DE BORDO
// ==========================================

let fotosDiario = [];

function prepararFotos(seletor, previewSeletor, aoSelecionar) {
  const input = $(seletor);
  const preview = $(previewSeletor);

  if (!input || !preview) return;

  input.addEventListener('change', async () => {
    preview.innerHTML = '';

    const arquivos = [...(input.files || [])].slice(0, 6);
    const imagens = [];

    for (const arquivo of arquivos) {
      try {
        const imagem = await comprimirImagem(arquivo);
        imagens.push(imagem);
        preview.insertAdjacentHTML(
          'beforeend',
          `<img src="${imagem}" alt="Prévia da imagem">`
        );
      } catch {
        toast('Uma das imagens não pôde ser carregada.', 'error');
      }
    }

    aoSelecionar(imagens);
  });
}

function renderizarDiario() {
  const projectId = $('#notebookProjectSelect')?.value || '';

  const registros = db.notebook
    .filter(item => item.projectId === projectId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  if ($('#notebookList')) {
    $('#notebookList').innerHTML = registros.map(item => `
      <article class="entry">
        <span class="tag">${escapeHTML(item.type || 'Atividade')}</span>
        <h4>${escapeHTML(item.title)}</h4>
        <p><strong>Data:</strong> ${dataBonita(item.date)}</p>
        <p><strong>Responsável:</strong> ${escapeHTML(item.author || 'Não informado')}</p>
        <p>${escapeHTML(item.description)}</p>

        ${item.next ? `<p><strong>Próximos passos:</strong> ${escapeHTML(item.next)}</p>` : ''}

        ${item.images?.length ? `
          <div class="entry-photos">
            ${item.images.map((imagem, indice) => `
              <img src="${imagem}" alt="Foto ${indice + 1} do registro">
            `).join('')}
          </div>
        ` : ''}

        <div class="card-actions">
          <button class="delete-btn" data-delete-notebook="${item.id}">
            <i class="fa-solid fa-trash"></i> Excluir registro
          </button>
        </div>
      </article>
    `).join('');
  }

  $('#emptyNotebook')?.toggleAttribute('hidden', registros.length > 0);
}

function salvarRegistroDiario(evento) {
  evento.preventDefault();

  const projectId = $('#notebookProjectSelect')?.value;
  const title = texto($('#notebookTitle')?.value);
  const description = texto($('#notebookDescription')?.value);

  if (!projectId) {
    toast('Crie um projeto antes de salvar um registro.', 'error');
    return;
  }

  if (!title || !description) {
    toast('Preencha o título e a descrição do registro.', 'error');
    return;
  }

  db.notebook.push({
    id: uid(),
    projectId,
    date: $('#notebookDate')?.value || dataHoje(),
    type: $('#notebookType')?.value || 'Atividade',
    author: texto($('#notebookAuthor')?.value),
    title,
    description,
    next: texto($('#notebookNext')?.value),
    images: fotosDiario
  });

  if (salvar()) {
    $('#notebookForm')?.reset();
    $('#notebookDate').value = dataHoje();
    $('#notebookPhotoPreview').innerHTML = '';
    fotosDiario = [];
    renderizarDiario();
    toast('Registro salvo no diário de bordo!');
  }
}

// ==========================================
// 12. RELATÓRIO TÉCNICO
// ==========================================

let fotosRelatorio = [];

function dadosRelatorio() {
  const projectId = $('#technicalProjectSelect')?.value || '';
  const projeto = obterProjeto(projectId);
  const salvo = db.reports[projectId] || {};

  return {
    projectId,
    projectName: projeto?.name || 'Projeto não selecionado',
    team: texto($('#reportTeam')?.value ?? salvo.team),
    institution: texto($('#reportInstitution')?.value ?? salvo.institution),
    objective: texto($('#reportObjective')?.value ?? salvo.objective),
    method: texto($('#reportMethod')?.value ?? salvo.method),
    limits: texto($('#reportLimits')?.value ?? salvo.limits),
    images: fotosRelatorio.length ? fotosRelatorio : (salvo.images || [])
  };
}

function carregarRelatorio() {
  const projectId = $('#technicalProjectSelect')?.value;

  if (!projectId) return;

  const salvo = db.reports[projectId] || {};

  $('#reportTeam').value = salvo.team || '';
  $('#reportInstitution').value = salvo.institution || '';
  $('#reportObjective').value = salvo.objective || '';
  $('#reportMethod').value = salvo.method || '';
  $('#reportLimits').value = salvo.limits || '';

  fotosRelatorio = salvo.images || [];

  const preview = $('#reportImagePreview');

  if (preview) {
    preview.innerHTML = fotosRelatorio.map(imagem =>
      `<img src="${imagem}" alt="Imagem do relatório">`
    ).join('');
  }

  renderizarRelatorio();
}

function renderizarRelatorio() {
  const preview = $('#technicalPreview');

  if (!preview) return;

  const dados = dadosRelatorio();

  preview.innerHTML = `
    <h2>Relatório técnico</h2>
    <p><strong>Projeto:</strong> ${escapeHTML(dados.projectName)}</p>
    <p><strong>Instituição:</strong> ${escapeHTML(dados.institution || 'Não informada')}</p>
    <p><strong>Equipe:</strong> ${escapeHTML(dados.team || 'Não informada')}</p>

    <h3>1. Objetivo</h3>
    <p>${escapeHTML(dados.objective || 'Descreva aqui o objetivo do projeto.')}</p>

    <h3>2. Metodologia</h3>
    <p>${escapeHTML(dados.method || 'Explique as etapas e os materiais utilizados.')}</p>

    <h3>3. Limitações e próximos passos</h3>
    <p>${escapeHTML(dados.limits || 'Registre as dificuldades e as melhorias planejadas.')}</p>

    ${dados.images.length ? `
      <h3>4. Fotos do projeto</h3>
      <div class="entry-photos">
        ${dados.images.map((imagem, indice) => `
          <img src="${imagem}" alt="Foto ${indice + 1} do projeto">
        `).join('')}
      </div>
    ` : `
      <p class="muted">Nenhuma foto adicionada ao relatório.</p>
    `}
  `;
}

function salvarRelatorio(evento) {
  evento.preventDefault();

  const dados = dadosRelatorio();

  if (!dados.projectId) {
    toast('Escolha um projeto para salvar o relatório.', 'error');
    return;
  }

  db.reports[dados.projectId] = {
    team: dados.team,
    institution: dados.institution,
    objective: dados.objective,
    method: dados.method,
    limits: dados.limits,
    images: dados.images,
    updatedAt: new Date().toISOString()
  };

  if (salvar()) {
    toast('Relatório atualizado e salvo!');
    renderizarRelatorio();
  }
}

// ==========================================
// 13. COMPARAR PROTÓTIPOS
// ==========================================

function lerComparacaoFormulario() {
  const numero = id => Number($(id)?.value) || 0;

  return {
    a: {
      name: texto($('#versionAName')?.value) || 'Protótipo A',
      cost: numero('#versionACost'),
      accuracy: numero('#versionAAccuracy'),
      resistance: numero('#versionAResistance'),
      notes: texto($('#versionANotes')?.value)
    },
    b: {
      name: texto($('#versionBName')?.value) || 'Protótipo B',
      cost: numero('#versionBCost'),
      accuracy: numero('#versionBAccuracy'),
      resistance: numero('#versionBResistance'),
      notes: texto($('#versionBNotes')?.value)
    }
  };
}

function compararVersoes() {
  const dados = lerComparacaoFormulario();

  for (const versao of [dados.a, dados.b]) {
    if (versao.cost < 0 || versao.accuracy < 0 || versao.accuracy > 100 ||
        versao.resistance < 0 || versao.resistance > 100) {
      toast('Confira os valores. As porcentagens precisam ficar entre 0 e 100.', 'error');
      return;
    }
  }

  db.compare = dados;
  salvar();

  mostrarComparacao(dados);
  toast('Comparação realizada!');
}

function mostrarComparacao(dados) {
  const tabela = $('#comparisonTable');
  const conclusao = $('#comparisonConclusion');

  if (!tabela || !conclusao) return;

  const metricas = [
    { chave: 'cost', nome: 'Custo', formato: money, menor: true },
    { chave: 'accuracy', nome: 'Precisão', formato: v => `${v}%`, menor: false },
    { chave: 'resistance', nome: 'Resistência', formato: v => `${v}%`, menor: false }
  ];

  tabela.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Característica</th>
          <th>${escapeHTML(dados.a.name)}</th>
          <th>${escapeHTML(dados.b.name)}</th>
          <th>Comparação</th>
        </tr>
      </thead>

      <tbody>
        ${metricas.map(metrica => {
          const a = dados.a[metrica.chave];
          const b = dados.b[metrica.chave];

          let vencedor = 'Empate';

          if (a !== b) {
            vencedor = metrica.menor
              ? (a < b ? dados.a.name : dados.b.name)
              : (a > b ? dados.a.name : dados.b.name);
          }

          return `
            <tr>
              <td>${metrica.nome}</td>
              <td>${metrica.formato(a)}</td>
              <td>${metrica.formato(b)}</td>
              <td>${escapeHTML(vencedor)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  const custoTexto = dados.a.cost === dados.b.cost
    ? 'As duas versões têm o mesmo custo.'
    : `${dados.a.cost < dados.b.cost ? dados.a.name : dados.b.name} tem o menor custo.`;

  const precisaoTexto = dados.a.accuracy === dados.b.accuracy
    ? 'As duas versões têm a mesma precisão.'
    : `${dados.a.accuracy > dados.b.accuracy ? dados.a.name : dados.b.name} tem a maior precisão.`;

  const resistenciaTexto = dados.a.resistance === dados.b.resistance
    ? 'As duas versões têm a mesma resistência.'
    : `${dados.a.resistance > dados.b.resistance ? dados.a.name : dados.b.name} tem a maior resistência.`;

  conclusao.innerHTML = `
    <strong>Resumo da comparação</strong><br>
    ${escapeHTML(custoTexto)}<br>
    ${escapeHTML(precisaoTexto)}<br>
    ${escapeHTML(resistenciaTexto)}<br><br>
    <strong>Lembrete:</strong> o melhor protótipo depende do objetivo do seu projeto.
    Considere também segurança, facilidade de construção e resultados dos testes.
  `;
}

function carregarComparacao() {
  if (db.compare) mostrarComparacao(db.compare);
}

function limparComparacao() {
  if (!confirmar('Deseja limpar os dados da comparação?')) return;

  $('#compareFormA')?.reset();
  $('#compareFormB')?.reset();

  $('#comparisonTable').innerHTML = '';
  $('#comparisonConclusion').textContent = '';

  db.compare = null;
  salvar();

  toast('Comparação limpa.');
}

// ==========================================
// 14. GERADOR DE IDEIAS
// ==========================================

function gerarIdeias(tema) {
  const modelos = [
    {
      titulo: 'Solução inteligente',
      icone: 'fa-lightbulb',
      problema: 'Um processo que poderia ser mais simples, rápido ou seguro.',
      solucao: `Criar uma solução para melhorar ${tema}, usando materiais acessíveis e um protótipo simples.`,
      materiais: 'Papelão, materiais reutilizados, sensores ou componentes básicos.',
      teste: 'Verificar se a solução funciona em diferentes situações.'
    },
    {
      titulo: 'Projeto sustentável',
      icone: 'fa-leaf',
      problema: 'Desperdício de recursos ou materiais que poderiam ser reaproveitados.',
      solucao: `Desenvolver uma alternativa sustentável relacionada a ${tema}.`,
      materiais: 'Materiais recicláveis, recipientes reutilizados e ferramentas de montagem.',
      teste: 'Comparar o consumo de recursos antes e depois da solução.'
    },
    {
      titulo: 'Automação de uma tarefa',
      icone: 'fa-gears',
      problema: 'Uma tarefa repetitiva que exige tempo ou esforço desnecessário.',
      solucao: `Construir um protótipo que automatize uma etapa relacionada a ${tema}.`,
      materiais: 'Microcontrolador opcional, sensores, fios e materiais de montagem.',
      teste: 'Realizar a mesma tarefa várias vezes e registrar os resultados.'
    },
    {
      titulo: 'Monitoramento e segurança',
      icone: 'fa-shield-halved',
      problema: 'Dificuldade de perceber mudanças, falhas ou situações de risco.',
      solucao: `Planejar um sistema que ajude a acompanhar ${tema} e avise quando algo precisar de atenção.`,
      materiais: 'Indicadores visuais, sensores apropriados e materiais de prototipagem.',
      teste: 'Simular situações diferentes e verificar se os avisos são compreensíveis.'
    }
  ];

  return modelos.map((modelo, indice) => ({
    ...modelo,
    id: String(indice),
    tema
  }));
}

function renderizarIdeias(tema) {
  const resultados = $('#ideaResults');
  const escolhido = $('#ideaChosen');

  if (!resultados) return;

  escolhido.hidden = true;

  const ideias = gerarIdeias(tema);

  resultados.innerHTML = `
    <div class="idea-results-head">
      <div>
        <h3>Ideias para: ${escapeHTML(tema)}</h3>
        <p class="muted">Escolha a sugestão que mais combina com seu objetivo.</p>
      </div>
      <span class="idea-count">${ideias.length} sugestões</span>
    </div>

    <div class="idea-grid">
      ${ideias.map(ideia => `
        <article class="idea-card">
          <div class="idea-card-top">
            <div class="idea-icon">
              <i class="fa-solid ${ideia.icone}"></i>
            </div>
            <span class="idea-number">Ideia ${Number(ideia.id) + 1}</span>
          </div>

          <h3>${escapeHTML(ideia.titulo)}</h3>
          <p>${escapeHTML(ideia.problema)}</p>

          <div class="idea-detail">
            <b>Possível solução</b>
            <span>${escapeHTML(ideia.solucao)}</span>
          </div>

          <div class="idea-detail">
            <b>Materiais possíveis</b>
            <span>${escapeHTML(ideia.materiais)}</span>
          </div>

          <div class="idea-detail">
            <b>Como testar</b>
            <span>${escapeHTML(ideia.teste)}</span>
          </div>

          <button class="btn primary idea-select"
            data-choose-idea="${escapeHTML(ideia.id)}"
            data-topic="${escapeHTML(tema)}">
            Escolher esta ideia
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </article>
      `).join('')}
    </div>
  `;
}

function escolherIdeia(indice, tema) {
  const ideia = gerarIdeias(tema)[Number(indice)];

  if (!ideia) return;

  const escolhido = $('#ideaChosen');

  escolhido.hidden = false;

  escolhido.innerHTML = `
    <div>
      <span class="tag">Ideia selecionada</span>
      <h3>${escapeHTML(ideia.titulo)}</h3>
      <p>${escapeHTML(ideia.solucao)}</p>
      <p><strong>Próximo passo:</strong> crie um projeto e use essa descrição para começar a organizar seu trabalho.</p>
    </div>

    <button class="btn primary" data-create-idea="${escapeHTML(ideia.titulo)}"
      data-description="${escapeHTML(ideia.solucao)}">
      <i class="fa-solid fa-plus"></i> Criar projeto com esta ideia
    </button>
  `;

  escolhido.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==========================================
// 15. IMPRIMIR E SALVAR EM PDF
// ==========================================

function imprimirPagina(pagina) {
  navegar(pagina);

  setTimeout(() => {
    window.print();
  }, 200);
}

// ==========================================
// 16. NÚMEROS DA PÁGINA INICIAL
// ==========================================

function atualizarEstatisticas() {
  const ativos = db.projects.filter(p => p.status !== 'done').length;
  const pendentes = db.tasks.filter(t => t.status !== 'done').length;
  const concluidas = db.tasks.filter(t => t.status === 'done').length;

  if ($('#statActive')) $('#statActive').textContent = ativos;
  if ($('#statPending')) $('#statPending').textContent = pendentes;
  if ($('#statDone')) $('#statDone').textContent = concluidas;
  if ($('#statTests')) $('#statTests').textContent = db.tests.length;
}

// ==========================================
// 17. ATUALIZAR A INTERFACE
// ==========================================

function renderizarTudo() {
  atualizarSelects();
  renderizarProjetos();
  renderizarTarefas();
  renderizarMateriais();
  renderizarTestes();
  renderizarDiario();
  renderizarRelatorio();
  atualizarEstatisticas();
}

// ==========================================
// 18. CLIQUES NOS BOTÕES
// ==========================================

document.addEventListener('click', evento => {
  const botao = evento.target.closest('button');

  if (!botao) return;

  if (botao.dataset.page) {
    navegar(botao.dataset.page);
    return;
  }

  if (botao.dataset.action) {
    const acao = botao.dataset.action;

    const acoes = {
      'new-project': () => abrirModal('project'),
      'new-task': () => {
        if (!db.projects.length) {
          toast('Crie um projeto antes de adicionar tarefas.', 'error');
          abrirModal('project');
        } else {
          abrirModal('task');
        }
      },
      'new-material': () => {
        if (!db.projects.length) {
          toast('Crie um projeto antes de adicionar materiais.', 'error');
          abrirModal('project');
        } else {
          abrirModal('material');
        }
      },
      'new-test': () => {
        if (!db.projects.length) {
          toast('Crie um projeto antes de registrar testes.', 'error');
          abrirModal('project');
        } else {
          abrirModal('test');
        }
      },
      'compare': compararVersoes,
      'reset-compare': limparComparacao,
      'print-technical': () => imprimirPagina('technical'),
      'print-notebook': () => imprimirPagina('notebook')
    };

    acoes[acao]?.();
    return;
  }

  if (botao.dataset.edit) {
    abrirModal(botao.dataset.edit, botao.dataset.id);
    return;
  }

  if (botao.dataset.delete) {
    excluirItem(botao.dataset.delete, botao.dataset.id);
    return;
  }

  if (botao.dataset.taskStatus) {
    mudarStatusTarefa(botao.dataset.id, botao.dataset.taskStatus);
    return;
  }

  if (botao.dataset.projectTasks) {
    projetoAtual = botao.dataset.projectTasks;
    preencherSelectProjetos('#taskProjectSelect', projetoAtual);
    navegar('tasks');
    renderizarTarefas();
    return;
  }

  if (botao.dataset.deleteNotebook) {
    if (confirmar('Deseja excluir este registro do diário de bordo?')) {
      db.notebook = db.notebook.filter(item => item.id !== botao.dataset.deleteNotebook);

      if (salvar()) {
        renderizarDiario();
        toast('Registro excluído.');
      }
    }

    return;
  }

  if (botao.dataset.chooseIdea !== undefined) {
    escolherIdeia(botao.dataset.chooseIdea, botao.dataset.topic);
    return;
  }

  if (botao.dataset.createIdea) {
    const titulo = botao.dataset.createIdea;
    const descricao = botao.dataset.description;

    abrirModal('project');

    setTimeout(() => {
      if ($('#modalName')) $('#modalName').value = titulo;
      if ($('#modalDescription')) $('#modalDescription').value = descricao;
    }, 50);

    return;
  }
});

// ==========================================
// 19. FORMULÁRIOS
// ==========================================

$('#modalForm')?.addEventListener('submit', salvarItemModal);

$('#modalClose')?.addEventListener('click', fecharModal);
$('#modalCancel')?.addEventListener('click', fecharModal);

$('#modalBackdrop')?.addEventListener('click', evento => {
  if (evento.target.id === 'modalBackdrop') fecharModal();
});

$('#projectSearch')?.addEventListener('input', renderizarProjetos);

$('#taskProjectSelect')?.addEventListener('change', evento => {
  projetoAtual = evento.target.value;
  renderizarTarefas();
});

$('#testProjectSelect')?.addEventListener('change', renderizarTestes);

$('#technicalProjectSelect')?.addEventListener('change', carregarRelatorio);

$('#notebookProjectSelect')?.addEventListener('change', renderizarDiario);

$('#technicalForm')?.addEventListener('submit', salvarRelatorio);

$('#notebookForm')?.addEventListener('submit', salvarRegistroDiario);

$('#ideaForm')?.addEventListener('submit', evento => {
  evento.preventDefault();

  const tema = texto($('#ideaTopic')?.value);

  if (tema.length < 2) {
    toast('Digite um tema com pelo menos duas letras.', 'error');
    return;
  }

  renderizarIdeias(tema);
});

$('#compareFormA')?.addEventListener('submit', evento => evento.preventDefault());
$('#compareFormB')?.addEventListener('submit', evento => evento.preventDefault());

// ==========================================
// 20. PRÉVIA DAS FOTOS
// ==========================================

prepararFotos('#notebookPhotos', '#notebookPhotoPreview', imagens => {
  fotosDiario = imagens;
});

prepararFotos('#reportImages', '#reportImagePreview', imagens => {
  fotosRelatorio = imagens;
  renderizarRelatorio();
});

// ==========================================
// 21. MENU PARA CELULAR
// ==========================================

$('#mobileMenu')?.addEventListener('click', () => {
  $('#sidebar')?.classList.toggle('open');
});

document.addEventListener('keydown', evento => {
  if (evento.key === 'Escape') {
    fecharModal();
    $('#sidebar')?.classList.remove('open');
  }
});

// ==========================================
// 22. INICIAR O SITE
// ==========================================

function iniciarCleberLab() {
  projetoAtual = db.projects[0]?.id || '';

  if ($('#notebookDate')) {
    $('#notebookDate').value = dataHoje();
  }

  atualizarSelects();
  renderizarTudo();

  const paginaInicial = $('#page-dashboard');

  if (paginaInicial) {
    navegar('dashboard');
  }

  console.info('CleberLab iniciado.');
}

iniciarCleberLab();
