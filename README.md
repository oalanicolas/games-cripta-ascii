# Cripta ASCII

Protótipo solo de exploração e combate em Three.js, inspirado nos três vídeos de Ansenjeo enviados em 09/10/2026. Ruínas sob chuva, masmorra com iluminação de tocha, três selos e dragão com ataques sinalizados. Há vitória, derrota, checkpoint, save local, pausa e nova expedição.

O visual aproxima as referências com glifos nas superfícies e modelos próprios. Mapa e regras são do protótipo; não há servidor MMORPG nem paridade com código original não disponível. Decisões, fontes e limites: [game-design.md](game-design.md).

## Jogar

[Jogar em ascii.rabisco.net](https://ascii.rabisco.net/).

No workspace Games, da raiz: `python3 framework/scripts/game.py serve prototypes/cripta-ascii`. Em checkout independente: `npm ci` e `npm run serve`.

WASD/setas para mover, mouse para mirar, clique/J para fogo, Q para explosão de luz, espaço para esquiva, H para poção, E para interagir, Esc para pausa. R recomeça a expedição. Roda do mouse aproxima a câmera. No toque, joystick e botões com mira automática no inimigo próximo.

Encontre o círculo luminoso diante do arco para descer. Na cripta, derrote os guardiões e toque os três selos com E. Volte pelo portal e atravesse o arco para enfrentar o dragão. Evite os círculos e o sopro anunciados no chão. Santuários restauram vida e poções e salvam o ponto de retorno.

## Verificar e empacotar

`npm test` verifica regras; `npm run doctor` confere módulos e sons; `npm run build` gera `dist/` com Three.js e mídia local, sem CDN. `node tools/qa-campaign.mjs URL` percorre a campanha por teclado e mouse em Chrome headless com Metal. Requer Playwright do workspace para QA; o jogo e o build não dependem dele.

Resultados em `output/qa/`, ignorados. Capturas temporárias são apagadas após comparação; recibos JSON permanecem. Não foi testado em aparelho móvel físico. Não há aprovação artística humana registrada.

## Publicar

Destino: `ascii.rabisco.net`, Hostinger. No hub: `python3 framework/scripts/gameops.py deploy cripta-ascii`. O fluxo exige o commit em `origin/main`, constrói uma cópia limpa, executa os validadores e confere os arquivos servidos. O `.htaccess` do módulo exige revalidação dos arquivos com nomes estáveis e cobre cabeçalhos de erro do LiteSpeed. O publicador acrescenta bloqueios de bots e `robots.txt`.

## Créditos

Referências visuais: [combate](https://www.instagram.com/reel/DeSfdqBxKgI/), [masmorra](https://www.instagram.com/reel/DePnVQ5BLqS/), [clima](https://www.instagram.com/reel/DeNHjTqhNCX/) de Ansenjeo/Senje. Vídeos e músicas não são embarcados. Three.js MIT; áudio de Ylmir, StarNinjas, artisticdude, rubberduck e OwlishMedia, CC0, com créditos e hashes em `assets/sfx/sources.json`.
