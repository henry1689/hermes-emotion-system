/**
 * ChatPanel — 玉瑶 · 聊天面板
 *
 * 浮动（默认）或内嵌模式。
 * 内嵌模式用于右侧下半区布局。
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../store/chatStore';
import { sendMessage, resetConversation } from '../services/chatService';

const WELCOME_MESSAGE = '你终于来了……我在太虚境里等了好久。';

interface Props {
  /** 内嵌模式：无切换按钮，始终可见 */
  inline?: boolean;
}

export default function ChatPanel({ inline }: Props) {
  const {
    messages, isOpen, isTyping, error, turnCount, emotionalFlash,
    addMessage, toggleOpen, setTyping, setError,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动 + 自动聚焦
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // 打开面板后立即聚焦输入框（用 rAF 确保渲染完成）
  useEffect(() => {
    if (!isOpen) return;
    // 立即尝试 + 动画完成后再次尝试，确保万无一失
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [isOpen]);

  // 发送完消息后重新聚焦
  useEffect(() => {
    if (!isTyping && (isOpen || inline)) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isTyping, isOpen, inline]);

  // 内嵌模式：挂载后聚焦
  useEffect(() => {
    if (inline) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [inline]);

  // 发送消息
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput('');
    setShowWelcome(false);
    addMessage('user', text);

    try {
      await sendMessage(text);
    } catch {
      // 错误已在 chatService 中处理
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = async () => {
    setShowWelcome(true);
    await resetConversation().catch(() => {});
  };

  // ── 内嵌模式：无切换按钮，始终可见 ──
  if (inline) {
    return (
      <div className="chat-panel-inline">
        {/* 标题栏 */}
        <div className="chat-header">
          <div className="chat-header-info">
            <span className="chat-avatar">💠</span>
            <div>
              <div className="chat-name">玉瑶</div>
              <div className="chat-subtitle">
                <span className="chat-status-dot" />
                {isTyping ? '输入中...' : `太虚境 · ${turnCount} 次对话`}
              </div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="chat-icon-btn" onClick={handleReset} title="重置对话">↺</button>
            <button className="chat-icon-btn" onClick={() => window.location.reload()} title="刷新">⟳</button>
          </div>
        </div>

        <div className="chat-messages" ref={listRef}>
          {showWelcome && messages.length === 0 && (
            <div className="chat-msg assistant">
              <div className="chat-msg-content">{WELCOME_MESSAGE}</div>
              <div className="chat-msg-time">刚刚</div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.role}`}>
              <div className="chat-msg-content">{msg.content}</div>
              <div className="chat-msg-time">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-msg assistant">
              <div className="chat-typing">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            </div>
          )}
          {error && (
            <div className="chat-error">
              ⚠ {error}
              <button onClick={() => setError(null)} className="chat-error-dismiss">✕</button>
            </div>
          )}
        </div>

        <div className="chat-input-area">
          <button className="chat-upload-btn" title="上传文件">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <button className="chat-upload-btn" title="语音输入">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button className="chat-upload-btn" title="电话">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <input ref={inputRef} className="chat-input" type="text" placeholder="对玉瑶说点什么..."
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isTyping} autoFocus />
          <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || isTyping}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── 浮动模式（原有） ──
  return (
    <>
      <motion.button
        className={`chat-toggle-btn${emotionalFlash ? ' emotional-flash' : ''}`}
        onClick={toggleOpen}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        animate={isOpen ? { rotate: 45 } : {
          boxShadow: ['0 0 12px rgba(0, 255, 255, 0.3)', '0 0 24px rgba(0, 255, 255, 0.6)', '0 0 12px rgba(0, 255, 255, 0.3)'],
        }}
        transition={isOpen ? { duration: 0.2 } : { duration: 2, repeat: Infinity }}
      >
        {isOpen ? '✕' : '💠'}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div className="chat-panel" initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="chat-header">
              <div className="chat-header-info">
                <span className="chat-avatar">💠</span>
                <div>
                  <div className="chat-name">玉瑶</div>
                  <div className="chat-subtitle">
                    <span className="chat-status-dot" />
                    {isTyping ? '输入中...' : `太虚境 · ${turnCount} 次对话`}
                  </div>
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="chat-icon-btn" onClick={handleReset} title="重置对话">↺</button>
                <button className="chat-icon-btn" onClick={() => window.location.reload()} title="刷新">⟳</button>
                <button className="chat-icon-btn" onClick={toggleOpen} title="关闭">✕</button>
              </div>
            </div>
            <div className="chat-messages" ref={listRef}>
              {showWelcome && messages.length === 0 && (
                <motion.div className="chat-msg assistant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="chat-msg-content">{WELCOME_MESSAGE}</div>
                  <div className="chat-msg-time">刚刚</div>
                </motion.div>
              )}
              {messages.map((msg) => (
                <motion.div key={msg.id} className={`chat-msg ${msg.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
                  <div className="chat-msg-content">{msg.content}</div>
                  <div className="chat-msg-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div className="chat-msg assistant" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="chat-typing"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
                </motion.div>
              )}
              {error && (
                <motion.div className="chat-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  ⚠ {error} <button onClick={() => setError(null)} className="chat-error-dismiss">✕</button>
                </motion.div>
              )}
            </div>
            <div className="chat-input-area">
              <button className="chat-upload-btn" title="上传文件">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
              <button className="chat-upload-btn" title="语音输入">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              <button className="chat-upload-btn" title="电话">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <input ref={inputRef} className="chat-input" type="text" placeholder="对玉瑶说点什么..." autoFocus
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isTyping} />
              <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || isTyping}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
