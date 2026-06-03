/**
 * SettingsDock — 左下角设置舱
 *
 * 非核心操作区，保持低调。
 * 未来放 API 配置、系统设置等。
 */
import { motion } from 'framer-motion';

export default function SettingsDock() {
  return (
    <motion.div
      className="settings-dock"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
    >
      <div className="dock-divider" />
      <div className="dock-content">
        <span className="dock-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </span>
        <span className="dock-label">设置</span>
        <span className="dock-version">v0.1.0</span>
      </div>
    </motion.div>
  );
}
