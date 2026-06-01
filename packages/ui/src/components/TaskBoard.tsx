import React, { useState, useEffect } from 'react';
import { getColyseusRoom } from '../game/Game';

interface TaskItem { id: number; title: string; assigned_to: string; status: string; }

export function TaskBoard() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [newTask, setNewTask] = useState('');
    const [target, setTarget] = useState('auto');

    useEffect(() => {
        const check = setInterval(() => {
            const room = getColyseusRoom();
            if (room) {
                room.onMessage('task-update', (d: any) => {
                    setTasks(prev => {
                        const existing = prev.find(t => t.title === d.task);
                        if (existing) return prev.map(t => t.title === d.task ? { ...t, status: d.status, assigned_to: d.agentId } : t);
                        return [...prev, { id: Date.now(), title: d.task, assigned_to: d.agentId, status: d.status }];
                    });
                });
                room.onMessage('tasks-sync', (ts: any[]) => {
                    setTasks(ts.map(t => ({ id: t.id, title: t.title, assigned_to: t.assigned_to || '', status: t.status })));
                });
                clearInterval(check);
            }
        }, 500);
        return () => clearInterval(check);
    }, []);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        const room = getColyseusRoom();
        if (room) { room.send('assign-task', { title: newTask, agentId: target === 'auto' ? undefined : target }); setNewTask(''); }
    };

    return (
        <div style={{ position: 'absolute', left: 20, top: 20, width: 260, backgroundColor: 'rgba(10,10,30,0.92)', color: 'white', padding: 14, borderRadius: 10, border: '1px solid rgba(108,92,231,0.3)', maxHeight: '45vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13px' }}>Task Board</h3>
            <form onSubmit={submit} style={{ marginBottom: 8 }}>
                <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Assign a task..."
                    style={{ width: '100%', padding: 7, borderRadius: 5, border: '1px solid #444', background: '#1a1a3e', color: 'white', fontSize: '12px', marginBottom: 5 }} />
                <div style={{ display: 'flex', gap: 5 }}>
                    <select value={target} onChange={e => setTarget(e.target.value)}
                        style={{ flex: 1, padding: 5, borderRadius: 5, border: '1px solid #444', background: '#1a1a3e', color: '#aaa', fontSize: '11px' }}>
                        <option value="auto">Auto-assign</option>
                        <option value="alice">Alice</option>
                        <option value="bob">Bob</option>
                    </select>
                    <button type="submit" style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: '#6c5ce7', color: 'white', fontSize: '11px', cursor: 'pointer' }}>Assign</button>
                </div>
            </form>
            <div style={{ flex: 1, overflowY: 'auto', fontSize: '11px' }}>
                {tasks.length === 0 && <p style={{ color: '#666', fontStyle: 'italic' }}>No tasks yet.</p>}
                {tasks.map(t => (
                    <div key={t.id} style={{ padding: '5px 7px', marginBottom: 3, borderRadius: 5, background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${t.status === 'completed' ? '#00b894' : '#fdcb6e'}` }}>
                        <div style={{ fontWeight: 'bold' }}>{t.status === 'completed' ? '✅' : '🔄'} {t.title}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>→ {t.assigned_to || 'Unassigned'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
