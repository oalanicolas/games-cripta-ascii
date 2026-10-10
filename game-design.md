# Cripta ASCII

## Brief e visão

Escala: jam. Lente: Jogar. Fantasia: um peregrino com uma tocha atravessa ruínas sob tempestade, desce à cripta, recupera três selos e enfrenta o dragão que guarda o retorno. Plataforma: navegador desktop, teclado e mouse; controles de toque como alternativa a conferir. Maior incerteza: reconstrução visual de superfícies ASCII e modelos sem acesso ao projeto original.

Autorização: pedido de Alan em 09/10/2026, “quero recriar um protótipo completo a partir destes vídeos”. Não há aceite visual do resultado produzido.

## GDD e ciclo

Entrada → ruínas com chuva → portal da cripta → três selos guardados por criaturas → retorno às ruínas → dragão → vitória e nova expedição. Derrota permite reiniciar no último santuário mantendo selos já conquistados. Todos os cenários são alcançáveis por controles públicos. Pausa congela regras e áudio. Reiniciar expedição zera progressão; continuar recupera o checkpoint salvo.

WASD/setas: mover no plano da câmera. Mouse: mirar. Clique/J: projétil de fogo. Q: explosão de luz em área com recuperação. Espaço: esquiva. H: poção. E: portal/selo/santuário. Esc: pausa. R: reinício da expedição. Roda do mouse: aproximação da câmera. A iluminação e o tamanho dos glifos acompanham a câmera.

## MDA

Hipótese: tocha com alcance restrito e sinais de ataques antes do dano produzem exploração cautelosa e combate legível. Contraprova: jogador não encontra o portal, não distingue aviso do fogo ativo ou perde sem oportunidade de esquiva. O protótipo não presume que dificuldade ou diversão foram aprovadas por teste humano.

## Requisitos e aceite

- AC1: explorar cenário tridimensional ASCII com chuva, ruínas e iluminação móvel.
- AC2: entrar na masmorra, derrotar criaturas e recuperar todos os três selos.
- AC3: enfrentar dragão com projéteis, sopro sinalizado e círculos de impacto; chegar à vitória.
- AC4: sofrer dano, morrer, retornar ao checkpoint; pausar e retomar; reiniciar sem estados residuais.
- AC5: som licenciado carregado localmente; nenhuma mídia depende do Instagram em runtime.
- AC6: URL servida corresponde ao build entregue; testes de regras e verificação de recursos sem erros.

## Design system e Art Bible

Autoridade: [combate](https://www.instagram.com/reel/DeSfdqBxKgI/), [masmorra](https://www.instagram.com/reel/DePnVQ5BLqS/), [clima](https://www.instagram.com/reel/DeNHjTqhNCX/), vistos no navegador e em folhas extraídas dos vídeos baixados integralmente. Paleta: vazio #090a13, pedra fria #7b909b, vegetação #477663, brasa #ffad45, luz subterrânea #b3bf55, perigo #d36c45. UI discreta em serif para títulos e monospace para dados. Sem interface de terminal genérica envolvendo a tela inteira.

Componentes: paredes com glifos aderentes e arcos, árvores com troncos e folhas em camadas, chão irregular com vegetação, humanoide articulado com capa/tocha, dragão com corpo, cabeça, patas, cauda, asas e animação. Famílias geradas em `world.js`, mantendo a mesma densidade e shader. Glifos fazem parte dos materiais e deformam em perspectiva; não são uma imagem do vídeo nem substituto da simulação.

Feel: fogo sai da mão, rastro acompanha o movimento, impacto dispara partículas e som no mesmo evento, esquiva invulnerável tem recuperação, ataques do chefe avisam no chão. Movimento reduzido desativa tremor e relâmpagos. Áudio: chuva contínua, passos, ataque, impacto e trovão; pausa interrompe vozes; mute disponível. Origem dos sons em `assets/sfx/sources.json`.

Fazer: preservar perspectiva, caracteres, sombra e detalhe reconhecíveis ao aproximar. Não fazer: inserir arte Rabisco, entregar círculos como personagens, alegar fórmulas do original ou reutilizar música do Reel sem licença.

## TDD e reuso

[Pesquisa técnica](../../docs/pesquisas/ASCII%203D%20—%20glifos%20em%20superfícies%20para%20a%20Cripta%20ASCII.md). Three.js 0.186.1, WebGL, ShaderMaterial com atlas de glifos em coordenadas da superfície; vegetação repetida por instancing. npm e lockfile. O starter Canvas Arcade foi lido: suas regras de orbes e render 2D não atendem este RPG 3D; copiar todo o starter traria consumidores órfãos. Lacuna de CREATE: regras de RPG, modelos 3D, material de glifos, mapa e integração própria. REUSE: Three.js MIT, sons CC0 de `shared/sfx`, harness de servidor e verificação; nenhum asset de `shared/rabisco` combina com a fonte e nenhum foi incorporado.

Simulação pura com passo fixo 1/60 s; renderer não é dono do estado. Eventos de dano, cura, coleta e ataque alimentam apresentação e áudio. RNG semeado para cenário. Save v1 valida no limite de localStorage; preferências separadas. Colisão no plano XZ, corpo circular contra paredes; teste de trajetória para projéteis. Build estático inclui o Three e os sons e roda sem conta ou CDN.

## Números e origem

Todos os valores de regras em `RULES` e posições em `MAP` são `assumed`: nenhum código-fonte do original foi obtido. Câmera inclinada, densidade variável de caracteres, verde exterior, luz amarela subterrânea, dragão, círculos de aviso e chuva são `external_reference` observados nos vídeos de 07–09/10/2026; sem paridade numérica alegada. Origem de formas próprias: modelagem procedural para aproximar o que foi visto, sem extração de assets do autor.

## Decisões tomadas sem Alan

Nome Cripta ASCII; campanha solo finita; Three.js; câmera inclinada com zoom; atalhos; três selos, checkpoint e persistência local. Derivam da necessidade de um protótipo jogável com fim a partir de clipes que não revelam o MMORPG inteiro. Não foram apresentadas como decisões humanas.

## Proveniência

Vídeos: Ansenjeo/Senje, consulta em 09/10/2026; somente referência, não embarcados. Código e modelos novos do protótipo. Three.js: MIT. Sons copiados do catálogo licenciado do estúdio com sidecars. Músicas comerciais e faixas anexadas aos Reels não entram.

## QA e Devlog

09/10/2026: vídeos obtidos, folhas e quadros examinados, pesquisa persistida e campanha implementada. `npm test`: 11 de 11. Chrome headless/Metal executou 15 checagens da campanha por controles públicos: três de três selos, vitória, reinício, derrota e checkpoint; zero erros JS e zero falhas HTTP. Confirmação final: quatro cenários adicionais de build, luz/zoom/reset, save/preferências e interface emulada de toque. Seis arquivos de som carregados e decodificados; não há avaliação auditiva humana da mixagem.

Primeira inspeção: exterior escuro demais; corrigido aumentando a iluminação, mantendo geometria e vegetação. Comparação lado a lado: relva tinha glifos redondos em vez das lâminas da referência; corrigida com barras verticais/diagonais e densidade maior, sem remover detalhe. Masmorra ajustada para amarelo/esverdeado. Pausa inicialmente apagava eventos; causa corrigida sem alterar a asserção do teste. Disparo rápido no botão de toque passou a preservar o comando até o próximo tick, sem exigir manter o dedo pressionado. Reinício remove efeitos visuais pendentes. Nenhuma asserção ou limiar foi afrouxado.

Diferenças visuais numeradas: (1) mapa e arquitetura de ruínas próprios; (2) humanoide e dragão procedurais, sem assets do autor; (3) glifos, densidade e câmera inferidos; (4) campanha solo finita, sem MMORPG. A aparência é aproximação do protótipo; não houve acesso ao runtime original. Não há playtest humano, aprovação visual ou teste em aparelho físico.

O auxiliar estático `check_web_delivery.py` gerou falsos positivos para nomes de áudio montados dinamicamente e exemplos em comentários do Three.js. Não alteramos o validador nem o jogo para satisfazer essas URLs fictícias. A conferência equivalente no navegador verificou recursos realmente solicitados, decodificação de seis de seis sons e identidade do HTML, CSS e módulos do build; recibos em `output/qa/final.json`.

Revisão de entrega: AC1–AC6 atendidos no protótipo solo pelos scripts, comparação visual e build; identidade exata com o MMORPG original não é reivindicada. Capturas de QA temporárias removidas após leitura; recibos JSON mantidos. Repo local independente na main; criação de remoto/submódulo e publicação não foram solicitadas, e o workspace.json compartilhado de outras sessões não foi alterado.

## Executar e continuidade

Do hub: `python3 framework/scripts/game.py serve prototypes/cripta-ascii`. Dentro do módulo: `npm ci`, `npm test`, `npm run doctor`, `npm run build`. Build em `dist/`. O QA final registra testes, cenários e limites. Nenhuma publicação autorizada.
