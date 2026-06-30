const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');

module.exports = {
    name: 'shop',
    execute: async (message, args, client) => {
        const loadingMsg = await message.reply('Accessing Overhub API...');

        try {
            const response = await fetch("https://overhub.gg/v1/shop/item-shop", {
                method: "GET",
                headers: {
                    "accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://overhub.gg/shop"
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const shopItems = Array.isArray(data) ? data : (data.items || data.data || []);

            if (shopItems.length === 0) {
                await loadingMsg.edit('API returned empty data.');
                return;
            }

            let currentIndex = 0;

            const buildComponents = () => {
                if (shopItems.length <= 1) return [];
                
                return [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_item')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentIndex === 0),
                        new ButtonBuilder()
                            .setCustomId('next_item')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentIndex === shopItems.length - 1)
                    )
                ];
            };

            const buildPayload = async (index) => {
                const item = shopItems[index];
                
                const title = item.title || item.name || 'Unknown Item';
                const price = item.price ? `${item.price} Overwatch Coins` : 'Price not found';
                let imageUrl = item.imageUrl || item.image || null;
                
                if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = `https://overhub.gg${imageUrl}`;
                }

                const itemType = item.type || 'Bundle';
                const itemRarity = item.rarity || 'Unknown';
                const purchaseLink = item.purchaseUrl || 'https://overhub.gg/shop';
                
                const embed = new EmbedBuilder()
                    .setColor('#F99E1A')
                    .setTitle(title)
                    .setURL(purchaseLink)
                    .addFields(
                        { name: 'Price', value: price, inline: true },
                        { name: 'Type', value: itemType, inline: true },
                        { name: 'Rarity', value: itemRarity, inline: true }
                    )
                    .setFooter({ 
                        text: `Echo Bot - Overhub Shop (${index + 1}/${shopItems.length})`, 
                        iconURL: client.user.displayAvatarURL() 
                    });

                let attachment = null;

                if (imageUrl) {
                    try {
                        const imgRes = await fetch(imageUrl, {
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Referer": "https://overhub.gg/shop"
                            }
                        });
                        
                        if (imgRes.ok) {
                            const arrayBuffer = await imgRes.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            const fileName = `item_${index}.png`;
                            
                            attachment = new AttachmentBuilder(buffer, { name: fileName });
                            embed.setImage(`attachment://${fileName}`);
                        }
                    } catch (err) {
                        console.error("Failed to fetch image buffer", err);
                    }
                }

                return {
                    embeds: [embed],
                    components: buildComponents(),
                    files: attachment ? [attachment] : []
                };
            };

            const initialPayload = await buildPayload(currentIndex);
            const initialMessage = await loadingMsg.edit({
                content: '',
                ...initialPayload
            });

            if (shopItems.length > 1) {
                const collector = initialMessage.createMessageComponentCollector({ 
                    componentType: ComponentType.Button,
                    time: 300000 
                });

                collector.on('collect', async (interaction) => {
                    if (interaction.user.id !== message.author.id) {
                        await interaction.reply({ content: 'Only the user who requested the command can interact.', ephemeral: true });
                        return;
                    }

                    await interaction.deferUpdate();

                    if (interaction.customId === 'prev_item') {
                        currentIndex--;
                    } else if (interaction.customId === 'next_item') {
                        currentIndex++;
                    }

                    const updatedPayload = await buildPayload(currentIndex);
                    await interaction.editReply(updatedPayload);
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
            await loadingMsg.edit('Error retrieving shop data. The Overhub API might be down.');
        }
    }
};