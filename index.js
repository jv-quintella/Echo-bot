require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ComponentType
} = require('discord.js');
const cheerio = require('cheerio');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, (c) => {
    console.log(`Logada com sucesso como ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!notas') {
        const loadingMsg = await message.reply('Acessando o banco de dados da Blizzard...');

        try {
            const urlOficial = 'https://overwatch.blizzard.com/pt-br/news/patch-notes/';
            const response = await fetch(urlOficial);
            const html = await response.text();

            const $ = cheerio.load(html);

            const tituloPatch = $('h3').first().text().trim() || 'Ultima Atualizacao';
            
            const secoes = [];
            let secaoAtual = { titulo: 'Visao Geral', conteudo: '' };

            $('.PatchNotes-body').first().find('h3, h4, ul, p').each((index, element) => {
                const tag = element.tagName.toLowerCase();
                const texto = $(element).text().trim();

                if (!texto) return;

                if (tag === 'h3') {
                    if (secaoAtual.conteudo.trim().length > 0) {
                        secoes.push(secaoAtual);
                    }
                    secaoAtual = { titulo: texto.substring(0, 90), conteudo: '' };
                } else {
                    let textoAdicional = '';

                    if (tag === 'h4') {
                        textoAdicional = `\n\n**${texto}**\n`;
                    } else if (tag === 'ul') {
                        $(element).find('li').each((i, li) => {
                            textoAdicional += `- ${$(li).text().trim()}\n`;
                        });
                    } else if (tag === 'p') {
                        textoAdicional = `${texto}\n`;
                    }

                    if (textoAdicional) {
                        if (secaoAtual.conteudo.length + textoAdicional.length > 3800) {
                            secoes.push(secaoAtual);
                            
                            let novoTitulo = secaoAtual.titulo;
                            if (!novoTitulo.endsWith('(Cont.)')) {
                                novoTitulo = novoTitulo + ' (Cont.)';
                            }
                            
                            secaoAtual = { titulo: novoTitulo, conteudo: textoAdicional };
                        } else {
                            secaoAtual.conteudo += textoAdicional;
                        }
                    }
                }
            });

            if (secaoAtual.conteudo.trim().length > 0) {
                secoes.push(secaoAtual);
            }

            if (secoes.length === 0) {
                await loadingMsg.edit('Nenhum conteudo encontrado na pagina.');
                return;
            }

            const opcoesMenu = secoes.slice(0, 25).map((secao, index) => {
                return {
                    label: secao.titulo,
                    value: index.toString()
                };
            });

            const menu = new StringSelectMenuBuilder()
                .setCustomId('menu_notas')
                .setPlaceholder('Selecione uma categoria para ler')
                .addOptions(opcoesMenu);

            const linha = new ActionRowBuilder().addComponents(menu);

            const embedInicial = new EmbedBuilder()
                .setColor('#F99E1A')
                .setTitle(tituloPatch)
                .setURL(urlOficial)
                .setDescription('As notas de atualizacao foram divididas em categorias. Use o menu abaixo para navegar pelo conteudo.')
                .setFooter({ 
                    text: 'Echo Bot - Dados extraidos do site oficial', 
                    iconURL: client.user.displayAvatarURL() 
                });

            const mensagemComMenu = await loadingMsg.edit({ 
                content: '', 
                embeds: [embedInicial], 
                components: [linha] 
            });

            const coletor = mensagemComMenu.createMessageComponentCollector({ 
                componentType: ComponentType.StringSelect, 
                time: 300000 
            });

            coletor.on('collect', async (interacao) => {
                if (interacao.user.id !== message.author.id) {
                    await interacao.reply({ content: 'Apenas quem usou o comando pode navegar neste menu.', ephemeral: true });
                    return;
                }

                const indiceEscolhido = parseInt(interacao.values[0]);
                const secaoEscolhida = secoes[indiceEscolhido];
                
                const embedAtualizado = new EmbedBuilder()
                    .setColor('#F99E1A')
                    .setTitle(`${tituloPatch} - ${secaoEscolhida.titulo}`)
                    .setURL(urlOficial)
                    .setDescription(secaoEscolhida.conteudo.trim())
                    .setFooter({ 
                        text: 'Echo Bot - Dados extraidos do site oficial', 
                        iconURL: client.user.displayAvatarURL() 
                    });

                await interacao.update({ embeds: [embedAtualizado] });
            });

            coletor.on('end', async () => {
                menu.setDisabled(true);
                const linhaDesativada = new ActionRowBuilder().addComponents(menu);
                await mensagemComMenu.edit({ components: [linhaDesativada] }).catch(() => {});
            });

        } catch (error) {
            console.error(error);
            await loadingMsg.edit('Erro! A pagina da Blizzard pode ter mudado de estrutura.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);