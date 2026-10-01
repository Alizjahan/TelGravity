<p align="center">
  <img src="https://raw.githubusercontent.com/Alizjahan/TelGravity/main/header.jpg" alt="TelGravity Banner" width="100%">
</p>

<div align="center">

# TelGravity (Telegram Remote Controller for Antigravity)
### Intelligent Remote Bridge & Mission Control for Google Antigravity via Telegram

[![Release](https://img.shields.io/badge/Release-v1.2.0-0D9DF8?style=flat-square&logo=github)](https://github.com/Alizjahan/TelGravity)
[![License](https://img.shields.io/badge/License-MIT-34C6BF?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0-89DB76?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-FA9138?style=flat-square)]()
[![Maintainer](https://img.shields.io/badge/Maintainer-Alizjahan-0F6FFA?style=flat-square&logo=github)](https://github.com/Alizjahan)

Control, monitor, prompt, and interact with your **Google Antigravity** AI assistant seamlessly from your smartphone or desktop via Telegram. Features live window screenshots, voice prompt execution, task aborting, and automated native project discovery.

[English Documentation](#overview) | [راهنمای فارسی](./README_FA.md)

</div>

---

> [!NOTE]
> **Zero-Configuration Native Discovery:**  
> TelGravity automatically queries your local Antigravity environment to list and switch between all active workspaces and conversations. No manual directory path configuration or moving project folders is required!

---

## Overview

**TelGravity** is a modern, high-performance remote control bridge designed exclusively for the **Google Antigravity** assistant. Powered by Chrome DevTools Protocol (CDP) and native React Fiber navigation, TelGravity transforms Telegram into an interactive handheld cockpit for your AI coding sessions.

Whether you are away from your workstation, commuting, or simply monitoring long-running agent workflows from your bed, TelGravity keeps you in complete command of your coding workflows.

---

## ✨ Features

- **🚀 Two-Way Conversational Control**:
  - Send prompts directly into active Antigravity conversations.
  - Automatically receive formatted Markdown/HTML responses as soon as the assistant finishes generating.
- **📸 Instant Live Window Screenshots**:
  - Dispatch `/screenshot` to receive high-definition, real-time screenshots of your Antigravity IDE directly in chat.
- **🎙️ Voice Message Prompting**:
  - Send voice notes directly from your phone — TelGravity automatically downloads, processes, and submits them to the active model.
- **📂 Native Project & Session Switcher**:
  - Switch between projects and conversations via inline keyboard buttons or start fresh conversations with `/new` (General standalone mode or project-specific).
- **⏹️ Instant Abort / Task Stop**:
  - One-tap `/stop` button terminates lingering tool executions, cancels pending chat queues, or aborts runaway tasks immediately.
- **🖥️ Beautiful Web Dashboard**:
  - Built-in local management UI (`http://127.0.0.1:3888`) with live console telemetry, service controls, and one-click token configuration.
- **🔒 Enterprise-Grade Security**:
  - Strict user ID whitelisting (`ALLOWED_USER_IDS`) blocks unauthorized access.
  - Process locking (`.bot.lock`) prevents multiple rogue instances.
- **🌐 Bilingual Support (English & Persian)**:
  - Toggle between Persian and English using `/lang` or via the web dashboard. All notifications, buttons, and help guides render in your preferred language.

---

## ⚡ Quick Start & Installation

### Option 1: Desktop Launcher (Windows)

Simply double-click **`run_bot.bat`**.  
The interactive web dashboard will automatically open at `http://127.0.0.1:3888`, allowing you to enter your bot token, start the service, and begin interacting immediately.

### Option 2: Command Line (CLI)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Alizjahan/TelGravity.git
   cd TelGravity
   ```

2. **Install dependencies and build:**
   ```bash
   npm install
   npm run build
   ```

3. **Configure your environment (`.env`):**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
   ALLOWED_USER_IDS=your_numeric_telegram_id
   ```

4. **Launch the bot or dashboard:**
   ```bash
   npm run start:built      # Direct bot runner
   npm run ui               # Web dashboard UI (http://127.0.0.1:3888)
   ```

---

## 🤖 Telegram Commands Reference

| Command | Description |
| :--- | :--- |
| **`/start`** | Open the main interactive glass control menu & telemetry status |
| **`/help`** | Display the comprehensive multi-lingual command reference & usage guide |
| **`/new`** | Launch a brand new chat session (General mode or Project-specific) |
| **`/project`** | Browse all recognized Antigravity projects and switch conversations |
| **`/status`** | Inspect active running tasks, connected CDP port, and system health |
| **`/screenshot`** | Capture and send a crisp, live screenshot of the Antigravity window |
| **`/stop`** | Abort stuck tool executions, active generation, or background loops |
| **`/last`** | Retrieve the latest completed assistant output from transcript history |
| **`/lang`** | Toggle bot language instantly between Persian (`fa`) and English (`en`) |
| **`/ping`** | Measure real-time server latency and Telegram API round-trip delay |

---

## 🏗️ Architecture & How It Works

```
┌─────────────────┐       Telegram Bot API       ┌───────────────────────────┐
│  Telegram App   │ ◄──────────────────────────► │    TelGravity Service     │
│ (Phone/Desktop) │                              │     (Node.js / grammY)    │
└─────────────────┘                              └─────────────┬─────────────┘
                                                               │
                                                   Chrome DevTools Protocol
                                                   (CDP WebSocket & Fiber)
                                                               │
                                                 ┌─────────────▼─────────────┐
                                                 │   Google Antigravity IDE  │
                                                 │   (Electron / React Fiber)│
                                                 └───────────────────────────┘
```

1. **Chrome DevTools Protocol (CDP)**: Interacts directly with the running Antigravity Electron process over its active remote debugging port, enabling click dispatches, input text injections, and live viewport captures.
2. **React Fiber Navigation**: Navigates the internal TanStack router directly through React container fibers for instant, 100% reliable session switching without fragile DOM clicking.
3. **SQLite Summaries Sync**: Automatically monitors `~/.gemini/antigravity/conversation_summaries.db` for instant project extraction and metadata synchronization.

---

## 👨‍💻 Author & Maintainer

Developed with ❤️ by **Aliz ([@Alizjahan](https://github.com/Alizjahan))**
- GitHub: [@Alizjahan](https://github.com/Alizjahan)
- Telegram: [@Alizjahan](https://t.me/Alizjahan)

---

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).
