import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Provider from "./provider";
import ConvexClientProvider from "./ConvexClientProvider";


export const metadata = {
  title: "AI Website Builder - Build Websites with AI",
  description: "Transform your ideas into production-ready code with AI-powered website generation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning >
      <body>
        <ConvexClientProvider>
        <Provider>
        {children}
        </Provider>
        </ConvexClientProvider>
        
      </body>
    </html>
  );
}
