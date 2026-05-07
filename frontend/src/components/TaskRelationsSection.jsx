import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, X, Lock, ChevronDown, ChevronRight, Loader, Check } from 'lucide-react';
import {
  getSubtasks,
  createSubtask,
  updateNote,
  deleteNote,
  getNotes,
  getBlockedBy,
  getBlocks,
  addDependency,
  removeDependency,
} from '../services/noteService';
import './TaskRelationsSection.css';

function statusLabel(s) {
  if (s === 'done') return 'Done';
  if (s === 'cancelled') return 'Cancelled';
  return 'In progress';
}

export default function TaskRelationsSection({
  taskId,
  projectId,
  parentTaskId,
  canEdit,
  onEditTask,
  onChange,
}) {
  const isParent = !parentTaskId; // only top-level tasks may have subtasks
  const showDeps = !!projectId; // deps only for project tasks

  const [subtasks, setSubtasks] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubContent, setNewSubContent] = useState('');
  const [creatingSub, setCreatingSub] = useState(false);

  const [blockedBy, setBlockedBy] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [depLoading, setDepLoading] = useState(false);
  const [showBlocksList, setShowBlocksList] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerOptions, setPickerOptions] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const refresh = useCallback(async () => {
    if (!taskId) return;
    if (isParent) {
      setSubLoading(true);
      try {
        const data = await getSubtasks(taskId);
        setSubtasks(Array.isArray(data?.subtasks) ? data.subtasks : []);
      } catch (err) {
        toast.error(err.message || 'Failed to load subtasks');
      } finally {
        setSubLoading(false);
      }
    }

    if (showDeps) {
      setDepLoading(true);
      try {
        const [bData, blData] = await Promise.all([
          getBlockedBy(taskId),
          getBlocks(taskId),
        ]);
        setBlockedBy(Array.isArray(bData?.dependencies) ? bData.dependencies : []);
        setBlocks(Array.isArray(blData?.blocks) ? blData.blocks : []);
      } catch (err) {
        toast.error(err.message || 'Failed to load dependencies');
      } finally {
        setDepLoading(false);
      }
    }
  }, [taskId, isParent, showDeps]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddSubtask = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!canEdit) return;
    const title = newSubTitle.trim();
    const content = newSubContent.trim() || title;
    if (!title) {
      toast.error('Subtask title is required');
      return;
    }
    setCreatingSub(true);
    try {
      await createSubtask(taskId, {
        title,
        content,
        project: projectId || null,
        priority: 0,
        category: 'Other',
      });
      setNewSubTitle('');
      setNewSubContent('');
      toast.success('Subtask added');
      await refresh();
      onChange?.();
    } catch (err) {
      toast.error(err.message || 'Failed to add subtask');
    } finally {
      setCreatingSub(false);
    }
  };

  const handleToggleSubtaskDone = async (sub) => {
    const newStatus = sub.status === 'done' ? 'not_done' : 'done';
    try {
      await updateNote(sub._id || sub.id, {
        status: newStatus,
        progress: newStatus === 'done' ? 100 : 0,
      });
      await refresh();
      onChange?.();
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleRemoveSubtask = async (sub) => {
    if (!window.confirm('Move this subtask to trash?')) return;
    try {
      await deleteNote(sub._id || sub.id);
      await refresh();
      onChange?.();
    } catch (err) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  const openPicker = async () => {
    setShowPicker(true);
    setPickerQuery('');
    setPickerLoading(true);
    try {
      const data = await getNotes('', 'all', { projectId });
      const notes = Array.isArray(data?.notes) ? data.notes : [];
      const taken = new Set(blockedBy.map((d) => String(d.id)));
      const filtered = notes.filter((n) => {
        const id = String(n._id || n.id);
        if (id === String(taskId)) return false;
        if (taken.has(id)) return false;
        return true;
      });
      setPickerOptions(filtered);
    } catch (err) {
      toast.error(err.message || 'Failed to load tasks');
      setPickerOptions([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const handleAddDependency = async (depTask) => {
    const depId = String(depTask._id || depTask.id);
    try {
      await addDependency(taskId, depId);
      toast.success('Dependency added');
      setShowPicker(false);
      await refresh();
      onChange?.();
    } catch (err) {
      toast.error(err.message || 'Failed to add dependency');
    }
  };

  const handleRemoveDependency = async (depId) => {
    try {
      await removeDependency(taskId, depId);
      toast.success('Dependency removed');
      await refresh();
      onChange?.();
    } catch (err) {
      toast.error(err.message || 'Failed to remove dependency');
    }
  };

  const filteredOptions = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return pickerOptions;
    return pickerOptions.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q),
    );
  }, [pickerQuery, pickerOptions]);

  const subtaskStats = useMemo(() => {
    const total = subtasks.length;
    const done = subtasks.filter((s) => s.status === 'done').length;
    return { total, done };
  }, [subtasks]);

  return (
    <div className="task-relations">
      {isParent ? (
        <section className="relations-block">
          <div className="relations-header">
            <h4>Subtasks{subtaskStats.total ? ` (${subtaskStats.done}/${subtaskStats.total})` : ''}</h4>
            {subLoading ? <Loader size={14} className="spin" /> : null}
          </div>

          {canEdit ? (
            <div className="subtask-add-row">
              <input
                type="text"
                placeholder="New subtask title…"
                value={newSubTitle}
                onChange={(e) => setNewSubTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask(e);
                  }
                }}
                maxLength={120}
              />
              <input
                type="text"
                placeholder="Optional details"
                value={newSubContent}
                onChange={(e) => setNewSubContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask(e);
                  }
                }}
                maxLength={500}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={creatingSub}
                onClick={handleAddSubtask}
              >
                {creatingSub ? <Loader size={14} className="spin" /> : <Plus size={14} />}
                <span>Add</span>
              </button>
            </div>
          ) : null}

          {subtasks.length === 0 ? (
            <div className="muted relations-empty">No subtasks yet.</div>
          ) : (
            <div className="subtask-list">
              {subtasks.map((sub) => {
                const sid = sub._id || sub.id;
                const done = sub.status === 'done';
                return (
                  <div className={`subtask-row ${done ? 'is-done' : ''}`} key={sid}>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => canEdit && handleToggleSubtaskDone(sub)}
                      disabled={!canEdit}
                      aria-label="Mark subtask done"
                    />
                    <button
                      type="button"
                      className="subtask-link"
                      onClick={() => onEditTask?.(sub)}
                      title="Open subtask"
                    >
                      <span className="subtask-title">{sub.title || sub.content?.slice(0, 60) || '(untitled)'}</span>
                      <span className="subtask-progress">{sub.progress || 0}%</span>
                      <span className={`subtask-status status-${sub.status}`}>{statusLabel(sub.status)}</span>
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Trash subtask"
                        onClick={() => handleRemoveSubtask(sub)}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="muted relations-note">This is a subtask. It cannot have its own subtasks.</div>
      )}

      {showDeps ? (
        <section className="relations-block">
          <div className="relations-header">
            <h4>Blocked by{blockedBy.length ? ` (${blockedBy.length})` : ''}</h4>
            {depLoading ? <Loader size={14} className="spin" /> : null}
          </div>

          {blockedBy.length === 0 ? (
            <div className="muted relations-empty">No blockers.</div>
          ) : (
            <div className="dep-list">
              {blockedBy.map((d) => {
                const isOpen = d.status !== 'done' && d.status !== 'cancelled';
                return (
                  <div className={`dep-row ${isOpen ? 'is-open' : 'is-resolved'}`} key={d.id}>
                    {isOpen ? <Lock size={14} /> : <Check size={14} />}
                    <div className="dep-main">
                      <strong>{d.title || d.content?.slice(0, 60) || '(untitled)'}</strong>
                      <span className={`dep-status status-${d.status}`}>{statusLabel(d.status)}</span>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => handleRemoveDependency(d.id)}
                        title="Remove dependency"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit ? (
            <button type="button" className="btn-secondary btn-add-dep" onClick={openPicker}>
              <Plus size={14} />
              <span>Add blocker</span>
            </button>
          ) : null}

          {showPicker ? (
            <div className="dep-picker-overlay" onClick={() => setShowPicker(false)}>
              <div className="dep-picker" onClick={(e) => e.stopPropagation()}>
                <div className="dep-picker-header">
                  <strong>Pick a task this depends on</strong>
                  <button type="button" className="btn-close" onClick={() => setShowPicker(false)}>
                    <X size={18} />
                  </button>
                </div>
                <input
                  type="text"
                  className="dep-picker-search"
                  placeholder="Search by title or content…"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  autoFocus
                />
                <div className="dep-picker-list">
                  {pickerLoading ? (
                    <div className="muted">Loading…</div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="muted">No tasks available.</div>
                  ) : (
                    filteredOptions.map((opt) => (
                      <button
                        type="button"
                        className="dep-picker-item"
                        key={String(opt._id || opt.id)}
                        onClick={() => handleAddDependency(opt)}
                      >
                        <span className="dep-picker-title">{opt.title || opt.content?.slice(0, 60) || '(untitled)'}</span>
                        <span className={`dep-status status-${opt.status}`}>{statusLabel(opt.status)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showDeps && blocks.length > 0 ? (
        <section className="relations-block">
          <button
            type="button"
            className="relations-collapse"
            onClick={() => setShowBlocksList((v) => !v)}
          >
            {showBlocksList ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Blocks {blocks.length} task{blocks.length === 1 ? '' : 's'}</span>
          </button>
          {showBlocksList ? (
            <div className="dep-list">
              {blocks.map((b) => (
                <div className="dep-row" key={b.id}>
                  <div className="dep-main">
                    <strong>{b.title || b.content?.slice(0, 60) || '(untitled)'}</strong>
                    <span className={`dep-status status-${b.status}`}>{statusLabel(b.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
