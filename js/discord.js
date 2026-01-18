/**
 * Discord integration for sending winner notifications via Webhook
 */

import { appState, saveState } from './state.js';

let elements = {};

export function initDiscord(domElements) {
    elements = domElements;

    if (elements.discordWebhookInput) {
        // Restore value if exists
        const savedUrl = appState.preferences.discordWebhookUrl;
        if (savedUrl) {
            elements.discordWebhookInput.value = savedUrl;
        }

        elements.discordWebhookInput.addEventListener('change', (event) => {
            appState.preferences.discordWebhookUrl = event.target.value.trim();
            saveState();
        });
    }

    if (elements.discordTestBtn) {
        elements.discordTestBtn.addEventListener('click', handleTestNotification);
    }
}

async function handleTestNotification() {
    const url = appState.preferences.discordWebhookUrl;
    if (!url) {
        alert('Please enter a Discord Webhook URL first.');
        return;
    }

    try {
        const success = await sendDiscordNotification('Test Movie', 'https://via.placeholder.com/300x450.png?text=Test+Poster', true);
        if (success) {
            alert('Test notification sent successfully! Check your Discord channel.');
        } else {
            alert('Failed to send test notification. Check console for details.');
        }
    } catch (error) {
        console.error(error);
        alert('Error sending test notification.');
    }
}

export async function sendDiscordNotification(winnerName, movieImage, options = {}) {
    const WEBHOOK_URL = appState.preferences.discordWebhookUrl;
    // Handle legacy call signature (winnerName, movieImage, isTest)
    const isTest = typeof options === 'boolean' ? options : (options.isTest || false);
    const {
        odds = null,
        weight = null,
        link = null,
        spinMode = null
    } = typeof options === 'object' ? options : {};

    if (!WEBHOOK_URL) {
        console.log('No Discord Webhook configured, skipping notification.');
        return false;
    }

    const title = isTest ? `🔔 Webhook Test: ${winnerName}` : `${winnerName} is the winner!`;
    const spinModeLabel = options.spinModeLabel || (options.spinMode ? (options.spinMode.charAt(0).toUpperCase() + options.spinMode.slice(1).replace('-', ' ')) : 'Spin');
    const description = isTest
        ? `If you can see this, the Wheelbur webhook integration for **${winnerName}** is working!`
        : `The Wheel has spoken! **${winnerName}** was selected via **${spinModeLabel}**. Praise the Wheel!`;

    const fields = [];
    if (!isTest) {
        if (odds) fields.push({ name: "Odds", value: odds, inline: true });
        if (weight) fields.push({ name: "Weight", value: `${weight}x`, inline: true });
        if (link) fields.push({ name: "Letterboxd", value: `[View Movie](${link})`, inline: true });
    }

    const payload = {
        content: isTest ? "🤖 **Beep Boop! Test Notification**" : "☸️ **The Wheel has spoken!**",
        embeds: [
            {
                title: title,
                description: description,
                color: 0x5865F2, // Blurple color
                image: {
                    url: movieImage || ''
                },
                fields: fields,
                footer: {
                    text: "Wheelbur • via wheel.sensei.lol"
                },
                timestamp: new Date().toISOString()
            }
        ]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("Discord notification sent!");
            return true;
        } else {
            console.error("Failed to send notification:", response.statusText);
            return false;
        }
    } catch (error) {
        console.error("Error sending webhook:", error);
        return false;
    }
}
