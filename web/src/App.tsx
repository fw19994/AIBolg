import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import LandingPage from '@/pages/LandingPage';
import HomeBlogPage from '@/pages/HomeBlogPage';
import ArticlesManagePage from '@/pages/ArticlesManagePage';
import ArticlePlaceholderPage from '@/pages/ArticlePlaceholderPage';
import ArticleDetailPage from '@/pages/ArticleDetailPage';
import EditorNewPage from '@/pages/EditorNewPage';
import EditorEditPage from '@/pages/EditorEditPage';
import ProfilePage from '@/pages/ProfilePage';
import FavoritesPage from '@/pages/FavoritesPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* OSS/静态站直接打开 /index.html 时 pathname 为 /index.html，需与 / 对齐 */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomeBlogPage />} />
        <Route path="/articles" element={<ArticlesManagePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/article" element={<ArticlePlaceholderPage />} />
        <Route path="/article/:id" element={<ArticleDetailPage />} />
        <Route path="/editor" element={<EditorNewPage />} />
        <Route path="/editor/:id" element={<EditorEditPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<Navigate to="/profile" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </AuthProvider>
  );
}
