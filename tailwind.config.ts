import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 重新定义背景，使用极深的灰而不是纯黑，更有质感
        background: "#0a0a0a", 
        foreground: "#ededed",
      },
      backgroundImage: {
        // 去掉之前的网格，改用极细微的噪点或纯色，这里先用纯色保持极简
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;