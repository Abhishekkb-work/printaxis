
# 🖨️ Print Axis Pro

<p align="center">
  <strong>A modern browser-based print layout editor</strong>
</p>

<p align="center">
  Create, arrange, edit, import, print and export print-ready layouts — directly from your browser.
</p>

<p align="center">
  <a href="https://printaxis.vercel.app/">
    <img src="https://img.shields.io/badge/🚀%20Live%20Demo-Print%20Axis%20Pro-111827?style=for-the-badge" alt="Live Demo" />
  </a>
  <a href="https://github.com/Abhishekkb-work/printaxis">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub Repository" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square" alt="PWA" />
</p>

---

## ✨ Overview

**Print Axis Pro** is a browser-based print layout editor built for creating and preparing print-ready documents in a visual workspace.

It combines document importing, page management, layout controls, grid-based positioning, snapping, layers, properties, printing and exporting into one focused application.

The goal is simple:

> **Make print layout editing faster, more precise and easier to manage directly from the browser.**

---

## 🚀 Live Demo

### 👉 https://printaxis.vercel.app/

Open the application and start designing directly in your browser.

---

## 🎯 Core Features

### 📄 PDF Import

Import PDF documents and bring their pages into the editing workflow.

- PDF document loading
- Page-based workflow
- Visual document editing
- PDF rendering in the browser

---

### 🧩 Templates

Start layouts faster using predefined templates.

Templates provide a foundation for common print compositions without having to build every layout from scratch.

---

### 🎨 Visual Layout Editor

Design layouts inside a visual canvas.

The editor is built around direct manipulation of page content, making it easier to understand positioning and composition while working.

---

### 📐 Page Configuration

Configure the document according to your printing requirements.

- Paper size
- Page orientation
- Measurement units
- Margins
- Layout dimensions

Supported workflows include both **portrait** and **landscape** orientations.

---

### 📏 Grid System

Use a configurable grid to improve positioning accuracy.

- Toggle grid visibility
- Configure grid spacing
- Align elements visually
- Work with consistent measurements

---

### 🧲 Snap to Grid

Enable snapping for more accurate positioning.

Snap controls help keep elements aligned while designing complex layouts.

---

### 🗂️ Multi-Page Documents

Work with multiple pages from a single workspace.

The page workflow allows you to:

- Navigate between pages
- Organize pages
- Arrange pages
- Edit individual pages
- Configure page properties

---

### 🧱 Layers

Manage the elements that make up a page through the layer system.

This makes it easier to understand and control the structure of complex layouts.

---

### ⚙️ Properties

Configure selected objects and page-level settings through the properties interface.

This provides more precise control than relying only on direct manipulation.

---

### ↩️ Undo & Redo

Quickly move backward or forward through editing actions.

```text
Edit
  ↓
Undo
  ↓
Continue Editing
  ↓
Redo
````

---

 ### 🖨️ Print

 Prepare your completed layout for printing directly from the application.

 The print workflow is designed around the final document layout rather than requiring a separate desktop publishing application.

---

 ### 📤 Export

 Export completed layouts from the application for use outside the editor.

---

 ## 🧠 How It Works

 Print Axis Pro follows a simple visual workflow:

```
                 ┌───────────────┐
                 │ Create /      │
                 │ Import        │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Configure     │
                 │ Page          │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Design        │
                 │ Layout        │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Arrange       │
                 │ Elements      │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Grid / Snap   │
                 │ Alignment     │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Manage Pages  │
                 └───────┬───────┘
                         │
                         ▼
                 ┌────────────────┐
                 │ Print / Export │
                 └────────────────┘
```

---

 # 🛠️ Tech Stack

 Print Axis Pro is built using a modern TypeScript-based frontend stack.

 | Technology | Purpose |
| --- | --- |
| **React 19** | UI framework |
| **TypeScript** | Type-safe application development |
| **Vite** | Development server and build tooling |
| **TanStack Router** | Application routing |
| **TanStack Start** | Application framework |
| **Tailwind CSS 4** | Styling and UI system |
| **Radix UI** | Accessible UI primitives |
| **React Hook Form** | Form handling |
| **Zod** | Schema validation |
| **PDF.js** | PDF rendering and processing |
| **jsPDF** | PDF generation |
| **JSZip** | ZIP/archive handling |
| **idb-keyval** | Browser IndexedDB storage |
| **Lucide React** | Icon system |
| **Recharts** | Data visualization |
| **Sonner** | Toast notifications |
| **vite-plugin-pwa** | Progressive Web App support |
| **Workbox** | Service worker and caching support |

---

 # 🏗️ Architecture

 The application is structured as a modern client-side web application.

```
┌──────────────────────────────────────────────┐
│                  Print Axis Pro              │
├──────────────────────────────────────────────┤
│                                              │
│                  React 19                    │
│                      │                       │
│          ┌───────────┼───────────┐           │
│          ▼           ▼           ▼           │
│      UI Layer    Editor Layer  Routing       │
│          │           │           │           │
│          ▼           ▼           ▼           │
│      Radix UI     Layout      TanStack       │
│      Tailwind     Engine       Router        │
│          │           │                       │
│          └───────────┼───────────────────┐   │
│                      ▼                   │   │
│               Document Processing        │   │
│                      │                   │   │
│          ┌───────────┼───────────┐       │   │
│          ▼           ▼           ▼       │   │
│        PDF.js      jsPDF       JSZip     │   │
│                                          │   │
│                      │                   │   │
│                      ▼                   │   │
│               Browser Storage            │   │
│                   IndexedDB              │   │
│                                          │   │
└──────────────────────────────────────────┴───┘
```

---

 # 📁 Project Structure

```
printaxis/
│
├── .github/
│   └── workflows/
│
├── .lovable/
│
├── public/
│
├── src/
│   ├── components/
│   │
│   ├── ...
│   │
│   └── ...
│
├── .gitignore
├── .prettierignore
├── .prettierrc
│
├── AGENTS.md
├── README.md
│
├── bun.lock
├── bunfig.toml
├── components.json
│
├── eslint.config.js
├── package.json
├── tsconfig.json
├── vite.config.ts
│
└── google3baede3899ecf171.html
```

---

 # 💻 Development

 ## Prerequisites

 Make sure you have a modern version of:

 - Node.js
- npm
- Git

 The repository also includes Bun configuration and a `bun.lock` file.

---

 ## Clone

```
git clone https://github.com/Abhishekkb-work/printaxis.git
```

```
cd printaxis
```

---

 ## Install Dependencies

 Using npm:

```
npm install
```

 Or using Bun:

```
bun install
```

---

 ## Start Development Server

```
npm run dev
```

 Or:

```
bun run dev
```

 The Vite development server will start the application locally.

---

 # 📦 Production Build

 Create a production build:

```
npm run build
```

 Or:

```
bun run build
```

 Preview the production build:

```
npm run preview
```

---

 # 🧹 Code Quality

 Run ESLint:

```
npm run lint
```

 Format the project:

```
npm run format
```

---

 # 🌐 Deployment

 Print Axis Pro is deployed as a web application and is available at:

 ### https://printaxis.vercel.app/

 The project is compatible with modern Vite-based deployment workflows.

---

 # 📱 Progressive Web App

 Print Axis Pro includes PWA tooling through:

 - `vite-plugin-pwa`
- Workbox
- Service worker support
- Browser caching / precaching

 This provides the foundation for a more app-like browser experience.

---

 # 🔐 Browser-First Design

 Print Axis Pro is designed around browser-native capabilities.

 The application uses browser technologies for document handling, rendering, storage and layout workflows.

 This helps keep the editing experience lightweight and accessible without requiring a traditional desktop publishing installation.

---

 # 🎨 Editor Workflow

```
┌──────────────────────────────────────────┐
│                  TOOLBAR                 │
├────────────┬─────────────────┬───────────┤
│            │                 │           │
│   PAGES    │     CANVAS      │ PROPERTIES│
│            │                 │           │
│  Page 01   │                 │  Size     │
│  Page 02   │     Layout      │  Position │
│  Page 03   │     Workspace   │  Margins  │
│            │                 │  Settings │
│            │                 │           │
├────────────┴─────────────────┴───────────┤
│                 LAYERS                    │
├──────────────────────────────────────────┤
│              PRINT / EXPORT              │
└──────────────────────────────────────────┘
```

---

 # 📐 Layout Model

 A typical print document can be thought of as:

```
Document
│
├── Page
│   ├── Background
│   ├── Elements
│   │   ├── Image
│   │   ├── Text
│   │   └── Other content
│   │
│   ├── Margins
│   ├── Grid
│   └── Properties
│
├── Page
│   └── ...
│
└── Page
    └── ...
```

 This page-oriented approach makes the editor suitable for multi-page print workflows.

---

 # 📄 Document Workflow

```
PDF / Template / New Document
              │
              ▼
       Document Loaded
              │
              ▼
        Page Selection
              │
              ▼
       Layout Editing
              │
       ┌──────┴──────┐
       ▼             ▼
     Grid          Layers
       │             │
       └──────┬──────┘
              ▼
         Properties
              │
              ▼
       Final Layout
              │
       ┌──────┴──────┐
       ▼             ▼
     Print         Export
```

---

 # ⚡ Why Print Axis Pro?

 Traditional print workflows often require switching between multiple applications for:

```
PDF Viewer
   +
Image Editor
   +
Document Editor
   +
Layout Software
   +
Print Dialog
```

 Print Axis Pro brings the core layout workflow into one browser-based workspace:

```
             PRINT AXIS PRO
                    │
       ┌────────────┼────────────┐
       │            │            │
      PDF         Layout       Pages
       │            │            │
       ├────────────┼────────────┤
       │            │            │
      Grid        Layers      Properties
       │            │            │
       └────────────┼────────────┘
                    │
              Print / Export
```

---

 # 🧩 Key Capabilities

```
✓ PDF Import
✓ Template Workflow
✓ Multi-page Editing
✓ Visual Layout
✓ Page Configuration
✓ Paper Size Controls
✓ Portrait / Landscape
✓ Measurement Units
✓ Margin Controls
✓ Grid System
✓ Snap to Grid
✓ Layers
✓ Properties
✓ Undo / Redo
✓ Print Workflow
✓ Export Workflow
✓ Browser Storage
✓ PWA Support
```

---

 # 🚀 Project Status

 Print Axis Pro is an actively developed browser-based print layout editor.

 The application is available online and the source code is maintained in this repository.

---

 # 👨‍💻 Author

 ## Abhishek K B

 Built with ❤️ to make print layout editing simpler, faster and more accessible.

---

 # 🔗 Links

 | Resource | Link |
| --- | --- |
| 🚀 Live Application | https://printaxis.vercel.app/ |
| 💻 GitHub Repository | https://github.com/Abhishekkb-work/printaxis |

---

 # 📜 License

 This project is currently distributed through the repository.

 See the repository for the applicable licensing terms.

---

 \<p align="center"\> \<br /\> \<strong\>🖨️ Print Axis Pro\</strong\> \<br /\> \<sub\>Design • Arrange • Print • Export\</sub\> \<br /\> \<br /\> \<a href="https://printaxis.vercel.app/"\> Launch Print Axis Pro → \</a\> \</p\>
