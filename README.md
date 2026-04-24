# SELENA-NLICS

**SELENA-NLICS** (Node-based Live Interactive Composition System) is a powerful, high-performance web application designed for real-time visual composition and creative coding.

## 🚀 Overview

Built with modern web technologies, SELENA-NLICS leverages a custom WebGL-based engine to provide a smooth, interactive experience for visual artists and developers. The system uses a Directed Acyclic Graph (DAG) architecture under the hood, allowing for complex node-based visual logic while maintaining a clean, list-based UI.

### Key Features
- **GPU-Accelerated Rendering**: Powered by [PixiJS](https://pixijs.com/) for high-performance visual processing.
- **Node-Based Architecture**: Flexible visual logic through a backend DAG data structure.
- **Real-Time Interactive Engine**: Instant feedback via a custom React-Pixi integration.
- **Advanced Blending & Masking**: Support for various blend modes and complex masking pipelines.
- **AI Integration**: Built-in support for Google Gemini API for intelligent creative assistance.

## 🛠 Tech Stack
- **Framework**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/)
- **Visual Engine**: [PixiJS](https://pixijs.com/) & [@pixi/react](https://github.com/pixijs/pixi-react)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Languages**: [TypeScript](https://www.typescriptlang.org/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/NSDesign/SELENA-NLICS.git
   cd SELENA-NLICS
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   Create a `.env` file based on `.env.example` and add your `GEMINI_API_KEY`.

### Development
Start the development server:
```bash
npm run dev
```

### Production Build
Create a production-ready build:
```bash
npm run build
```

## 📜 License
Copyright (c) 2026 NSDesign / Nick Sullivan. All rights reserved.
Proprietary license - unauthorized use is prohibited. See [LICENSE](./LICENSE) for details.
