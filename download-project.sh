#!/bin/bash

# Personal Assistant Replit - Local Download Script
# Run this script to create the complete project structure locally

echo "Creating Personal Assistant project structure..."

# Create main directories
mkdir -p PersonalAssistant_Replit/{client/src/{components/{ui,},hooks,lib,pages},server,shared}

cd PersonalAssistant_Replit

# Create package.json
cat > package.json << 'EOF'
{
  "name": "personal-assistant",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.1",
    "@neondatabase/serverless": "^0.10.1",
    "@radix-ui/react-accordion": "^1.2.1",
    "@radix-ui/react-alert-dialog": "^1.1.2",
    "@radix-ui/react-aspect-ratio": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-checkbox": "^1.1.2",
    "@radix-ui/react-collapsible": "^1.1.1",
    "@radix-ui/react-context-menu": "^2.2.2",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-hover-card": "^1.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-menubar": "^1.1.2",
    "@radix-ui/react-navigation-menu": "^1.2.1",
    "@radix-ui/react-popover": "^1.1.2",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.1",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slider": "^1.2.1",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.2",
    "@radix-ui/react-toggle": "^1.1.0",
    "@radix-ui/react-toggle-group": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.3",
    "@tanstack/react-query": "^5.59.16",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "cmdk": "1.0.0",
    "connect-pg-simple": "^10.0.0",
    "date-fns": "^4.1.0",
    "drizzle-kit": "^0.26.2",
    "drizzle-orm": "^0.36.1",
    "drizzle-zod": "^0.5.1",
    "express": "^4.21.1",
    "express-session": "^1.18.1",
    "lucide-react": "^0.451.0",
    "openid-client": "^6.1.6",
    "passport": "^0.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "tailwind-merge": "^2.5.3",
    "tailwindcss": "^3.4.13",
    "tailwindcss-animate": "^1.0.7",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "wouter": "^3.3.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/express-session": "^1.18.0",
    "@types/node": "^22.7.5",
    "@types/passport": "^1.0.16",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47"
  }
}
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
build/
.env*
*.log
.DS_Store
coverage/
.vscode/
.idea/
EOF

echo "✓ Created package.json and .gitignore"
echo ""
echo "To complete setup:"
echo "1. Copy all files from your Replit project to this folder"
echo "2. Run: npm install"
echo "3. Set up your environment variables"
echo "4. Run: npm run db:push"
echo "5. Run: npm run dev"
echo ""
echo "Project structure created in: $(pwd)"
EOF