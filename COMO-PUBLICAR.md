# Central de chamados WeAxis — como publicar

Leva uns 10 minutos. Tudo é feito com a conta Google da empresa.

> **Já publicou a versão anterior?** Pule para [Atualizar uma versão já publicada](#atualizar-uma-versão-já-publicada).

## 1. Criar a planilha (banco de dados)

1. Acesse https://sheets.new e dê um nome à planilha, por exemplo **Central de Chamados – Base**.
2. Menu **Arquivo → Configurações → Fuso horário**: escolha **(GMT-03:00) São Paulo**.

## 2. Colar o código

1. Na planilha, abra o menu **Extensões → Apps Script**.
2. No arquivo `Código.gs` que já vem aberto, apague tudo e cole o conteúdo de **Code.gs**.
3. Clique no **+** ao lado de "Arquivos" → **HTML**, dê o nome `Index` (sem `.html`) e cole o conteúdo de **Index.html**.
4. Salve (Ctrl+S).

## 3. Criar as abas e a pasta de fotos

1. Na barra de cima do editor, selecione a função **setup** e clique em **Executar**.
2. O Google vai pedir autorização: escolha sua conta e clique em **Permitir**. Ele pede acesso à planilha e ao **Google Drive** (é onde as fotos ficam).
3. Pronto:
   - na planilha surgem as abas **Chamados**, **Mensagens** e **Config**;
   - no seu Drive surge a pasta **Central de Chamados - Fotos**.

> **Criou o script direto em script.google.com ou pelo Drive, e não pela planilha?** Também funciona. Nesse caso o `setup` cria sozinho uma planilha chamada **Central de Chamados - Base** no seu Drive. O link aparece no **Registro de execução**, na parte de baixo do editor. Configure os temas e atendentes nela (passo 4).

## 4. Configurar temas e atendentes (aba Config)

- **Coluna A – Temas**: um tema por linha. Já vem com "Abertura de cadastro" e "Assistência técnica"; adicione os outros.
- **Coluna B – Atendentes (e-mail)**: um e-mail por linha. Só essas pessoas veem a **Fila de atendimento** e os **Indicadores**. O seu e-mail já vem preenchido.

Pode alterar essa aba a qualquer momento, sem publicar de novo.

## 5. Publicar a URL

1. No editor do Apps Script: **Implantar → Nova implantação**.
2. Clique na engrenagem → **App da Web**.
3. Preencha:
   - **Executar como:** *Eu* (você)
   - **Quem pode acessar:** *Qualquer pessoa em domuscommerce.com*
4. **Implantar** e copie a **URL do app da Web**. Essa é a URL para divulgar.

> Os usuários **não** precisam de acesso à planilha nem à pasta de fotos: o sistema grava e lê em seu nome, e cada pessoa só vê as fotos dos chamados que pode ver. Não compartilhe a pasta de fotos.

## Atualizar uma versão já publicada

1. Abra a planilha → **Extensões → Apps Script**.
2. Substitua o conteúdo de `Código.gs` pelo novo **Code.gs** e o de `Index` pelo novo **Index.html**. Salve.
3. Rode **setup** de novo e autorize o acesso ao Drive. Ele só cria o que falta (aba **Mensagens**, coluna **Fotos** e a pasta de fotos). Os chamados existentes ficam intactos.
4. **Implantar → Gerenciar implantações → lápis (editar) → Versão: Nova versão → Implantar.** A URL continua a mesma.

## Como funciona

| Quem | O que faz |
|---|---|
| Qualquer pessoa da empresa | Abre o chamado (tema, descrição e até 5 fotos). Conversa com o atendimento dentro do chamado, também com fotos. Quando o chamado é concluído, avalia **qualidade** e **satisfação** (notas de 1 a 5). |
| Atendente | Na **Fila de atendimento**, abre o chamado e responde por ali. Responder um chamado aberto já o assume. Ao terminar, registra a **solução** e conclui. Em **Indicadores**, vê os números por período, tema e atendente. |

**Status:** Aberto → Em atendimento → Concluído. Depois de concluído, o chamado não recebe mais respostas. Se o problema voltar, a pessoa abre um novo.

**Sinais nas listas:**
- O solicitante vê **Nova resposta do atendimento** e **Avalie o atendimento**.
- O atendente vê **Aguardando há…** nos abertos e **Solicitante respondeu** nos que estão em atendimento.

**Fotos:**
- **No celular:** **Tirar foto** abre a câmera direto e **Adicionar fotos** abre a galeria. No computador aparece só **Adicionar fotos**.
- **Formatos aceitos:** JPG, PNG, HEIC/HEIF (padrão do iPhone), WEBP, GIF e BMP.
- **Antes de enviar:** a página converte cada foto para JPG de no máximo 1600 px. Isso deixa o envio rápido e faz a foto abrir em qualquer navegador.
- **Fotos HEIC fora do Safari:** a conversão usa um componente gratuito (heic2any), carregado da internet só quando aparece uma foto HEIC. Leva 1 ou 2 segundos por foto.

**Indicadores:**
- **Tempo médio de atendimento:** da abertura até a conclusão.
- **Tempo médio até início:** da abertura até alguém assumir, seja pelo botão ou pela primeira resposta.
- **Qualidade média / Satisfação média:** média das notas dadas pelos solicitantes.

Os tempos são corridos (contam noites e fins de semana).

**Onde ficam os registros:**
- **Chamados:** uma linha por chamado, com data e hora de cada etapa, a solução e as notas.
- **Mensagens:** uma linha por resposta, com autor, papel (solicitante ou atendente), texto e fotos.
- As fotos ficam na pasta do Drive. A planilha guarda só o identificador de cada arquivo.

O e-mail de quem usa é identificado automaticamente pela conta Google. Se o Google não informar o e-mail (por exemplo, numa conta pessoal), a página pede que a pessoa digite.

## Identidade visual

Segue o kit WeAxis e o mesmo padrão da Etiqueta de triagem:
- lockup oficial em vetor;
- tokens de cor da seção 11;
- lime só como fundo ou massa gráfica, com texto sempre em `#212121`;
- estados (aberto, concluído) nas cores operacionais do kit, não em lime;
- assinatura `nós somos o eixo · weaxis.com` no rodapé;
- tema claro e escuro conforme o sistema.

A fonte é a Inter Tight (fallback oficial), carregada do Google Fonts, até existir licença de webfont da Greed.
