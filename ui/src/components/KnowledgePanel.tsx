/**
 * KnowledgePanel — 知识库浏览面板
 *
 * 点击左下角 📚 图标后弹出，显示知识库文件列表，支持搜索。
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  source_type?: string;
  created_at?: string;
}

export default function KnowledgePanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/knowledge?search=${encodeURIComponent(q)}` : '/api/knowledge';
      const r = await fetch(url);
      const d = await r.json();
      setItems(d.items || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button className="dock-btn dock-kb-btn" onClick={toggle} title="知识库">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" /><path d="M8 11h6" /><path d="M8 15h4" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="kb-popup"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="kb-popup-header">
              <span className="kb-popup-title">📚 知识库</span>
              <button className="kb-popup-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="kb-popup-search">
              <input className="kb-search-input" placeholder="搜索知识库文件…"
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') load(search); }} />
              <button className="kb-search-btn" onClick={() => load(search)}>🔍</button>
            </div>
            <div className="kb-popup-list">
              {loading ? (
                <div className="kb-loading">加载中…</div>
              ) : items.length === 0 ? (
                <div className="kb-empty">📭 知识库还没有内容</div>
              ) : (
                items.map(item => (
                  <div key={item.id} className="kb-card">
                    <div className="kb-card-title">{item.title || '无标题'}</div>
                    <div className="kb-card-preview">{(item.content || '').substring(0, 120)}</div>
                    <div className="kb-card-meta">
                      {item.tags?.map(t => <span key={t} className="kb-tag">{t}</span>)}
                      {item.created_at && <span className="kb-date">{new Date(item.created_at).toLocaleDateString()}</span>}
                      {item.source_type && <span className="kb-source">{item.source_type}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
