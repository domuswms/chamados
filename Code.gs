/**
 * Central de Chamados WeAxis — backend (Google Apps Script + Google Sheets + Google Drive)
 *
 * Abas da planilha:
 *   Chamados  -> um chamado por linha (registro de abertura e atendimento)
 *   Mensagens -> respostas trocadas dentro de cada chamado
 *   Config    -> coluna A: temas | coluna B: e-mails dos atendentes
 *
 * Fotos: gravadas numa pasta do Drive do dono do script. A planilha guarda só os IDs.
 */

const ABA_CHAMADOS = 'Chamados';
const ABA_MENSAGENS = 'Mensagens';
const ABA_CONFIG = 'Config';
const NOME_PASTA_FOTOS = 'Central de Chamados - Fotos';
const MAX_FOTOS = 5;
const MAX_BYTES_FOTO = 8 * 1024 * 1024;

const CABECALHO = [
  'ID', 'Aberto em', 'Solicitante', 'Tema', 'Descrição', 'Status',
  'Atendente', 'Iniciado em', 'Concluído em', 'Solução',
  'Nota qualidade', 'Nota satisfação', 'Avaliado em', 'Fotos'
];
const CABECALHO_MSG = ['Chamado', 'Data', 'Autor', 'Papel', 'Mensagem', 'Fotos'];

const STATUS = { ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em atendimento', CONCLUIDO: 'Concluído' };
const PAPEL = { SOLICITANTE: 'Solicitante', ATENDENTE: 'Atendente' };

// ---------------------------------------------------------------------------
// Web app
// ---------------------------------------------------------------------------

function doGet() {
  return paginaHtml_()
    .setTitle('Central de chamados · WeAxis')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Aceita as variações de nome mais comuns do arquivo HTML no editor. */
function paginaHtml_() {
  const nomes = ['Index', 'index', 'Index.html', 'index.html'];
  for (let i = 0; i < nomes.length; i++) {
    try { return HtmlService.createHtmlOutputFromFile(nomes[i]); } catch (e) {}
  }
  throw new Error('Arquivo HTML "Index" não encontrado. No editor, clique no + ao lado de "Arquivos", ' +
    'escolha HTML, digite Index e cole nele o conteúdo do Index.html.');
}

/** Rode pelo editor do Apps Script. Cria o que faltar; pode rodar de novo sem perder dados. */
function setup() {
  const ss = planilhaDoSetup_();

  prepararAba_(ss, ABA_CHAMADOS, CABECALHO);
  prepararAba_(ss, ABA_MENSAGENS, CABECALHO_MSG);

  const config = ss.getSheetByName(ABA_CONFIG) || ss.insertSheet(ABA_CONFIG);
  if (config.getLastRow() === 0) {
    config.getRange(1, 1, 3, 2).setValues([
      ['Temas', 'Atendentes (e-mail)'],
      ['Abertura de cadastro', Session.getActiveUser().getEmail()],
      ['Assistência técnica', '']
    ]);
    config.setFrozenRows(1);
    config.getRange(1, 1, 1, 2).setFontWeight('bold');
  }

  pastaFotos_();
  Logger.log('Pronto. Planilha da Central de Chamados: ' + ss.getUrl());
}

/**
 * Script criado pela planilha (Extensões → Apps Script): usa essa planilha.
 * Script avulso (criado em script.google.com ou pelo Drive): usa a planilha
 * gravada antes ou cria uma nova no seu Drive.
 */
function planilhaDoSetup_() {
  const props = PropertiesService.getScriptProperties();
  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) {
    props.setProperty('SPREADSHEET_ID', ativa.getId());
    return ativa;
  }
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  const nova = SpreadsheetApp.create('Central de Chamados - Base');
  nova.setSpreadsheetTimeZone('America/Sao_Paulo');
  props.setProperty('SPREADSHEET_ID', nova.getId());
  return nova;
}

function prepararAba_(ss, nome, cabecalho) {
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

// ---------------------------------------------------------------------------
// Funções chamadas pela página (google.script.run)
// ---------------------------------------------------------------------------

function getDadosIniciais(emailInformado) {
  const usuario = usuario_(emailInformado);
  const config = lerConfig_();
  const ehAtendente = !!usuario && config.atendentes.indexOf(usuario) !== -1;

  const ultimo = {};
  lerMensagens_().forEach(function (m) { ultimo[m.chamado] = m.papel; });
  const chamados = lerChamados_().map(function (c) {
    c.dados.ultimaResposta = ultimo[c.dados.id] || null;
    return c.dados;
  });

  return {
    usuario: usuario,
    emailDetectado: !!Session.getActiveUser().getEmail(),
    ehAtendente: ehAtendente,
    temas: config.temas,
    meusChamados: chamados.filter(function (c) { return c.solicitante === usuario; }),
    todosChamados: ehAtendente ? chamados : []
  };
}

function getChamado(emailInformado, id) {
  const usuario = exigirUsuario_(emailInformado);
  const c = acharChamado_(id).dados;
  exigirAcesso_(usuario, c);
  return {
    chamado: c,
    mensagens: lerMensagens_().filter(function (m) { return m.chamado === id; })
  };
}

function abrirChamado(emailInformado, tema, descricao, fotos) {
  const usuario = exigirUsuario_(emailInformado);
  tema = String(tema || '').trim();
  descricao = String(descricao || '').trim();
  if (lerConfig_().temas.indexOf(tema) === -1) throw new Error('Selecione um tema válido.');
  if (!descricao) throw new Error('Descreva a solicitação.');
  const idsFotos = salvarFotos_(fotos, usuario);

  return comTrava_(function () {
    const sh = abaChamados_();
    const id = proximoId_(sh);
    const linha = [id, new Date(), usuario, tema, descricao, STATUS.ABERTO, '', '', '', '', '', '', '', idsFotos];
    sh.appendRow(linha);
    return paraObjeto_(linha);
  });
}

function responderChamado(emailInformado, id, texto, fotos) {
  const usuario = exigirUsuario_(emailInformado);
  texto = String(texto || '').trim();
  if (!texto && !(fotos && fotos.length)) throw new Error('Escreva uma mensagem ou anexe uma foto.');

  const atual = acharChamado_(id).dados;
  exigirAcesso_(usuario, atual);
  if (atual.status === STATUS.CONCLUIDO) throw new Error('Chamado concluído. Para um novo problema, abra outro chamado.');
  const idsFotos = salvarFotos_(fotos, usuario);

  return comTrava_(function () {
    const c = acharChamado_(id);
    if (c.dados.status === STATUS.CONCLUIDO) throw new Error('Chamado concluído. Para um novo problema, abra outro chamado.');
    const papel = c.dados.solicitante === usuario ? PAPEL.SOLICITANTE : PAPEL.ATENDENTE;

    // Atendente que responde um chamado ainda aberto passa a ser o responsável por ele.
    if (papel === PAPEL.ATENDENTE && c.dados.status === STATUS.ABERTO) {
      gravar_(c.linha, { 'Status': STATUS.EM_ATENDIMENTO, 'Atendente': usuario, 'Iniciado em': new Date() });
    }
    abaMensagens_().appendRow([id, new Date(), usuario, papel, texto, idsFotos]);
    return getChamado(emailInformado, id);
  });
}

function iniciarAtendimento(emailInformado, id) {
  const usuario = exigirAtendente_(emailInformado);
  return comTrava_(function () {
    const c = acharChamado_(id);
    if (c.dados.status !== STATUS.ABERTO) throw new Error('Este chamado já foi assumido.');
    gravar_(c.linha, { 'Status': STATUS.EM_ATENDIMENTO, 'Atendente': usuario, 'Iniciado em': new Date() });
    return getChamado(emailInformado, id);
  });
}

function concluirChamado(emailInformado, id, solucao) {
  exigirAtendente_(emailInformado);
  solucao = String(solucao || '').trim();
  if (!solucao) throw new Error('Descreva a solução antes de concluir.');
  return comTrava_(function () {
    const c = acharChamado_(id);
    if (c.dados.status !== STATUS.EM_ATENDIMENTO) throw new Error('Só é possível concluir chamados em atendimento.');
    gravar_(c.linha, { 'Status': STATUS.CONCLUIDO, 'Concluído em': new Date(), 'Solução': solucao });
    return getChamado(emailInformado, id);
  });
}

function avaliarChamado(emailInformado, id, notaQualidade, notaSatisfacao) {
  const usuario = exigirUsuario_(emailInformado);
  const q = Number(notaQualidade), s = Number(notaSatisfacao);
  if (!(q >= 1 && q <= 5 && s >= 1 && s <= 5)) throw new Error('As notas devem ser de 1 a 5.');
  return comTrava_(function () {
    const c = acharChamado_(id);
    if (c.dados.solicitante !== usuario) throw new Error('Só quem abriu o chamado pode avaliá-lo.');
    if (c.dados.status !== STATUS.CONCLUIDO) throw new Error('O chamado ainda não foi concluído.');
    if (c.dados.avaliadoEm) throw new Error('Este chamado já foi avaliado.');
    gravar_(c.linha, { 'Nota qualidade': q, 'Nota satisfação': s, 'Avaliado em': new Date() });
    return getChamado(emailInformado, id);
  });
}

/** Devolve a foto como data URL, só para quem pode ver o chamado dela. */
function getFoto(emailInformado, idFoto) {
  const usuario = exigirUsuario_(emailInformado);
  let idChamado = null;
  lerChamados_().forEach(function (c) { if (c.dados.fotos.indexOf(idFoto) !== -1) idChamado = c.dados.id; });
  lerMensagens_().forEach(function (m) { if (m.fotos.indexOf(idFoto) !== -1) idChamado = m.chamado; });
  if (!idChamado) throw new Error('Foto não encontrada.');
  exigirAcesso_(usuario, acharChamado_(idChamado).dados);

  const blob = DriveApp.getFileById(idFoto).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

// ---------------------------------------------------------------------------
// Internos
// ---------------------------------------------------------------------------

function planilha_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function aba_(nome) {
  const sh = planilha_().getSheetByName(nome);
  if (!sh) throw new Error('Aba "' + nome + '" não encontrada. Rode a função setup() no editor.');
  return sh;
}
function abaChamados_() { return aba_(ABA_CHAMADOS); }
function abaMensagens_() { return aba_(ABA_MENSAGENS); }

function lerChamados_() {
  const sh = abaChamados_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, CABECALHO.length).getValues()
    .map(function (r, i) { return { linha: i + 2, dados: paraObjeto_(r) }; })
    .filter(function (c) { return c.dados.id; });
}

function lerMensagens_() {
  const sh = abaMensagens_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, CABECALHO_MSG.length).getValues()
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return {
        chamado: String(r[0]),
        data: r[1] instanceof Date ? r[1].getTime() : new Date(r[1]).getTime(),
        autor: String(r[2]).toLowerCase(),
        papel: String(r[3]),
        texto: String(r[4]),
        fotos: listaIds_(r[5])
      };
    });
}

function lerConfig_() {
  const sh = planilha_().getSheetByName(ABA_CONFIG);
  const n = sh ? sh.getLastRow() - 1 : 0;
  const valores = n > 0 ? sh.getRange(2, 1, n, 2).getValues() : [];
  return {
    temas: valores.map(function (r) { return String(r[0]).trim(); }).filter(String),
    atendentes: valores.map(function (r) { return String(r[1]).trim().toLowerCase(); }).filter(String)
  };
}

function pastaFotos_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PASTA_FOTOS_ID');
  if (id) return DriveApp.getFolderById(id);
  const pasta = DriveApp.createFolder(NOME_PASTA_FOTOS);
  props.setProperty('PASTA_FOTOS_ID', pasta.getId());
  return pasta;
}

/** Recebe [{nome, dados: 'data:image/...;base64,...'}] e devolve os IDs no Drive separados por vírgula. */
function salvarFotos_(fotos, usuario) {
  if (!fotos || !fotos.length) return '';
  if (fotos.length > MAX_FOTOS) throw new Error('Envie no máximo ' + MAX_FOTOS + ' fotos por vez.');
  const decodificadas = fotos.map(function (f) {
    const m = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(f && f.dados || '');
    if (!m) throw new Error('Formato de foto não suportado. Use JPG, PNG ou WEBP.');
    const bytes = Utilities.base64Decode(m[3]);
    if (bytes.length > MAX_BYTES_FOTO) throw new Error('Foto muito grande. O limite é 8 MB.');
    return { tipo: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2], bytes: bytes };
  });
  const pasta = pastaFotos_();
  const prefixo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + usuario.split('@')[0];
  return decodificadas.map(function (f, i) {
    return pasta.createFile(Utilities.newBlob(f.bytes, f.tipo, prefixo + '-' + (i + 1) + '.' + f.ext)).getId();
  }).join(',');
}

function listaIds_(v) {
  return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(String);
}

function usuario_(emailInformado) {
  const email = Session.getActiveUser().getEmail() || emailInformado || '';
  return String(email).trim().toLowerCase();
}

function exigirUsuario_(emailInformado) {
  const u = usuario_(emailInformado);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u)) throw new Error('Não foi possível identificar seu e-mail.');
  return u;
}

function exigirAtendente_(emailInformado) {
  const u = exigirUsuario_(emailInformado);
  if (lerConfig_().atendentes.indexOf(u) === -1) throw new Error('Apenas atendentes podem fazer isso.');
  return u;
}

function exigirAcesso_(usuario, chamado) {
  if (chamado.solicitante === usuario) return;
  if (lerConfig_().atendentes.indexOf(usuario) !== -1) return;
  throw new Error('Você não tem acesso a este chamado.');
}

function acharChamado_(id) {
  const c = lerChamados_().filter(function (x) { return x.dados.id === id; })[0];
  if (!c) throw new Error('Chamado ' + id + ' não encontrado.');
  return c;
}

function gravar_(linha, campos) {
  const sh = abaChamados_();
  Object.keys(campos).forEach(function (nome) {
    sh.getRange(linha, CABECALHO.indexOf(nome) + 1).setValue(campos[nome]);
  });
}

function proximoId_(sh) {
  const n = sh.getLastRow() - 1;
  let maior = 0;
  if (n > 0) {
    sh.getRange(2, 1, n, 1).getValues().forEach(function (r) {
      const num = parseInt(String(r[0]).replace(/\D/g, ''), 10);
      if (num > maior) maior = num;
    });
  }
  return 'CH-' + ('00000' + (maior + 1)).slice(-5);
}

function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const resultado = fn();
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    trava.releaseLock();
  }
}

/** Converte a linha da planilha num objeto serializável (datas viram milissegundos). */
function paraObjeto_(r) {
  const data = function (v) { return v instanceof Date ? v.getTime() : (v ? new Date(v).getTime() : null); };
  const nota = function (v) { return v === '' || v === null ? null : Number(v); };
  return {
    id: String(r[0]),
    abertoEm: data(r[1]),
    solicitante: String(r[2]).toLowerCase(),
    tema: String(r[3]),
    descricao: String(r[4]),
    status: String(r[5]),
    atendente: String(r[6]).toLowerCase(),
    iniciadoEm: data(r[7]),
    concluidoEm: data(r[8]),
    solucao: String(r[9]),
    notaQualidade: nota(r[10]),
    notaSatisfacao: nota(r[11]),
    avaliadoEm: data(r[12]),
    fotos: listaIds_(r[13])
  };
}
