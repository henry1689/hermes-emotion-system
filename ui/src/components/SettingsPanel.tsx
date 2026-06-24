/**
 * SettingsPanel — 设置面板
 *
 * API Key管理、TTS语音播报模式选择
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApiKeyItem {
  key: string;
  value: string;
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [ttsMode, setTtsMode] = useState('auto');
  const panelRef = useRef<HTMLDivElement>(null);

  const loadKeys = useCallback(async () => {
    try {
      const r = await fetch('/api/keys');
      const d = await r.json();
      if (d.keys) setApiKeys(d.keys.map((k) => ({ key: typeof k === "string" ? k : (k.key || k.name || JSON.stringify(k)), value: '' })));
    } catch {}
  }, []);

  useEffect(() => {
    if (open) loadKeys();
  }, [open, loadKeys]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const addKey = async () => {
    if (!newKey.trim()) return;
    try {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey.trim(), value: newValue }),
      });
      setNewKey('');
      setNewValue('');
      loadKeys();
    } catch {}
  };

  const deleteKey = async (key: string) => {
    try {
      await fetch('/api/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      loadKeys();
    } catch {}
  };

  const toggle = () => setOpen(o => !o);

  return (
    <>
      <button className="dock-btn dock-settings-btn" onClick={toggle} title="设置">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="settings-popup"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="settings-popup-header">
              <span className="settings-popup-title">⚙️ 设置</span>
              <button className="settings-popup-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">🔑 API Key 管理</div>
              <div className="settings-key-list">
                {apiKeys.length === 0 ? (
                  <div className="settings-empty">暂无 API Key</div>
                ) : (
                  apiKeys.map(item => (
                    <div key={item.key} className="settings-key-row">
                      <span className="settings-key-name">{item.key}</span>
                      <button className="settings-key-del" onClick={() => deleteKey(item.key)} title="删除">✕</button>
                    </div>
                  ))
                )}
              </div>
              <div className="settings-key-add">
                <input className="settings-input" placeholder="Key 名称" value={newKey} onChange={e => setNewKey(e.target.value)} />
                <input className="settings-input" placeholder="Key 值" type="password" value={newValue} onChange={e => setNewValue(e.target.value)} />
                <button className="settings-btn" onClick={addKey}>添加</button>
              </div>
            </div>

            <div className="settings-divider" />

            <div className="settings-section">
              <div className="settings-section-title">🔊 语音播报模式</div>
              <div className="settings-tts-options">
                {['auto', 'always', 'never'].map(mode => (
                  <label key={mode} className="settings-radio">
                    <input type="radio" name="tts" value={mode} checked={ttsMode === mode}
                      onChange={() => setTtsMode(mode)} />
                    <span>{mode === 'auto' ? '智能播报' : mode === 'always' ? '总是播报' : '静音'}</span>
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
