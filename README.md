# Layox

A local-first, privacy-focused photo album creator.

## Tech Stack

- **Vite** + **React** + **TypeScript**
- **react-konva** – Canvas rendering
- **zustand** – State management
- **Tailwind CSS** – UI styling
- **jszip** / **file-saver** / **jspdf** – File handling & export

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/
├── components/
│   └── canvas/       # Canvas editor components (react-konva)
├── store/            # zustand state management
├── types/            # TypeScript interfaces (Page, ImageElement, TextElement…)
├── App.tsx
└── main.tsx
```

## File Format

Projects are saved as `.layox` files — a ZIP container holding `project.json` and an `assets/` folder.
