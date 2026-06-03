/**
 * App — 主布局
 *
 * 三栏结构：左（状态监控）+ 中（3D 核心）+ 右（思维流）
 * 背景 #050505，青橙高对比配色
 */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import NeuralCore from './components/NeuralCore';
import StatusPanel from './components/StatusPanel';
import ThoughtStream from './components/ThoughtStream';
import ChatPanel from './components/ChatPanel';
import { refreshNeuralData } from './services/neuralDataService';
import { useNeuralStore } from './store/neuralStore';
import './App.css';

export default function App() {
  const setMousePosition = useNeuralStore((s) => s.setMousePosition);
  const setMouseInView = useNeuralStore((s) => s.setMouseInView);

  // 启动时加载神经数据（优先从 Tauri 后端）
  useEffect(() => {
    refreshNeuralData();
  }, []);

  // 全局鼠标追踪（传递给 3D 场景用于交互）
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition(e.clientX, e.clientY);
  };

  return (
    <div
      className="app-root"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setMouseInView(true)}
      onMouseLeave={() => setMouseInView(false)}
    >
      {/* ===== 3D 背景层 ===== */}
      <div className="canvas-layer">
        <NeuralCore />
      </div>

      {/* ===== 顶部标题 ===== */}
      <motion.header
        className="app-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="header-left">
          <span className="logo-icon">◈</span>
          <h1 className="logo-text">
            Hermes <span className="accent-cyan">Neural</span>
          </h1>
        </div>
        <div className="header-right">
          <span className="header-badge">v0.1.0</span>
          <span className="header-badge accent-orange">视觉觉醒</span>
        </div>
      </motion.header>

      {/* ===== 三栏布局 ===== */}
      <div className="layout-grid">
        {/* 左栏：状态监控 */}
        <motion.aside
          className="layout-left"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <StatusPanel />
        </motion.aside>

        {/* 中栏：3D 核心区（透明 overlay） */}
        <main className="layout-center">
          {/* 中心水印提示 */}
          <div className="center-hint">
            <span>移动鼠标与神经节点交互</span>
          </div>
        </main>

        {/* 右栏：思维流 */}
        <motion.aside
          className="layout-right"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <ThoughtStream />
        </motion.aside>
      </div>

      {/* ===== 底部状态条 ===== */}
      <motion.footer
        className="app-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <span className="footer-left">
          <span className="status-dot" />
          Hermes Emotion System · 认知可视化引擎
        </span>
        <span className="footer-right">
          Tauri + React Three Fiber · {new Date().toLocaleTimeString()}
        </span>
      </motion.footer>

      {/* ===== 玉瑶聊天面板（浮动 overlay） ===== */}
      <ChatPanel />
    </div>
  );
}
