import React, { useState, useEffect, useRef } from 'react';
import { eventBus } from '../events';
import { getColyseusRoom } from '../game/Game';

export function ChatPanel() {
    const [messages, setMessages] = useState<{ sender: string; text: string }[]>([
        { sender: 'System', text: 'Office initialized.' }
    ]);
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: any) => setMessages(prev => [...prev, e.detail]);
        eventBus.addEventListener('chat-message', handler);
        return () => eventBus.removeEventListener('chat-message', handler);
    }, []);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const send = () => {
        if (!input.trim()) return;
        const room = getColyseusRoom();
        if (room) { room.send('chat', { text: input }); setInput(''); }
    };

    return (
        <div style={{ position: 'absolute', right: 20, bottom: 20, width: 300, height: 400, backgroundColor: 'rgba(0,0,0,0.85)', color: 'white', padding: 16, borderRadius: 10, display: 'flex', flexDirection: 'column', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Office Chat</h3>
            <div style={{ flex: 1, overflowY: 'auto', fontSize: '13px', marginBottom: 10 }}>
                {messages.map((m, i) => (
                    <p key={i} style={{ margin: '5px 0', lineHeight: '1.4' }}>
                        <strong style={{ color: m.sender === 'System' ? '#00eeff' : '#aaffaa' }}>{m.sender}:</strong> {m.text}
                    </p>
                ))}
                <div ref={endRef} />
            </div>
            <input type="text" placeholder="Send a message..." value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                style={{ width: '100%', padding: 10, background: '#222', color: 'white', border: '1px solid #444', borderRadius: 6, outline: 'none' }}
            />
        </div>
    );
}
