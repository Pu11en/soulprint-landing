'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

interface ConversationItemProps {
  id: string;
  title: string;
  isActive: boolean;
  updatedAt: string;
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
}

// Helper function to format relative time
function formatRelativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConversationItem({
  id,
  title,
  isActive,
  updatedAt,
  onSelect,
  onRename,
  onDelete,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      onSelect(id);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(title);
    setIsEditing(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-accent' : 'hover:bg-muted'
      }`}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-background text-foreground border border-border rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="text-sm font-medium text-foreground truncate">
              {title}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatRelativeTime(updatedAt)}
            </div>
          </>
        )}
      </div>

      {/* Action buttons - visible on hover or when active */}
      {!isEditing && (
        <div className={`flex items-center gap-1 transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <button
            onClick={handleEditClick}
            className="p-1.5 rounded hover:bg-background transition-colors"
            title="Rename"
          >
            <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded hover:bg-background transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}
