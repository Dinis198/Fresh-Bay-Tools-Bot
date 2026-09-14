const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
// ---------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
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
        .setName('get-id')
        .setDescription('Get a Roblox ID from a Roblox username.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('setrank')
        .setDescription('Remotely set someones group rank.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
        .addStringOption(opt => opt.setName('rank_name_or_id').setDescription('Target Rank Name or ID').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from all Fresh Bay games.')
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true)),

    new SlashCommandBuilder()
        .setName('rank-request')
        .setDescription('Submit a rank promotion request.')
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
        .addStringOption(opt => opt.setName('username').setDescription('Roblox Username').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Fresh Bay Tools commands registered.');
    } catch (e) { console.error(e); }
})();

// FUNÇÃO GET-ID TOTALMENTE CORRIGIDA (Utilizando Proxy estável para rotas Roblox)
async function getRobloxId(username) {
    try {
        const res = await axios.post('https://roproxy.com', { 
            usernames: [username],
            excludeBannedUsers: false
        });
        if (res.data && res.data.data && res.data.data.length > 0) {
            return res.data.data[0].id; // Correção cirúrgica na leitura do array do proxy
        }
        return null;
    } catch (err) {
        console.error("Error in getRobloxId API:", err.message);
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
        return interaction.editReply(`❌ User **${username}** not found on Roblox or API Proxy is down.`);
    }

    if (interaction.commandName === 'rank-request') {
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

        return interaction.editReply({ embeds: [embed] });
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
        const targetRank = interaction.options.getString('rank_name_or_id');
        try {
            const rolesRes = await axios.get(`https://roproxy.com{ROBLOX_GROUP_ID}/roles`);
            const targetRole = rolesRes.data.roles.find(r => r.name.toLowerCase() === targetRank.toLowerCase() || r.rank == targetRank);
            if (!targetRole) return interaction.editReply(`❌ Rank **${targetRank}** not found.`);

            const cookieString = `.ROBLOSECURITY=${ROBLOX_COOKIE}`;
            let csrfToken = "";
            try {
                await axios.post('https://roproxy.com', {}, { headers: { Cookie: cookieString } });
            } catch (csrfError) {
                csrfToken = csrfError.response?.headers['x-csrf-token'];
            }

            if (!csrfToken) return interaction.editReply(`❌ Failed to retrieve CSRF token. Check if ROBLOX_COOKIE is valid.`);

            await axios.patch(`https://roproxy.com{ROBLOX_GROUP_ID}/users/${robloxId}`, 
                { roleId: targetRole.id },
                { headers: { Cookie: cookieString, 'X-CSRF-TOKEN': csrfToken } }
            );

            const embed = new EmbedBuilder()
                .setTitle('🚀 Fresh Bay Tools - Rank Updated')
                .setColor(0x2ecc71)
                .setDescription(`Successfully updated **${username}** to rank **${targetRole.name}**!`)
                .setFooter({ text: 'Fresh Bay Tools System' }).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        } catch (err) { 
            console.error("SetRank Error Details:", err.response?.data || err.message); 
            return interaction.editReply(`❌ Failed to update rank. Check Render logs for error details.`); 
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
