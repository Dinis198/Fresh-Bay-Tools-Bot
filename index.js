const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const axios = require('axios');
const http = require('http');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY; 
// ---------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder()
        .setName('get-id')
        .setDescription('Get a Roblox ID from a Roblox username.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('setrank')
        .setDescription('Remotely set someones group rank.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
        .addStringOption(opt => opt.setName('rank_id').setDescription('Target Rank ID Number (e.g. 10, 50, 255)').setRequired(true)),

    new SlashCommandBuilder()
        .setName('rank-request')
        .setDescription('Submit a rank promotion request to a specific channel.')
        .addChannelOption(opt => opt.setName('channel').setDescription('The channel where managers see requests').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(opt => opt.setName('username').setDescription('Your Roblox Username').setRequired(true))
        .addStringOption(opt => opt.setName('rank').setDescription('The rank you are applying for').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Why do you deserve this rank?').setRequired(true)),

    new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Add a user to the Fresh Bay game whitelist.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true)),

    new SlashCommandBuilder()
        .setName('unwhitelist')
        .setDescription('Remove a user from the Fresh Bay game whitelist.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true)),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from all Fresh Bay games.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('get-ban')
        .setDescription('Gets a ban issued.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true)),

    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from all Fresh Bay games.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Fresh Bay Tools commands registered.');
    } catch (e) { console.error('Command Registration Error:', e); }
})();

// Chamada corrigida com cabeçalho de autorização explícito para evitar erros de autenticação na Cloud
async function getRobloxId(username) {
    try {
        const res = await axios.post('https://roblox.com', 
            { usernames: [username] },
            { headers: { 'x-api-key': ROBLOX_API_KEY, 'Content-Type': 'application/json' } }
        );
        if (res.data && res.data.users && res.data.users.length > 0) {
            const fullPath = res.data.users[0].path; 
            return fullPath.split('/')[1]; 
        }
        return null;
    } catch (err) {
        console.error("OpenCloud getRobloxId Failure:", err.response?.data || err.message);
        return null;
    }
}

const banDatabase = new Map();
const whitelistDatabase = new Set();
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();
    
    const username = interaction.options.getString('username');
    const robloxId = await getRobloxId(username);
    
    if (!robloxId) {
        return interaction.editReply(`❌ User **${username}** not found on Roblox. Please verify your OpenCloud settings.`);
    }

    if (interaction.commandName === 'rank-request') {
        const targetChannel = interaction.options.getChannel('channel');
        const targetRank = interaction.options.getString('rank');
        const reason = interaction.options.getString('reason');

        const embed = new EmbedBuilder()
            .setTitle('📋 Fresh Bay Tools - New Rank Request')
            .setColor(0xf39c12)
            .setDescription(`A new staff promotion request has been submitted!`)
            .addFields(
                { name: '👤 Applicant (Discord)', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🎮 Roblox Account', value: `[${username}](https://roblox.com{robloxId}/profile) (ID: \`${robloxId}\`)`, inline: true },
                { name: '🚀 Requested Rank', value: targetRank, inline: false },
                { name: '📝 Reason / Justification', value: reason, inline: false }
            )
            .setFooter({ text: 'Fresh Bay Tools Application System' })
            .setTimestamp();

        try {
            await targetChannel.send({ embeds: [embed] });
            return interaction.editReply(`✅ Your rank request has been successfully submitted to <#${targetChannel.id}>!`);
        } catch (err) {
            console.error(err);
            return interaction.editReply(`❌ Failed to send request. Ensure the bot has permission to post in that channel.`);
        }
    }

    if (interaction.commandName === 'get-id') {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Fresh Bay Tools - ID Finder')
            .setColor(0x3498db)
            .setDescription(`**Username:** ${username}\n**Roblox ID:** \`${robloxId}\``)
            .setFooter({ text: 'Fresh Bay Tools System' })
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'whitelist') {
        whitelistDatabase.add(robloxId.toString());
        const embed = new EmbedBuilder()
            .setTitle('✅ Fresh Bay Tools - Whitelist Added')
            .setColor(0x2ecc71)
            .setDescription(`**${username}** has been added to the game whitelist.`)
            .setFooter({ text: 'Fresh Bay Tools System' }).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'unwhitelist') {
        if (!whitelistDatabase.has(robloxId.toString())) return interaction.editReply(`❌ **${username}** is not whitelisted.`);
        whitelistDatabase.delete(robloxId.toString());
        return interaction.editReply(`🗑️ **${username}** removed from whitelist.`);
    }
    if (interaction.commandName === 'ban') {
        const reason = interaction.options.getString('reason');
        banDatabase.set(robloxId.toString(), { username, reason, by: interaction.user.tag });
        const embed = new EmbedBuilder()
            .setTitle('🔨 Fresh Bay Tools - Ban Issued')
            .setColor(0xe74c3c)
            .setDescription(`**${username}** has been banned from all Fresh Bay games.`)
            .addFields({ name: 'Reason', value: reason })
            .setFooter({ text: 'Fresh Bay Tools System' }).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'get-ban') {
        const banInfo = banDatabase.get(robloxId.toString());
        if (!banInfo) return interaction.editReply(`ℹ️ **${username}** is not banned.`);
        const embed = new EmbedBuilder()
            .setTitle('🔍 Fresh Bay Tools - Ban Record')
            .setColor(0xf1c40f)
            .addFields({ name: 'Reason', value: banInfo.reason }, { name: 'Banned By', value: banInfo.by })
            .setFooter({ text: 'Fresh Bay Tools System' }).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.commandName === 'unban') {
        if (!banDatabase.has(robloxId.toString())) return interaction.editReply(`❌ **${username}** is not banned.`);
        banDatabase.delete(robloxId.toString());
        return interaction.editReply(`✅ **${username}** has been unbanned.`);
    }

    if (interaction.commandName === 'setrank') {
        const targetRankId = interaction.options.getString('rank_id');
        try {
            const rolesRes = await axios.get(`https://roblox.com{ROBLOX_GROUP_ID}/roles`, {
                headers: { 'x-api-key': ROBLOX_API_KEY }
            });
            
            const targetRole = rolesRes.data.groupRoles.find(r => r.path.endsWith(`/roles/${targetRankId}`) || r.id === targetRankId);
            if (!targetRole) return interaction.editReply(`❌ Rank ID \`${targetRankId}\` not found in group configuration.`);

            await axios.patch(`https://roblox.com{ROBLOX_GROUP_ID}/memberships/${robloxId}`, 
                { role: targetRole.path },
                { headers: { 'x-api-key': ROBLOX_API_KEY, 'Content-Type': 'application/json' } }
            );

            const embed = new EmbedBuilder()
                .setTitle('🚀 Fresh Bay Tools - Rank Updated')
                .setColor(0x2ecc71)
                .setDescription(`Successfully updated **${username}** to Rank ID **${targetRankId}** (${targetRole.displayName})!`)
                .setFooter({ text: 'Fresh Bay Tools System' }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        } catch (err) { 
            console.error("OpenCloud SetRank Error:", err.response?.data || err.message); 
            return interaction.editReply(`❌ Failed to update rank. Check your OpenCloud permissions on Roblox Dashboard.`); 
        }
    }
});

http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');
    
    if (url.pathname === '/check-ban') {
        if (id && banDatabase.has(id.toString())) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ banned: true, reason: banDatabase.get(id.toString()).reason }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ banned: false }));
    }

    if (url.pathname === '/check-whitelist') {
        if (id && whitelistDatabase.has(id.toString())) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ whitelisted: true }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ whitelisted: false }));
    }

    res.write("Fresh Bay Tools API is Online!");
    res.end();
}).listen(process.env.PORT || 3000);

client.login(DISCORD_TOKEN);
