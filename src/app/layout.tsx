import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme-context';
import { AuthProvider } from '@/components/AuthContext';
import AuthGate from '@/components/AuthGate';
import { AudioPlayerProvider } from '@/components/AudioPlayerContext';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Player from '@/components/Player';

export const metadata: Metadata = {
  title: 'Виртуальная АТС — SAVT',
  description: 'Корпоративная телефония SAVT с ИИ-выжимками и интеграцией Bitrix24',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate>
              <AudioPlayerProvider>
                <Sidebar />
                <div className="main-wrapper">
                  <Topbar />
                  <main className="content-area">{children}</main>
                  <Player />
                </div>
              </AudioPlayerProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
