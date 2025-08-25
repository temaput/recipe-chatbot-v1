/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Grandma's Recipe Theme - Warm & Cozy Colors
        cream: {
          50: '#fffef7',
          100: '#fefaec',
          200: '#fdf4d3',
          300: '#fbeeb3',
          400: '#f8e588',
          500: '#f4d958',
          600: '#e8c545',
          700: '#d1a93a',
          800: '#b08332',
          900: '#8f6a2e',
        },
        honey: {
          50: '#fefaef',
          100: '#fdf2d4',
          200: '#fae3a9',
          300: '#f6d073',
          400: '#f2ba3f',
          500: '#eda41c',
          600: '#d88f15',
          700: '#b47815',
          800: '#926118',
          900: '#785017',
        },
        terracotta: {
          50: '#fdf4f3',
          100: '#fce8e6',
          200: '#f9d5d2',
          300: '#f4b8b3',
          400: '#ed9286',
          500: '#e3725d',
          600: '#cf5a42',
          700: '#ad4935',
          800: '#903e30',
          900: '#78372e',
        },
        sage: {
          50: '#f6f7f4',
          100: '#e9ede4',
          200: '#d4dccb',
          300: '#b6c5a8',
          400: '#94a981',
          500: '#758d62',
          600: '#5a704c',
          700: '#47573e',
          800: '#3a4834',
          900: '#313c2d',
        },
        warmBrown: {
          50: '#faf8f5',
          100: '#f3ede6',
          200: '#e6d9cb',
          300: '#d5c0a8',
          400: '#c2a284',
          500: '#b18866',
          600: '#9a7558',
          700: '#80614a',
          800: '#685142',
          900: '#544539',
        }
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
