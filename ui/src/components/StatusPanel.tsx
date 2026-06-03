/**
 * StatusPanel — 左栏：状态监控面板
 *
 * 显示系统运行时指标：FPS、粒子数、连接数、后端健康。
 */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNeuralStore } from '../store/neuralStore';
import { fetchHealth } from '../services/chatService';

const statusItems = [
  { key: 'system', label: '系统状态', value: '运行中', color: '#00ff88' },
  { key: 'mode', label: '运行模式', value: '可视化', color: '#00ffff' },
  { key: 'backend', label: '后端引擎', value: 'Hermes v0.1', color: '#ff6600' },
];

export default function StatusPanel() {
  const fps = useNeuralStore((s) => s.fps);
  const particleCount = useNeuralStore((s) => s.particleCount);
  const connectionCount = useNeuralStore((s) => s.connectionCount);
  const isLoading = useNeuralStore((s) => s.isLoading);
  const backendHealth = useNeuralStore((s) => s.backendHealth);
  const setBackendHealth = useNeuralStore((s) => s.setBackendHealth);

  // 心跳轮询后端健康
  useEffect(() => {
    const poll = async () => {
      try {
        const h = await fetchHealth();
        setBackendHealth(h);
      } catch {
        setBackendHealth({ connected: false, lastCheck: Date.now() });
      }
    };
    poll();
    const timer = setInterval(poll, 15_000);
    return () => clearInterval(timer);
  }, [setBackendHealth]);

  const isHealthy = backendHealth?.connected !== false && backendHealth !== null;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemAnim = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 },
  };

  return (
    <motion.div
      className="panel status-panel"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.h2 className="panel-title" variants={itemAnim}>
        <span className="accent-cyan">◆</span> 状态监控
      </motion.h2>

      {/* FPS 仪表 */}
      <motion.div className="metric-card" variants={itemAnim}>
        <div className="metric-label">实时帧率</div>
        <div className="metric-value-row">
          <span
            className="metric-value metric-glow"
            style={{ color: fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffaa00' : '#ff4444' }}
          >
            {isLoading ? '--' : fps}
          </span>
          <span className="metric-unit">FPS</span>
        </div>
        <div className="metric-bar">
          <motion.div
            className="metric-bar-fill"
            style={{ backgroundColor: fps >= 55 ? '#00ff88' : '#ffaa00' }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((fps / 60) * 100, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>

      {/* 节点统计 */}
      <motion.div className="metric-card" variants={itemAnim}>
        <div className="metric-label">神经节点</div>
        <div className="metric-value-row">
          <span className="metric-value accent-cyan">{particleCount}</span>
          <span className="metric-unit">nodes</span>
        </div>
      </motion.div>

      <motion.div className="metric-card" variants={itemAnim}>
        <div className="metric-label">突触连接</div>
        <div className="metric-value-row">
          <span className="metric-value accent-orange">{connectionCount}</span>
          <span className="metric-unit">synapses</span>
        </div>
      </motion.div>

      {/* 连接密度 */}
      <motion.div className="metric-card" variants={itemAnim}>
        <div className="metric-label">连接密度</div>
        <div className="metric-value-row">
          <span className="metric-value" style={{ color: '#8888ff' }}>
            {particleCount > 0
              ? ((connectionCount / ((particleCount * (particleCount - 1)) / 2)) * 100).toFixed(2)
              : '0.00'}
          </span>
          <span className="metric-unit">%</span>
        </div>
      </motion.div>

      {/* 分割线 */}
      <motion.div className="divider" variants={itemAnim} />

      {/* 后端健康卡片 */}
      <motion.div className="metric-card" variants={itemAnim}
        style={{ borderColor: isHealthy ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.2)' }}
      >
        <div className="metric-label">后端连接</div>
        <div className="metric-value-row" style={{ gap: 8 }}>
          <span className="status-dot" style={{
            background: isHealthy ? '#00ff88' : '#ff4444',
            boxShadow: isHealthy ? '0 0 6px rgba(0,255,136,0.5)' : '0 0 6px rgba(255,68,68,0.5)',
          }} />
          <span className="metric-value" style={{
            fontSize: 16,
            color: isHealthy ? '#00ff88' : '#ff4444',
          }}>
            {isHealthy ? '已连接' : '离线'}
          </span>
        </div>
        {backendHealth && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="status-row" style={{ padding: 0 }}>
              <span className="status-label">内存</span>
              <span className="status-value" style={{ color: '#888' }}>
                {backendHealth.memory?.heapUsedMB ?? '?'}MB / {backendHealth.memory?.heapTotalMB ?? '?'}MB
              </span>
            </div>
            <div className="status-row" style={{ padding: 0 }}>
              <span className="status-label">存储记录</span>
              <span className="status-value" style={{ color: '#888' }}>
                {backendHealth.storageRecords ?? backendHealth.storage?.totalRecords ?? 0} 条
              </span>
            </div>
            <div className="status-row" style={{ padding: 0 }}>
              <span className="status-label">对话轮次</span>
              <span className="status-value" style={{ color: '#888' }}>
                {backendHealth.conversations?.total ?? 0}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* 系统信息 */}
      {statusItems.map((item) => (
        <motion.div className="status-row" key={item.key} variants={itemAnim}>
          <span className="status-label">{item.label}</span>
          <span className="status-value" style={{ color: item.color }}>
            {item.value}
          </span>
        </motion.div>
      ))}

      {/* 加载指示器 */}
      {isLoading && (
        <motion.div
          className="loading-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="loading-dot" />
          加载神经数据...
        </motion.div>
      )}
    </motion.div>
  );
}
