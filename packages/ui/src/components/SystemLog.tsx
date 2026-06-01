import React, { useState, useEffect } from 'react';
import { eventBus } from '../events';

interface LogEntry { agent: string; action: string; thought: string; time: string; }

export function SystemLog() {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        const handler = (e: any) => {
            setLogs(prev => [e.detail, ...prev].slice(0, 50));
        };
        eventBus.addEventListener('activity-log', handler);
        return () => eventBus.removeEventListener('activity-log', handler);
    }, []);

    const actionColor = (a: string) => {
        if (a === 'work') return '#74b9ff';
        if (a === 'talk') return '#55efc4';
        if (a === 'use_tool') return '#fdcb6e';
        return '#dfe6e9';
    };

    return (
        <div style={{ position: 'absolute', right: 20, top: 20, width: 280, maxHeight: '35vh', backgroundColor: 'rgba(10,10,30,0.9)', color: 'white', padding: 12, borderRadius: 10, border: '1px solid rgba(0,184,148,0.3)', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13px' }}>System Log</h3>
            {logs.length === 0 && <p style={{ color: '#555', fontSize: '11px' }}>Waiting for agent activity...</p>}
            {logs.map((l, i) => (
                <div key={i} style={{ fontSize: '11px', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #222' }}>
                    <span style={{ color: actionColor(l.action) }}>[{l.action}]</span>{' '}
                    <strong>{l.agent}</strong>{' '}
                    <span style={{ color: '#888' }}>{l.time}</span>
                    {l.thought && <div style={{ color: '#aaa', fontSize: '10px', marginTop: 2 }}>"{l.thought}"</div>}
                </div>
            ))}
        </div>
    );
}
