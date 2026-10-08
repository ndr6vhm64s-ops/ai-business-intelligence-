import "./globals.css";
export const metadata = { title: "AI Business Intelligence", description: "Исследование компании → возможности для автоматизации → PRD" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body className="antialiased">{children}</body></html>;
}
