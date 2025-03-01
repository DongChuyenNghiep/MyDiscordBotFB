import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import express from "express";
const TOKEN = process.env.DISCORD_TOKEN;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_PAGE_ID = "102959158396045"; 
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CHANNEL_ID = "1147097127298801694"
const CHECK_INTERVAL = 10000; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ],
});

// Lưu ID bài viết gần nhất trên Facebook và Discord
let lastPost = { fbId: null, discordMsgId: null };

async function fetchLatestPost() {
    try {
        const url = `https://graph.facebook.com/v22.0/${FB_PAGE_ID}/posts?fields=id,message,created_time,attachments{media}&access_token=${FB_ACCESS_TOKEN}`;
        const response = await axios.get(url);

        if (response.data && response.data.data.length > 0) {
            console.log("📌 Dữ liệu bài viết từ Facebook:", JSON.stringify(response.data.data[0], null, 2)); // Debug API
            return response.data.data[0]; // Trả về bài viết mới nhất
        }
    } catch (error) {
        console.error("❌ Lỗi khi fetch bài viết từ Facebook:", error.response?.data || error.message);
    }
    return null;
}


async function sendToDiscord(post) {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel) {
        console.error("❌ Không tìm thấy kênh Discord!");
        return null;
    }

    const messageContent = post.message ? post.message : "🔗 [Xem bài viết trên Facebook](https://www.facebook.com/" + post.id + ")";

    // Lấy URL ảnh nếu có
    let imageUrl = null;
    if (post.attachments && post.attachments.data.length > 0) {
        imageUrl = post.attachments.data[0].media.image.src;
        console.log(`📌 Ảnh từ bài viết: ${imageUrl}`); // Debug ảnh
    }

    // Gửi tin nhắn với Embed nếu có ảnh
    const embed = {
        title: "📢 Bài viết mới từ Facebook!",
        description: messageContent,
        url: `https://www.facebook.com/${post.id}`,
        color: 0x3498db, // Xanh dương
        image: imageUrl ? { url: imageUrl } : undefined, // Chỉ thêm ảnh nếu có
        timestamp: new Date()
    };

    const sentMessage = await channel.send({
        content: ``,
        embeds: [embed]
    });

    console.log(`✅ Đã đăng bài viết với hình ảnh: ${post.id}`);
    return sentMessage.id; // Lưu lại ID tin nhắn trên Discord
}

async function deleteDiscordPost() {
    if (!lastPost.discordMsgId) return;

    try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        const msg = await channel.messages.fetch(lastPost.discordMsgId);
        if (msg) {
            await msg.delete();
            console.log(`🗑️ Đã xóa bài viết trên Discord: ${lastPost.discordMsgId}`);
        }
    } catch (error) {
        console.error("⚠️ Không tìm thấy tin nhắn để xóa trên Discord:", error.message);
    }
}

async function checkForUpdates() {
    const post = await fetchLatestPost();

    if (!post) {
        if (lastPost.fbId) {
            console.log("🚨 Bài viết đã bị xóa trên Facebook!");
            await deleteDiscordPost();
            lastPost = { fbId: null, discordMsgId: null };
        }
        return;
    }

    if (post.id !== lastPost.fbId) {
        console.log("📌 Có bài viết mới trên Facebook!");
        await deleteDiscordPost(); // Xóa bài cũ
        const discordMsgId = await sendToDiscord(post);
        lastPost = { fbId: post.id, discordMsgId };
    }
}
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot is running!");
});

app.listen(PORT, () => {
    console.log(`🌐 Express server is running on port ${PORT}`);
});

// 🌍 Ping chính server của nó mỗi 10 giây để Render không đưa vào trạng thái ngủ
const SERVER_URL = `https://mydiscordbot-9v5s.onrender.com/`;

setInterval(() => {
    axios.get(SERVER_URL)
        .then(() => console.log("🔄 Ping chính server để giữ bot hoạt động"))
        .catch(err => console.error("❌ Lỗi khi ping server:", err.message));
}, 10000); // 10 giây

client.once("ready", async () => {
    console.log(`🤖 Bot đã đăng nhập với tên ${client.user.tag}`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        console.log(`📌 Bot đang hoạt động trên server: ${guild.name} (${guild.id})`);

        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        console.log(`📌 Bot sẽ đăng bài trong kênh: ${channel.name} (${channel.id})`);
    } catch (error) {
        console.error("❌ Lỗi khi fetch guild hoặc channel:", error);
    }

    setInterval(checkForUpdates, CHECK_INTERVAL);
});



client.login(TOKEN);
