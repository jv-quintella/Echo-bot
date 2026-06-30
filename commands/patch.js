const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const cheerio = require('cheerio');

module.exports = {
    name: 'patch',
    execute: async (message, args, client) => {
        const loadingMsg = await message.reply('Accessing Blizzard database...');

        try {
            const officialUrl = 'https://overwatch.blizzard.com/en-us/news/patch-notes/';
            const response = await fetch(officialUrl);
            const html = await response.text();

            const $ = cheerio.load(html);

            const patchTitle = $('h3').first().text().trim() || 'Latest Update';
            
            const pages = [];
            let currentPageContent = '';
            let h3Count = 0;

            const pushPage = () => {
                if (currentPageContent.trim()) {
                    pages.push(currentPageContent.trim());
                }
                currentPageContent = '';
            };

            $('.PatchNotes-body').first().find('h3, h4, h5, ul, p').each((index, element) => {
                const tag = element.tagName.toLowerCase();
                const text = $(element).text().trim();

                if (!text) return;

                if (tag === 'h3') {
                    h3Count++;
                    if (h3Count > 1) return false;
                }

                let additionalText = '';

                if (tag === 'h3' || tag === 'h4' || tag === 'h5') {
                    additionalText = `\n\n**${text}**\n`;
                } else if (tag === 'ul') {
                    $(element).find('li').each((i, li) => {
                        additionalText += `- ${$(li).text().trim()}\n`;
                    });
                } else if (tag === 'p') {
                    additionalText = `${text}\n`;
                }

                if (currentPageContent.length + additionalText.length > 3800) {
                    pushPage();
                }
                currentPageContent += additionalText;
            });
            
            pushPage();

            if (pages.length === 0) {
                await loadingMsg.edit('No content found on the page.');
                return;
            }

            let currentIndex = 0;

            const buildComponents = () => {
                if (pages.length <= 1) return [];
                
                return [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentIndex === 0),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentIndex === pages.length - 1)
                    )
                ];
            };

            const buildEmbed = () => {
                const content = pages[currentIndex];
                const pageIndicator = pages.length > 1 ? ` - Page ${currentIndex + 1} of ${pages.length}` : '';
                
                return new EmbedBuilder()
                    .setColor('#F99E1A')
                    .setTitle(`${patchTitle}${pageIndicator}`)
                    .setDescription(`${content}\n\n**[Click here to read the official patch notes](${officialUrl})**`)
                    .setFooter({ 
                        text: 'Echo Bot - Data extracted from official website', 
                        iconURL: client.user.displayAvatarURL() 
                    });
            };

            const initialMessage = await loadingMsg.edit({
                content: '',
                embeds: [buildEmbed()],
                components: buildComponents()
            });

            if (pages.length > 1) {
                const collector = initialMessage.createMessageComponentCollector({ 
                    componentType: ComponentType.Button,
                    time: 300000 
                });

                collector.on('collect', async (interaction) => {
                    if (interaction.user.id !== message.author.id) {
                        await interaction.reply({ content: 'Only the user who requested the command can interact.', ephemeral: true });
                        return;
                    }

                    if (interaction.customId === 'prev_page') {
                        currentIndex--;
                    } else if (interaction.customId === 'next_page') {
                        currentIndex++;
                    }

                    await interaction.update({
                        embeds: [buildEmbed()],
                        components: buildComponents()
                    });
                });

                collector.on('end', async () => {
                    const rows = buildComponents();
                    rows.forEach(row => {
                        row.components.forEach(comp => comp.setDisabled(true));
                    });
                    await initialMessage.edit({ components: rows }).catch(() => {});
                });
            }

        } catch (error) {
            console.error(error);
            await loadingMsg.edit('Error! The Blizzard page structure might have changed.');
        }
    }
};