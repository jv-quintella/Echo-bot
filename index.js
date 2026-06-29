require('dotenv').config();

const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
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
            const resumoPatch = $('.PatchNotes-body, .PatchNotes-description, p').first().text().trim().substring(0, 300) + '...';

            const embed = new EmbedBuilder()
                .setColor('#F99E1A')
                .setTitle(tituloPatch)
                .setURL(urlOficial)
                .setDescription(resumoPatch)
                .addFields(
                    { name: 'Onde ler tudo?', value: `[Clique aqui para ler no site oficial](${urlOficial})`, inline: false }
                )
                .setFooter({ 
                    text: 'Echo Bot - Dados extraidos do site oficial', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            await loadingMsg.edit({ content: '', embeds: [embed] });

        } catch (error) {
            console.error(error);
            await loadingMsg.edit('Erro! A pagina da Blizzard pode ter mudado de estrutura.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);